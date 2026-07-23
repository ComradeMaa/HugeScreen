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

  const inputCls = "w-full bg-[#1B2238]/60 border border-[rgba(183,172,178,0.15)] rounded-lg px-3 py-2.5 text-sm text-[#F1EFF2] placeholder-[#B7ACB2]/50 focus:outline-none focus:border-[#7181AC] transition-all backdrop-blur-sm";

  return (
    <div className="min-h-screen bg-[#1B2238] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 -left-20 w-[300px] h-[300px] rounded-full bg-[#7181AC]/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-[250px] h-[250px] rounded-full bg-[#B7ACB2]/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[380px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#F1EFF2] tracking-wider">
            HugeScreen
          </h1>
          <p className="text-[#B7ACB2] text-xs mt-2 tracking-wide">数据可视化大屏平台</p>
        </div>

        {/* Card */}
        <div className="bg-gradient-to-b from-[#7181AC]/40 to-[#7181AC]/15 rounded-2xl border border-[rgba(183,172,178,0.12)] p-6 backdrop-blur-xl shadow-2xl shadow-[#1B2238]/50">
          {/* Tabs */}
          <div className="flex mb-6 border-b border-[rgba(183,172,178,0.12)]">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 pb-2.5 text-sm transition-all ${
                tab === 'login'
                  ? 'text-[#F1EFF2] border-b-2 border-[#7181AC] font-medium'
                  : 'text-[#B7ACB2] hover:text-[#F1EFF2]/70'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 pb-2.5 text-sm transition-all ${
                tab === 'register'
                  ? 'text-[#F1EFF2] border-b-2 border-[#7181AC] font-medium'
                  : 'text-[#B7ACB2] hover:text-[#F1EFF2]/70'
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
              <input type="text" placeholder="用户名" value={username}
                onChange={(e) => setUsername(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <input type="password" placeholder="密码（至少6位，需含字母和数字）" value={password}
                onChange={(e) => setPassword(e.target.value)} required={tab === 'register' || tab === 'login'}
                minLength={6} className={inputCls} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#7181AC] text-[#F1EFF2] text-sm font-semibold rounded-lg hover:bg-[#7E8DB5] disabled:opacity-50 transition-all shadow-lg shadow-[#1B2238]/30">
              {loading ? '处理中...' : tab === 'login' ? '登 录' : '注 册'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-[rgba(183,172,178,0.1)]" />
            <span className="px-3 text-xs text-[#B7ACB2]/50">或者</span>
            <div className="flex-1 border-t border-[rgba(183,172,178,0.1)]" />
          </div>

          {/* Guest */}
          <button onClick={handleGuest} disabled={loading}
            className="w-full py-2.5 bg-[#1B2238]/40 border border-[rgba(183,172,178,0.12)] text-[#B7ACB2] text-sm rounded-lg hover:bg-[#1B2238]/60 hover:text-[#F1EFF2] hover:border-[rgba(183,172,178,0.2)] disabled:opacity-50 transition-all backdrop-blur-sm">
            游客试用
          </button>
        </div>
      </div>
    </div>
  );
}
