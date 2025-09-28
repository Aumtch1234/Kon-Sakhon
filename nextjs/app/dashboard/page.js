'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  
  // Chat state
  const [chatBoxOpen, setChatBoxOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  
  // Comment dialog states
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [comments, setComments] = useState([]);
  
  // Profile dialog states
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    // Prevent back navigation after login
    window.history.pushState(null, null, window.location.pathname);
    window.addEventListener('popstate', preventBack);

    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.replace('/');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      loadFeeds();
      loadMembers();
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.removeEventListener('popstate', preventBack);
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

        // Load preview comments for all posts
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
    setSelectedChat(chatData);
    setChatBoxOpen(true);
  };

  const handleChatClose = () => {
    setChatBoxOpen(false);
    setSelectedChat(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar onLogout={handleLogout} onChatOpen={handleChatOpen} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Members */}
          <div className="lg:col-span-1">
            <MembersSidebar members={members} />
          </div>

          {/* Center - Feed */}
          <div className="lg:col-span-2">
            <CreatePost user={user} onPostCreated={loadFeeds} />
            
            <div className="space-y-6">
              {feeds.map((feed) => (
                <FeedPost
                  key={feed.id}
                  feed={feed}
                  user={user}
                  allComments={allComments}
                  onDeletePost={loadFeeds}
                  onLikePost={setFeeds}
                  onCommentClick={() => {
                    setSelectedPostId(feed.id);
                    setCommentDialogOpen(true);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right Sidebar - User Profile */}
          <div className="lg:col-span-1">
            <ProfileSidebar
              user={user}
              feeds={feeds}
              members={members}
              onEditProfile={() => setProfileDialogOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Comment Dialog */}
      {commentDialogOpen && (
        <CommentDialog
          postId={selectedPostId}
          user={user}
          onClose={() => {
            setCommentDialogOpen(false);
            setSelectedPostId(null);
          }}
          onCommentAdded={() => {
            loadFeeds();
            loadPreviewComments(selectedPostId);
          }}
        />
      )}

      {/* Profile Edit Dialog */}
      {profileDialogOpen && (
        <ProfileEditDialog
          user={user}
          onClose={() => setProfileDialogOpen(false)}
          onUpdate={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }}
        />
      )}

      {/* Chat Box */}
      {chatBoxOpen && selectedChat && (
        <ChatBox
          chat={selectedChat}
          user={user}
          onClose={handleChatClose}
        />
      )}
    </div>
  );
}