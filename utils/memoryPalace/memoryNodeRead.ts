/**
 * 读取某角色的记忆节点时，顺带便保持原有「排序 + 规整」一致。
 * 单独拆出来是为了给 MemoryPalaceApp 提供最小改动接入点。
 */

import type { MemoryNode, MemoryRoom } from './types';
import { getAllNodesByCharId } from './nodeRead';

/** 读取全部记忆（已规整，按时间倒序） */
export async function loadAllMemoryNodes(charId: string): Promise<MemoryNode[]> {
    const { nodes } = await getAllNodesByCharId(charId);
    return nodes.sort((a, b) => b.createdAt - a.createdAt);
}

/** 读取某房间记忆（已规整，按时间倒序） */
export async function loadRoomMemoryNodes(charId: string, room: MemoryRoom): Promise<MemoryNode[]> {
    const { nodes } = await getAllNodesByCharId(charId);
    return nodes
        .filter(n => n.room === room)
        .sort((a, b) => b.createdAt - a.createdAt);
}
