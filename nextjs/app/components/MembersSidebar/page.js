'use client';
import { useState } from 'react';

export default function MembersSidebar({ members }) {
  const [showMoreMembers, setShowMoreMembers] = useState(5);

  const getProfileImage = (member, size = 'w-10 h-10') => {
    if (member?.profile_image) {
      return (
        <img
          src={member.profile_image}
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
          {member?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        สมาชิก ({members.length} คน)
      </h2>
      
      <div className="space-y-3">
        {members.slice(0, showMoreMembers).map((member, index) => (
          <div key={index} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <div className="relative">
              {getProfileImage(member, 'w-10 h-10')}
              {/* Online status indicator */}
              {Math.random() > 0.5 && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{member.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {member.last_login ? `ใช้งานล่าสุด ${new Date(member.last_login).toLocaleDateString('th-TH')}` : 'ไม่เคยเข้าใช้'}
              </p>
            </div>
            <div className="flex space-x-1">
              <button className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {members.length > showMoreMembers && (
        <button
          onClick={() => setShowMoreMembers(prev => prev + 5)}
          className="w-full mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors duration-200"
        >
          แสดงเพิ่มเติม ({members.length - showMoreMembers} คน)
        </button>
      )}
      
      {members.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>ยังไม่มีสมาชิก</p>
        </div>
      )}
    </div>
  );
}