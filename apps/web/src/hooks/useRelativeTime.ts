import { useMemo } from 'react';

/**
 * 将 ISO 时间字符串转为中文相对时间。
 */
export function useRelativeTime(isoStr: string | undefined): string {
  return useMemo(() => {
    if (!isoStr) return '';
    const now = Date.now();
    const then = new Date(isoStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    if (days < 30) return `${Math.floor(days / 7)} 周前`;
    return new Date(isoStr).toLocaleString('zh-CN', { month: 'short', day: 'numeric' });
  }, [isoStr]);
}
