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

// GET - ดึงคอมเมนต์ทั้งหมดของโพสต์
export async function GET(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    const decoded = verifyToken(authHeader);

    // ✅ ต้อง await
    const { id: postId } = await params;

    const connection = await mysql.createConnection(dbConfig);

    try {
      const [rows] = await connection.execute(`
        SELECT 
          c.id,
          c.content,
          c.created_at,
          c.updated_at,
          u.id as user_id,
          u.name as user_name,
          u.profile_image
        FROM post_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
      `, [postId]);

      return Response.json(rows);

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Get comments error:', error);
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

// POST - เพิ่มคอมเมนต์ใหม่
export async function POST(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    const decoded = verifyToken(authHeader);

    // ✅ ต้อง await
    const { id: postId } = await params;

    const { content } = await request.json();

    if (!content || content.trim().length === 0) {
      return Response.json(
        { error: 'กรุณาใส่เนื้อหาคอมเมนต์' },
        { status: 400 }
      );
    }

    const connection = await mysql.createConnection(dbConfig);

    try {
      // ตรวจสอบว่าโพสต์มีอยู่จริง
      const [postCheck] = await connection.execute(
        'SELECT id FROM posts WHERE id = ?',
        [postId]
      );

      if (postCheck.length === 0) {
        return Response.json(
          { error: 'ไม่พบโพสต์ที่ต้องการแสดงความคิดเห็น' },
          { status: 404 }
        );
      }

      // เพิ่มคอมเมนต์
      const [result] = await connection.execute(
        'INSERT INTO post_comments (user_id, post_id, content, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [decoded.userId, postId, content.trim()]
      );

      // ดึงคอมเมนต์ที่เพิ่งสร้าง
      const [newComment] = await connection.execute(`
        SELECT 
          c.id,
          c.content,
          c.created_at,
          c.updated_at,
          u.id as user_id,
          u.name as user_name,
          profile_image
        FROM post_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `, [result.insertId]);

      return Response.json({
        message: 'เพิ่มความคิดเห็นสำเร็จ',
        comment: newComment[0]
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Create comment error:', error);
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
