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

export function TemplateCard({ id, name, updatedAt, onDeleted, onPublish, onDeleteRequest }: TemplateCardProps) {
  const [hover, setHover] = useState(false);
  const relative = useRelativeTime(updatedAt);
  const navigate = useNavigate();

  return (
    <div
      className="bg-gradient-to-b from-[#1E3F7A] to-[#163268]/60 rounded-2xl border border-[rgba(133,177,224,0.15)]
                 overflow-hidden cursor-pointer hover:border-[rgba(133,177,224,0.4)] transition-all duration-200
                 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#0A032E]/50
                 shadow-[0_0_20px_rgba(133,177,224,0.06)] hover:shadow-[0_0_35px_rgba(133,177,224,0.12)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => navigate(`/editor/${id}`)}
    >
      {/* Thumbnail */}
      <div className="h-[120px] bg-[#0A032E]/40 flex items-center justify-center border-b border-[rgba(133,177,224,0.1)]">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="2" y="4" width="18" height="12" rx="2" stroke="#85B1E0" strokeOpacity="0.3" strokeWidth="1" />
          <rect x="24" y="4" width="22" height="12" rx="2" stroke="#85B1E0" strokeOpacity="0.12" strokeWidth="1" />
          <rect x="2" y="20" width="10" height="10" rx="2" stroke="#85B1E0" strokeOpacity="0.2" strokeWidth="1" />
          <rect x="16" y="20" width="30" height="22" rx="2" stroke="#85B1E0" strokeOpacity="0.15" strokeWidth="1" />
        </svg>
      </div>

      {/* Info */}
      <div className="p-3 relative">
        <h3 className="text-sm text-[#E8E8EC] font-medium truncate">{name}</h3>
        <p className="text-[11px] text-[#85B1E0]/40 mt-1">{relative}</p>

        {/* Hover actions */}
        {hover && (
          <div className="absolute inset-0 bg-[#0A032E]/95 flex items-center justify-center gap-2 rounded-b-2xl backdrop-blur-sm"
               onClick={(e) => e.stopPropagation()}>
            <button onClick={() => navigate(`/editor/${id}`)}
              className="px-3 py-1.5 bg-gradient-to-r from-[#163268] to-[#1A4A8A] text-[#85B1E0] text-xs rounded-lg border border-[rgba(133,177,224,0.15)] hover:from-[#1A4A8A] transition-all">
              编辑
            </button>
            <button onClick={() => onPublish(id)}
              className="px-3 py-1.5 bg-[#0A032E]/60 border border-[rgba(133,177,224,0.15)] text-[#85B1E0]/80 text-xs rounded-lg hover:bg-[#0A032E] transition-all">
              发布
            </button>
            <button onClick={() => onDeleteRequest(id, name)}
              className="px-3 py-1.5 bg-[#f87171]/10 border border-[#f87171]/20 text-[#f87171] text-xs rounded-lg hover:bg-[#f87171]/20 transition-all">
              删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
