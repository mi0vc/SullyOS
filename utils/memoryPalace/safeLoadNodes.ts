/*
 * 霂淶：记忆读取出错时丢掉单条，不拖垮整页。
 */
import type { MemoryNode } from './types';
import { getAllNodesByCharId } from './nodeRead';

/** 已经被规整过的（理论上不会抛），这里再兜一层，防止异常数据在规整内部抛错 */
export async function safeLoadAllNodes(
    charId: string,
): Promise<{ nodes: MemoryNode[]; skipped: number }> {
    try {
        return await getAllNodesByCharId(charId);
    } catch (error) {
        console.error('[记忆宫殿] 记忆读取失败，已降级为空列表', error);
        return { nodes: [], skipped: 0 };
    }
}
