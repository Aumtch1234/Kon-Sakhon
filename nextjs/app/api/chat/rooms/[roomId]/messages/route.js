import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'WEB_APP',
};

export async function GET(request, { params }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '6540201131');
    const { roomId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;

    const connection = await mysql.createConnection(dbConfig);

    // Verify user is member of this room
    const [members] = await connection.execute(
      'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ? AND is_active = TRUE',
      [roomId, decoded.userId]
    );

    if (members.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get messages
    const [messages] = await connection.execute(
      `SELECT 
        cm.id,
        cm.content,
        cm.message_type,
        cm.reply_to,
        cm.is_edited,
        cm.created_at,
        cm.updated_at,
        u.id as sender_id,
        u.name as sender_name,
        u.profile_image as sender_avatar,
        rt.content as reply_content,
        ru.name as reply_sender_name,
        (
          SELECT COUNT(*) 
          FROM chat_message_reads 
          WHERE message_id = cm.id
        ) as read_count
      FROM chat_messages cm
      INNER JOIN users u ON cm.sender_id = u.id
      LEFT JOIN chat_messages rt ON cm.reply_to = rt.id
      LEFT JOIN users ru ON rt.sender_id = ru.id
      WHERE cm.room_id = ? AND cm.is_deleted = FALSE
      ORDER BY cm.created_at DESC
      LIMIT ? OFFSET ?`,
      [roomId, limit, offset]
    );

    // Get attachments for messages that have them
    const messageIds = messages.map(m => m.id);
    let attachments = [];
    
    if (messageIds.length > 0) {
      const [attachmentResults] = await connection.execute(
        `SELECT * FROM chat_attachments WHERE message_id IN (${messageIds.map(() => '?').join(',')})`,
        messageIds
      );
      attachments = attachmentResults;
    }

    // Combine messages with attachments
    const messagesWithAttachments = messages.reverse().map(message => ({
      ...message,
      attachments: attachments.filter(a => a.message_id === message.id)
    }));

    await connection.end();
    return NextResponse.json(messagesWithAttachments);

  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}