import { useEffect, useState, useCallback } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useRelativeTime } from '../hooks/useRelativeTime';
import { apiFetch } from '../utils/api';

interface PublishedViewItem {
  id: string;
  name: string;
  createdAt: string;
}

/** 已发布大屏单行记录：名称 + 发布时间 + 查看链接 + 删除按钮 */
function PublishedViewRow({ view, onDeleteRequest }: { view: PublishedViewItem; onDeleteRequest: (v: PublishedViewItem) => void }) {
  const relative = useRelativeTime(view.createdAt);
  return (
    <div className="group flex items-center gap-4 bg-gradient-to-r from-[#7E8DB5]/35 to-[#7181AC]/15
                    border border-[rgba(183,172,178,0.12)] rounded-xl px-4 py-3
                    hover:border-[rgba(183,172,178,0.35)] transition-all duration-200">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#E8E8EC] font-medium truncate">{view.name || '未命名'}</p>
        <p className="text-[11px] text-[#F1EFF2]/40 mt-0.5 font-mono">{view.id} · {relative}</p>
      </div>
      <a href={`/viewer?id=${view.id}`} target="_blank" rel="noreferrer"
        className="flex-shrink-0 px-3 py-1.5 bg-[#1B2238]/60 border border-[rgba(133,177,224,0.15)] text-[#F1EFF2]/70 text-xs rounded-lg hover:bg-[#1B2238] hover:text-[#F1EFF2] transition-all">
        查看 ↗
      </a>
      <button onClick={() => onDeleteRequest(view)}
        className="flex-shrink-0 px-3 py-1.5 bg-[#f87171]/10 border border-[#f87171]/20 text-[#f87171] text-xs rounded-lg hover:bg-[#f87171]/20 transition-all">
        删除
      </button>
    </div>
  );
}

export function ViewsPage() {
  const [views, setViews] = useState<PublishedViewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PublishedViewItem | null>(null);

  const fetchViews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/views');
      if (res.ok) {
        setViews(await res.json());
      } else {
        setError('加载失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/api/view/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        fetchViews();
      }
    } catch { /* ignore */ }
  };

  const handleClose = () => {
    // 脚本打开的新窗口可直接关闭；非脚本打开的则回退到模板管理
    if (window.opener) window.close();
    window.location.href = '/templates';
  };

  return (
    <div className="h-screen bg-[#1B2238] flex flex-col overflow-hidden relative">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-[#7181AC]/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full bg-[#F1EFF2]/5 blur-[120px] pointer-events-none" />

      {/* Header — 固定顶部 */}
      <header className="flex-shrink-0 border-b border-[rgba(133,177,224,0.08)] bg-gradient-to-r from-[#1B2238]/80 to-[#7181AC]/40 backdrop-blur-xl">
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#F1EFF2] to-[#A3C8F0] bg-clip-text text-transparent tracking-wider">
              HugeScreen
            </h1>
            <span className="text-sm text-[#F1EFF2]/40">已发布大屏</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleClose}
              className="text-xs text-[#F1EFF2]/40 hover:text-[#F1EFF2]/70 transition-colors">
              返回模板管理
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6 gap-4">
            <h2 className="text-[#F1EFF2]/80 text-base font-medium flex-shrink-0">我的发布</h2>
            <span className="text-xs text-[#F1EFF2]/40">{views.length} 个发布</span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-xs text-[#F1EFF2]/40">加载中...</div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-[#f87171] text-sm mb-3">{error}</p>
              <button onClick={fetchViews}
                className="px-4 py-2 bg-[#1B2238]/40 border border-[rgba(133,177,224,0.1)] text-[#F1EFF2]/60 text-xs rounded-lg hover:bg-[#1B2238]/60 hover:text-[#F1EFF2] transition-all">
                重试
              </button>
            </div>
          ) : views.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[rgba(133,177,224,0.15)] rounded-2xl">
              <p className="text-sm text-[#F1EFF2]/50 mb-1">还没有已发布的大屏</p>
              <p className="text-xs text-[#F1EFF2]/30">在模板管理器中点击模板上的「发布」即可生成永久链接</p>
            </div>
          ) : (
            <div className="space-y-2">
              {views.map(view => (
                <PublishedViewRow key={view.id} view={view} onDeleteRequest={setDeleteTarget} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除已发布大屏"
        message={deleteTarget
          ? `确定删除发布"${deleteTarget.name || '未命名'}"？删除后链接 /viewer?id=${deleteTarget.id} 将无法访问，此操作不可撤销。`
          : ''}
        confirmLabel="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
