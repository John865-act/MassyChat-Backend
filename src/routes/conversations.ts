import express, { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../database';
import { Server as SocketIOServer } from 'socket.io';

export default function conversationRoutes(io: SocketIOServer): Router {
  const router: Router = express.Router();

  // Get all conversations for a user
  router.get('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await pool.query(
        `
        SELECT DISTINCT c.id, c.created_at, c.updated_at,
               ARRAY_AGG(u.id) as participant_ids,
               ARRAY_AGG(u.display_name) as participant_names,
               (
                 SELECT json_build_object(
                   'id', m.id,
                   'conversationId', m.conversation_id,
                   'senderId', m.sender_id,
                   'senderName', u2.display_name,
                   'text', m.text,
                   'timestamp', EXTRACT(EPOCH FROM m.created_at) * 1000,
                   'status', m.status
                 )
                 FROM messages m
                 LEFT JOIN users u2 ON m.sender_id = u2.id
                 WHERE m.conversation_id = c.id
                 ORDER BY m.created_at DESC
                 LIMIT 1
               ) as last_message
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = $1
        GROUP BY c.id, c.created_at, c.updated_at
        ORDER BY c.updated_at DESC
        `,
        [req.user.id]
      );

      const conversations = result.rows.map((row) => ({
        id: row.id,
        participantIds: row.participant_ids,
        participantNames: row.participant_names,
        lastMessage: row.last_message,
        updatedAt: new Date(row.updated_at).getTime(),
      }));

      res.json(conversations);
    } catch (error: any) {
      console.error('Get conversations error:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // Create a new conversation
  router.post('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { participantIds } = req.body;

      if (!participantIds || !Array.isArray(participantIds)) {
        return res.status(400).json({ error: 'participantIds array is required' });
      }

      const conversationId = uuidv4();
      const allParticipants = [...new Set([req.user.id, ...participantIds])];

      await pool.query('INSERT INTO conversations (id) VALUES ($1)', [conversationId]);

      for (const participantId of allParticipants) {
        await pool.query(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
          [conversationId, participantId]
        );
      }

      res.status(201).json({ id: conversationId });
    } catch (error: any) {
      console.error('Create conversation error:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });

  // Get single conversation
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const result = await pool.query(
        `
        SELECT c.id, c.created_at, c.updated_at,
               ARRAY_AGG(u.id) as participant_ids,
               ARRAY_AGG(u.display_name) as participant_names
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        JOIN users u ON cp.user_id = u.id
        WHERE c.id = $1
        GROUP BY c.id, c.created_at, c.updated_at
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const row = result.rows[0];
      res.json({
        id: row.id,
        participantIds: row.participant_ids,
        participantNames: row.participant_names,
        updatedAt: new Date(row.updated_at).getTime(),
      });
    } catch (error: any) {
      console.error('Get conversation error:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  return router;
}
