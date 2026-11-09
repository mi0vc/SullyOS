import { getAllNodesByCharId, getNodeById } from './nodeRead';
import type { MemoryNode, MemoryRoom } from './types';

/** 带规整的读取：供 UI 层使用 */
export { getAllNodesByCharId, getNodeById };

export async function safeLoad(charId: string): Promise<MemoryNode[]> {
    try {
        const r = await getAllNodesByCharId(charId);
        return r.nodes;
    } catch {
        return [];
    }
}

export async function safeLoadRoom(charId: string, room: MemoryRoom): Promise<MemoryNode[]> {
    const list = await safeLoad(charId);
    return list.filter(n => n.room === room);
}
