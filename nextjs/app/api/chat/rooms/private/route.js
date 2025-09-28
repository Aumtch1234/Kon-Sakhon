// app/api/chat/rooms/private/route.js - Create private chat room
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'WEB_APP',
};

export async function POST(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '6540201131');
    const { userId: otherUserId } = await request.json();
    
    if (!otherUserId || otherUserId === decoded.userId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const connection = await mysql.createConnection(dbConfig);

    // Use stored procedure to create private chat
    const [result] = await connection.execute(
      'CALL CreatePrivateChat(?, ?)',
      [decoded.userId, otherUserId]
    );

    const roomData = result[0][0];

    if (roomData.status === 'existing' || roomData.status === 'created') {
      // Get complete room information
      const [rooms] = await connection.execute(
        `SELECT 
          cr.id,
          u.name,
          u.profile_image as avatar,
          cr.type,
          cr.created_at,
          uos.is_online as online
        FROM chat_rooms cr
        INNER JOIN chat_room_members crm ON cr.id = crm.room_id
        INNER JOIN users u ON crm.user_id = u.id
        LEFT JOIN user_online_status uos ON u.id = uos.user_id
        WHERE cr.id = ? AND crm.user_id != ?`,
        [roomData.room_id, decoded.userId]
      );

      await connection.end();
      return NextResponse.json({
        ...rooms[0],
        id: roomData.room_id,
        status: roomData.status
      });
    } else {
      await connection.end();
      return NextResponse.json({ error: 'Failed to create chat room' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error creating private chat:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}