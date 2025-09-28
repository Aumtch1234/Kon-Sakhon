// app/components/ChatList/ChatList.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function ChatList({ user, onChatOpen, onClose }) {
  const [chatRooms, setChatRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef(null);

  useEffect(() => {
    loadChatRooms();
    loadOnlineUsers();
    initializeSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const initializeSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    socketRef.current = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
      auth: { token }
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Chat list connected to socket server');
    });

    socket.on('user_rooms', (rooms) => {
      setChatRooms(rooms);
    });

    socket.on('new_message', (message) => {
      // อัพเดทข้อความล่าสุดในรายการแชท
      setChatRooms(prev => prev.map(room => {
        if (room.id === message.room_id) {
          return {
            ...room,
            last_message: message.content,
            last_message_time: message.created_at,
            last_sender_name: message.sender_name,
            unread_count: message.sender_id !== user.id ? (room.unread_count || 0) + 1 : room.unread_count
          };
        }
        return room;
      }));
    });

    socket.on('user_online', (data) => {
      setOnlineUsers(prev => prev.map(u => 
        u.id === data.userId ? { ...u, is_online: true } : u
      ));
    });

    socket.on('user_offline', (data) => {
      setOnlineUsers(prev => prev.map(u => 
        u.id === data.userId ? { ...u, is_online: false } : u
      ));
    });
  };

  const loadChatRooms = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/rooms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const rooms = await response.json();
        setChatRooms(rooms);
      }
    } catch (error) {
      console.error('Error loading chat rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOnlineUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/online-users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const users = await response.json();
        setOnlineUsers(users);
      }
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  };

  const createPrivateChat = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/rooms/private', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const room = await response.json();
        onChatOpen(room);
        onClose();
      }
    } catch (error) {
      console.error('Error creating private chat:', error);
    }
  };

  const getProfileImage = (userData, size = 'w-10 h-10') => {
    return (
      <div className={`${size} bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-sm`}>
        {userData?.name?.charAt(0)?.toUpperCase() || 'U'}
      </div>
    );
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now - time) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - time) / (1000 * 60));
      return diffInMinutes < 1 ? 'เมื่อกี้' : `${diffInMinutes} นาทีที่แล้ว`;
    } else if (diffInHours < 24) {
      return `${diffInHours} ชั่วโมงที่แล้ว`;
    } else {
      return time.toLocaleDateString('th-TH');
    }
  };

  const filteredChats = chatRooms.filter(room =>
    room.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = onlineUsers.filter(user =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed top-16 right-4 w-80 h-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">ข้อความ</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="ค้นหา..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
          />
        </div>

        {/* Tabs */}
        <div className="flex mt-3 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeTab === 'chats'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            แชท ({chatRooms.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeTab === 'users'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ผู้ใช้ ({onlineUsers.filter(u => u.is_online).length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : activeTab === 'chats' ? (
          <div className="space-y-1 p-2">
            {filteredChats.length > 0 ? (
              filteredChats.map((room) => (
                <div
                  key={room.id}
                  onClick={() => {
                    onChatOpen({
                      id: room.id,
                      name: room.name,
                      online: room.online,
                      avatar: room.avatar
                    });
                    onClose();
                  }}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                >
                  <div className="relative">
                    {getProfileImage({ name: room.name, profile_image: room.avatar })}
                    {room.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-gray-800 truncate">{room.name}</p>
                      <span className="text-xs text-gray-500">{formatTime(room.last_message_time)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-sm text-gray-600 truncate">
                        {room.last_message ? (
                          room.last_sender_name && room.last_sender_name !== user.name ? 
                            `${room.last_sender_name}: ${room.last_message}` : 
                            room.last_message
                        ) : 'ไม่มีข้อความ'}
                      </p>
                      {room.unread_count > 0 && (
                        <div className="bg-blue-500 text-white text-xs rounded-full h-5 min-w-5 px-2 flex items-center justify-center font-medium">
                          {room.unread_count > 99 ? '99+' : room.unread_count}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>ไม่มีการสนทนา</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((userData) => (
                <div
                  key={userData.id}
                  onClick={() => createPrivateChat(userData.id)}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                >
                  <div className="relative">
                    {getProfileImage(userData)}
                    {userData.is_online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{userData.name}</p>
                    <p className="text-sm text-gray-500">
                      {userData.is_online ? 'ออนไลน์' : `ออฟไลน์ ${formatTime(userData.last_seen)}`}
                    </p>
                  </div>
                  <button className="text-blue-600 hover:text-blue-800 transition-colors duration-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p>ไม่มีผู้ใช้ออนไลน์</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}