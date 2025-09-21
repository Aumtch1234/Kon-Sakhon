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

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const decoded = verifyToken(authHeader);

    const connection = await mysql.createConnection(dbConfig);

    try {
      // Get all feeds with user information, likes and comments count
      const [rows] = await connection.execute(`
        SELECT 
          p.id,
          p.content,
          p.image_url,
          p.created_at,
          p.user_id,
          u.name as user_name,
          u.email as user_email,
          u.profile_image,
          COALESCE(like_count.count, 0) as like_count,
          COALESCE(comment_count.count, 0) as comment_count,
          CASE WHEN user_likes.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN (
          SELECT post_id, COUNT(*) as count 
          FROM post_likes 
          GROUP BY post_id
        ) like_count ON p.id = like_count.post_id
        LEFT JOIN (
          SELECT post_id, COUNT(*) as count 
          FROM post_comments 
          GROUP BY post_id
        ) comment_count ON p.id = comment_count.post_id
        LEFT JOIN post_likes user_likes ON p.id = user_likes.post_id AND user_likes.user_id = ?
        ORDER BY p.created_at DESC
        LIMIT 50
      `, [decoded.userId]);

      return Response.json(rows);

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Feeds API error:', error);
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