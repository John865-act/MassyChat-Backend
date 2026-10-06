import express, { Router, Request, Response } from 'express';
import pool from '../database';

const router: Router = express.Router();

// Get messages for a conversation
router.get('/conversation/:conversationId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { conversationId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await pool.query(
      `
      SELECT m.id, m.conversation_id, m.sender_id, u.display_name as sender_name,
             u.photo_url as sender_photo, m.text,
             EXTRACT(EPOCH FROM m.created_at) * 1000 as timestamp,
             m.status
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
      `,
      [conversationId, limit, offset]
    );

    const messages = result.rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderPhoto: row.sender_photo,
      text: row.text,
      timestamp: parseInt(row.timestamp),
      status: row.status,
    }));

    res.json(messages);
  } catch (error: any) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark conversation as read
router.post('/conversation/:conversationId/read', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { conversationId } = req.params;

    await pool.query(
      `
      UPDATE messages
      SET status = 'read'
      WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'
      `,
      [conversationId, req.user.id]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

export default router;
