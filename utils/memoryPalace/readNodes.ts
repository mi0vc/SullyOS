import { normalizeMemoryNodeRecord } from './nodeNormalize';
import type { MemoryNode } from './types';

export async function readNormalizedNodesByCharIdFromAll(
    getAllByIndex: <T>(store: string, index: string, value: IDBValidKey) => Promise<T[]>,
    charId: string,
): Promise<MemoryNode[]> {
    const raw = await getAllByIndex<unknown>('memory_nodes', 'charId', charId);
    const out: MemoryNode[] = [];
    const now = Date.now();
    for (const item of raw) {
        const node = normalizeMemoryNodeRecord(item, now);
        if (node) out.push(node);
    }
    return out;
}
