import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { TemplateCard } from '../components/TemplateCard';
import { NewTemplateDialog } from '../components/NewTemplateDialog';
import { GuestUpgradeDialog } from '../components/GuestUpgradeDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PublishSuccessDialog } from '../components/PublishSuccessDialog';
import { apiFetch } from '../utils/api';
import defaultScreenConfig from '../store/defaultScreenConfig.json';

interface TemplateItem {
  id: string;
  name: string;
  updatedAt: string;
}

export function TemplatePage() {
  const { user, logout } = useAuthStore();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);

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
      body: JSON.stringify({
        name,
        config: defaultScreenConfig,
      }),
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

  const handlePublish = async (templateId: string) => {
    // Fetch template config, then publish
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

  return (
    <div className="min-h-screen bg-[#2C2C34]">
      {/* Header */}
      <header className="border-b border-[rgba(255,255,255,0.06)] bg-[#363640]">
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="text-[#00D4FF] font-bold text-lg tracking-wider">HugeScreen</h1>
          <div className="flex items-center gap-4">
            {!!user?.is_guest && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="text-xs text-[#FF8C42] hover:text-[#FF8C42]/80 transition-colors"
              >
                升级账号
              </button>
            )}
            <span className="text-sm text-[#9E9EA8]">欢迎, {user?.username}</span>
            <button
              onClick={logout}
              className="text-xs text-[#9E9EA8] hover:text-[#E8E8EC] transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* Guest banner */}
      {!!user?.is_guest && (
        <div className="bg-[#FF8C42]/10 border-b border-[#FF8C42]/20 px-6 py-2 text-center">
          <span className="text-xs text-[#FF8C42]">
            你是游客用户，模板将在关闭浏览器后丢失。
          </span>
          <button onClick={() => setShowUpgrade(true)}
            className="ml-2 text-xs text-[#FF8C42] underline hover:no-underline">
            立即注册
          </button>
        </div>
      )}

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[#E8E8EC] text-base font-medium">我的模板</h2>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-[#00D4FF] text-[#2C2C34] text-xs font-semibold rounded hover:bg-[#00D4FF]/80 transition-colors"
          >
            + 新建模板
          </button>
        </div>

        {/* Content area */}
        <div className="transition-opacity duration-200" style={{ opacity: loading ? 0 : 1 }}>
          {/* Error */}
          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-[#f87171] text-sm mb-3">{error}</p>
              <button onClick={fetchTemplates}
                className="px-4 py-2 bg-[#363640] border border-[rgba(255,255,255,0.1)] text-sm text-[#E8E8EC] rounded hover:bg-[#363640]/80">
                重试
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && templates.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4 opacity-30">+</div>
              <p className="text-sm text-[#9E9EA8] mb-4">还没有模板</p>
              <button onClick={() => setShowNew(true)}
                className="px-4 py-2 bg-[#00D4FF] text-[#2C2C34] text-xs font-semibold rounded hover:bg-[#00D4FF]/80">
                新建第一个模板
              </button>
            </div>
          )}

          {/* Grid */}
          {!loading && !error && templates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(tpl => (
              <TemplateCard
                key={tpl.id}
                id={tpl.id}
                name={tpl.name}
                updatedAt={tpl.updatedAt}
                onDeleted={fetchTemplates}
                onPublish={handlePublish}
                onDeleteRequest={(id, name) => setDeleteTarget({ id, name })}
              />
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Dialogs */}
      <NewTemplateDialog open={showNew} onClose={() => setShowNew(false)} onCreate={handleCreate} />
      <GuestUpgradeDialog open={showUpgrade} onClose={() => setShowUpgrade(false)} />
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
