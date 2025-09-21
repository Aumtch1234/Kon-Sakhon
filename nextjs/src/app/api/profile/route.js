import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

// Database configuration
const dbConfig = {
  host: 'mysql',
  user: 'root',
  password: 'root',
  database: 'WEB_APP',
  port: 3306
};

const JWT_SECRET = process.env.JWT_SECRET || '6540201131';

export async function PUT(request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'ไม่พบ token การยืนยันตัวตน' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return Response.json(
        { error: 'Token ไม่ถูกต้องหรือหมดอายุ' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;

    // Parse form data
    const formData = await request.formData();
    const name = formData.get('name');
    const email = formData.get('email');
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const profileImage = formData.get('profileImage');

    // Validate input
    if (!name || !email) {
      return Response.json(
        { error: 'กรุณากรอกชื่อและอีเมล' },
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

    // Validate new password if provided
    if (newPassword && newPassword.length < 6) {
      return Response.json(
        { error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    // Handle profile image upload
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
        const fileName = `profile_${userId}_${timestamp}.${fileExtension}`;
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
      // Get current user data
      const [users] = await connection.execute(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return Response.json(
          { error: 'ไม่พบข้อมูลผู้ใช้' },
          { status: 404 }
        );
      }

      const currentUser = users[0];

      // Check if email is already used by another user
      if (email !== currentUser.email) {
        const [existingUsers] = await connection.execute(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, userId]
        );

        if (existingUsers.length > 0) {
          return Response.json(
            { error: 'อีเมลนี้ถูกใช้งานแล้ว' },
            { status: 409 }
          );
        }
      }

      // Verify current password if changing password
      if (newPassword) {
        if (!currentPassword) {
          return Response.json(
            { error: 'กรุณาใส่รหัสผ่านปัจจุบัน' },
            { status: 400 }
          );
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
        if (!isCurrentPasswordValid) {
          return Response.json(
            { error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
            { status: 400 }
          );
        }
      }

      // Prepare update data
      let updateQuery = 'UPDATE users SET name = ?, email = ?, updated_at = NOW()';
      let updateParams = [name, email];

      // Add password to update if provided
      if (newPassword) {
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        updateQuery += ', password = ?';
        updateParams.push(hashedPassword);
      }

      // Add profile image to update if provided
      if (profileImageUrl) {
        // Delete old profile image if exists
        if (currentUser.profile_image) {
          try {
            const oldImagePath = path.join(process.cwd(), 'public', currentUser.profile_image);
            await unlink(oldImagePath);
          } catch (error) {
            // Ignore error if file doesn't exist
            console.log('Old profile image not found or could not be deleted');
          }
        }

        updateQuery += ', profile_image = ?';
        updateParams.push(profileImageUrl);
      }

      updateQuery += ' WHERE id = ?';
      updateParams.push(userId);

      // Execute update
      await connection.execute(updateQuery, updateParams);

      // Get updated user data
      const [updatedUsers] = await connection.execute(
        'SELECT id, name, email, profile_image, created_at FROM users WHERE id = ?',
        [userId]
      );

      const updatedUser = updatedUsers[0];

      return Response.json({
        message: 'อัปเดตโปรไฟล์สำเร็จ',
        user: updatedUser
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Profile update error:', error);
    return Response.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}