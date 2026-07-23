import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainScreen } from './pages/MainScreen';
import { LoginPage } from './pages/LoginPage';
import { AuthGuard } from './components/AuthGuard';
import { RequireAuth } from './components/RequireAuth';
import { TemplatePage } from './pages/TemplatePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 根路由 — 自动跳转 */}
        <Route path="/" element={<AuthGuard />} />

        {/* 登录页 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 模板管理 — 需要登录 */}
        <Route path="/templates" element={
          <RequireAuth><TemplatePage /></RequireAuth>
        } />

        {/* 编辑器 — 复用 MainScreen，传入 templateId */}
        <Route path="/editor/:templateId" element={
          <RequireAuth><MainScreen /></RequireAuth>
        } />

        {/* 向后兼容 — 旧的 /screen 路由，无需认证 */}
        <Route path="/screen" element={<MainScreen />} />

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
