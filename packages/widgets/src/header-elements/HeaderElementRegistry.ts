import type { ComponentType } from 'react';

export interface HeaderElementDefinition {
  type: string;
  name: string;
  icon: string;
  defaultColSpan: number;
  component: ComponentType<any>;
  defaultConfig: Record<string, unknown>;
}

class HeaderElementRegistry {
  private elements = new Map<string, HeaderElementDefinition>();

  register(def: HeaderElementDefinition): void {
    if (this.elements.has(def.type)) {
      console.warn(`[HeaderRegistry] "${def.type}" already registered, overwriting.`);
    }
    this.elements.set(def.type, def);
  }

  get(type: string): HeaderElementDefinition | undefined {
    return this.elements.get(type);
  }

  getAll(): HeaderElementDefinition[] {
    return Array.from(this.elements.values());
  }
}

export const headerElementRegistry = new HeaderElementRegistry();
