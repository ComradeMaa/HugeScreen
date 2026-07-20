import type { CompositeSubChartType } from '@hugescreen/shared';
import { widgetRegistry } from '@hugescreen/core';

/**
 * Get default chart options for a given sub-chart type.
 * Delegates to the corresponding widget's defaultConfig from the registry.
 */
export function getDefaultSubChartOptions(chartType: CompositeSubChartType): Record<string, unknown> {
  const def = widgetRegistry.get(chartType);
  if (!def?.defaultConfig) return {};

  // Return a deep copy of the default config to avoid mutation
  return JSON.parse(JSON.stringify(def.defaultConfig));
}

/** Generate a short unique ID for a slot */
export function generateSlotId(): string {
  return `slot_${Math.random().toString(36).slice(2, 8)}`;
}
