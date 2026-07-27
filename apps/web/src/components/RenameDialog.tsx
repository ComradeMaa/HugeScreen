import { useState, type FormEvent, useEffect, useRef } from 'react';

interface RenameDialogProps {
  open: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}

export function RenameDialog({ open, currentName, onClose, onRename }: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      // 弹窗打开后自动聚焦并全选
      setTimeout(() => { inputRef.current?.select(); }, 50);
    }
  }, [open, currentName]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) { onClose(); return; }
    onRename(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2238]/70 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-gradient-to-b from-[#7181AC]/90 to-[#7181AC]/50 border border-[rgba(183,172,178,0.12)] rounded-2xl p-6 w-[360px] shadow-2xl shadow-[#1B2238]/60 backdrop-blur-xl"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[#E8E8EC] text-lg font-semibold mb-4">重命名模板</h2>
        <form onSubmit={handleSubmit}>
          <input ref={inputRef} type="text" value={name}
            onChange={(e) => setName(e.target.value)} required autoFocus
            className="w-full bg-[#1B2238]/50 border border-[rgba(183,172,178,0.12)] rounded-lg px-3 py-2.5 text-sm text-[#E8E8EC] placeholder-[#F1EFF2]/30 focus:outline-none focus:border-[#F1EFF2]/40 transition-all backdrop-blur-sm mb-4" />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs text-[#F1EFF2]/50 hover:text-[#F1EFF2] transition-colors">取消</button>
            <button type="submit"
              className="px-4 py-2 bg-gradient-to-r from-[#7181AC] to-[#7E8DB5] text-[#F1EFF2] text-xs font-semibold rounded-lg border border-[rgba(183,172,178,0.15)] hover:from-[#7E8DB5] transition-all">
              确定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
