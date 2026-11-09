import { normalizeMemoryNodeRecord } from './nodeNormalize';
import type { MemoryNode } from './types';

/** 规整读取钩子：db.ts 的 MemoryNodeDB 初始化时会把它接上 */
export let normalizeHook: ((raw: unknown) => MemoryNode | null) | null = null;

export function setNormalizeHook(fn: (raw: unknown) => MemoryNode | null): void {
    normalizeHook = fn;
}

export function applyNormalize(raw: unknown): MemoryNode | null {
    if (!normalizeHook) return normalizeMemoryNodeRecord(raw);
    return normalizeHook(raw);
}
