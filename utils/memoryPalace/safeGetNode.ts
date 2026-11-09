/**
 * 记忆节点单条读取兜底（按 id）。
 */

import { getNodeById } from './nodeRead';
import type { MemoryNode } from './types';

export async function safeGetNodeById(id: string): Promise<MemoryNode | null> {
    try {
        return await getNodeById(id);
    } catch (error) {
        console.error('[记忆宫殿] 单条记忆读取失败', id, error);
        return null;
    }
}
