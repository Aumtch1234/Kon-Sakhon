'use client';

export default function ProfileSidebar({ user, feeds, members, onEditProfile }) {
  
  const getProfileImageWithFallback = (user, size = 'w-20 h-20 mx-auto') => {
    return (
      <div className="relative">
        {user?.profile_image ? (
          <>
            <img
              src={user.profile_image}
              alt="Profile"
              className={`${size} rounded-full object-cover border-4 border-white shadow-lg`}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div
              className={`${size} bg-gradient-to-br from-blue-400 to-purple-500 rounded-full items-center justify-center text-white font-bold text-xl hidden shadow-lg`}
              style={{ display: 'none' }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          </>
        ) : (
          <div className={`${size} bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
      </div>
    );
  };

  const userPosts = feeds.filter(f => f.user_id === user?.id);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
      {/* Profile Header */}
      <div className="text-center mb-6">
        <div className="mb-4 relative">
          {getProfileImageWithFallback(user, 'w-20 h-20 mx-auto')}
          <div className="absolute bottom-1 right-1/2 transform translate-x-6 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">{user?.name}</h3>
        <p className="text-sm text-gray-600 mb-3">{user?.email}</p>
        <div className="inline-flex px-3 py-1 bg-blue-100 text-blue-600 text-sm font-medium rounded-full">
          ออนไลน์
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-3 mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm font-medium text-blue-700">โพสต์ของคุณ</span>
            </div>
            <span className="font-bold text-blue-800 text-lg">{userPosts.length}</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium text-green-700">สมาชิก</span>
            </div>
            <span className="font-bold text-green-800 text-lg">{members.length}</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-purple-700">ไลก์ที่ได้รับ</span>
            </div>
            <span className="font-bold text-purple-800 text-lg">
              {userPosts.reduce((sum, post) => sum + (post.like_count || 0), 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3 mb-6">
        <button
          onClick={onEditProfile}
          className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg transition-all duration-200 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>แก้ไขโปรไฟล์</span>
        </button>
        
        <button className="w-full flex items-center justify-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-all duration-200 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>ดูเรื่องราวของคุณ</span>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="border-t pt-6">
        <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          กิจกรรมล่าสุด
        </h4>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3 text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">เข้าร่วมชุมชน</span>
          </div>
          <div className="flex items-center space-x-3 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">โพสต์ใหม่ล่าสุด</span>
          </div>
          <div className="flex items-center space-x-3 text-sm">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span className="text-gray-600">มีคนถูกใจโพสต์</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-4 mt-6">
        <p className="text-xs text-gray-500 text-center">
          สมาชิกตั้งแต่ {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}