'use client';
import { useState } from 'react';

export default function CreatePost({ user, onPostCreated }) {
  const [newPost, setNewPost] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getProfileImage = (user, size = 'w-12 h-12') => {
    if (user?.profile_image) {
      return (
        <img
          src={user.profile_image}
          alt="Profile"
          className={`${size} rounded-full object-cover border-2 border-gray-200`}
          onError={(e) => {
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

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !postImage) return;

    setIsSubmitting(true);
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
        setPreview(null);
        onPostCreated();
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsSubmitting(false);
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

  const removeImage = () => {
    setPreview(null);
    setPostImage(null);
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <form onSubmit={handleCreatePost}>
        <div className="flex items-start space-x-4">
          {getProfileImage(user)}
          <div className="flex-1">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="คุณกำลังคิดอะไรอยู่?"
              className="w-full border-0 resize-none text-lg placeholder-gray-500 focus:outline-none"
              rows="3"
            />

            {preview && (
              <div className="mt-3 relative">
                <img
                  src={preview}
                  alt="Preview"
                  className="rounded-lg max-h-60 w-full object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-red-500 text-white text-xs px-3 py-1 rounded-full hover:bg-red-600 transition-colors duration-200"
                >
                  ลบรูป
                </button>
              </div>
            )}

            <div className="border-t border-gray-100 mt-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium">รูปภาพ/วิดีโอ</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    type="button"
                    className="flex items-center space-x-2 text-gray-600 hover:text-yellow-600 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a2.5 2.5 0 100-5H9v5zm0 0H7.5a2.5 2.5 0 100 5H9V10z" />
                    </svg>
                    <span className="text-sm font-medium">ความรู้สึก</span>
                  </button>
                  
                  <button
                    type="button"
                    className="flex items-center space-x-2 text-gray-600 hover:text-green-600 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-medium">สถานที่</span>
                  </button>
                </div>
                
                <button
                  type="submit"
                  disabled={(!newPost.trim() && !postImage) || isSubmitting}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>กำลังโพสต์...</span>
                    </div>
                  ) : (
                    'โพสต์'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}