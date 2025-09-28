'use client';

import { useState } from 'react';
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";

export default function FeedPost({ 
  feed, 
  user, 
  allComments = {},
  onDeletePost = () => {}, 
  onLikePost = () => {}, 
  onCommentClick = () => {}
}) {
  const [isLiking, setIsLiking] = useState(false);

  // Early return if no feed data
  if (!feed || !feed.user_name) {
    return null;
  }

  // Helper function to get profile image with fallback
  const getProfileImageWithFallback = (userData, size = 'w-12 h-12') => {
    return (
      <div className="relative">
        {userData?.profile_image ? (
          <>
            <img
              src={userData.profile_image}
              alt="Profile"
              className={`${size} rounded-full object-cover border-2 border-white shadow-sm`}
              onError={(e) => {
                console.error('Image failed to load:', userData.profile_image);
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div
              className={`${size} bg-gradient-to-br from-blue-400 to-purple-500 rounded-full items-center justify-center text-white font-semibold text-sm hidden shadow-sm`}
              style={{ display: 'none' }}
            >
              {userData?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          </>
        ) : (
          <div className={`${size} bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm`}>
            {userData?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
      </div>
    );
  };

  // Format time in Thai style with more detailed formatting
  const formatTime = (dateString) => {
    if (!dateString) return 'เมื่อสักครู่';
    
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInMs = now - postDate;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return 'เมื่อสักครู่';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} นาทีที่แล้ว`;
    } else if (diffInHours < 24) {
      return `${diffInHours} ชั่วโมงที่แล้ว`;
    } else if (diffInDays < 7) {
      return `${diffInDays} วันที่แล้ว`;
    } else {
      return postDate.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const handleLikePost = async () => {
    if (isLiking || !feed?.id) return;
    
    setIsLiking(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/posts/${feed.id}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        // อัปเดตข้อมูลในฟีด
        onLikePost(prevFeeds =>
          prevFeeds.map(f =>
            f.id === feed.id
              ? { ...f, is_liked: result.isLiked, like_count: result.likeCount }
              : f
          )
        );
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
    setIsLiking(false);
  };

  const handleDeletePost = async () => {
    if (!feed?.id || !confirm('ต้องการลบโพสต์นี้หรือไม่?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/posts/${feed.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        onDeletePost();
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  return (
    <article className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 group">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {getProfileImageWithFallback({ 
              name: feed.user_name, 
              profile_image: feed.profile_image 
            }, 'w-11 h-11')}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h4 className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors cursor-pointer">
                  {feed.user_name}
                </h4>
                {feed.user_id === user?.id && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    คุณ
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <time className="text-sm text-gray-500" dateTime={feed.created_at}>
                  {formatTime(feed.created_at)}
                </time>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <div className="flex items-center text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs ml-1">สาธารณะ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Menu */}
          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {feed.user_id === user?.id && (
              <button
                onClick={handleDeletePost}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
                title="ลบโพสต์"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-all duration-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {feed.content && (
        <div className="px-6 pb-4">
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-base">
              {feed.content}
            </p>
          </div>
        </div>
      )}

      {/* Image */}
      {feed.image_url && (
        <div className="px-6 pb-4">
          <div className="rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
            <Zoom>
              <img
                src={feed.image_url}
                alt="Post image"
                className="w-full h-auto max-h-96 object-cover cursor-pointer transition-transform hover:scale-[1.02] duration-300"
                loading="lazy"
              />
            </Zoom>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {(feed.like_count > 0 || feed.comment_count > 0) && (
        <div className="px-6 py-2 flex items-center justify-between text-sm text-gray-500 border-t border-gray-50">
          <div className="flex items-center space-x-4">
            {feed.like_count > 0 && (
              <div className="flex items-center space-x-1">
                <div className="flex -space-x-1">
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border border-white">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <span className="ml-2">{feed.like_count} คนถูกใจ</span>
              </div>
            )}
          </div>
          {feed.comment_count > 0 && (
            <button
              onClick={() => onCommentClick(feed.id)}
              className="hover:text-blue-600 transition-colors duration-200"
            >
              {feed.comment_count} ความคิดเห็น
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-around">
          {/* Like Button */}
          <button
            onClick={handleLikePost}
            disabled={isLiking}
            className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 flex-1 mx-1 ${
              feed.is_liked
                ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
                : 'text-gray-600 hover:text-red-500 hover:bg-red-50'
            } ${isLiking ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          >
            <svg
              className={`w-5 h-5 transition-all duration-200 ${
                feed.is_liked ? 'fill-current scale-110' : 'fill-none'
              }`}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
              />
            </svg>
            <span className="text-sm font-medium">
              {feed.is_liked ? 'ถูกใจแล้ว' : 'ถูกใจ'}
            </span>
          </button>

          {/* Comment Button */}
          <button
            onClick={() => onCommentClick(feed.id)}
            className="flex items-center justify-center space-x-2 px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-105 flex-1 mx-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-medium">ความคิดเห็น</span>
          </button>

          {/* Share Button */}
          <button className="flex items-center justify-center space-x-2 px-4 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-105 flex-1 mx-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <span className="text-sm font-medium">แชร์</span>
          </button>
        </div>
      </div>

      {/* Preview Comments */}
      {feed.comment_count > 0 && allComments[feed.id] && allComments[feed.id].length > 0 && (
        <div className="px-6 pb-4 bg-gray-50/30">
          <div className="space-y-3">
            {allComments[feed.id]
              .slice(0, 2)
              .map((comment) => (
                <div key={comment.id} className="flex items-start space-x-3">
                  {getProfileImageWithFallback({ 
                    name: comment.user_name, 
                    profile_image: comment.profile_image 
                  }, 'w-8 h-8')}
                  <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs text-gray-700 mb-1">
                            {comment.user_name}
                          </p>
                          <p className="text-sm text-gray-900 break-words">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 px-3">
                      <p className="text-xs text-gray-500">
                        {formatTime(comment.created_at)}
                      </p>
                      <div className="flex items-center space-x-3 text-xs">
                        <button className="text-gray-500 hover:text-blue-600 transition-colors font-medium">
                          ตอบกลับ
                        </button>
                        <button className="text-gray-500 hover:text-red-600 transition-colors font-medium">
                          ถูกใจ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
          {feed.comment_count > 2 && (
            <button
              onClick={() => onCommentClick(feed.id)}
              className="w-full mt-4 py-2 text-blue-600 hover:text-blue-800 text-sm font-medium hover:bg-blue-50 rounded-lg transition-all duration-200"
            >
              ดูความคิดเห็นทั้งหมด ({feed.comment_count} ความคิดเห็น)
            </button>
          )}
        </div>
      )}
    </article>
  );
}