/**
 * 数据合并时保留用户 per-item 元数据。
 *
 * 为什么需要：独立组件与成员组件（自定义组件）共享同一份组件代码，
 * 但各自的外壳数据管道不同 —— 独立组件（ScreenCanvas.WidgetBody）与
 * 成员组件（CompositeChartWidget）都必须用本函数合并实时数据，
 * 否则数据源刷新会用新数据项整体覆盖用户配置，导致：
 *   - showLabelLine（引出标签线）勾选丢失（pie/bar 按索引回填）
 *   - image/video 手动固定（pinned）的条目被 API 数据覆盖
 *
 * ★ 两处外壳必须引用同一份实现，避免"独立有、成员没有"的能力漂移。
 */

/**
 * 合并新数据时保留已有 per-item 元数据（如 showLabelLine），
 * 图片/视频组件追加 API 数据而不覆盖手动固定（pinned）的条目。
 * @param newData 新到达的实时数据（mapData 转换后）
 * @param currentOpts 当前用户配置（options / slot.chartOptions）
 * @param chartType 组件类型（决定保留策略）
 */
export function mergePreservingMeta(
  newData: Record<string, unknown>,
  currentOpts: Record<string, unknown>,
  chartType: string,
): Record<string, unknown> {
  if (!newData || typeof newData !== 'object' || Array.isArray(newData)) return {};
  const merged = { ...newData };
  // pie/bar 图表：按索引从旧 categories 找回 showLabelLine 合并进新数据项
  if ((chartType === 'pie-chart' || chartType === 'bar-chart') && Array.isArray(newData.categories) && Array.isArray(currentOpts.categories)) {
    const oldCats = currentOpts.categories as Array<Record<string, unknown>>;
    merged.categories = (newData.categories as Array<Record<string, unknown>>).map((item, i) => {
      const oldItem = oldCats[i] as Record<string, unknown> | undefined;
      if (oldItem && oldItem.showLabelLine !== undefined) {
        return { ...item, showLabelLine: oldItem.showLabelLine };
      }
      return item;
    });
  }
  // 图片组件：保留 pinned=true 的图片，替换 pinned=false 的图片为 API 新数据
  if (chartType === 'image-widget' && Array.isArray(newData.images)) {
    const rawOld = Array.isArray(currentOpts.images) ? currentOpts.images : [];
    // 向后兼容：旧数据是 string[] → 视为 {url, pinned:true}（不丢失已有图片）
    const oldImages = rawOld.map((e: any) =>
      typeof e === 'string' ? { url: e, pinned: true } : e
    ) as Array<{ url: string; pinned?: boolean }>;
    const pinned = oldImages.filter((e: any) => e?.pinned);
    const pinnedUrls = new Set(pinned.map((p: any) => p.url));
    const newEntries = (newData.images as Array<{ url: string; pinned?: boolean }>).filter(
      (e: any) => !pinnedUrls.has(e.url)
    );
    merged.images = [...pinned, ...newEntries];
  }
  if (chartType === 'video-widget' && Array.isArray(newData.videos)) {
    const rawOld = Array.isArray(currentOpts.videos) ? currentOpts.videos : [];
    const oldVideos = rawOld.map((e: any) =>
      typeof e === 'string' ? { url: e, pinned: true } : e
    ) as Array<{ url: string; pinned?: boolean }>;
    const pinned = oldVideos.filter((e: any) => e?.pinned);
    const pinnedUrls = new Set(pinned.map((p: any) => p.url));
    const newEntries = (newData.videos as Array<{ url: string; pinned?: boolean }>).filter(
      (e: any) => !pinnedUrls.has(e.url)
    ).slice(0, 4 - pinned.length); // 最多4个
    merged.videos = [...pinned, ...newEntries];
  }
  return merged;
}
