import { openDB } from '../db';
import type { MemoryNode, MemoryRoom } from './types';
import { normalizeMemoryNodeRecord } from './nodeNormalize';

export async function readNormalizedNodesByCharId(charId: string): Promise<MemoryNode[]> {
    const db = await openDB();
    const raw = await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction('memory_nodes', 'readonly');
        const index = tx.objectStore('memory_nodes').index('charId');
        const req = index.getAll(IDBKeyRange.only(charId));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
    const out: MemoryNode[] = [];
    const now = Date.now();
    for (const item of raw) {
        const node = normalizeMemoryNodeRecord(item, now);
        if (node) out.push(node);
    }
    return out;
}

export function pickRoom(nodes: MemoryNode[], room: MemoryRoom): MemoryNode[] {
    return nodes.filter(n => n.room === room);
}
