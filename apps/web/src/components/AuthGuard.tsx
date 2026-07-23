import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * 根路由守卫 — 检查 token，有效跳模板页，无效跳登录。
 */
export function AuthGuard() {
  const { user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1B2238] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F1EFF2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/templates" replace />;
  }

  return <Navigate to="/login" replace />;
}
