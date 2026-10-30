import type { MemoryNode, RemoteVectorConfig } from './types';
import { resolveMemoryScoringRoom } from './types';
import { compatHeaders, compatPersona, isCompat } from './sullyosCompat';
import { MemoryNodeDB } from './db';

/**
 * 把已经导入本地的记录对齐云端新映射：房间与自动来源/类型标签。
 * 只做增量校正，绝不覆盖用户手动编辑过的内容、手动设置过的房间或手动添加的标签。
 */
export async function refreshMappedRooms(config: RemoteVectorConfig, charId: string): Promise<number> {
    if (!charId) throw new Error('请先选择角色');
    const persona = isCompat(config) ? compatPersona(charId, config) : charId;
    const authorization = await compatHeaders(config);
    let changed = 0;
    for (let offset = 0; ; offset += 200) {
        const query = new URLSearchParams({ select: 'memory_id,room,tags', char_id: `eq.${persona}`, order: 'memory_id.asc', limit: '200', offset: String(offset) });
        const response = await fetch(new URL('/rest/v1/memory_vectors?' + query, config.supabaseUrl).href, { headers: { apikey: config.supabaseAnonKey, ...authorization } });
        if (!response.ok) throw new Error(`读取房间映射失败：${response.status}`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('云端记忆格式错误');
        for (const row of rows) {
            const local = (await MemoryNodeDB.getById(row.memory_id)) as MemoryNode | undefined;
            if (!local || local.charId !== charId) continue;
            const mappedRoom = resolveMemoryScoringRoom(row.room);
            const next: MemoryNode = { ...local };
            if (local.room === 'living_room' && mappedRoom !== 'living_room') next.room = mappedRoom;
            const autoTags: string[] = Array.isArray(row.tags) ? row.tags.filter((t: unknown): t is string => typeof t === 'string' && (t.startsWith('来源:') || t.startsWith('类型:'))) : [];
            if (autoTags.length) {
                const kept = (local.tags || []).filter((t) => !t.startsWith('来源:') && !t.startsWith('类型:'));
                const merged = [...kept, ...autoTags.filter((t) => !kept.includes(t))];
                if (merged.length !== (local.tags || []).length || merged.some((t, i) => t !== (local.tags || [])[i])) next.tags = merged;
            }
            if (next.room !== local.room || next.tags !== local.tags) {
                await MemoryNodeDB.save(next);
                changed++;
            }
        }
        if (rows.length < 200) break;
    }
    return changed;
}
