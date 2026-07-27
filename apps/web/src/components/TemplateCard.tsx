import { useNavigate } from 'react-router-dom';
import { useRelativeTime } from '../hooks/useRelativeTime';

interface TemplateCardProps {
  id: string;
  name: string;
  updatedAt: string;
  onDeleted: () => void;
  onPublish: (id: string) => void;
  onDeleteRequest: (id: string, name: string) => void;
  onRename: (id: string, name: string) => void;
}

export function TemplateCard({ id, name, updatedAt, onDeleted, onPublish, onDeleteRequest, onRename }: TemplateCardProps) {
  const relative = useRelativeTime(updatedAt);
  const navigate = useNavigate();

  return (
    <div
      className="group bg-gradient-to-b from-[#7E8DB5] to-[#7181AC]/60 rounded-2xl border border-[rgba(183,172,178,0.15)]
                 overflow-hidden cursor-pointer hover:border-[rgba(183,172,178,0.4)] transition-all duration-200
                 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#1B2238]/50
                 shadow-[0_0_20px_rgba(183,172,178,0.06)] hover:shadow-[0_0_35px_rgba(183,172,178,0.12)]"
      onClick={() => navigate(`/editor/${id}`)}
    >
      {/* Thumbnail */}
      <div className="h-[120px] bg-[#1B2238]/40 flex items-center justify-center border-b border-[rgba(183,172,178,0.1)]">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="2" y="4" width="18" height="12" rx="2" stroke="#F1EFF2" strokeOpacity="0.3" strokeWidth="1" />
          <rect x="24" y="4" width="22" height="12" rx="2" stroke="#F1EFF2" strokeOpacity="0.12" strokeWidth="1" />
          <rect x="2" y="20" width="10" height="10" rx="2" stroke="#F1EFF2" strokeOpacity="0.2" strokeWidth="1" />
          <rect x="16" y="20" width="30" height="22" rx="2" stroke="#F1EFF2" strokeOpacity="0.15" strokeWidth="1" />
        </svg>
      </div>

      {/* Info */}
      <div className="p-3 relative">
        <h3 className="text-sm text-[#E8E8EC] font-medium truncate">{name}</h3>
        <p className="text-[11px] text-[#F1EFF2]/40 mt-1">{relative}</p>

        {/* Hover actions — CSS group-hover, no JS state bug */}
        <div className="absolute inset-0 bg-[#1B2238]/95 flex items-center justify-center gap-2 rounded-b-2xl backdrop-blur-sm
                        opacity-0 group-hover:opacity-100 transition-opacity duration-150"
             onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onRename(id, name)}
            className="px-3 py-1.5 bg-gradient-to-r from-[#7181AC] to-[#7E8DB5] text-[#F1EFF2] text-xs rounded-lg border border-[rgba(183,172,178,0.15)] hover:from-[#7E8DB5] transition-all">
            重命名
          </button>
          <button onClick={() => onPublish(id)}
            className="px-3 py-1.5 bg-[#1B2238]/60 border border-[rgba(183,172,178,0.15)] text-[#F1EFF2]/80 text-xs rounded-lg hover:bg-[#1B2238] transition-all">
            发布
          </button>
          <button onClick={() => onDeleteRequest(id, name)}
            className="px-3 py-1.5 bg-[#f87171]/10 border border-[#f87171]/20 text-[#f87171] text-xs rounded-lg hover:bg-[#f87171]/20 transition-all">
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
