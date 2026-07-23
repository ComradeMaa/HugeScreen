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

  const inputCls = "w-full bg-[#0A032E]/60 border border-[rgba(133,177,224,0.12)] rounded-lg px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#85B1E0]/40 focus:outline-none focus:border-[#85B1E0]/50 transition-all backdrop-blur-sm";

  return (
    <div className="min-h-screen bg-[#0A032E] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 -left-20 w-[300px] h-[300px] rounded-full bg-[#163268]/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-[250px] h-[250px] rounded-full bg-[#85B1E0]/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[380px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#85B1E0] via-[#A3C8F0] to-[#85B1E0] bg-clip-text text-transparent tracking-wider">
            HugeScreen
          </h1>
          <p className="text-[#85B1E0]/40 text-xs mt-2 tracking-wide">数据可视化大屏平台</p>
        </div>

        {/* Card */}
        <div className="bg-gradient-to-b from-[#163268]/80 to-[#163268]/40 rounded-2xl border border-[rgba(133,177,224,0.12)] p-6 backdrop-blur-xl shadow-2xl shadow-[#0A032E]/50">
          {/* Tabs */}
          <div className="flex mb-6 border-b border-[rgba(133,177,224,0.1)]">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 pb-2.5 text-sm transition-all ${
                tab === 'login'
                  ? 'text-[#85B1E0] border-b-2 border-[#85B1E0] font-medium'
                  : 'text-[#85B1E0]/30 hover:text-[#85B1E0]/60'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 pb-2.5 text-sm transition-all ${
                tab === 'register'
                  ? 'text-[#85B1E0] border-b-2 border-[#85B1E0] font-medium'
                  : 'text-[#85B1E0]/30 hover:text-[#85B1E0]/60'
              }`}
            >
              注册
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2 bg-[#f87171]/10 border border-[#f87171]/20 rounded-lg text-[#f87171] text-xs">
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
                className={inputCls}
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
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-[#163268] to-[#1A4A8A] text-[#85B1E0] text-sm font-semibold rounded-lg border border-[rgba(133,177,224,0.15)] hover:from-[#1A4A8A] hover:to-[#1E5AAA] hover:border-[rgba(133,177,224,0.3)] disabled:opacity-50 transition-all shadow-lg shadow-[#0A032E]/30"
            >
              {loading ? '处理中...' : tab === 'login' ? '登 录' : '注 册'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-[rgba(133,177,224,0.08)]" />
            <span className="px-3 text-xs text-[#85B1E0]/30">或者</span>
            <div className="flex-1 border-t border-[rgba(133,177,224,0.08)]" />
          </div>

          {/* Guest */}
          <button
            onClick={handleGuest}
            disabled={loading}
            className="w-full py-2.5 bg-[#0A032E] border border-[rgba(133,177,224,0.15)] text-[#85B1E0]/70 text-sm rounded-lg hover:bg-[#0E0520] hover:text-[#85B1E0] hover:border-[rgba(133,177,224,0.3)] disabled:opacity-50 transition-all"
          >
            游客试用
          </button>
        </div>
      </div>
    </div>
  );
}
