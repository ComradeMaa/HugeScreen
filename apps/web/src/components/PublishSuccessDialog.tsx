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
      // fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            className="relative bg-[#363640] border border-[rgba(255,255,255,0.08)] rounded-xl p-6 w-[400px] shadow-2xl shadow-black/40"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[#34d399]/15 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-[#E8E8EC] text-base font-semibold">发布成功</h3>
            </div>

            <div className="bg-[#2C2C34] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5 mb-4 flex items-center justify-between">
              <span className="text-xs text-[#E8E8EC] font-mono truncate flex-1 select-all">{url}</span>
              <button
                onClick={handleCopy}
                className={`ml-2 px-3 py-1 text-xs rounded transition-colors flex-shrink-0 ${
                  copied
                    ? 'bg-[#34d399]/15 text-[#34d399]'
                    : 'bg-[#00D4FF] text-[#2C2C34] hover:bg-[#00D4FF]/80'
                }`}
              >
                {copied ? '已复制' : '复制链接'}
              </button>
            </div>

            <p className="text-[11px] text-[#9E9EA8] text-center">
              将此链接分享给其他人即可查看大屏
            </p>

            <div className="flex justify-center mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs text-[#9E9EA8] hover:text-[#E8E8EC] transition-colors"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
