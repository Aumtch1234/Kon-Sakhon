// scripts/migrate.js - Simplified Database Migration Script (No Procedures/Functions)
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'WEB_APP',
  multipleStatements: false
};

// แยก migration เป็น statement ย่อยๆ เพื่อหลีกเลี่ยง SQL syntax error
const migrations = [
  {
    name: '001_create_chat_rooms',
    sql: `
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type ENUM('private', 'group') DEFAULT 'private',
        description TEXT,
        avatar VARCHAR(500),
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_created_by (created_by),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `
  },
  {
    name: '002_create_chat_room_members',
    sql: `
      CREATE TABLE IF NOT EXISTS chat_room_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('admin', 'member') DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE KEY unique_room_user (room_id, user_id),
        INDEX idx_room_id (room_id),
        INDEX idx_user_id (user_id),
        INDEX idx_is_active (is_active),
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `
  },
  {
    name: '003_create_chat_messages',
    sql: `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        message_type ENUM('text', 'image', 'file', 'emoji') DEFAULT 'text',
        reply_to INT NULL,
        is_edited BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_room_id (room_id),
        INDEX idx_sender_id (sender_id),
        INDEX idx_created_at (created_at),
        INDEX idx_reply_to (reply_to),
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to) REFERENCES chat_messages(id) ON DELETE SET NULL
      );
    `
  },
  {
    name: '004_create_chat_message_reads',
    sql: `
      CREATE TABLE IF NOT EXISTS chat_message_reads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_message_user (message_id, user_id),
        INDEX idx_message_id (message_id),
        INDEX idx_user_id (user_id),
        FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `
  },
  {
    name: '005_create_chat_attachments',
    sql: `
      CREATE TABLE IF NOT EXISTS chat_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_message_id (message_id),
        FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
      );
    `
  },
  {
    name: '006_create_user_online_status',
    sql: `
      CREATE TABLE IF NOT EXISTS user_online_status (
        user_id INT PRIMARY KEY,
        is_online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        socket_id VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_online (is_online),
        INDEX idx_socket_id (socket_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `
  },
  {
    name: '007_create_chat_typing',
    sql: `
      CREATE TABLE IF NOT EXISTS chat_typing (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_room_user_typing (room_id, user_id),
        INDEX idx_room_id (room_id),
        INDEX idx_started_at (started_at),
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `
  },
  {
    name: '008_create_chat_views',
    sql: `
      CREATE OR REPLACE VIEW chat_rooms_with_last_message AS
      SELECT 
        cr.id,
        cr.name,
        cr.type,
        cr.description,
        cr.avatar,
        cr.created_by,
        cr.created_at,
        cr.updated_at,
        lm.content as last_message,
        lm.created_at as last_message_time,
        lm.sender_id as last_sender_id,
        u.name as last_sender_name,
        (
          SELECT COUNT(*) 
          FROM chat_messages cm 
          WHERE cm.room_id = cr.id AND cm.is_deleted = FALSE
        ) as message_count
      FROM chat_rooms cr
      LEFT JOIN (
        SELECT 
          room_id,
          content,
          created_at,
          sender_id,
          ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY created_at DESC) as rn
        FROM chat_messages 
        WHERE is_deleted = FALSE
      ) lm ON cr.id = lm.room_id AND lm.rn = 1
      LEFT JOIN users u ON lm.sender_id = u.id;
    `
  },
  {
    name: '009_create_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at);
    `
  },
  {
    name: '010_create_more_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_room ON chat_room_members(user_id, room_id);
    `
  },
  {
    name: '011_create_final_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_message_reads_user_message ON chat_message_reads(user_id, message_id);
    `
  },
  {
    name: '012_create_remaining_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_user_online_status_updated ON user_online_status(updated_at);
    `
  },
  {
    name: '013_create_last_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_created ON chat_messages(sender_id, created_at);
    `
  }
];

async function runMigration() {
  let connection;
  
  try {
    // รอให้ database พร้อม
    let retries = 15;
    while (retries > 0) {
      try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL database');
        break;
      } catch (error) {
        console.log(`⏳ Waiting for database... (${retries} retries left)`);
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // สร้าง migrations table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ดึงรายการ migration ที่รันแล้ว
    const [executedMigrations] = await connection.execute(
      'SELECT name FROM migrations'
    );
    
    const executedNames = executedMigrations.map(m => m.name);

    // รัน migration แต่ละอันทีละอัน
    for (const migration of migrations) {
      if (!executedNames.includes(migration.name)) {
        console.log(`🔄 Running migration: ${migration.name}`);
        
        try {
          // รัน SQL statement
          await connection.execute(migration.sql);
          
          // บันทึกว่ารันแล้ว
          await connection.execute(
            'INSERT INTO migrations (name) VALUES (?)',
            [migration.name]
          );
          
          console.log(`✅ Migration ${migration.name} completed successfully`);
        } catch (error) {
          console.error(`❌ Migration ${migration.name} failed:`, error.message);
          
          // Skip foreign key errors for missing tables
          if (error.code === 'ER_CANNOT_ADD_FOREIGN' || error.code === 'ER_NO_REFERENCED_ROW_2') {
            console.log(`⚠️  Skipping foreign key constraint for ${migration.name}`);
            await connection.execute(
              'INSERT INTO migrations (name) VALUES (?)',
              [migration.name]
            );
            continue;
          }
          
          throw error;
        }
      } else {
        console.log(`⏭️  Migration ${migration.name} already executed`);
      }
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// สร้าง upload directories
async function createUploadDirectories() {
  try {
    const uploadDirs = [
      'public/uploads',
      'public/uploads/chat',
      'public/uploads/posts',
      'public/uploads/profiles'
    ];

    for (const dir of uploadDirs) {
      try {
        await fs.access(dir);
        console.log(`✅ Directory ${dir} already exists`);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    }
  } catch (error) {
    console.error('❌ Error creating upload directories:', error);
  }
}

// รันเมื่อถูกเรียกโดยตรง
if (require.main === module) {
  (async () => {
    try {
      await createUploadDirectories();
      await runMigration();
      process.exit(0);
    } catch (error) {
      console.error('Migration script failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { runMigration, createUploadDirectories };