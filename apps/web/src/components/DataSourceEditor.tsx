import { useState, useEffect, useRef } from 'react';
import type { DataSourceConfig, DataSourceOptions } from '@hugescreen/shared';
import { getByPath, mapData } from '@hugescreen/data';

const DEFAULT_DS: DataSourceConfig = { type: 'static', config: {}, mapping: {} };

interface DataSourceEditorProps {
  dataSource: DataSourceConfig | undefined;
  chartType: string;
  onChange: (ds: DataSourceConfig) => void;
}

const inputCls =
  'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors';

/** 从 Authorization 头里取出裸 token（去掉各类前缀）用于展示。
 *  不论用户粘贴的是 bare-token / "Bearer xxx" / "Authorization: Bearer xxx"，
 *  都提取出裸 token 显示，setToken 统一再加一层 Bearer。 */
function extractBearer(headers?: Record<string, string>): string {
  let a = (headers?.Authorization ?? '').trim();
  // Strip "Authorization: Bearer " or "Authorization:" prefix
  const authIdx = a.toLowerCase().indexOf('authorization:');
  if (authIdx !== -1) {
    a = a.slice(authIdx + 14).trim(); // 14 = "Authorization:".length
  }
  // Strip "Bearer " prefix
  if (a.toLowerCase().startsWith('bearer ')) a = a.slice(7);
  return a;
}

/**
 * 数据源配置编辑器 — 普通组件与组合子槽位共用。
 * 支持 静态 / REST；REST 可配 URL、Bearer token、刷新间隔、jsonPath、字段映射，并可即时测试。
 */
export function DataSourceEditor({ dataSource, chartType, onChange }: DataSourceEditorProps) {
  const ds = dataSource ?? DEFAULT_DS;
  const cfg: DataSourceOptions = ds.config ?? {};
  const mapping = ds.mapping ?? {};
  const [test, setTest] = useState<{ loading: boolean; ok?: boolean; msg?: string; mapped?: string }>({ loading: false });

    const didFix = useRef(false);
  // Auto-correct stored header corruption from earlier versions on first render
  useEffect(() => {
    if (didFix.current) return;
    const h = cfg.headers;
    if (!h || !h.Authorization) return;
    const bare = extractBearerFromString(h.Authorization);
    if (bare && h.Authorization !== "Bearer " + bare) {
      didFix.current = true;
      const headers = { ...(cfg.headers ?? {}) };
      headers.Authorization = "Bearer " + bare;
      patchConfig({ headers });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const token = extractBearer(cfg.headers);
  const intervalSec = cfg.interval && cfg.interval >= 1000 ? Math.round(cfg.interval / 1000) : 0;

  const patchConfig = (p: Partial<DataSourceOptions>) => onChange({ ...ds, config: { ...cfg, ...p } });
  const setType = (type: DataSourceConfig['type']) => onChange({ ...ds, type });
  const setToken = (t: string) => {
    const headers = { ...(cfg.headers ?? {}) };
    if (t) headers.Authorization = `Bearer ${t}`;
    else delete headers.Authorization;
    patchConfig({ headers });
  };
  const setMapping = (m: Record<string, string>) => onChange({ ...ds, mapping: m });

  /** Build clean headers for fetch — always strip corruption and re-wrap the token */
function buildCleanHeaders(cfg) {
  const clean = {};
  if (cfg.headers) {
    for (const [k, v] of Object.entries(cfg.headers)) {
      if (k.toLowerCase() === "authorization") {
        const bare = extractBearerFromString(v);
        if (bare) clean.Authorization = "Bearer " + bare;
      } else {
        clean[k] = v;
      }
    }
  }
  return clean;
}

function extractBearerFromString(a) {
  let s = a.trim();
  const ai = s.toLowerCase().indexOf("authorization:");
  if (ai !== -1) s = s.slice(ai + 14).trim();
  if (s.toLowerCase().startsWith("bearer ")) s = s.slice(7);
  return s;
}

const [staticDraft, setStaticDraft] = useState<string | null>(null);

const mappingRows = Object.entries(mapping);

  async function testConnection() {
    if (!cfg.url) { setTest({ loading: false, ok: false, msg: '请先填写 URL' }); return; }
    setTest({ loading: true });
    try {
      const hdrs = buildCleanHeaders(cfg);
      const fetchOpts: RequestInit = { method: cfg.method ?? 'GET', headers: hdrs };
      if (cfg.method === 'POST' && cfg.body !== undefined) {
        fetchOpts.body = JSON.stringify(cfg.body);
        if (!hdrs['Content-Type'] && !hdrs['content-type']) {
          hdrs['Content-Type'] = 'application/json';
        }
      }
      const res = await fetch(cfg.url!, fetchOpts);
      if (!res.ok) { setTest({ loading: false, ok: false, msg: `HTTP ${res.status} ${res.statusText}` }); return; }
      const raw = await res.json();
      const extracted = cfg.jsonPath ? getByPath(raw, cfg.jsonPath) : raw;
      const mapped = mapData(extracted, chartType, mapping);
      const keys = Object.keys(mapped);
      setTest({
        loading: false, ok: true,
        msg: keys.length ? `成功 · 映射出 ${keys.join(', ')}` : '成功，但映射结果为空（检查 jsonPath / 字段映射）',
        mapped: JSON.stringify(mapped, null, 2).slice(0, 600),
      });
    } catch (e: unknown) {
      setTest({ loading: false, ok: false, msg: e instanceof Error ? e.message : '请求失败' });
    }
  }

  return (
    <div className="space-y-2.5">
      {/* 类型 */}
      <div className="flex gap-1.5">
        {(['static', 'rest'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 text-[11px] py-1.5 rounded border transition-colors ${
              ds.type === t
                ? 'border-accent-cool/50 text-accent-cool bg-accent-cool/5'
                : 'border-[rgba(255,255,255,0.06)] text-textSecondary/60 hover:text-textSecondary'
            }`}
          >
            {t === 'static' ? '静态' : 'REST 接口'}
          </button>
        ))}
      </div>

      {ds.type === 'rest' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-textSecondary/70">接口 URL</span>
            <input type="text" value={cfg.url ?? ''} placeholder="http://host:port/api/xxx"
              onChange={(e) => patchConfig({ url: e.target.value })} className={inputCls} />
          </label>

          <div className="flex gap-1.5">
            <span className="text-[11px] text-textSecondary/70 whitespace-nowrap pt-1.5">Method</span>
            {(['GET', 'POST'] as const).map((m) => (
              <button
                key={m}
                onClick={() => patchConfig({ method: m, ...(m === 'GET' ? { body: undefined } : {}) })}
                className={`flex-1 text-[11px] py-1 rounded border transition-colors ${
                  (cfg.method ?? 'GET') === m
                    ? 'border-accent-cool/50 text-accent-cool bg-accent-cool/5'
                    : 'border-[rgba(255,255,255,0.06)] text-textSecondary/60 hover:text-textSecondary'
                }`}
              >{m}</button>
            ))}
          </div>

          {cfg.method === 'POST' && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-textSecondary/70">POST Body (JSON)</span>
              <textarea
                rows={4}
                value={cfg.body ? JSON.stringify(cfg.body, null, 2) : ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  try { patchConfig({ body: v ? JSON.parse(v) : undefined }); } catch { /* allow partial JSON */ }
                }}
                placeholder='{"source":"mydb","query":"SELECT * FROM users"}'
                className={`${inputCls} font-mono resize-y`}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-textSecondary/70">鉴权 Token（Bearer）</span>
            <input type="text" value={token} placeholder="直接粘贴 token，无需加前缀"
              onChange={(e) => setToken(e.target.value)} className={`${inputCls} font-mono`} />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-textSecondary/70 whitespace-nowrap">刷新间隔(秒)</span>
            <input type="number" min={0} step={1} value={intervalSec}
              onChange={(e) => patchConfig({ interval: Math.max(0, Number(e.target.value)) * 1000 })}
              className={`${inputCls} w-20 text-right`} />
          </label>
          <p className="text-[10px] text-textSecondary/40 -mt-1">0 = 只拉取一次 · 最小轮询间隔 1 秒</p>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-textSecondary/70">jsonPath（可选）</span>
            <input type="text" value={cfg.jsonPath ?? ''} placeholder="如 data 或 items[0]"
              onChange={(e) => patchConfig({ jsonPath: e.target.value })} className={`${inputCls} font-mono`} />
          </label>

          {/* 字段映射（可选） */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">字段映射（可选）</span>
              <button
                onClick={() => setMapping({ ...mapping, '': '' })}
                className="text-[11px] text-accent-cool/70 hover:text-accent-cool px-1.5 rounded border border-[rgba(0,212,255,0.15)]"
              >+ 添加</button>
            </div>
            {mappingRows.length === 0 && (
              <p className="text-[10px] text-textSecondary/40">不填则用默认字段名（name/value/series/categories…）</p>
            )}
            {mappingRows.map(([k, v], i) => (
              <div key={i} className="flex items-center gap-1">
                <input type="text" value={k} placeholder="目标字段"
                  onChange={(e) => {
                    const next: Record<string, string> = {};
                    mappingRows.forEach(([kk, vv], j) => { next[j === i ? e.target.value : kk] = vv; });
                    setMapping(next);
                  }}
                  className={`${inputCls} flex-1 min-w-0 font-mono`} />
                <span className="text-textSecondary/40 text-[11px]">←</span>
                <input type="text" value={v} placeholder="源路径"
                  onChange={(e) => setMapping({ ...mapping, [k]: e.target.value })}
                  className={`${inputCls} flex-1 min-w-0 font-mono`} />
                <button
                  onClick={() => { const next = { ...mapping }; delete next[k]; setMapping(next); }}
                  className="text-textSecondary/40 hover:text-negative text-sm leading-none px-1"
                >×</button>
              </div>
            ))}
          </div>

          {/* 测试连接 */}
          <button
            onClick={testConnection}
            disabled={test.loading}
            className="w-full text-[11px] py-1.5 rounded border border-[rgba(0,212,255,0.25)] text-accent-cool hover:bg-accent-cool/5 transition-colors disabled:opacity-40"
          >
            {test.loading ? '测试中…' : '测试连接'}
          </button>

          {/* 独立请求 */}
          <label className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-textSecondary/70">发送独立请求</span>
            <input type="checkbox" checked={!!(cfg as any).independent}
              onChange={(e) => patchConfig({ ...cfg, independent: e.target.checked } as any)}
              className="rounded" />
          </label>
          <p className="text-[10px] text-textSecondary/40 -mt-1">勾选后不与其他组件共享请求，拥有独立的轮询周期</p>
          {test.msg && (
            <div className={`text-[11px] ${test.ok ? 'text-positive' : 'text-negative'}`}>{test.msg}</div>
          )}
          {test.ok && test.mapped && (
            <pre className="text-[10px] text-textSecondary/60 bg-surface-base rounded p-2 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">{test.mapped}</pre>
          )}
        </>
      )}

      {ds.type === 'static' && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-textSecondary/70">静态数据（JSON，可选）</span>
          <textarea
            rows={4}
            value={staticDraft !== null ? staticDraft : (ds.staticData != null ? JSON.stringify(ds.staticData, null, 2) : '')}
            onChange={(e) => setStaticDraft(e.target.value)}
            placeholder="留空则使用组件下方的数据编辑器"
            className={`${inputCls} font-mono resize-y`} />
          <button
            onClick={() => {
              const t = (staticDraft !== null ? staticDraft : (ds.staticData != null ? JSON.stringify(ds.staticData, null, 2) : '')).trim();
              if (!t) { onChange({ ...ds, staticData: undefined }); setStaticDraft(null); return; }
              try {
                const parsed = JSON.parse(t);
                onChange({ ...ds, staticData: parsed });
                setStaticDraft(null);
              } catch (e) {
                alert('JSON 解析失败: ' + (e instanceof Error ? e.message : e));
              }
            }}
            className="w-full text-[11px] py-1.5 rounded border border-[rgba(0,212,255,0.25)] text-accent-cool hover:bg-accent-cool/5 transition-colors"
          >
            ✓ 应用静态数据
          </button>
        </label>
      )}
    </div>
  );
}
