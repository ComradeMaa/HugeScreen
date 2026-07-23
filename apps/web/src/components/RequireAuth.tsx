import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect, type ReactNode } from 'react';

/**
 * 需要登录才能访问的包装组件。
 * 未登录 → 跳转 /login?redirect=xxx
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A032E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#85B1E0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}
