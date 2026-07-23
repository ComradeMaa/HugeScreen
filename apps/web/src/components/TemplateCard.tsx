import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRelativeTime } from '../hooks/useRelativeTime';

interface TemplateCardProps {
  id: string;
  name: string;
  updatedAt: string;
  onDeleted: () => void;
  onPublish: (id: string) => void;
  onDeleteRequest: (id: string, name: string) => void;
}

/**
 * 模板卡片 — 缩略图 + 名称 + hover 操作按钮。
 */
export function TemplateCard({ id, name, updatedAt, onDeleted, onPublish, onDeleteRequest }: TemplateCardProps) {
  const [hover, setHover] = useState(false);
  const relative = useRelativeTime(updatedAt);
  const navigate = useNavigate();

  return (
    <div
      className="bg-[#363640] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden cursor-pointer
                 hover:border-[rgba(0,212,255,0.25)] transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-[#00D4FF]/5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => navigate(`/editor/${id}`)}
    >
      {/* Thumbnail placeholder */}
      <div className="h-[120px] bg-[#2C2C34] flex items-center justify-center border-b border-[rgba(255,255,255,0.04)]">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="2" y="4" width="18" height="12" rx="2" stroke="#00D4FF" strokeOpacity="0.3" strokeWidth="1" />
          <rect x="24" y="4" width="22" height="12" rx="2" stroke="#00D4FF" strokeOpacity="0.15" strokeWidth="1" />
          <rect x="2" y="20" width="10" height="10" rx="2" stroke="#FF8C42" strokeOpacity="0.2" strokeWidth="1" />
          <rect x="16" y="20" width="30" height="22" rx="2" stroke="#00D4FF" strokeOpacity="0.2" strokeWidth="1" />
        </svg>
      </div>

      {/* Info */}
      <div className="p-3 relative">
        <h3 className="text-sm text-[#E8E8EC] font-medium truncate">{name}</h3>
        <p className="text-[11px] text-[#9E9EA8] mt-1">{relative}</p>

        {/* Hover actions */}
        {hover && (
          <div className="absolute inset-0 bg-[#2C2C34]/90 flex items-center justify-center gap-2 rounded-b-xl"
               onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => navigate(`/editor/${id}`)}
              className="px-3 py-1.5 bg-[#00D4FF] text-[#2C2C34] text-xs rounded hover:bg-[#00D4FF]/80 transition-colors"
            >
              编辑
            </button>
            <button
              onClick={() => onPublish(id)}
              className="px-3 py-1.5 bg-[#363640] border border-[rgba(255,255,255,0.1)] text-[#E8E8EC] text-xs rounded hover:bg-[#363640]/80 transition-colors"
            >
              发布
            </button>
            <button
              onClick={() => onDeleteRequest(id, name)}
              className="px-3 py-1.5 bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] text-xs rounded hover:bg-[#f87171]/20 transition-colors"
            >
              删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
