import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const dbConfig = {
  host: 'mysql',
  user: 'root',
  password: 'root',
  database: 'WEB_APP',
  port: 3306
};

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 });
    }

    const connection = await mysql.createConnection(dbConfig);
    try {
      const [rows] = await connection.execute('SELECT id, email, password, profile_image, name FROM users WHERE email = ?', [email]);
      if (!rows.length) return Response.json({ error: 'ไม่พบบัญชีผู้ใช้งาน' }, { status: 401 });

      const user = rows[0];
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return Response.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });

      const token = jwt.sign({ userId: user.id, email: user.email, profile_image: user.profile_image, name: user.name }, process.env.JWT_SECRET || '6540201131', { expiresIn: '24h' });

      await connection.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

      return Response.json({ message: 'เข้าสู่ระบบสำเร็จ', token, user: { id: user.id, email: user.email, profile_image: user.profile_image, name: user.name } });

    } finally {
      await connection.end();
    }
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
  }
}
