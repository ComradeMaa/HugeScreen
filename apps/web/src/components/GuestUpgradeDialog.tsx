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
    if (result.success) { onClose(); }
    else { setError(result.error || '升级失败'); }
  }

  const inputCls = "w-full bg-[#0A032E]/50 border border-[rgba(133,177,224,0.12)] rounded-lg px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#85B1E0]/30 focus:outline-none focus:border-[#85B1E0]/40 transition-all backdrop-blur-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A032E]/70 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-gradient-to-b from-[#163268]/90 to-[#163268]/50 border border-[rgba(133,177,224,0.12)] rounded-2xl p-6 w-[360px] shadow-2xl shadow-[#0A032E]/60 backdrop-blur-xl"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[#E8E8EC] text-lg font-semibold mb-1">注册正式账号</h2>
        <p className="text-xs text-[#85B1E0]/50 mb-4">注册后，你的所有模板将永久保存。</p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-[#f87171]/10 border border-[#f87171]/20 rounded-lg text-[#f87171] text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="用户名" value={username}
            onChange={(e) => setUsername(e.target.value)} required className={inputCls + ' mb-3'} />
          <input type="password" placeholder="密码（至少6位）" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputCls + ' mb-4'} />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs text-[#85B1E0]/50 hover:text-[#85B1E0] transition-colors">取消</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-[#163268] to-[#1A4A8A] text-[#85B1E0] text-xs font-semibold rounded-lg border border-[rgba(133,177,224,0.15)] hover:from-[#1A4A8A] disabled:opacity-50 transition-all">
              {loading ? '注册中...' : '注册'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
