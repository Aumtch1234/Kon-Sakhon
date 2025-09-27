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

// POST - Toggle like (ไลค์/ยกเลิกไลค์)
export async function POST(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    const decoded = verifyToken(authHeader);
    const postId = params.id;

    const connection = await mysql.createConnection(dbConfig);

    try {
      // ตรวจสอบว่าโพสต์มีอยู่จริง
      const [postCheck] = await connection.execute(
        'SELECT id FROM posts WHERE id = ?',
        [postId]
      );

      if (postCheck.length === 0) {
        return Response.json(
          { error: 'ไม่พบโพสต์ที่ต้องการกดไลค์' },
          { status: 404 }
        );
      }

      // ตรวจสอบว่าเคยไลค์แล้วหรือยัง
      const [existingLike] = await connection.execute(
        'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?',
        [decoded.userId, postId]
      );

      let isLiked;
      
      if (existingLike.length > 0) {
        // ยกเลิกไลค์
        await connection.execute(
          'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
          [decoded.userId, postId]
        );
        isLiked = false;
      } else {
        // เพิ่มไลค์
        await connection.execute(
          'INSERT INTO post_likes (user_id, post_id, created_at) VALUES (?, ?, NOW())',
          [decoded.userId, postId]
        );
        isLiked = true;
      }

      // นับจำนวนไลค์ทั้งหมด
      const [likeCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?',
        [postId]
      );

      return Response.json({
        message: isLiked ? 'ไลค์โพสต์แล้ว' : 'ยกเลิกไลค์แล้ว',
        isLiked,
        likeCount: likeCount[0].count
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Like toggle error:', error);
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

// GET - ดึงสถานะไลค์และจำนวน
export async function GET(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    const decoded = verifyToken(authHeader);
    const postId = params.id;

    const connection = await mysql.createConnection(dbConfig);

    try {
      // ตรวจสอบว่าเคยไลค์หรือไม่
      const [userLike] = await connection.execute(
        'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?',
        [decoded.userId, postId]
      );

      // นับจำนวนไลค์ทั้งหมด
      const [likeCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?',
        [postId]
      );

      return Response.json({
        isLiked: userLike.length > 0,
        likeCount: likeCount[0].count
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Get like status error:', error);
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