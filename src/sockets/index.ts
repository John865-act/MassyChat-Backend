import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../database';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userDisplayName?: string;
}

export function setupSocketHandlers(io: SocketIOServer) {
  // Middleware to authenticate socket connections
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    const userId = socket.handshake.auth.userId;
    const displayName = socket.handshake.auth.displayName;

    if (!userId || !displayName) {
      return next(new Error('Authentication error: userId and displayName required'));
    }

    socket.userId = userId;
    socket.userDisplayName = displayName;
    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✓ User connected: ${socket.userDisplayName} (${socket.userId})`);

    // Join conversation rooms
    socket.on('conversation:join', (data: { conversationId: string }) => {
      const roomName = `conversation:${data.conversationId}`;
      socket.join(roomName);
      console.log(`  → Joined room: ${roomName}`);
      socket.emit('joined:room', { conversationId: data.conversationId });
    });

    socket.on('conversation:leave', (data: { conversationId: string }) => {
      const roomName = `conversation:${data.conversationId}`;
      socket.leave(roomName);
      console.log(`  → Left room: ${roomName}`);
    });

    // Handle incoming messages
    socket.on('message:send', async (message: any) => {
      try {
        const messageId = uuidv4();
        const timestamp = Date.now();

        // Save to database
        await pool.query(
          `
          INSERT INTO messages (id, conversation_id, sender_id, text, status)
          VALUES ($1, $2, $3, $4, 'delivered')
          `,
          [messageId, message.conversationId, socket.userId, message.text]
        );

        // Update conversation timestamp
        await pool.query(
          `
          UPDATE conversations
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          `,
          [message.conversationId]
        );

        // Broadcast to all users in the conversation
        const roomName = `conversation:${message.conversationId}`;
        io.to(roomName).emit('message:new', {
          id: messageId,
          conversationId: message.conversationId,
          senderId: socket.userId,
          senderName: socket.userDisplayName,
          text: message.text,
          timestamp,
          status: 'delivered',
        });
      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('user:typing', (data: { conversationId: string; isTyping: boolean }) => {
      const roomName = `conversation:${data.conversationId}`;
      io.to(roomName).emit('user:typing', {
        conversationId: data.conversationId,
        userId: socket.userId,
        displayName: socket.userDisplayName,
        isTyping: data.isTyping,
      });
    });

    // Handle read receipts
    socket.on('message:markAsRead', async (data: { conversationId: string; messageIds: string[] }) => {
      try {
        // Update database
        for (const messageId of data.messageIds) {
          await pool.query(
            `
            UPDATE messages
            SET status = 'read'
            WHERE id = $1 AND sender_id != $2
            `,
            [messageId, socket.userId]
          );
        }

        // Broadcast read receipt
        const roomName = `conversation:${data.conversationId}`;
        io.to(roomName).emit('message:read', {
          conversationId: data.conversationId,
          userId: socket.userId,
          messageIds: data.messageIds,
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`✗ User disconnected: ${socket.userDisplayName} (${socket.userId})`);
    });
  });
}
