import type { IntegrationAdapter } from "./types";

const adapters = new Map<string, IntegrationAdapter<unknown, unknown>>();
export function registerIntegrationAdapter<TExternal, TStaged>(adapter: IntegrationAdapter<TExternal, TStaged>): void {
  if (adapters.has(adapter.id)) throw new Error(`El adaptador ya está registrado: ${adapter.id}`);
  adapters.set(adapter.id, adapter as IntegrationAdapter<unknown, unknown>);
}
export function getIntegrationAdapter(id: string): IntegrationAdapter<unknown, unknown> {
  const adapter = adapters.get(id);
  if (!adapter) throw new Error(`Adaptador no soportado: ${id}`);
  return adapter;
}
export function listIntegrationAdapters(): string[] { return [...adapters.keys()].sort(); }
export function clearIntegrationAdapters(): void { adapters.clear(); }
