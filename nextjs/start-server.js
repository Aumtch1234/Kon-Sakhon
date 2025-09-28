// start-server.js - Simple version without migration
require('dotenv').config();

// Server configuration
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection pool
const dbConfig = {
  host: 'mysql',
  user: 'root',
  password: 'root',
  database: 'WEB_APP',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// Socket.IO configuration
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Active connections storage
const activeConnections = new Map();
const userSockets = new Map();
const roomMembers = new Map();

// Create upload directories
const createUploadDirectories = () => {
  const uploadDirs = [
    'public/uploads',
    'public/uploads/chat',
    'public/uploads/posts',
    'public/uploads/profiles'
  ];

  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
};

// Utility functions
const updateUserOnlineStatus = async (userId, isOnline, socketId = null) => {
  try {
    await pool.execute(
      `INSERT INTO user_online_status (user_id, is_online, socket_id, last_seen) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE 
       is_online = ?, socket_id = ?, 
       last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
      [userId, isOnline, socketId, isOnline, socketId]
    );
  } catch (error) {
    console.error('Error updating user online status:', error);
  }
};

const joinUserRooms = async (socket) => {
  try {
    const [rooms] = await pool.execute(
      `SELECT DISTINCT crm.room_id, cr.name, cr.type
       FROM chat_room_members crm
       INNER JOIN chat_rooms cr ON crm.room_id = cr.id
       WHERE crm.user_id = ? AND crm.is_active = TRUE`,
      [socket.userId]
    );

    const roomData = [];
    for (const room of rooms) {
      socket.join(`room_${room.room_id}`);
      
      if (!roomMembers.has(room.room_id)) {
        roomMembers.set(room.room_id, new Set());
      }
      roomMembers.get(room.room_id).add(socket.userId);

      // Get unread count
      const [unreadCount] = await pool.execute(
        `SELECT COUNT(*) as unread_count
         FROM chat_messages cm
         LEFT JOIN chat_message_reads cmr ON cm.id = cmr.message_id AND cmr.user_id = ?
         WHERE cm.room_id = ? 
         AND cm.sender_id != ? 
         AND cmr.id IS NULL
         AND cm.is_deleted = FALSE`,
        [socket.userId, room.room_id, socket.userId]
      );

      const [roomDetails] = await pool.execute(
        `SELECT cr.*, 
                (SELECT COUNT(*) FROM chat_room_members WHERE room_id = cr.id AND is_active = TRUE) as member_count
         FROM chat_rooms cr
         WHERE cr.id = ?`,
        [room.room_id]
      );

      if (roomDetails.length > 0) {
        roomDetails[0].unread_count = unreadCount[0].unread_count;
        roomData.push(roomDetails[0]);
      }
    }

    socket.emit('user_rooms', roomData);
  } catch (error) {
    console.error('Error joining user rooms:', error);
  }
};

const markMessagesAsRead = async (roomId, userId) => {
  try {
    await pool.execute(
      `INSERT INTO chat_message_reads (message_id, user_id)
       SELECT cm.id, ?
       FROM chat_messages cm
       LEFT JOIN chat_message_reads cmr ON cm.id = cmr.message_id AND cmr.user_id = ?
       WHERE cm.room_id = ? 
       AND cm.sender_id != ? 
       AND cmr.id IS NULL
       AND cm.is_deleted = FALSE`,
      [userId, userId, roomId, userId]
    );

    await pool.execute(
      'UPDATE chat_room_members SET last_seen_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
};

const getRoomMessages = async (roomId, limit = 50, offset = 0) => {
  try {
    const [messages] = await pool.execute(
      `SELECT cm.*, u.name as sender_name, u.profile_image as sender_avatar,
              rt.content as reply_content, ru.name as reply_sender_name
       FROM chat_messages cm
       INNER JOIN users u ON cm.sender_id = u.id
       LEFT JOIN chat_messages rt ON cm.reply_to = rt.id
       LEFT JOIN users ru ON rt.sender_id = ru.id
       WHERE cm.room_id = ? AND cm.is_deleted = FALSE
       ORDER BY cm.created_at DESC
       LIMIT ? OFFSET ?`,
      [roomId, limit, offset]
    );

    return messages.reverse();
  } catch (error) {
    console.error('Error getting room messages:', error);
    return [];
  }
};

const createPrivateChat = async (user1Id, user2Id) => {
  try {
    const [existingRooms] = await pool.execute(
      `SELECT cr.id
       FROM chat_rooms cr
       INNER JOIN chat_room_members crm1 ON cr.id = crm1.room_id AND crm1.user_id = ?
       INNER JOIN chat_room_members crm2 ON cr.id = crm2.room_id AND crm2.user_id = ?
       WHERE cr.type = 'private'
       AND (SELECT COUNT(*) FROM chat_room_members WHERE room_id = cr.id AND is_active = TRUE) = 2
       LIMIT 1`,
      [user1Id, user2Id]
    );

    if (existingRooms.length > 0) {
      return { room_id: existingRooms[0].id, status: 'existing' };
    }

    const [roomResult] = await pool.execute(
      'INSERT INTO chat_rooms (name, type, created_by) VALUES (?, ?, ?)',
      ['Private Chat', 'private', user1Id]
    );

    const roomId = roomResult.insertId;

    await pool.execute(
      'INSERT INTO chat_room_members (room_id, user_id, role) VALUES (?, ?, ?), (?, ?, ?)',
      [roomId, user1Id, 'admin', roomId, user2Id, 'member']
    );

    return { room_id: roomId, status: 'created' };
  } catch (error) {
    console.error('Error creating private chat:', error);
    throw error;
  }
};

// Socket.IO Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '6540201131');
    
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
    next(new Error(`Authentication error: ${error.message}`));
  }
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log(`[${new Date().toISOString()}] User ${socket.user.name} (ID: ${socket.userId}) connected`);
  
  activeConnections.set(socket.id, {
    userId: socket.userId,
    user: socket.user,
    connectedAt: new Date()
  });
  userSockets.set(socket.userId, socket.id);

  try {
    await updateUserOnlineStatus(socket.userId, true, socket.id);
    await joinUserRooms(socket);
    
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      userData: socket.user
    });
  } catch (error) {
    console.error('Error during connection setup:', error);
    socket.emit('error', { message: 'Failed to initialize connection' });
  }

  // Handle creating private chat
  socket.on('create_private_chat', async (data) => {
    try {
      const { targetUserId } = data;
      
      if (!targetUserId) {
        socket.emit('error', { message: 'Target user ID is required' });
        return;
      }

      const result = await createPrivateChat(socket.userId, targetUserId);
      socket.emit('private_chat_created', result);
    } catch (error) {
      console.error('Error creating private chat:', error);
      socket.emit('error', { message: 'Failed to create private chat' });
    }
  });

  // Handle joining a room
  socket.on('join_room', async (data) => {
    try {
      const { roomId } = data;
      
      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

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
      
      if (!roomMembers.has(roomId)) {
        roomMembers.set(roomId, new Set());
      }
      roomMembers.get(roomId).add(socket.userId);

      await markMessagesAsRead(roomId, socket.userId);
      
      const messages = await getRoomMessages(roomId, 50);
      
      const [allMembers] = await pool.execute(
        `SELECT crm.*, u.name, u.profile_image, uos.is_online
         FROM chat_room_members crm
         INNER JOIN users u ON crm.user_id = u.id
         LEFT JOIN user_online_status uos ON u.id = uos.user_id
         WHERE crm.room_id = ? AND crm.is_active = TRUE`,
        [roomId]
      );
      
      socket.emit('room_joined', {
        roomId: parseInt(roomId),
        messages: messages,
        members: allMembers
      });

      socket.to(`room_${roomId}`).emit('user_joined_room', {
        roomId: parseInt(roomId),
        user: socket.user
      });

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { roomId, content, messageType = 'text', replyTo = null } = data;

      if (!roomId || !content || !content.trim()) {
        socket.emit('error', { message: 'Room ID and message content are required' });
        return;
      }

      const [members] = await pool.execute(
        'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ? AND is_active = TRUE',
        [roomId, socket.userId]
      );

      if (members.length === 0) {
        socket.emit('error', { message: 'Not authorized to send message to this room' });
        return;
      }

      const [result] = await pool.execute(
        `INSERT INTO chat_messages (room_id, sender_id, content, message_type, reply_to) 
         VALUES (?, ?, ?, ?, ?)`,
        [roomId, socket.userId, content.trim(), messageType, replyTo]
      );

      const messageId = result.insertId;

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

      if (messages.length === 0) {
        socket.emit('error', { message: 'Failed to retrieve sent message' });
        return;
      }

      const message = messages[0];

      io.to(`room_${roomId}`).emit('new_message', {
        id: message.id,
        room_id: parseInt(roomId),
        sender_id: socket.userId,
        sender_name: message.sender_name,
        sender_avatar: message.sender_avatar,
        content: message.content,
        message_type: message.message_type,
        reply_to: message.reply_to,
        reply_content: message.reply_content,
        reply_sender_name: message.reply_sender_name,
        created_at: message.created_at,
        is_edited: message.is_edited
      });

      await pool.execute(
        'UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [roomId]
      );

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', async (data) => {
    try {
      const { roomId } = data;
      if (!roomId) return;

      await pool.execute(
        `INSERT INTO chat_typing (room_id, user_id) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE started_at = CURRENT_TIMESTAMP`,
        [roomId, socket.userId]
      );

      socket.to(`room_${roomId}`).emit('user_typing', {
        roomId: parseInt(roomId),
        userId: socket.userId,
        userName: socket.user.name,
        isTyping: true
      });
    } catch (error) {
      console.error('Error handling typing start:', error);
    }
  });

  socket.on('typing_stop', async (data) => {
    try {
      const { roomId } = data;
      if (!roomId) return;

      await pool.execute(
        'DELETE FROM chat_typing WHERE room_id = ? AND user_id = ?',
        [roomId, socket.userId]
      );

      socket.to(`room_${roomId}`).emit('user_typing', {
        roomId: parseInt(roomId),
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
      if (!roomId) return;

      await markMessagesAsRead(roomId, socket.userId);
      
      socket.to(`room_${roomId}`).emit('messages_read', {
        roomId: parseInt(roomId),
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
        `SELECT u.id, u.name, u.profile_image, 
                COALESCE(uos.is_online, FALSE) as is_online, 
                uos.last_seen
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
    console.log(`[${new Date().toISOString()}] User ${socket.user.name} disconnected: ${reason}`);
    
    try {
      await updateUserOnlineStatus(socket.userId, false, null);
      
      await pool.execute(
        'DELETE FROM chat_typing WHERE user_id = ?',
        [socket.userId]
      );

      for (const [roomId, members] of roomMembers.entries()) {
        members.delete(socket.userId);
        if (members.size === 0) {
          roomMembers.delete(roomId);
        }
      }

      activeConnections.delete(socket.id);
      userSockets.delete(socket.userId);

      socket.broadcast.emit('user_offline', {
        userId: socket.userId
      });
    } catch (error) {
      console.error('Error during disconnect cleanup:', error);
    }
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const [result] = await pool.execute('SELECT 1 as healthy');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: result.length > 0 ? 'connected' : 'disconnected',
      activeConnections: activeConnections.size,
      activeRooms: roomMembers.size
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Cleanup typing indicators every 30 seconds
setInterval(async () => {
  try {
    await pool.execute(
      'DELETE FROM chat_typing WHERE started_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)'
    );
  } catch (error) {
    console.error('Error cleaning up typing indicators:', error);
  }
}, 30000);

// Start server
async function startServer() {
  try {
    console.log('Creating upload directories...');
    createUploadDirectories();
    
    console.log('Testing database connection...');
    await pool.execute('SELECT 1');
    console.log('✅ Database connected');
    
    const PORT = process.env.SOCKET_PORT || 3001;
    server.listen(PORT, () => {
      console.log(`🚀 Chat server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`💾 Database: mysql:3306/WEB_APP`);
      console.log(`⚠️  Note: Please create chat tables manually in database`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io, server, pool };