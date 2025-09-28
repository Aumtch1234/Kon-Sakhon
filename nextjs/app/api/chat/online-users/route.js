import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'WEB_APP',
};

// app/api/chat/online-users/route.js - Get online users
export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '6540201131');
    const connection = await mysql.createConnection(dbConfig);

    const [users] = await connection.execute(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.profile_image,
        COALESCE(uos.is_online, FALSE) as is_online,
        uos.last_seen,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM chat_rooms cr
            INNER JOIN chat_room_members crm1 ON cr.id = crm1.room_id AND crm1.user_id = ?
            INNER JOIN chat_room_members crm2 ON cr.id = crm2.room_id AND crm2.user_id = u.id
            WHERE cr.type = 'private'
            AND (SELECT COUNT(*) FROM chat_room_members WHERE room_id = cr.id AND is_active = TRUE) = 2
          ) THEN TRUE
          ELSE FALSE
        END as has_chat
      FROM users u
      LEFT JOIN user_online_status uos ON u.id = uos.user_id
      WHERE u.id != ?
      ORDER BY uos.is_online DESC, u.name ASC`,
      [decoded.userId, decoded.userId]
    );

    await connection.end();
    return NextResponse.json(users);

  } catch (error) {
    console.error('Error fetching online users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}