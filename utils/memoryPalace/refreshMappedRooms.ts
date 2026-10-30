import type { MemoryNode, RemoteVectorConfig } from './types';
import { resolveMemoryScoringRoom } from './types';
import { compatHeaders, compatPersona, isCompat } from './sullyosCompat';
import { MemoryNodeDB } from './db';

export async function refreshMappedRooms(config: RemoteVectorConfig, charId: string): Promise<number> {
    const persona = isCompat(config) ? compatPersona(charId, config) : charId;
    const authorization = await compatHeaders(config);
    let changed = 0;
    for (let offset = 0; ; offset += 200) {
        const query = new URLSearchParams({ select: 'memory_id,room', char_id: `eq.${persona}`, order: 'memory_id.asc', limit: '200', offset: String(offset) });
        const response = await fetch(new URL('/rest/v1/memory_vectors?' + query, config.supabaseUrl).href, { headers: { apikey: config.supabaseAnonKey, ...authorization } });
        if (!response.ok) throw new Error(`读取房间映射失败：${response.status}`);
        const rows = await response.json();
        for (const row of rows) {
            const local = await MemoryNodeDB.getById(row.memory_id) as MemoryNode | undefined;
            if (local && local.charId === charId && local.room === 'living_room' && resolveMemoryScoringRoom(row.room) !== 'living_room') {
                await MemoryNodeDB.save({ ...local, room: resolveMemoryScoringRoom(row.room) }); changed++;
            }
        }
        if (rows.length < 200) break;
    }
    return changed;
}
