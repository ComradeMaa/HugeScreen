import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PublishSuccessDialogProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

export function PublishSuccessDialog({ open, url, onClose }: PublishSuccessDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div className="absolute inset-0 bg-[#0A032E]/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />

          <motion.div
            className="relative bg-gradient-to-b from-[#163268]/90 to-[#163268]/50 border border-[rgba(133,177,224,0.12)] rounded-2xl p-6 w-[420px] shadow-2xl shadow-[#0A032E]/60 backdrop-blur-xl"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#34d399]/20 to-[#34d399]/5 flex items-center justify-center mx-auto mb-3 border border-[#34d399]/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-[#E8E8EC] text-base font-semibold">发布成功</h3>
            </div>

            <div className="bg-[#0A032E]/60 border border-[rgba(133,177,224,0.1)] rounded-lg px-3 py-2.5 mb-4 flex items-center justify-between backdrop-blur-sm">
              <span className="text-xs text-[#85B1E0] font-mono truncate flex-1 select-all">{url}</span>
              <button onClick={handleCopy}
                className={`ml-2 px-3 py-1 text-xs rounded-lg transition-all flex-shrink-0 ${
                  copied
                    ? 'bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/20'
                    : 'bg-gradient-to-r from-[#163268] to-[#1A4A8A] text-[#85B1E0] border border-[rgba(133,177,224,0.15)] hover:from-[#1A4A8A]'
                }`}>
                {copied ? '已复制' : '复制链接'}
              </button>
            </div>

            <p className="text-[11px] text-[#85B1E0]/40 text-center">将此链接分享给其他人即可查看大屏</p>

            <div className="flex justify-center mt-4">
              <button onClick={onClose}
                className="px-4 py-2 text-xs text-[#85B1E0]/50 hover:text-[#85B1E0] transition-colors">关闭</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
