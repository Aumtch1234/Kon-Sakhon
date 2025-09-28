// server.js - Socket.IO Server Configuration
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'WEB_APP',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Active connections storage
const activeConnections = new Map();
const userSockets = new Map();

// Socket.IO Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '6540201131');
    
    // Get user details from database
    const [users] = await pool.execute(
      'SELECT id, name, email, profile_image FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return next(new Error('User not found'));
    }

    socket.userId = decoded.userId;
    socket.user = users[0];
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  console.log(`User ${socket.user.name} connected with socket ID: ${socket.id}`);
  
  // Store user connection
  activeConnections.set(socket.id, socket.userId);
  userSockets.set(socket.userId, socket.id);

  try {
    // Update user online status
    await updateUserOnlineStatus(socket.userId, true, socket.id);
    
    // Join user to their chat rooms
    await joinUserRooms(socket);
    
    // Broadcast user online status
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      userData: socket.user
    });

  } catch (error) {
    console.error('Error during connection setup:', error);
  }

  // Handle joining a specific room
  socket.on('join_room', async (data) => {
    try {
      const { roomId } = data;
      
      // Verify user is member of this room
      const [members] = await pool.execute(
        `SELECT crm.*, u.name, u.profile_image 
         FROM chat_room_members crm 
         INNER JOIN users u ON crm.user_id = u.id
         WHERE crm.room_id = ? AND crm.user_id = ? AND crm.is_active = TRUE`,
        [roomId, socket.userId]
      );

      if (members.length === 0) {
        socket.emit('error', { message: 'Not authorized to join this room' });
        return;
      }

      socket.join(`room_${roomId}`);
      
      // Mark messages as read
      await markMessagesAsRead(roomId, socket.userId);
      
      // Get recent messages
      const messages = await getRoomMessages(roomId, 50);
      
      socket.emit('room_joined', {
        roomId,
        messages,
        members: members
      });

      // Notify other room members that user joined
      socket.to(`room_${roomId}`).emit('user_joined_room', {
        roomId,
        user: socket.user
      });

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle leaving a room
  socket.on('leave_room', (data) => {
    const { roomId } = data;
    socket.leave(`room_${roomId}`);
    
    // Notify other room members
    socket.to(`room_${roomId}`).emit('user_left_room', {
      roomId,
      user: socket.user
    });
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { roomId, content, messageType = 'text', replyTo = null } = data;

      // Verify user is member of this room
      const [members] = await pool.execute(
        'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ? AND is_active = TRUE',
        [roomId, socket.userId]
      );

      if (members.length === 0) {
        socket.emit('error', { message: 'Not authorized to send message to this room' });
        return;
      }

      // Insert message into database
      const [result] = await pool.execute(
        `INSERT INTO chat_messages (room_id, sender_id, content, message_type, reply_to) 
         VALUES (?, ?, ?, ?, ?)`,
        [roomId, socket.userId, content, messageType, replyTo]
      );

      const messageId = result.insertId;

      // Get complete message data
      const [messages] = await pool.execute(
        `SELECT cm.*, u.name as sender_name, u.profile_image as sender_avatar,
                rt.content as reply_content, ru.name as reply_sender_name
         FROM chat_messages cm
         INNER JOIN users u ON cm.sender_id = u.id
         LEFT JOIN chat_messages rt ON cm.reply_to = rt.id
         LEFT JOIN users ru ON rt.sender_id = ru.id
         WHERE cm.id = ?`,
        [messageId]
      );

      const message = messages[0];

      // Broadcast to all room members
      io.to(`room_${roomId}`).emit('new_message', {
        id: message.id,
        room_id: roomId,
        sender_id: socket.userId,
        sender_name: message.sender_name,
        sender_avatar: message.sender_avatar,
        content: message.content,
        message_type: message.message_type,
        reply_to: message.reply_to,
        reply_content: message.reply_content,
        reply_sender_name: message.reply_sender_name,
        created_at: message.created_at
      });

      // Update room's last message time
      await pool.execute(
        'UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [roomId]
      );

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicator
  socket.on('typing_start', async (data) => {
    const { roomId } = data;
    
    try {
      // Add typing record
      await pool.execute(
        `INSERT INTO chat_typing (room_id, user_id) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE started_at = CURRENT_TIMESTAMP`,
        [roomId, socket.userId]
      );

      // Notify other room members
      socket.to(`room_${roomId}`).emit('user_typing', {
        roomId,
        userId: socket.userId,
        userName: socket.user.name,
        isTyping: true
      });

    } catch (error) {
      console.error('Error handling typing start:', error);
    }
  });

  socket.on('typing_stop', async (data) => {
    const { roomId } = data;
    
    try {
      // Remove typing record
      await pool.execute(
        'DELETE FROM chat_typing WHERE room_id = ? AND user_id = ?',
        [roomId, socket.userId]
      );

      // Notify other room members
      socket.to(`room_${roomId}`).emit('user_typing', {
        roomId,
        userId: socket.userId,
        userName: socket.user.name,
        isTyping: false
      });

    } catch (error) {
      console.error('Error handling typing stop:', error);
    }
  });

  // Handle message read status
  socket.on('mark_messages_read', async (data) => {
    try {
      const { roomId } = data;
      await markMessagesAsRead(roomId, socket.userId);
      
      // Notify other room members
      socket.to(`room_${roomId}`).emit('messages_read', {
        roomId,
        userId: socket.userId,
        readAt: new Date()
      });

    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Handle getting online users
  socket.on('get_online_users', async () => {
    try {
      const [users] = await pool.execute(
        `SELECT u.id, u.name, u.profile_image, uos.is_online, uos.last_seen
         FROM users u
         LEFT JOIN user_online_status uos ON u.id = uos.user_id
         WHERE u.id != ?
         ORDER BY uos.is_online DESC, u.name ASC`,
        [socket.userId]
      );

      socket.emit('online_users', users);
    } catch (error) {
      console.error('Error getting online users:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async (reason) => {
    console.log(`User ${socket.user.name} disconnected: ${reason}`);
    
    try {
      // Update user offline status
      await updateUserOnlineStatus(socket.userId, false, null);
      
      // Clean up typing indicators
      await pool.execute(
        'DELETE FROM chat_typing WHERE user_id = ?',
        [socket.userId]
      );

      // Remove from active connections
      activeConnections.delete(socket.id);
      userSockets.delete(socket.userId);

      // Broadcast user offline status
      socket.broadcast.emit('user_offline', {
        userId: socket.userId
      });

    } catch (error) {
      console.error('Error during disconnect cleanup:', error);
    }
  });
});

// Helper Functions

async function updateUserOnlineStatus(userId, isOnline, socketId = null) {
  await pool.execute(
    `INSERT INTO user_online_status (user_id, is_online, socket_id, last_seen) 
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE 
     is_online = ?, socket_id = ?, 
     last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
    [userId, isOnline, socketId, isOnline, socketId]
  );
}

async function joinUserRooms(socket) {
  const [rooms] = await pool.execute(
    `SELECT DISTINCT crm.room_id
     FROM chat_room_members crm
     WHERE crm.user_id = ? AND crm.is_active = TRUE`,
    [socket.userId]
  );

  for (const room of rooms) {
    socket.join(`room_${room.room_id}`);
  }

  // Send user's rooms data
  const [roomsData] = await pool.execute(
    `SELECT cr.*, 
            (SELECT COUNT(*) FROM chat_room_members WHERE room_id = cr.id AND is_active = TRUE) as member_count,
            GetUnreadMessageCount(cr.id, ?) as unread_count
     FROM chat_rooms cr
     INNER JOIN chat_room_members crm ON cr.id = crm.room_id
     WHERE crm.user_id = ? AND crm.is_active = TRUE
     ORDER BY cr.updated_at DESC`,
    [socket.userId, socket.userId]
  );

  socket.emit('user_rooms', roomsData);
}

async function markMessagesAsRead(roomId, userId) {
  await pool.execute('CALL MarkMessagesAsRead(?, ?)', [roomId, userId]);
}

async function getRoomMessages(roomId, limit = 50) {
  const [messages] = await pool.execute(
    `SELECT cm.*, u.name as sender_name, u.profile_image as sender_avatar,
            rt.content as reply_content, ru.name as reply_sender_name
     FROM chat_messages cm
     INNER JOIN users u ON cm.sender_id = u.id
     LEFT JOIN chat_messages rt ON cm.reply_to = rt.id
     LEFT JOIN users ru ON rt.sender_id = ru.id
     WHERE cm.room_id = ? AND cm.is_deleted = FALSE
     ORDER BY cm.created_at DESC
     LIMIT ?`,
    [roomId, limit]
  );

  return messages.reverse();
}

// Clean up old typing indicators (run every 30 seconds)
setInterval(async () => {
  try {
    await pool.execute(
      'DELETE FROM chat_typing WHERE started_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)'
    );
  } catch (error) {
    console.error('Error cleaning up typing indicators:', error);
  }
}, 30000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});

module.exports = { app, io, server };