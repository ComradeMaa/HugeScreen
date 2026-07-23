import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register, loginAsGuest } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/templates';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
      navigate(redirect, { replace: true });
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setError('');
    setLoading(true);
    try {
      await loginAsGuest();
      navigate(redirect, { replace: true });
    } catch (err: any) {
      setError(err.message || '游客登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#2C2C34] flex items-center justify-center p-4">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#00D4FF] tracking-wider">HugeScreen</h1>
          <p className="text-[#9E9EA8] text-xs mt-1">数据可视化大屏平台</p>
        </div>

        {/* Card */}
        <div className="bg-[#363640] rounded-xl border border-[rgba(255,255,255,0.06)] p-6">
          {/* Tabs */}
          <div className="flex mb-6 border-b border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 pb-2 text-sm transition-colors ${
                tab === 'login'
                  ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]'
                  : 'text-[#9E9EA8] hover:text-[#E8E8EC]'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 pb-2 text-sm transition-colors ${
                tab === 'register'
                  ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]'
                  : 'text-[#9E9EA8] hover:text-[#E8E8EC]'
              }`}
            >
              注册
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2 bg-[#f87171]/10 border border-[#f87171]/30 rounded text-[#f87171] text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-[#2C2C34] border border-[rgba(255,255,255,0.06)] rounded px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#9E9EA8] focus:outline-none focus:border-[#00D4FF]/50 transition-colors"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="密码（至少6位，需含字母和数字）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={tab === 'register' || tab === 'login'}
                minLength={6}
                className="w-full bg-[#2C2C34] border border-[rgba(255,255,255,0.06)] rounded px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#9E9EA8] focus:outline-none focus:border-[#00D4FF]/50 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#00D4FF] text-[#2C2C34] text-sm font-semibold rounded hover:bg-[#00D4FF]/90 disabled:opacity-50 transition-all"
            >
              {loading ? '处理中...' : tab === 'login' ? '登 录' : '注 册'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-[rgba(255,255,255,0.06)]" />
            <span className="px-3 text-xs text-[#9E9EA8]">或者</span>
            <div className="flex-1 border-t border-[rgba(255,255,255,0.06)]" />
          </div>

          {/* Guest */}
          <button
            onClick={handleGuest}
            disabled={loading}
            className="w-full py-2.5 bg-[#2C2C34] border border-[rgba(255,255,255,0.08)] text-[#9E9EA8] text-sm rounded hover:bg-[#363640] hover:text-[#E8E8EC] disabled:opacity-50 transition-all"
          >
            游客试用
          </button>
        </div>
      </div>
    </div>
  );
}
