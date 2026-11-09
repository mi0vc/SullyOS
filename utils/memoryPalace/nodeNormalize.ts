import type { MemoryRoom } from './types';

/**
 * 记忆节点读取边界兜底。
 *
 * 老版本 / 云端导入 / 手动维修过的记录，可能缺字段或字段类型不对。
 * 这些记录一旦直接喂进 JSX，`node.tags.join()`、`'★'.repeat(NaN)`、
 * `ROOM_COLORS[undefined]` 就会在渲染期抛错，React 压缩后报 #306，整页白屏。
 *
 * 处理原则：不改写数据库，不丢弃可恢复的记录。读取时在内存里补默认值，
 * 让渲染永远拿到形状完整的对象；连 id / charId 都不存在的才算不可恢复。
 */

const VALID_ROOMS: MemoryRoom[] = [
    'living_room', 'bedroom', 'study', 'user_room', 'self_room', 'attic', 'windowsill',
];

function isPlainObject(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function coerceId(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
}

/** 只收字符串元素，去掉首尾空白与空串 */
function coerceStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    for (const item of value) {
        if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed) out.push(trimmed);
        }
    }
    return out;
}

function coerceFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 时间戳兜底：毫秒数或可解析的日期字符串都接受 */
function coerceTimestamp(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return fallback;
}

function coerceRoom(value: unknown): MemoryRoom {
    return typeof value === 'string' && (VALID_ROOMS as string[]).includes(value)
        ? (value as MemoryRoom)
        : 'living_room';
}

/**
 * 把一条原始记录规整成可安全渲染的对象。
 * 返回 null 表示连 id / charId 都缺失，无法归位，属不可恢复脏数据。
 */
export function normalizeMemoryNodeRecord(
    raw: unknown,
    now: number = Date.now(),
): import('./types').MemoryNode | null {
    if (!isPlainObject(raw)) return null;

    const id = coerceId(raw.id);
    const charId = coerceId(raw.charId);
    if (!id || !charId) return null;

    const createdAt = coerceTimestamp(raw.createdAt, now);
    const importance = Math.min(10, Math.max(1, coerceFiniteNumber(raw.importance, 5)));

    const node = {
        ...raw,
        id,
        charId,
        content: typeof raw.content === 'string' ? raw.content : '',
        room: coerceRoom(raw.room),
        tags: coerceStringArray(raw.tags),
        importance,
        mood: typeof raw.mood === 'string' && raw.mood ? raw.mood : 'neutral',
        embedded: raw.embedded === true,
        createdAt,
        lastAccessedAt: coerceTimestamp(raw.lastAccessedAt, createdAt),
        accessCount: Math.max(0, Math.floor(coerceFiniteNumber(raw.accessCount, 0))),
        sourceId: typeof raw.sourceId === 'string' ? raw.sourceId : null,
        eventBoxId: typeof raw.eventBoxId === 'string' ? raw.eventBoxId : null,
        archived: raw.archived === true,
        isBoxSummary: raw.isBoxSummary === true,
    } as import('./types').MemoryNode;

    // 可选字段：原值类型合法才保留，避免旧记录把字符串塞进数组字段
    if (Array.isArray(raw.entities)) node.entities = raw.entities;
    if (raw.origin === 'extraction' || raw.origin === 'digestion' || raw.origin === 'system') {
        node.origin = raw.origin;
    }
    if (raw.pinnedUntil === null || typeof raw.pinnedUntil === 'number') {
        node.pinnedUntil = raw.pinnedUntil;
    }
    if (raw.digestedAt === null || typeof raw.digestedAt === 'number') {
        node.digestedAt = raw.digestedAt;
    }
    if (typeof raw.groupId === 'string') node.groupId = raw.groupId;
    if (typeof raw.groupName === 'string') node.groupName = raw.groupName;

    return node;
}

/** 批量规整并统计跳过数量，供 UI 如实展示「有几条没能显示」 */
export function normalizeMemoryNodeRecords(rawList: unknown[]): {
    nodes: import('./types').MemoryNode[];
    skipped: number;
} {
    const nodes: import('./types').MemoryNode[] = [];
    let skipped = 0;
    const now = Date.now();
    for (const raw of rawList) {
        const node = normalizeMemoryNodeRecord(raw, now);
        if (node) nodes.push(node);
        else skipped += 1;
    }
    return { nodes, skipped };
}
