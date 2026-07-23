import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';

interface GuestUpgradeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GuestUpgradeDialog({ open, onClose }: GuestUpgradeDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { upgradeGuest } = useAuthStore();

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await upgradeGuest(username, password);
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || '升级失败');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#363640] border border-[rgba(255,255,255,0.08)] rounded-xl p-6 w-[360px] shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[#E8E8EC] text-lg font-semibold mb-1">注册正式账号</h2>
        <p className="text-xs text-[#9E9EA8] mb-4">注册后，你的所有模板将永久保存。</p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-[#f87171]/10 border border-[#f87171]/30 rounded text-[#f87171] text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="用户名" value={username}
            onChange={(e) => setUsername(e.target.value)} required
            className="w-full bg-[#2C2C34] border border-[rgba(255,255,255,0.06)] rounded px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#9E9EA8] focus:outline-none focus:border-[#00D4FF]/50 transition-colors mb-3" />
          <input type="password" placeholder="密码（至少6位）" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={6}
            className="w-full bg-[#2C2C34] border border-[rgba(255,255,255,0.06)] rounded px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#9E9EA8] focus:outline-none focus:border-[#00D4FF]/50 transition-colors mb-4" />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs text-[#9E9EA8] hover:text-[#E8E8EC]">取消</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-[#00D4FF] text-[#2C2C34] text-xs font-semibold rounded hover:bg-[#00D4FF]/80 disabled:opacity-50">
              {loading ? '注册中...' : '注册'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
