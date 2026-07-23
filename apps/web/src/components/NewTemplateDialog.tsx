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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A032E]/70 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-gradient-to-b from-[#163268]/90 to-[#163268]/50 border border-[rgba(133,177,224,0.12)] rounded-2xl p-6 w-[360px] shadow-2xl shadow-[#0A032E]/60 backdrop-blur-xl"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[#E8E8EC] text-lg font-semibold mb-4">新建模板</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="模板名称" value={name}
            onChange={(e) => setName(e.target.value)} required autoFocus
            className="w-full bg-[#0A032E]/50 border border-[rgba(133,177,224,0.12)] rounded-lg px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#85B1E0]/30 focus:outline-none focus:border-[#85B1E0]/40 transition-all backdrop-blur-sm mb-4" />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs text-[#85B1E0]/50 hover:text-[#85B1E0] transition-colors">取消</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-[#163268] to-[#1A4A8A] text-[#85B1E0] text-xs font-semibold rounded-lg border border-[rgba(133,177,224,0.15)] hover:from-[#1A4A8A] disabled:opacity-50 transition-all">
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
