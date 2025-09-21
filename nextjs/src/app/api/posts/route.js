import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Database configuration
const dbConfig = {
  host: 'mysql',
  user: 'root',
  password: 'root',
  database: 'WEB_APP',
  port: 3306
};

// Verify JWT token
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }
  
  const token = authHeader.substring(7);
  return jwt.verify(token, process.env.JWT_SECRET || '6540201131');
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const decoded = verifyToken(authHeader);

    const formData = await request.formData();
    const content = formData.get('content');
    const image = formData.get('image');

    if (!content || content.trim().length === 0) {
      return Response.json(
        { error: 'กรุณาใส่เนื้อหาโพสต์' },
        { status: 400 }
      );
    }

    let imageUrl = null;

    // Handle image upload if provided
    if (image && image.size > 0) {
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create unique filename
      const timestamp = Date.now();
      const extension = image.name.split('.').pop();
      const filename = `${timestamp}-${Math.random().toString(36).substring(2)}.${extension}`;
      
      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      try {
        await mkdir(uploadsDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      const filepath = path.join(uploadsDir, filename);
      await writeFile(filepath, buffer);
      
      imageUrl = `/uploads/${filename}`;
    }

    const connection = await mysql.createConnection(dbConfig);

    try {
      // Insert new post
      const [result] = await connection.execute(
        'INSERT INTO posts (user_id, content, image_url, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [decoded.userId, content.trim(), imageUrl]
      );

      return Response.json({
        message: 'โพสต์สำเร็จ',
        postId: result.insertId
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Create post error:', error);
    if (error.name === 'JsonWebTokenError') {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    return Response.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}