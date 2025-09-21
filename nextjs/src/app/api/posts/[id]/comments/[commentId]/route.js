import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

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

// DELETE - ลบคอมเมนต์
export async function DELETE(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    const decoded = verifyToken(authHeader);
    const { id: postId, commentId } = params;

    const connection = await mysql.createConnection(dbConfig);

    try {
      // ตรวจสอบว่าคอมเมนต์มีอยู่และเป็นของ user นี้
      const [rows] = await connection.execute(
        'SELECT id, user_id FROM post_comments WHERE id = ? AND post_id = ?',
        [commentId, postId]
      );

      if (rows.length === 0) {
        return Response.json(
          { error: 'ไม่พบความคิดเห็นที่ต้องการลบ' },
          { status: 404 }
        );
      }

      const comment = rows[0];

      if (comment.user_id !== decoded.userId) {
        return Response.json(
          { error: 'คุณไม่มีสิทธิ์ลบความคิดเห็นนี้' },
          { status: 403 }
        );
      }

      // ลบคอมเมนต์
      await connection.execute('DELETE FROM post_comments WHERE id = ?', [commentId]);

      return Response.json({
        message: 'ลบความคิดเห็นสำเร็จ'
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Delete comment error:', error);
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