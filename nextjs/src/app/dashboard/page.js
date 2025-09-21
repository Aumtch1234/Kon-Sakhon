'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState([]);
  const [members, setMembers] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [showMoreMembers, setShowMoreMembers] = useState(5);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [comments, setComments] = useState([]);
  const [allComments, setAllComments] = useState({}); // เก็บคอมเมนต์แยกตาม postId
  const [newComment, setNewComment] = useState('');
  const [loadingComment, setLoadingComment] = useState(false);

  // Profile edit states
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [newProfileImage, setNewProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [preview, setPreview] = useState(null);

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
      setProfileData({
        name: parsedUser.name || '',
        email: parsedUser.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
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

        // โหลดคอมเมนต์ 3 อันแรกสำหรับทุกโพสต์
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

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    const formData = new FormData();
    formData.append('content', newPost);
    if (postImage) {
      formData.append('image', postImage);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        setNewPost('');
        setPostImage(null);
        setPreview(null); // reset preview
        loadFeeds();
      }
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('ต้องการลบโพสต์นี้หรือไม่?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        loadFeeds();
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPostImage(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLikePost = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        // อัปเดตข้อมูลในฟีด
        setFeeds(prevFeeds =>
          prevFeeds.map(feed =>
            feed.id === postId
              ? { ...feed, is_liked: result.isLiked, like_count: result.likeCount }
              : feed
          )
        );
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const openCommentDialog = async (postId) => {
    setSelectedPostId(postId);
    setCommentDialogOpen(true);
    await loadComments(postId);
  };

  const loadComments = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/posts/${postId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data); // สำหรับ dialog
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoadingComment(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/posts/${selectedPostId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newComment })
      });

      if (response.ok) {
        const result = await response.json();
        setComments(prev => [...prev, result.comment]);
        setNewComment('');

        // อัปเดตคอมเมนต์ preview ด้วย
        setAllComments(prev => ({
          ...prev,
          [selectedPostId]: [...(prev[selectedPostId] || []), result.comment]
        }));

        // อัปเดตจำนวนคอมเมนต์ในฟีด
        setFeeds(prevFeeds =>
          prevFeeds.map(feed =>
            feed.id === selectedPostId
              ? { ...feed, comment_count: feed.comment_count + 1 }
              : feed
          )
        );
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
    setLoadingComment(false);
  };

  const closeCommentDialog = () => {
    setCommentDialogOpen(false);
    setSelectedPostId(null);
    setComments([]);
    setNewComment('');
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('ต้องการลบความคิดเห็นนี้หรือไม่?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/posts/${selectedPostId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // อัปเดตคอมเมนต์ใน dialog
        setComments(prev => prev.filter(comment => comment.id !== commentId));

        // อัปเดตคอมเมนต์ preview
        setAllComments(prev => ({
          ...prev,
          [selectedPostId]: prev[selectedPostId]?.filter(comment => comment.id !== commentId) || []
        }));

        // อัปเดตจำนวนคอมเมนต์ในฟีด
        setFeeds(prevFeeds =>
          prevFeeds.map(feed =>
            feed.id === selectedPostId
              ? { ...feed, comment_count: Math.max(0, feed.comment_count - 1) }
              : feed
          )
        );
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Profile functions
  const openProfileDialog = () => {
    setProfileDialogOpen(true);
    setProfileMessage('');
    setNewProfileImage(null);
    setProfileImagePreview(null);
  };

  const closeProfileDialog = () => {
    setProfileDialogOpen(false);
    setProfileData({
      name: user?.name || '',
      email: user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setNewProfileImage(null);
    setProfileImagePreview(null);
    setProfileMessage('');
  };

  const handleProfileInputChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setProfileMessage('รูปภาพต้องมีขนาดไม่เกิน 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setProfileMessage('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }

      setNewProfileImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfileImage = () => {
    setNewProfileImage(null);
    setProfileImagePreview(null);
    const fileInput = document.getElementById('new-profile-image');
    if (fileInput) fileInput.value = '';
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage('');

    // Password validation
    if (profileData.newPassword && profileData.newPassword !== profileData.confirmPassword) {
      setProfileMessage('รหัสผ่านใหม่ไม่ตรงกัน');
      setProfileLoading(false);
      return;
    }

    if (profileData.newPassword && profileData.newPassword.length < 6) {
      setProfileMessage('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      setProfileLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', profileData.name);
      formData.append('email', profileData.email);
      if (profileData.currentPassword) {
        formData.append('currentPassword', profileData.currentPassword);
      }
      if (profileData.newPassword) {
        formData.append('newPassword', profileData.newPassword);
      }
      if (newProfileImage) {
        formData.append('profileImage', newProfileImage);
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setProfileMessage('อัปเดตโปรไฟล์สำเร็จ');
        // Update user data in localStorage and state
        const updatedUser = { ...user, ...result.user };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));

        setTimeout(() => {
          closeProfileDialog();
        }, 1500);
      } else {
        setProfileMessage(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      setProfileMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }

    setProfileLoading(false);
  };

  // Helper function to get profile image
  const getProfileImage = (user, size = 'w-12 h-12') => {
    // Debug log
    console.log('User profile image:', user?.profile_image);

    if (user?.profile_image) {
      return (
        <img
          src={user.profile_image}
          alt="Profile"
          className={`${size} rounded-full object-cover border-2 border-gray-200`}
          onError={(e) => {
            console.error('Image failed to load:', user.profile_image);
            // Fallback to default avatar
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    } else {
      return (
        <div className={`${size} bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium`}>
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      );
    }
  };

  // Enhanced helper function with fallback
  const getProfileImageWithFallback = (user, size = 'w-12 h-12') => {
    return (
      <div className="relative">
        {user?.profile_image ? (
          <>
            <img
              src={user.profile_image}
              alt="Profile"
              className={`${size} rounded-full object-cover border-2 border-gray-200`}
              onError={(e) => {
                console.error('Image failed to load:', user.profile_image);
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div
              className={`${size} bg-gradient-to-br from-blue-400 to-purple-500 rounded-full items-center justify-center text-white font-medium hidden`}
              style={{ display: 'none' }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          </>
        ) : (
          <div className={`${size} bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium`}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
      </div>
    );
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-blue-600">Kon Sakon.</h1>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Members */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">สมาชิก</h2>
              <div className="space-y-3">
                {members.slice(0, showMoreMembers).map((member, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    {getProfileImage(member, 'w-10 h-10')}
                    <div>
                      <p className="font-medium text-gray-800">{member.name}</p>
                      <p className="text-xs text-gray-500">
                        {member.last_login ? `ใช้งานล่าสุด ${new Date(member.last_login).toLocaleDateString('th-TH')}` : 'ไม่เคยเข้าใช้'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {members.length > showMoreMembers && (
                <button
                  onClick={() => setShowMoreMembers(prev => prev + 5)}
                  className="w-full mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  แสดงเพิ่มเติม ({members.length - showMoreMembers} คน)
                </button>
              )}
            </div>
          </div>

          {/* Center - Feed */}
          <div className="lg:col-span-2">
            {/* Create Post */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <form onSubmit={handleCreatePost}>
                <div className="flex items-start space-x-4">
                  {getProfileImage(user)}
                  <div className="flex-1">
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="คุณกำลังคิดอะไรอยู่?"
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />

                    {preview && (
                      <div className="mt-3 relative">
                        <img
                          src={preview}
                          alt="Preview"
                          className="rounded-lg max-h-60 object-cover border"
                        />

                        {/* ปุ่มเคลียร์รูป */}
                        <button
                          type="button"
                          onClick={() => {
                            setPreview(null);
                            setPostImage(null);
                            document.querySelector('input[type="file"]').value = "";
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
                        >
                          ลบรูป
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 cursor-pointer">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm">รูปภาพ</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                        {postImage && (
                          <span className="text-sm text-green-600">✓ เลือกรูปภาพแล้ว</span>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={!newPost.trim() && !postImage}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                      >
                        โพสต์
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Feed Posts */}
            <div className="space-y-6">
              {feeds.map((feed) => (
                <div key={feed.id} className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {getProfileImage({ name: feed.user_name, profile_image: feed.profile_image })}
                      <div>
                        <p className="font-medium text-gray-800">{feed.user_name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(feed.created_at).toLocaleString('th-TH')}
                        </p>
                      </div>
                    </div>
                    {feed.user_id === user.id && (
                      <button
                        onClick={() => handleDeletePost(feed.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                  <p className="text-gray-800 mb-4">{feed.content}</p>
                  {feed.image_url && (
                    <Zoom>
                      <img
                        src={feed.image_url}
                        alt="Post image"
                        className="w-full max-h-96 object-cover rounded-lg mb-4 cursor-pointer"
                      />
                    </Zoom>
                  )}
                  <div className="flex items-center space-x-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleLikePost(feed.id)}
                      className={`flex items-center space-x-2 transition-colors duration-200 ${feed.is_liked
                        ? 'text-red-500 hover:text-red-600'
                        : 'text-gray-600 hover:text-red-500'
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 ${feed.is_liked ? 'fill-current' : 'fill-none'}`}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span className="text-sm">
                        {feed.is_liked ? 'ถูกใจแล้ว' : 'ถูกใจ'}
                        {feed.like_count > 0 && ` (${feed.like_count})`}
                      </span>
                    </button>
                    <button
                      onClick={() => openCommentDialog(feed.id)}
                      className="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition-colors duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span className="text-sm">
                        แสดงความคิดเห็น
                        {feed.comment_count > 0 && ` (${feed.comment_count})`}
                      </span>
                    </button>
                  </div>

                  {/* แสดงคอมเมนต์ 3 อันแรก */}
                  {feed.comment_count > 0 && allComments[feed.id] && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="space-y-2">
                        {allComments[feed.id]
                          .slice(0, 3)
                          .map((comment) => (
                            <div key={comment.id} className="flex items-start space-x-2">
                              {getProfileImage({ name: comment.user_name, profile_image: comment.profile_image }, 'w-8 h-8')}
                              <div className="flex-1">
                                <div className="bg-gray-100 rounded-lg p-2">
                                  <p className="font-medium text-xs text-gray-700">{comment.user_name}</p>
                                  <p className="text-sm text-gray-800">{comment.content}</p>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(comment.created_at).toLocaleString('th-TH')}
                                </p>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                      {feed.comment_count > 3 && (
                        <button
                          onClick={() => openCommentDialog(feed.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm mt-2 transition-colors duration-200"
                        >
                          ดูความคิดเห็นทั้งหมด ({feed.comment_count} ความคิดเห็น)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar - User Profile */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <div className="text-center mb-6">
                <div className="mb-4">
                  {getProfileImageWithFallback(user, 'w-20 h-20 mx-auto')}
                </div>
                <h3 className="text-lg font-semibold text-gray-800">{user?.name}</h3>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>

              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">โพสต์ของเธอ</span>
                    <span className="font-semibold text-gray-800">
                      {feeds.filter(f => f.user_id === user.id).length} โพสต์
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">สมาชิก</span>
                    <span className="font-semibold text-gray-800">{members.length} คน</span>
                  </div>
                </div>
              </div>

              <button
                onClick={openProfileDialog}
                className="w-full mt-6 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors duration-200"
              >
                แก้ไขโปรไฟล์
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comment Dialog */}
      {commentDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">ความคิดเห็น</h3>
              <button
                onClick={closeCommentDialog}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start space-x-3">
                    {getProfileImage({ name: comment.user_name, profile_image: comment.profile_image }, 'w-10 h-10')}
                    <div className="flex-1">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-700 mb-1">{comment.user_name}</p>
                            <p className="text-gray-800">{comment.content}</p>
                          </div>
                          {comment.user_id === user?.id && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-red-400 hover:text-red-600 text-xs ml-2 transition-colors duration-200"
                            >
                              ลบ
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-3">
                        {new Date(comment.created_at).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p>ยังไม่มีความคิดเห็น</p>
                    <p className="text-sm">เป็นคนแรกที่แสดงความคิดเห็น</p>
                  </div>
                )}
              </div>
            </div>

            {/* Add Comment Form */}
            <div className="border-t border-gray-200 p-6">
              <form onSubmit={handleAddComment} className="flex items-start space-x-3">
                {getProfileImage(user, 'w-10 h-10')}
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="เขียนความคิดเห็น..."
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="2"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={!newComment.trim() || loadingComment}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm"
                    >
                      {loadingComment ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>กำลังส่ง...</span>
                        </div>
                      ) : (
                        'ส่งความคิดเห็น'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Profile Edit Dialog */}
      {profileDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">แก้ไขโปรไฟล์</h3>
              <button
                onClick={closeProfileDialog}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
              {/* Profile Image */}
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  รูปโปรไฟล์
                </label>
                <div className="flex flex-col items-center space-y-4">
                  {profileImagePreview ? (
                    <div className="relative">
                      <img
                        src={profileImagePreview}
                        alt="Profile preview"
                        className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={removeProfileImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    getProfileImage(user, 'w-24 h-24')
                  )}
                  <label className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg cursor-pointer transition-colors duration-200 text-sm">
                    {profileImagePreview ? 'เปลี่ยนรูปภาพ' : 'อัปโหลดรูปภาพ'}
                    <input
                      id="new-profile-image"
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  name="name"
                  value={profileData.name}
                  onChange={handleProfileInputChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  อีเมล
                </label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleProfileInputChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                />
              </div>

              {/* Password Section */}
              <div className="border-t pt-4">
                <h4 className="text-md font-medium text-gray-700 mb-4">เปลี่ยนรหัสผ่าน (ไม่จำเป็น)</h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      รหัสผ่านปัจจุบัน
                    </label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={profileData.currentPassword}
                      onChange={handleProfileInputChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      รหัสผ่านใหม่
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      value={profileData.newPassword}
                      onChange={handleProfileInputChange}
                      minLength="6"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ยืนยันรหัสผ่านใหม่
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={profileData.confirmPassword}
                      onChange={handleProfileInputChange}
                      minLength="6"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Message */}
              {profileMessage && (
                <div className={`p-3 rounded-xl text-center text-sm ${profileMessage.includes('สำเร็จ')
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                  {profileMessage}
                </div>
              )}

              {/* Buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={closeProfileDialog}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={profileLoading}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium text-white transition-all duration-200 ${profileLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                    }`}
                >
                  {profileLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      กำลังบันทึก...
                    </div>
                  ) : (
                    'บันทึกการเปลี่ยนแปลง'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}