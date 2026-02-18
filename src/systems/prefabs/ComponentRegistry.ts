import type { Component } from "../../engine/core/GameObject"
import type { PrefabNode } from "./PrefabNode"

export type ComponentJSON = Record<string, unknown> & { type: string }

export interface PrefabComponentFactory {
  fromPrefabJSON(json: ComponentJSON, node: PrefabNode): Component | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrefabComponentConstructor = (new (...args: any[]) => Component) &
  PrefabComponentFactory

class ComponentRegistryImpl {
  private registry = new Map<string, PrefabComponentConstructor>()

  register(typeName: string, componentClass: PrefabComponentConstructor): void {
    if (this.registry.has(typeName)) {
      console.warn(`Component type "${typeName}" is already registered. Overwriting.`)
    }
    this.registry.set(typeName, componentClass)
  }

  get(typeName: string): PrefabComponentConstructor | undefined {
    return this.registry.get(typeName)
  }

  has(typeName: string): boolean {
    return this.registry.has(typeName)
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys())
  }
}

export const ComponentRegistry = new ComponentRegistryImpl()
