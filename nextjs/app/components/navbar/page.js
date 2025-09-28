'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ChatList Component (integrated)
function ChatList({ user, onChatOpen, onClose }) {
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
    // Use the same socket instance as the main app if available
    if (window.dashboardSocket) {
      socketRef.current = window.dashboardSocket;
      setupSocketListeners();
    }
  };

  const setupSocketListeners = () => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('user_rooms', (rooms) => {
      setChatRooms(rooms);
    });

    socket.on('new_message', (message) => {
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
      // Mock data for development
      setChatRooms([
        {
          id: 1,
          name: 'สมชาย ใจดี',
          last_message: 'สวัสดีครับ วันนี้เป็นอย่างไรบ้าง',
          last_message_time: new Date(Date.now() - 300000),
          unread_count: 2,
          online: true
        },
        {
          id: 2,
          name: 'สมหญิง สุขใจ',
          last_message: 'งานเสร็จแล้วนะคะ',
          last_message_time: new Date(Date.now() - 3600000),
          unread_count: 0,
          online: false
        }
      ]);
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
      // Mock data for development
      setOnlineUsers([
        { id: 2, name: 'สมชาย ใจดี', is_online: true },
        { id: 3, name: 'สมหญิง สุขใจ', is_online: true },
        { id: 4, name: 'นายสม รักเรียน', is_online: false }
      ]);
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
      } else {
        // Fallback - create mock chat room
        const targetUser = onlineUsers.find(u => u.id === userId);
        if (targetUser) {
          onChatOpen({
            id: userId,
            name: targetUser.name,
            online: targetUser.is_online,
            avatar: targetUser.profile_image
          });
          onClose();
        }
      }
    } catch (error) {
      console.error('Error creating private chat:', error);
      // Fallback for development
      const targetUser = onlineUsers.find(u => u.id === userId);
      if (targetUser) {
        onChatOpen({
          id: userId,
          name: targetUser.name,
          online: targetUser.is_online,
          avatar: targetUser.profile_image
        });
        onClose();
      }
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

  const filteredUsers = onlineUsers.filter(userData =>
    userData.name?.toLowerCase().includes(searchQuery.toLowerCase()) && userData.id !== user?.id
  );

  return (
    <div className="absolute right-0 mt-2 w-80 h-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col">
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
                          room.last_sender_name && room.last_sender_name !== user?.name ? 
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

export default function NavBar({ onLogout, onChatOpen }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'like',
      message: 'สมชาย ถูกใจโพสต์ของคุณ',
      time: '5 นาทีที่แล้ว',
      read: false,
      avatar: null
    },
    {
      id: 2,
      type: 'comment',
      message: 'สมหญิง แสดงความคิดเห็นในโพสต์ของคุณ',
      time: '10 นาทีที่แล้ว',
      read: false,
      avatar: null
    },
    {
      id: 3,
      type: 'friend',
      message: 'คุณมีคำขอเป็นเพื่อนใหม่จาก นายสม',
      time: '1 ชั่วโมงที่แล้ว',
      read: true,
      avatar: null
    }
  ]);

  // Refs for click outside detection
  const notificationRef = useRef(null);
  const messageRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    // Handle click outside
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (messageRef.current && !messageRef.current.contains(event.target)) {
        setShowMessages(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to get profile image
  const getProfileImage = (user, size = 'w-8 h-8') => {
    if (user?.profile_image) {
      return (
        <img
          src={user.profile_image}
          alt="Profile"
          className={`${size} rounded-full object-cover`}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    } else {
      return (
        <div className={`${size} bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-sm`}>
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      );
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return (
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        );
      case 'comment':
        return (
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
      case 'friend':
        return (
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM10.5 14H7a4 4 0 01-4-4V6a4 4 0 014-4h10a4 4 0 014 4v4a4 4 0 01-4 4h-3.5l-3.5 4v-4z" />
            </svg>
          </div>
        );
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;

  const handleChatListOpen = (chatData) => {
    if (onChatOpen) {
      onChatOpen(chatData);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-3">
          {/* Left Section - Logo and Search */}
          <div className="flex items-center space-x-4 flex-1">
            {/* Logo */}
            <h1
              onClick={() => router.push('/dashboard')}
              className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent cursor-pointer hover:scale-105 transition-transform duration-200"
            >
              Kon Sakon.
            </h1>
            
            {/* Search Bar */}
            <div className="relative hidden md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาใน Kon Sakon"
                className="bg-gray-100 border-0 rounded-full py-2 pl-10 pr-4 w-64 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
              />
            </div>
          </div>

          {/* Center Section - Navigation Icons */}
          <div className="hidden lg:flex items-center space-x-2">
            <button className="p-3 rounded-lg hover:bg-gray-100 transition-colors duration-200 group">
              <svg className="w-6 h-6 text-gray-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <button className="p-3 rounded-lg hover:bg-gray-100 transition-colors duration-200 group">
              <svg className="w-6 h-6 text-gray-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
            <button className="p-3 rounded-lg hover:bg-gray-100 transition-colors duration-200 group">
              <svg className="w-6 h-6 text-gray-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14-4l2 4-2 4M5 7l2 4-2 4" />
              </svg>
            </button>
          </div>

          {/* Right Section - Notifications, Messages, Profile */}
          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowMessages(false);
                  setShowProfileMenu(false);
                }}
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 relative"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM10.5 14H7a4 4 0 01-4-4V6a4 4 0 014-4h10a4 4 0 014 4v4a4 4 0 01-4 4h-3.5l-3.5 4v-4z" />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">การแจ้งเตือน</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 hover:bg-gray-50 transition-colors duration-200 border-b border-gray-100 ${
                            !notification.read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            {getNotificationIcon(notification.type)}
                            <div className="flex-1">
                              <p className="text-sm text-gray-800">{notification.message}</p>
                              <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM10.5 14H7a4 4 0 01-4-4V6a4 4 0 014-4h10a4 4 0 014 4v4a4 4 0 01-4 4h-3.5l-3.5 4v-4z" />
                        </svg>
                        <p>ไม่มีการแจ้งเตือน</p>
                      </div>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="p-2 border-t border-gray-200">
                      <button className="w-full text-center text-blue-600 hover:text-blue-800 py-2 text-sm font-medium">
                        ดูการแจ้งเตือนทั้งหมด
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="relative" ref={messageRef}>
              <button
                onClick={() => {
                  setShowMessages(!showMessages);
                  setShowNotifications(false);
                  setShowProfileMenu(false);
                }}
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 relative"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>

              {/* Messages Dropdown - Now uses ChatList */}
              {showMessages && (
                <ChatList
                  user={user}
                  onChatOpen={handleChatListOpen}
                  onClose={() => setShowMessages(false)}
                />
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                  setShowMessages(false);
                }}
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
              >
                {getProfileImage(user)}
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      {getProfileImage(user, 'w-10 h-10')}
                      <div>
                        <p className="font-medium text-gray-800">{user?.name}</p>
                        <p className="text-sm text-gray-600">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="py-2">
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-3">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-gray-700">ดูโปรไฟล์</span>
                    </button>
                    
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-3">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-gray-700">การตั้งค่า</span>
                    </button>
                    
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-3">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-gray-700">ความช่วยเหลือ</span>
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-200 py-2">
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 transition-colors duration-200 flex items-center space-x-3 text-red-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}