import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message,
  confirmLabel = '确认', cancelLabel = '取消',
  danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div className="absolute inset-0 bg-[#1B2238]/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} />

          <motion.div
            className="relative bg-gradient-to-b from-[#7181AC]/90 to-[#7181AC]/50 border border-[rgba(183,172,178,0.12)] rounded-2xl p-6 w-[360px] shadow-2xl shadow-[#1B2238]/60 backdrop-blur-xl"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <h3 className="text-[#E8E8EC] text-base font-semibold mb-2">{title}</h3>
            <p className="text-[#85B1E0]/60 text-sm leading-relaxed mb-6">{message}</p>

            <div className="flex justify-end gap-3">
              <button onClick={onCancel}
                className="px-4 py-2 text-xs text-[#85B1E0]/50 hover:text-[#85B1E0] bg-[#1B2238]/40 border border-[rgba(183,172,178,0.08)] rounded-lg transition-all">
                {cancelLabel}
              </button>
              <button onClick={onConfirm}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  danger
                    ? 'bg-[#f87171]/15 text-[#f87171] border border-[#f87171]/20 hover:bg-[#f87171]/25'
                    : 'bg-gradient-to-r from-[#7181AC] to-[#7E8DB5] text-[#85B1E0] border border-[rgba(183,172,178,0.15)] hover:from-[#7E8DB5]'
                }`}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
