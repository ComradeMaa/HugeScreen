import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { TemplateCard } from '../components/TemplateCard';
import { NewTemplateDialog } from '../components/NewTemplateDialog';
import { GuestUpgradeDialog } from '../components/GuestUpgradeDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PublishSuccessDialog } from '../components/PublishSuccessDialog';
import { RenameDialog } from '../components/RenameDialog';
import { apiFetch } from '../utils/api';
import defaultScreenConfig from '../store/defaultScreenConfig.json';

interface TemplateItem {
  id: string;
  name: string;
  updatedAt: string;
  thumbnail?: string | null;
}

export function TemplatePage() {
  const { user, logout } = useAuthStore();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = searchQuery.trim()
    ? templates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : templates;

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/templates');
      if (res.ok) {
        setTemplates(await res.json());
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
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = async (name: string) => {
    const res = await apiFetch('/api/templates', {
      method: 'POST',
      body: JSON.stringify({ name, config: defaultScreenConfig }),
    });
    if (res.ok) {
      setShowNew(false);
      fetchTemplates();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/api/templates/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        fetchTemplates();
      }
    } catch { /* ignore */ }
  };

  const handleRename = async (newName: string) => {
    if (!renameTarget) return;
    const { id } = renameTarget;
    // 乐观更新本地状态
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
    setRenameTarget(null);
    try {
      const res = await apiFetch(`/api/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) fetchTemplates();
    } catch {
      fetchTemplates();
    }
  };

  const handlePublish = async (templateId: string) => {
    const res = await apiFetch(`/api/templates/${templateId}`);
    if (!res.ok) return alert('获取模板失败');
    const tpl = await res.json();

    const pubRes = await apiFetch('/api/view', {
      method: 'POST',
      body: JSON.stringify({ ...tpl.config, name: tpl.name }),
    });
    if (pubRes.ok) {
      const data = await pubRes.json();
      setPublishUrl(`${window.location.origin}${data.url}`);
    } else {
      alert('发布失败');
    }
  };

  const btnPrimary = "px-4 py-2 bg-gradient-to-r from-[#7181AC] to-[#7E8DB5] text-[#F1EFF2] text-xs font-semibold rounded-lg border border-[rgba(133,177,224,0.15)] hover:from-[#7E8DB5] hover:to-[#1E5AAA] hover:border-[rgba(133,177,224,0.3)] transition-all shadow-lg shadow-[#1B2238]/30";
  const btnGhost = "px-4 py-2 bg-[#1B2238]/40 border border-[rgba(133,177,224,0.1)] text-[#F1EFF2]/60 text-xs rounded-lg hover:bg-[#1B2238]/60 hover:text-[#F1EFF2] hover:border-[rgba(133,177,224,0.2)] transition-all";

  return (
    <div className="h-screen bg-[#1B2238] flex flex-col overflow-hidden relative">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-[#7181AC]/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full bg-[#F1EFF2]/5 blur-[120px] pointer-events-none" />

      {/* Header — 固定顶部 */}
      <header className="flex-shrink-0 border-b border-[rgba(133,177,224,0.08)] bg-gradient-to-r from-[#1B2238]/80 to-[#7181AC]/40 backdrop-blur-xl">
          <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#F1EFF2] to-[#A3C8F0] bg-clip-text text-transparent tracking-wider">
              HugeScreen
            </h1>
            <div className="flex items-center gap-4">
              {!!user?.is_guest && (
                <button onClick={() => setShowUpgrade(true)}
                  className="text-xs text-[#F1EFF2]/70 hover:text-[#F1EFF2] transition-colors">
                  升级账号
                </button>
              )}
              <span className="text-sm text-[#F1EFF2]/60">欢迎, {user?.username}</span>
              <button onClick={logout}
                className="text-xs text-[#F1EFF2]/40 hover:text-[#F1EFF2]/70 transition-colors">
                退出登录
              </button>
            </div>
          </div>
        </header>

        {/* Guest banner */}
        {!!user?.is_guest && (
          <div className="bg-[#7181AC]/20 border-b border-[rgba(133,177,224,0.06)] px-6 py-2 text-center backdrop-blur-sm">
            <span className="text-xs text-[#F1EFF2]/60">你是游客用户，模板将在关闭浏览器后丢失。</span>
            <button onClick={() => setShowUpgrade(true)}
              className="ml-2 text-xs text-[#F1EFF2] underline hover:no-underline">立即注册</button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          {/* Search bar + new button */}
          <div className="flex items-center justify-between mb-6 gap-4">
            <h2 className="text-[#F1EFF2]/80 text-base font-medium flex-shrink-0">我的模板</h2>
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <input
                type="text"
                placeholder="搜索模板名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-[#1B2238]/50 border border-[rgba(133,177,224,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8E8EC] placeholder-[#F1EFF2]/30 focus:outline-none focus:border-[#F1EFF2]/40 transition-all backdrop-blur-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="text-xs text-[#F1EFF2]/50 hover:text-[#F1EFF2] transition-colors flex-shrink-0">
                  清除
                </button>
              )}
            </div>
            <button onClick={() => setShowNew(true)} className={btnPrimary}>
              + 新建模板
            </button>
          </div>

          {/* Content area */}
          <div className="transition-opacity duration-200" style={{ opacity: loading ? 0 : 1 }}>

            {/* Error */}
            {!loading && error && (
              <div className="text-center py-16">
                <p className="text-[#f87171] text-sm mb-3">{error}</p>
                <button onClick={fetchTemplates} className={btnGhost}>重试</button>
              </div>
            )}

            {/* Search empty */}
            {!loading && !error && filteredTemplates.length === 0 && searchQuery.trim() && (
              <div className="text-center py-16">
                <div className="text-4xl mb-3 opacity-20">
                  <svg className="mx-auto" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F1EFF2" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>
                <p className="text-sm text-[#F1EFF2]/60 mb-1">未找到匹配"<span className="text-[#F1EFF2]">{searchQuery.trim()}</span>"的模板</p>
                <p className="text-xs text-[#F1EFF2]/30 mb-4">试试其他关键词</p>
                <button onClick={() => setSearchQuery('')} className={btnGhost}>清除搜索</button>
              </div>
            )}

            {/* Empty (no templates) */}
            {!loading && !error && filteredTemplates.length === 0 && !searchQuery.trim() && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4 text-[#F1EFF2]/10">+</div>
                <p className="text-sm text-[#F1EFF2]/50 mb-4">还没有模板</p>
                <button onClick={() => setShowNew(true)} className={btnPrimary}>
                  新建第一个模板
                </button>
              </div>
            )}

            {/* Grid */}
            {!loading && !error && filteredTemplates.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(tpl => (
                  <TemplateCard
                    key={tpl.id}
                    id={tpl.id}
                    name={tpl.name}
                    updatedAt={tpl.updatedAt}
                    thumbnail={tpl.thumbnail}
                    onDeleted={fetchTemplates}
                    onPublish={handlePublish}
                    onDeleteRequest={(id, name) => setDeleteTarget({ id, name })}
                    onRename={(id, name) => setRenameTarget({ id, name })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        </div>{/* end scrollable */}

        {/* Dialogs */}
        <NewTemplateDialog open={showNew} onClose={() => setShowNew(false)} onCreate={handleCreate} />
        <GuestUpgradeDialog open={showUpgrade} onClose={() => setShowUpgrade(false)} />
        <RenameDialog
          open={renameTarget !== null}
          currentName={renameTarget?.name ?? ''}
          onClose={() => setRenameTarget(null)}
          onRename={handleRename}
        />
        <ConfirmDialog
          open={deleteTarget !== null}
          title="删除模板"
          message={deleteTarget ? `确定删除模板"${deleteTarget.name}"？此操作不可撤销。` : ''}
          confirmLabel="删除"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
        <PublishSuccessDialog
          open={publishUrl !== null}
          url={publishUrl || ''}
          onClose={() => setPublishUrl(null)}
        />
    </div>
  );
}
