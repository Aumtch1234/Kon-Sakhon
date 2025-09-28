import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'WEB_APP',
};

// app/api/chat/upload/route.js - File upload for chat
export async function POST(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '6540201131');
    const formData = await request.formData();
    
    const file = formData.get('file');
    const roomId = formData.get('roomId');
    
    if (!file || !roomId) {
      return NextResponse.json({ error: 'Missing file or room ID' }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

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

    // Save file (in a real app, you'd save to cloud storage)
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `uploads/chat/${fileName}`;
    
    // Create directory if it doesn't exist
    const fs = require('fs').promises;
    const path = require('path');
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat');
    
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(path.join(process.cwd(), 'public', filePath), buffer);

    // Insert message with file type
    const [messageResult] = await connection.execute(
      `INSERT INTO chat_messages (room_id, sender_id, content, message_type) 
       VALUES (?, ?, ?, ?)`,
      [roomId, decoded.userId, file.name, file.type.startsWith('image/') ? 'image' : 'file']
    );

    const messageId = messageResult.insertId;

    // Insert attachment record
    await connection.execute(
      `INSERT INTO chat_attachments (message_id, filename, original_name, file_size, file_type, file_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [messageId, fileName, file.name, file.size, file.type, filePath]
    );

    await connection.end();

    return NextResponse.json({
      messageId,
      fileName,
      originalName: file.name,
      fileSize: file.size,
      fileType: file.type,
      filePath: `/${filePath}`
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}