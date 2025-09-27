'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [profileImage, setProfileImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setMessage('รูปภาพต้องมีขนาดไม่เกิน 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setMessage('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }

      setProfileImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setProfileImage(null);
    setPreviewImage(null);
    const fileInput = document.getElementById('profile-image');
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validation
    if (!isLogin && formData.password !== formData.confirmPassword) {
      setMessage('รหัสผ่านไม่ตรงกัน');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? '/api/auth/' : '/api/register';
      
      // Use FormData for file upload in registration
      const requestData = isLogin ? 
        JSON.stringify(formData) : 
        (() => {
          const formDataObj = new FormData();
          formDataObj.append('name', formData.name);
          formDataObj.append('email', formData.email);
          formDataObj.append('password', formData.password);
          formDataObj.append('confirmPassword', formData.confirmPassword);
          if (profileImage) {
            formDataObj.append('profileImage', profileImage);
          }
          return formDataObj;
        })();

      const headers = isLogin ? 
        { 'Content-Type': 'application/json' } : 
        {}; // Let browser set Content-Type for FormData

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: requestData,
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message);
        if (isLogin) {
          // Save token and user data
          localStorage.setItem('token', result.token);
          localStorage.setItem('user', JSON.stringify(result.user));
          // Redirect to dashboard and replace history
          window.location.replace('/dashboard');
        } else {
          // Switch to login after successful registration
          setIsLogin(true);
          setFormData({ email: '', password: '', confirmPassword: '', name: '' });
          removeImage();
        }
      } else {
        setMessage(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      setMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }

    setLoading(false);
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setFormData({ email: '', password: '', confirmPassword: '', name: '' });
    setMessage('');
    removeImage();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            ฅนสกล | ยินดีต้อนรับ
          </h1>
          <p className="text-gray-600">
            {isLogin ? 'เข้าสู่ระบบเพื่อเริ่มใช้งาน' : 'สร้างบัญชีใหม่'}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Toggle Buttons */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                isLogin
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                !isLogin
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              สมัครสมาชิก
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Image (register only) */}
            {!isLogin && (
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  รูปโปรไฟล์ (ไม่จำเป็น)
                </label>
                <div className="flex flex-col items-center space-y-4">
                  {previewImage ? (
                    <div className="relative">
                      <img
                        src={previewImage}
                        alt="Profile preview"
                        className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <label className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg cursor-pointer transition-colors duration-200 text-sm">
                    {previewImage ? 'เปลี่ยนรูปภาพ' : 'เลือกรูปภาพ'}
                    <input
                      id="profile-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Name field (register only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                  placeholder="กรุณาใส่ชื่อ-นามสกุล"
                />
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                อีเมล
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                placeholder="example@email.com"
              />
            </div>

            {/* Password field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                รหัสผ่าน
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength="6"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร"
              />
            </div>

            {/* Confirm Password (register only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ยืนยันรหัสผ่าน
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  minLength="6"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
                  placeholder="ใส่รหัสผ่านอีกครั้ง"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl font-medium text-white transition-all duration-200 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transform hover:-translate-y-0.5 hover:shadow-lg'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  กำลังดำเนินการ...
                </div>
              ) : isLogin ? (
                'เข้าสู่ระบบ'
              ) : (
                'สร้างบัญชี'
              )}
            </button>
          </form>

          {/* Message */}
          {message && (
            <div className={`mt-4 p-3 rounded-xl text-center text-sm ${
              message.includes('สำเร็จ') || message.includes('ยินดี')
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              {message}
            </div>
          )}

        </div>

        {/* Bottom text */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            {isLogin ? 'ยังไม่มีบัญชี? ' : 'มีบัญชีแล้ว? '}
            <button
              onClick={switchMode}
              className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
            >
              {isLogin ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}