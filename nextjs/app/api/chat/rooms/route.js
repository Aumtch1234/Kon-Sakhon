// app/api/chat/rooms/route.js - Get user's chat rooms
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'WEB_APP',
};

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '6540201131');
    const connection = await mysql.createConnection(dbConfig);

    const [rooms] = await connection.execute(
      `SELECT 
        cr.id,
        CASE 
          WHEN cr.type = 'private' THEN (
            SELECT u.name 
            FROM chat_room_members crm2 
            INNER JOIN users u ON crm2.user_id = u.id 
            WHERE crm2.room_id = cr.id AND crm2.user_id != ? 
            LIMIT 1
          )
          ELSE cr.name 
        END as name,
        cr.type,
        cr.description,
        CASE 
          WHEN cr.type = 'private' THEN (
            SELECT u.profile_image 
            FROM chat_room_members crm2 
            INNER JOIN users u ON crm2.user_id = u.id 
            WHERE crm2.room_id = cr.id AND crm2.user_id != ? 
            LIMIT 1
          )
          ELSE cr.avatar 
        END as avatar,
        cr.created_at,
        cr.updated_at,
        lm.content as last_message,
        lm.created_at as last_message_time,
        lm.sender_id as last_sender_id,
        CASE 
          WHEN lm.sender_id = ? THEN 'คุณ'
          ELSE u.name 
        END as last_sender_name,
        GetUnreadMessageCount(cr.id, ?) as unread_count,
        (
          SELECT COUNT(*) 
          FROM chat_room_members 
          WHERE room_id = cr.id AND is_active = TRUE
        ) as member_count,
        CASE 
          WHEN cr.type = 'private' THEN (
            SELECT uos.is_online 
            FROM chat_room_members crm2 
            INNER JOIN user_online_status uos ON crm2.user_id = uos.user_id
            WHERE crm2.room_id = cr.id AND crm2.user_id != ? 
            LIMIT 1
          )
          ELSE FALSE 
        END as online
      FROM chat_rooms cr
      INNER JOIN chat_room_members crm ON cr.id = crm.room_id
      LEFT JOIN (
        SELECT 
          room_id,
          content,
          created_at,
          sender_id,
          ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY created_at DESC) as rn
        FROM chat_messages 
        WHERE is_deleted = FALSE
      ) lm ON cr.id = lm.room_id AND lm.rn = 1
      LEFT JOIN users u ON lm.sender_id = u.id
      WHERE crm.user_id = ? AND crm.is_active = TRUE
      ORDER BY 
        CASE WHEN lm.created_at IS NOT NULL THEN lm.created_at ELSE cr.created_at END DESC`,
      [decoded.userId, decoded.userId, decoded.userId, decoded.userId, decoded.userId, decoded.userId]
    );

    await connection.end();
    return NextResponse.json(rooms);

  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}