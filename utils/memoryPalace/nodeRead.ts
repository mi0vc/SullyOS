/**
 * 记忆节点的统一读取入口。
 *
 * 为什么单独拆一个文件：db.ts 里已经 import 了 bm25Index / supabaseVector 等，
 * 如果在 db.ts 内部去 import nodeNormalize，容易绕出循环。
 * 这里只依赖 openDB 与 normalize，依赖方向单一、看得清楚。
 *
 * 所有把记忆节点交给 UI 的地方都应该走这里，而不是直连 getByCharId，
 * 因为只有这里保证了「形状完整」这个前提。
 */

import { openDB } from '../db';
import type { MemoryNode } from './types';
import { normalizeMemoryNodeRecord } from './nodeNormalize';

/** 原始读取：不做任何兜底，仅供内部使用 */
async function readRawNodesByCharId(charId: string): Promise<unknown[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('memory_nodes', 'readonly');
        const index = tx.objectStore('memory_nodes').index('charId');
        const req = index.getAll(IDBKeyRange.only(charId));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

/** 读取某角色全部记忆，并逐条规整 */
export async function getAllNodesByCharId(
    charId: string,
): Promise<{ nodes: MemoryNode[]; skipped: number }> {
    const raw = await readRawNodesByCharId(charId);
    const nodes: MemoryNode[] = [];
    let skipped = 0;
    const now = Date.now();
    for (const item of raw) {
        const node = normalizeMemoryNodeRecord(item, now);
        if (node) nodes.push(node);
        else skipped += 1;
    }
    return { nodes, skipped };
}

/** 按 id 读取单条记忆，也会规整 */
export async function getNodeById(id: string): Promise<MemoryNode | null> {
    const db = await openDB();
    const raw = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('memory_nodes', 'readonly');
        const req = tx.objectStore('memory_nodes').get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return normalizeMemoryNodeRecord(raw);
}
