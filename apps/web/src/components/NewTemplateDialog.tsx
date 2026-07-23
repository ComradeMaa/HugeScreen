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
    try { await onCreate(name.trim()); setName(''); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2238]/70 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-gradient-to-b from-[#7181AC]/90 to-[#7181AC]/50 border border-[rgba(183,172,178,0.12)] rounded-2xl p-6 w-[360px] shadow-2xl shadow-[#1B2238]/60 backdrop-blur-xl"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[#E8E8EC] text-lg font-semibold mb-4">新建模板</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="模板名称" value={name}
            onChange={(e) => setName(e.target.value)} required autoFocus
            className="w-full bg-[#1B2238]/50 border border-[rgba(183,172,178,0.12)] rounded-lg px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#F1EFF2]/30 focus:outline-none focus:border-[#F1EFF2]/40 transition-all backdrop-blur-sm mb-4" />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs text-[#F1EFF2]/50 hover:text-[#F1EFF2] transition-colors">取消</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-[#7181AC] to-[#7E8DB5] text-[#F1EFF2] text-xs font-semibold rounded-lg border border-[rgba(183,172,178,0.15)] hover:from-[#7E8DB5] disabled:opacity-50 transition-all">
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
