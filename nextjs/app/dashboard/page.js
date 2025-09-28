'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import NavBar from '../components/navbar/page';
import MembersSidebar from '../components/MembersSidebar/page';
import CreatePost from '../components/CreatePost/page';
import FeedPost from '../components/Feed/page';
import CommentDialog from '../components/CommentDialog/page';
import ProfileEditDialog from '../components/ProfileEdit/page';
import ProfileSidebar from '../components/ProfileSidebar/page';
import ChatBox from '../components/ChatBox/ChatBox';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState([]);
  const [members, setMembers] = useState([]);
  const [allComments, setAllComments] = useState({});
  
  // Chat states
  const [activeChatBoxes, setActiveChatBoxes] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // Dialog states
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    // Prevent back navigation after login
    window.history.pushState(null, null, window.location.pathname);
    window.addEventListener('popstate', preventBack);

    // Check authentication and initialize
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.replace('/');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Load initial data
      loadFeeds();
      loadMembers();
      
      // Initialize socket connection
      initializeSocket(parsedUser);
      
    } catch (error) {
      console.error('Invalid user data');
      handleLogout();
    }

    setLoading(false);

    return () => {
      window.removeEventListener('popstate', preventBack);
    };
  }, [router]);

  const preventBack = () => {
    window.history.pushState(null, null, window.location.pathname);
  };

  const initializeSocket = (userData) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('Dashboard connected to socket server');
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Dashboard disconnected from socket server');
      setSocketConnected(false);
    });

    socket.on('user_online', (data) => {
      setOnlineUsers(prev => {
        const updated = prev.filter(u => u.id !== data.userId);
        return [...updated, { ...data.userData, is_online: true }];
      });

      // Update members list if needed
      setMembers(prev => prev.map(member => 
        member.id === data.userId ? { ...member, is_online: true } : member
      ));
    });

    socket.on('user_offline', (data) => {
      setOnlineUsers(prev => prev.map(user => 
        user.id === data.userId ? { ...user, is_online: false } : user
      ));

      // Update members list if needed
      setMembers(prev => prev.map(member => 
        member.id === data.userId ? { ...member, is_online: false } : member
      ));
    });

    // Store socket reference for cleanup
    window.dashboardSocket = socket;
  };

  const handleLogout = () => {
    // Clean up socket connection
    if (window.dashboardSocket) {
      window.dashboardSocket.disconnect();
      delete window.dashboardSocket;
    }
    
    // Clear storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Remove event listener
    window.removeEventListener('popstate', preventBack);
    
    // Redirect
    router.replace('/');
  };

  const loadFeeds = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/feeds', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFeeds(data);

        // Load preview comments for posts with comments
        for (const feed of data) {
          if (feed.comment_count > 0) {
            loadPreviewComments(feed.id);
          }
        }
      }
    } catch (error) {
      console.error('Error loading feeds:', error);
    }
  };

  const loadPreviewComments = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/posts/${postId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAllComments(prev => ({
          ...prev,
          [postId]: data
        }));
      }
    } catch (error) {
      console.error('Error loading preview comments:', error);
    }
  };

  const loadMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/members', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const handleChatOpen = (chatData) => {
    // Check if chat is already open
    const existingChat = activeChatBoxes.find(chat => chat.id === chatData.id);
    
    if (!existingChat) {
      // Add new chat box with positioning
      const newChatBox = {
        ...chatData,
        position: activeChatBoxes.length
      };
      
      // Limit to maximum 3 chat boxes
      if (activeChatBoxes.length >= 3) {
        setActiveChatBoxes([...activeChatBoxes.slice(1), newChatBox]);
      } else {
        setActiveChatBoxes([...activeChatBoxes, newChatBox]);
      }
    }
  };

  const handleChatClose = (chatId) => {
    setActiveChatBoxes(prev => 
      prev.filter(chat => chat.id !== chatId)
        .map((chat, index) => ({ ...chat, position: index }))
    );
  };

  const handleCommentClick = (postId) => {
    setSelectedPostId(postId);
    setCommentDialogOpen(true);
  };

  const handleCommentDialogClose = () => {
    setCommentDialogOpen(false);
    setSelectedPostId(null);
  };

  const handleCommentAdded = () => {
    loadFeeds();
    if (selectedPostId) {
      loadPreviewComments(selectedPostId);
    }
  };

  const handleProfileEdit = () => {
    setProfileDialogOpen(true);
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar 
        onLogout={handleLogout} 
        onChatOpen={handleChatOpen}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Members */}
          <div className="lg:col-span-1">
            <MembersSidebar 
              members={members}
              onlineUsers={onlineUsers}
              onChatOpen={handleChatOpen}
            />
          </div>

          {/* Center - Feed */}
          <div className="lg:col-span-2">
            <CreatePost user={user} onPostCreated={loadFeeds} />
            
            <div className="space-y-6">
              {feeds.length > 0 ? (
                feeds.map((feed) => (
                  <FeedPost
                    key={feed.id}
                    feed={feed}
                    user={user}
                    allComments={allComments}
                    onDeletePost={loadFeeds}
                    onLikePost={setFeeds}
                    onCommentClick={() => handleCommentClick(feed.id)}
                  />
                ))
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มีโพสต์</h3>
                  <p className="text-gray-500">เริ่มต้นแชร์ความคิดของคุณกับเพื่อน ๆ</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - User Profile */}
          <div className="lg:col-span-1">
            <ProfileSidebar
              user={user}
              feeds={feeds}
              members={members}
              onlineUsers={onlineUsers}
              socketConnected={socketConnected}
              onEditProfile={handleProfileEdit}
            />
          </div>
        </div>
      </div>

      {/* Comment Dialog */}
      {commentDialogOpen && selectedPostId && (
        <CommentDialog
          postId={selectedPostId}
          user={user}
          onClose={handleCommentDialogClose}
          onCommentAdded={handleCommentAdded}
        />
      )}

      {/* Profile Edit Dialog */}
      {profileDialogOpen && (
        <ProfileEditDialog
          user={user}
          onClose={() => setProfileDialogOpen(false)}
          onUpdate={handleProfileUpdate}
        />
      )}

      {/* Chat Boxes */}
      <div className="fixed bottom-0 right-4 flex space-x-2 z-40">
        {activeChatBoxes.map((chat, index) => (
          <div 
            key={chat.id}
            style={{ 
              transform: `translateX(-${index * 320}px)`,
              zIndex: 50 - index 
            }}
          >
            <ChatBox
              chat={chat}
              user={user}
              onClose={() => handleChatClose(chat.id)}
            />
          </div>
        ))}
      </div>

      {/* Connection Status Indicator */}
      {!socketConnected && (
        <div className="fixed top-20 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            <span className="text-sm font-medium">กำลังเชื่อมต่อแชท...</span>
          </div>
        </div>
      )}

      {/* Online Users Count (optional) */}
      {socketConnected && onlineUsers.length > 0 && (
        <div className="fixed bottom-4 left-4 bg-green-500 text-white px-3 py-2 rounded-full shadow-lg z-30">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="text-sm font-medium">
              {onlineUsers.filter(u => u.is_online).length} คนออนไลน์
            </span>
          </div>
        </div>
      )}
    </div>
  );
}