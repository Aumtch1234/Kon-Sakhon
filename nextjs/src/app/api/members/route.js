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
      // Get all members except current user
      const [rows] = await connection.execute(`
        SELECT 
          id,
          name,
          email,
          profile_image,
          last_login,
          created_at
        FROM users 
        WHERE status = 'active'
        ORDER BY last_login DESC, created_at DESC
      `);

      return Response.json(rows);

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Members API error:', error);
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