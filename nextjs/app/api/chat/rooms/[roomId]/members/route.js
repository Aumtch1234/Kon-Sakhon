import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'WEB_APP',
};

// app/api/chat/rooms/[roomId]/members/route.js - Get room members
export async function GET(request, { params }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '6540201131');
    const { roomId } = params;

    const connection = await mysql.createConnection(dbConfig);

    // Verify user is member of this room
    const [memberCheck] = await connection.execute(
      'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ? AND is_active = TRUE',
      [roomId, decoded.userId]
    );

    if (memberCheck.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get room members
    const [members] = await connection.execute(
      `SELECT 
        crm.user_id,
        crm.role,
        crm.joined_at,
        crm.last_seen_at,
        u.name,
        u.email,
        u.profile_image,
        uos.is_online,
        uos.last_seen
      FROM chat_room_members crm
      INNER JOIN users u ON crm.user_id = u.id
      LEFT JOIN user_online_status uos ON u.id = uos.user_id
      WHERE crm.room_id = ? AND crm.is_active = TRUE
      ORDER BY crm.role DESC, u.name ASC`,
      [roomId]
    );

    await connection.end();
    return NextResponse.json(members);

  } catch (error) {
    console.error('Error fetching room members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}