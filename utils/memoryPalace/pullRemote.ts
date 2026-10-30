import type { MemoryNode, MemoryVector, RemoteVectorConfig } from './types';
import { resolveMemoryScoringRoom } from './types';
import { compatHeaders, compatPersona, isCompat } from './sullyosCompat';
import { observeCloudContent } from './compatRevision';
import { MemoryNodeDB } from './db';

/**
 * 把已经导入本地的记录对齐云端映射：房间与自动来源/类型标签。
 * 只做增量校正：房间仅在此前默认落在客厅时刷新；标签只重写“来源:/类型:”这类自动标签，
 * 绝不覆盖用户手动编辑过的内容、手动设置的房间或手动添加的标签。
 */
async function refreshLocalMappings(config: RemoteVectorConfig, charId: string, persona: string, authorization: Record<string, string>): Promise<number> {
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

export async function pullRemoteMemories(config: RemoteVectorConfig, charId: string): Promise<{ added: number; existing: number; relocated: number }> {
    if (!charId) throw new Error('请先选择角色');
    const persona = isCompat(config) ? compatPersona(charId, config) : charId;
    const authorization = await compatHeaders(config);
    const entries: { node: MemoryNode; vector: MemoryVector }[] = [];
    const ids = new Set<string>();
    let existing = 0;
    for (let offset = 0; ; offset += 200) {
        const query = new URLSearchParams({ select: '*', char_id: `eq.${persona}`, order: 'memory_id.asc', limit: '200', offset: String(offset) });
        const response = await fetch(new URL('/rest/v1/memory_vectors?' + query, config.supabaseUrl).href, {
            headers: { apikey: config.supabaseAnonKey, ...authorization },
        });
        if (!response.ok) throw new Error(`读取云端记忆失败：${response.status}`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('云端记忆格式错误');
        if (isCompat(config) && compatPersona(charId, config) !== persona) throw new Error('角色绑定已切换，请重试');
        for (const row of rows) {
            if (row.char_id !== persona || !row.memory_id || typeof row.content !== 'string') throw new Error('云端记忆角色或正文格式错误');
            if (ids.has(row.memory_id)) throw new Error('云端分页返回重复记忆，请重试');
            ids.add(row.memory_id);
            const local = await MemoryNodeDB.getById(row.memory_id);
            if (local) {
                if (local.charId !== charId) throw new Error('记忆编号已属于其他本地角色，已停止导入');
                existing++;
                continue;
            }
            const values = typeof row.vector === 'string' ? JSON.parse(row.vector) : row.vector;
            if (!Array.isArray(values) || values.length !== Number(row.dimensions) || !values.length || !values.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))) throw new Error('云端向量不完整，已停止导入');
            const node: MemoryNode = {
                id: row.memory_id, charId, content: row.content, room: resolveMemoryScoringRoom(row.room),
                tags: Array.isArray(row.tags) ? row.tags : [], importance: row.importance ?? 5, mood: row.mood || '',
                embedded: true, createdAt: Number(row.created_at) || 0, lastAccessedAt: Number(row.last_accessed_at) || 0,
                accessCount: Number(row.access_count) || 0, valence: row.valence ?? undefined, arousal: row.arousal ?? undefined,
                pinnedUntil: row.pinned_until == null ? null : Number(row.pinned_until), sourceId: row.source_id ?? null,
                origin: row.origin ?? undefined, archived: !!row.archived, isBoxSummary: !!row.is_summary, eventBoxId: row.event_box_id ?? null,
            };
            entries.push({ node, vector: { memoryId: node.id, charId, vector: new Float32Array(values), dimensions: values.length, model: row.model ?? undefined } });
        }
        if (isCompat(config)) observeCloudContent(config, persona, rows, authorization);
        if (rows.length < 200) break;
    }
    if (isCompat(config) && compatPersona(charId, config) !== persona) throw new Error('角色绑定已切换，请重试');
    await MemoryNodeDB.saveVectorizedMany(entries);
    // 导入完成后把旧记录的房间与自动标签对齐云端映射，避免它们继续留在默认客厅。
    const relocated = await refreshLocalMappings(config, charId, persona, authorization);
    return { added: entries.length, existing, relocated };
}
