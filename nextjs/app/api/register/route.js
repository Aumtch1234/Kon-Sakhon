import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
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

export async function POST(request) {
  try {
    const formData = await request.formData();
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const profileImage = formData.get('profileImage');

    // Validate input
    if (!name || !email || !password) {
      return Response.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return Response.json(
        { error: 'รหัสผ่านไม่ตรงกัน' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: 'รูปแบบอีเมลไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Validate profile image if provided
    let profileImageUrl = null;
    if (profileImage && profileImage.size > 0) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(profileImage.type)) {
        return Response.json(
          { error: 'รูปภาพต้องเป็นไฟล์ JPEG, PNG, GIF หรือ WebP เท่านั้น' },
          { status: 400 }
        );
      }

      if (profileImage.size > maxSize) {
        return Response.json(
          { error: 'รูปภาพต้องมีขนาดไม่เกิน 5MB' },
          { status: 400 }
        );
      }

      try {
        // สร้างโฟลเดอร์ uploads หากไม่มี
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
        await mkdir(uploadDir, { recursive: true });

        // สร้างชื่อไฟล์ที่ไม่ซ้ำ
        const timestamp = Date.now();
        const fileExtension = profileImage.name.split('.').pop();
        const fileName = `profile_${timestamp}.${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);

        // บันทึกไฟล์
        const bytes = await profileImage.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        profileImageUrl = `/uploads/profiles/${fileName}`;
      } catch (error) {
        console.error('Error uploading profile image:', error);
        return Response.json(
          { error: 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' },
          { status: 500 }
        );
      }
    }

    // Connect to database
    const connection = await mysql.createConnection(dbConfig);

    try {
      // Check if user already exists
      const [existingUsers] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUsers.length > 0) {
        return Response.json(
          { error: 'อีเมลนี้ถูกใช้งานแล้ว' },
          { status: 409 }
        );
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert new user
      const [result] = await connection.execute(
        'INSERT INTO users (name, email, password, profile_image, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [name, email, hashedPassword, profileImageUrl]
      );

      return Response.json({
        message: 'สร้างบัญชีสำเร็จ กรุณาเข้าสู่ระบบ',
        userId: result.insertId
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Register error:', error);
    return Response.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}