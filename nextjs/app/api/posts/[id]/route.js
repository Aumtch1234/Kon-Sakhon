import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { unlink } from 'fs/promises';
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

export async function DELETE(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    const decoded = verifyToken(authHeader);
    const postId = params.id;

    const connection = await mysql.createConnection(dbConfig);

    try {
      // Check if post exists and belongs to current user
      const [rows] = await connection.execute(
        'SELECT id, user_id, image_url FROM posts WHERE id = ?',
        [postId]
      );

      if (rows.length === 0) {
        return Response.json(
          { error: 'ไม่พบโพสต์ที่ต้องการลบ' },
          { status: 404 }
        );
      }

      const post = rows[0];

      if (post.user_id !== decoded.userId) {
        return Response.json(
          { error: 'คุณไม่มีสิทธิ์ลบโพสต์นี้' },
          { status: 403 }
        );
      }

      // Delete image file if exists
      if (post.image_url) {
        try {
          const imagePath = path.join(process.cwd(), 'public', post.image_url);
          await unlink(imagePath);
        } catch (error) {
          console.error('Error deleting image file:', error);
          // Continue even if image deletion fails
        }
      }

      // Delete post from database
      await connection.execute('DELETE FROM posts WHERE id = ?', [postId]);

      return Response.json({
        message: 'ลบโพสต์สำเร็จ'
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Delete post error:', error);
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