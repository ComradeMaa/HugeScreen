import { useState, type FormEvent } from 'react';

interface NewTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function NewTemplateDialog({ open, onClose, onCreate }: NewTemplateDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate(name.trim());
      setName('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#363640] border border-[rgba(255,255,255,0.08)] rounded-xl p-6 w-[360px] shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[#E8E8EC] text-lg font-semibold mb-4">新建模板</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="模板名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            className="w-full bg-[#2C2C34] border border-[rgba(255,255,255,0.06)] rounded px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#9E9EA8] focus:outline-none focus:border-[#00D4FF]/50 transition-colors mb-4"
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs text-[#9E9EA8] hover:text-[#E8E8EC] transition-colors">
              取消
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-[#00D4FF] text-[#2C2C34] text-xs font-semibold rounded hover:bg-[#00D4FF]/80 disabled:opacity-50 transition-all">
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
