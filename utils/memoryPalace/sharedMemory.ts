/**
 * Memory Palace shared backend adapter (Supabase Edge Function: sullyos-memory).
 */
import type { MemoryNode, RemoteVectorConfig } from './types';

export const SHARED_MEMORY_URL = 'https://seosxqrdqqolsmjsljze.supabase.co/functions/v1/sullyos-memory';
const SESSION_KEY = 'sullyos.shared.supabase.session';
const REFRESH_SKEW_SECONDS = 45;
const UUID_NAMESPACE = 'sullyos-memory-node-v1';

export interface SharedMemorySession {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
    token_type?: string;
    user?: { id?: string; email?: string };
}

export interface SharedMemoryConfig {
    endpoint?: string;
    personaBindings: Record<string, string>;
}

export interface SharedMemoryRecord {
    id?: string;
    owner_id?: string;
    persona_id?: string;
    original_id: string;
    content: string;
    status?: string;
    revision?: number;
    memory_type?: string;
    importance?: number;
    tags?: string[];
    entities?: unknown[];
    sources?: unknown;
    embedding_model?: string | null;
    embedding_dimensions?: number | null;
    embedding?: number[] | null;
    manual_metadata?: Record<string, unknown>;
    source_hash?: string;
    source_key?: string;
    created_at?: string;
    updated_at?: string;
}

export interface SharedMemoryOperation {
    operation_id: string;
    operation_type: 'upsert' | 'tombstone';
    revision: number;
    source_node: 'sullyos';
    payload: SharedMemoryRecord;
}

export interface SharedMemoryBackendConfig {
    remoteVectorConfig: RemoteVectorConfig;
    personaId: string;
    endpoint?: string;
}

export interface SharedMemorySearchResult {
    memoryId: string;
    content: string;
    similarity: number;
    room: string;
    importance: number;
    tags: string[];
    mood: string;
    valence: number | null;
    arousal: number | null;
    createdAt: number;
    lastAccessedAt: number;
    accessCount: number;
    pinnedUntil: number | null;
    sourceId: string | null;
    origin: string | null;
    archived: boolean;
    isSummary: boolean;
    eventBoxId: string | null;
}

interface SharedCallConfig {
    endpoint: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    personaId: string;
}

function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}

function parseJson<T>(raw: string | null): T | null {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
}

function resolveSharedEndpoint(endpoint?: string): string {
    return (endpoint || SHARED_MEMORY_URL).replace(/\/+$/, '');
}

function resolveSupabaseUrl(config: RemoteVectorConfig): string {
    return (config.supabaseUrl || '').trim().replace(/\/+$/, '');
}

function resolveSupabaseAnonKey(config: RemoteVectorConfig): string {
    return (config.supabaseAnonKey || '').trim();
}

function assertSharedCredentials(config: RemoteVectorConfig): { supabaseUrl: string; supabaseAnonKey: string } {
    const supabaseUrl = resolveSupabaseUrl(config);
    const supabaseAnonKey = resolveSupabaseAnonKey(config);
    if (!supabaseUrl || !supabaseAnonKey) throw new Error('缺少共享记忆 Supabase URL 或 anon key');
    return { supabaseUrl, supabaseAnonKey };
}

export function getSharedSession(): SharedMemorySession | null {
    const parsed = parseJson<SharedMemorySession>(localStorage.getItem(SESSION_KEY));
    return parsed?.access_token ? parsed : null;
}

function saveSharedSession(session: SharedMemorySession): SharedMemorySession {
    const normalized: SharedMemorySession = {
        ...session,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    return normalized;
}

export function clearSharedSession(): void {
    localStorage.removeItem(SESSION_KEY);
}

function isSessionFresh(session: SharedMemorySession): boolean {
    if (!session.expires_at) return true;
    return session.expires_at - REFRESH_SKEW_SECONDS > nowSeconds();
}

export async function signInSharedMemory(
    email: string,
    password: string,
    remoteConfig: RemoteVectorConfig,
): Promise<SharedMemorySession> {
    const { supabaseUrl, supabaseAnonKey } = assertSharedCredentials(remoteConfig);
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.access_token) {
        throw new Error(data?.error_description || data?.message || 'Supabase 登录失败');
    }
    return saveSharedSession(data as SharedMemorySession);
}

export async function refreshSharedSession(remoteConfig: RemoteVectorConfig): Promise<SharedMemorySession> {
    const current = getSharedSession();
    if (!current?.refresh_token) throw new Error('当前会话缺少 refresh token，请重新登录');
    const { supabaseUrl, supabaseAnonKey } = assertSharedCredentials(remoteConfig);
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.access_token) {
        clearSharedSession();
        throw new Error(data?.error_description || data?.message || '刷新会话失败，请重新登录');
    }
    return saveSharedSession(data as SharedMemorySession);
}

async function ensureSharedSession(remoteConfig: RemoteVectorConfig): Promise<SharedMemorySession> {
    const session = getSharedSession();
    if (!session?.access_token) throw new Error('请先登录共享记忆库');
    if (isSessionFresh(session)) return session;
    if (session.refresh_token) return refreshSharedSession(remoteConfig);
    clearSharedSession();
    throw new Error('共享记忆会话已过期，请重新登录');
}

function toCallConfig(config: SharedMemoryBackendConfig): SharedCallConfig {
    const personaId = (config.personaId || '').trim();
    if (!personaId) throw new Error('未绑定共享 persona，请先在远程设置里为该角色填写 persona_id');
    const { supabaseUrl, supabaseAnonKey } = assertSharedCredentials(config.remoteVectorConfig);
    return {
        endpoint: resolveSharedEndpoint(config.endpoint),
        supabaseUrl,
        supabaseAnonKey,
        personaId,
    };
}

async function callShared<T>(
    config: SharedMemoryBackendConfig,
    action: string,
    body: Record<string, unknown> = {},
): Promise<T> {
    const callCfg = toCallConfig(config);
    const session = await ensureSharedSession(config.remoteVectorConfig);
    const response = await fetch(callCfg.endpoint, {
        method: 'POST',
        headers: {
            Authorization: `******
            apikey: callCfg.supabaseAnonKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, persona_id: callCfg.personaId, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401) {
            clearSharedSession();
            throw new Error('共享记忆登录态失效，请重新登录');
        }
        throw new Error((data as any)?.error || `共享记忆请求失败（${response.status}）`);
    }
    return data as T;
}

function knownMetadata(node: MemoryNode): Record<string, unknown> {
    return {
        room: node.room,
        mood: node.mood,
        valence: typeof node.valence === 'number' ? node.valence : null,
        arousal: typeof node.arousal === 'number' ? node.arousal : null,
        createdAt: node.createdAt,
        lastAccessedAt: node.lastAccessedAt,
        accessCount: node.accessCount,
        pinnedUntil: node.pinnedUntil ?? null,
        sourceId: node.sourceId ?? null,
        origin: node.origin ?? null,
        archived: !!node.archived,
        isBoxSummary: !!node.isBoxSummary,
        eventBoxId: node.eventBoxId ?? null,
        entities: node.entities ?? [],
    };
}

function extraMetadata(node: MemoryNode): Record<string, unknown> {
    const extras: Record<string, unknown> = {};
    const known = new Set([
        'id', 'charId', 'content', 'room', 'tags', 'entities', 'importance', 'mood', 'valence', 'arousal',
        'embedded', 'createdAt', 'lastAccessedAt', 'accessCount', 'pinnedUntil', 'sourceId', 'origin',
        'digestedAt', 'legacyCsy', 'eventBoxId', 'archived', 'isBoxSummary', 'groupId', 'groupName',
        'boxId', 'boxTopic', 'relativeTimeAnchor',
    ]);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (known.has(key)) continue;
        extras[key] = value;
    }
    return extras;
}

function normalizeImportance(input: unknown): number {
    const n = Number(input);
    if (!Number.isFinite(n)) return 0.5;
    const normalized = n <= 1 ? n : n / 10;
    return Math.max(0, Math.min(1, normalized));
}

function stableString(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableString).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableString(v)}`).join(',')}}`;
}

async function sha1Hex(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-1', encoded);
    return Array.from(new Uint8Array(hash)).map(v => v.toString(16).padStart(2, '0')).join('');
}

function formatUuidFromHex(hex: string): string {
    const h = hex.padEnd(32, '0').slice(0, 32).split('');
    h[12] = '5';
    h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
    return `${h.slice(0, 8).join('')}-${h.slice(8, 12).join('')}-${h.slice(12, 16).join('')}-${h.slice(16, 20).join('')}-${h.slice(20, 32).join('')}`;
}

export async function localIdToStableUuid(localId: string): Promise<string> {
    const seed = `${UUID_NAMESPACE}:${localId}`;
    const digest = await sha1Hex(seed);
    return formatUuidFromHex(digest);
}

function buildSourceHash(node: MemoryNode): Promise<string> {
    const payload = {
        id: node.id,
        content: node.content,
        room: node.room,
        tags: node.tags,
        entities: node.entities ?? [],
        mood: node.mood,
        importance: normalizeImportance(node.importance),
    };
    return sha1Hex(stableString(payload));
}

function buildRevision(node: MemoryNode): number {
    const base = Math.max(Number(node.lastAccessedAt) || 0, Number(node.createdAt) || 0, Date.now());
    return Math.max(1, Math.floor(base));
}

function memoryTypeOf(node: MemoryNode): string {
    if (node.origin === 'digestion') return 'digestion';
    if (node.origin === 'system') return 'system';
    return 'fact';
}

function opHashSeed(operationType: string, revision: number, payload: SharedMemoryRecord): string {
    return `${operationType}:${revision}:${stableString(payload)}`;
}

export async function buildSharedPushOperation(
    node: MemoryNode,
    options: {
        operationType?: 'upsert' | 'tombstone';
        revision?: number;
        embedding?: { vector: number[] | Float32Array | Uint8Array; dimensions: number; model?: string };
    } = {},
): Promise<SharedMemoryOperation> {
    const originalId = await localIdToStableUuid(node.id);
    const sourceHash = await buildSourceHash(node);
    const revision = options.revision ?? buildRevision(node);
    const manual = {
        ...knownMetadata(node),
        ...extraMetadata(node),
        localId: node.id,
        charId: node.charId,
        originalCreatedAt: node.createdAt,
    };
    const embeddingVector = options.embedding
        ? Array.from(options.embedding.vector instanceof Uint8Array
            ? new Float32Array(options.embedding.vector.buffer, options.embedding.vector.byteOffset, options.embedding.vector.byteLength >>> 2)
            : options.embedding.vector instanceof Float32Array
                ? options.embedding.vector
                : options.embedding.vector)
        : null;
    const payload: SharedMemoryRecord = {
        original_id: originalId,
        source_key: `sullyos:${node.charId}:${node.id}`,
        content: node.content,
        status: node.archived ? 'archived' : 'active',
        revision,
        memory_type: memoryTypeOf(node),
        importance: normalizeImportance(node.importance),
        tags: node.tags || [],
        entities: node.entities || [],
        manual_metadata: manual,
        source_hash: sourceHash,
        sources: Array.isArray((node as any).sources) ? (node as any).sources : undefined,
        embedding_model: options.embedding?.model || null,
        embedding_dimensions: options.embedding?.dimensions ?? null,
        embedding: embeddingVector,
    };
    const operationType = options.operationType || 'upsert';
    const operationId = await sha1Hex(opHashSeed(operationType, revision, payload));
    return {
        operation_id: `sullyos-${operationId.slice(0, 24)}`,
        operation_type: operationType,
        revision,
        source_node: 'sullyos',
        payload,
    };
}

export async function pushSharedMemoryNodes(
    config: SharedMemoryBackendConfig,
    nodes: MemoryNode[],
    options: {
        embeddingByNodeId?: Record<string, { vector: number[] | Float32Array | Uint8Array; dimensions: number; model?: string }>;
    } = {},
) {
    const operations = await Promise.all(nodes.map(node => buildSharedPushOperation(node, {
        embedding: options.embeddingByNodeId?.[node.id],
    })));
    return callShared<{ accepted?: string[]; duplicate?: string[]; rejected?: string[] }>(config, 'push', { operations });
}

export function listSharedMemories(
    config: SharedMemoryBackendConfig,
    limit = 500,
    offset = 0,
    filters: Record<string, unknown> = {},
): Promise<{ memories: SharedMemoryRecord[]; next_offset?: number | null }> {
    return callShared(config, 'list', { limit, offset, ...filters });
}

export async function listAllSharedMemories(
    config: SharedMemoryBackendConfig,
    filters: Record<string, unknown> = {},
    pageSize = 500,
): Promise<SharedMemoryRecord[]> {
    const collected: SharedMemoryRecord[] = [];
    let offset = 0;
    while (true) {
        const page = await listSharedMemories(config, pageSize, offset, filters);
        const rows = page.memories || [];
        collected.push(...rows);
        if (!rows.length || rows.length < pageSize) break;
        offset = typeof page.next_offset === 'number' ? page.next_offset : offset + rows.length;
    }
    return collected;
}

export function pullSharedMemoryEvents(config: SharedMemoryBackendConfig, since = '1970-01-01T00:00:00Z', limit = 500, offset = 0) {
    return callShared<{ events: any[]; next_offset?: number | null }>(config, 'pull', { since, limit, offset });
}

function toNodeFromRecord(record: SharedMemoryRecord, charId: string): MemoryNode {
    const meta = record.manual_metadata || {};
    const importance = Number(record.importance);
    const normalizedImportance = Number.isFinite(importance)
        ? (importance <= 1 ? Math.round(importance * 10) : importance)
        : 5;
    const room = (meta.room as any) || 'living_room';
    return {
        id: (meta.localId as string) || record.original_id,
        charId,
        content: record.content || '',
        room,
        tags: record.tags || [],
        entities: Array.isArray(record.entities) ? (record.entities as any) : undefined,
        importance: Math.max(1, Math.min(10, normalizedImportance)),
        mood: typeof meta.mood === 'string' ? meta.mood : '',
        valence: typeof meta.valence === 'number' ? meta.valence : undefined,
        arousal: typeof meta.arousal === 'number' ? meta.arousal : undefined,
        embedded: true,
        createdAt: Number(meta.createdAt || Date.parse(record.created_at || '')) || Date.now(),
        lastAccessedAt: Number(meta.lastAccessedAt || Date.parse(record.updated_at || '')) || Date.now(),
        accessCount: Number(meta.accessCount) || 0,
        pinnedUntil: meta.pinnedUntil == null ? null : Number(meta.pinnedUntil),
        sourceId: typeof meta.sourceId === 'string' ? meta.sourceId : null,
        origin: typeof meta.origin === 'string' ? meta.origin as any : undefined,
        archived: record.status === 'archived' || !!meta.archived,
        isBoxSummary: !!meta.isBoxSummary,
        eventBoxId: typeof meta.eventBoxId === 'string' ? meta.eventBoxId : null,
    };
}

export async function fetchSharedByRoom(
    config: SharedMemoryBackendConfig,
    charId: string,
    room: string,
    limit = 50,
): Promise<MemoryNode[]> {
    const rows = await listAllSharedMemories(config, { room, status: 'active' }, Math.min(500, Math.max(limit, 1)));
    return rows.slice(0, limit).map(row => toNodeFromRecord(row, charId));
}

export async function searchSharedMemories(
    config: SharedMemoryBackendConfig,
    queryVector: number[] | Float32Array | Uint8Array,
    options: {
        model: string;
        dimensions: number;
        threshold?: number;
        topK?: number;
    },
): Promise<SharedMemorySearchResult[]> {
    const vector = Array.from(queryVector instanceof Uint8Array
        ? new Float32Array(queryVector.buffer, queryVector.byteOffset, queryVector.byteLength >>> 2)
        : queryVector instanceof Float32Array
            ? queryVector
            : queryVector);
    const response = await callShared<{ matches: any[] }>(config, 'search', {
        embedding_model: options.model,
        embedding_dimensions: options.dimensions,
        query_embedding: vector,
        threshold: options.threshold ?? 0.3,
        limit: options.topK ?? 20,
    });
    return (response.matches || []).map((row: any) => ({
        memoryId: (row.manual_metadata?.localId as string) || row.original_id || row.id,
        content: row.content || '',
        similarity: Number(row.similarity) || 0,
        room: (row.manual_metadata?.room as string) || 'living_room',
        importance: Math.max(1, Math.min(10, Math.round(normalizeImportance(row.importance) * 10))),
        tags: row.tags || [],
        mood: row.manual_metadata?.mood || '',
        valence: typeof row.manual_metadata?.valence === 'number' ? row.manual_metadata.valence : null,
        arousal: typeof row.manual_metadata?.arousal === 'number' ? row.manual_metadata.arousal : null,
        createdAt: Number(row.manual_metadata?.createdAt || Date.parse(row.created_at || '')) || 0,
        lastAccessedAt: Number(row.manual_metadata?.lastAccessedAt || Date.parse(row.updated_at || '')) || 0,
        accessCount: Number(row.manual_metadata?.accessCount) || 0,
        pinnedUntil: row.manual_metadata?.pinnedUntil == null ? null : Number(row.manual_metadata.pinnedUntil),
        sourceId: row.manual_metadata?.sourceId ?? null,
        origin: row.manual_metadata?.origin ?? null,
        archived: row.status === 'archived' || !!row.manual_metadata?.archived,
        isSummary: !!row.manual_metadata?.isBoxSummary,
        eventBoxId: row.manual_metadata?.eventBoxId ?? null,
    }));
}

export async function getSharedMemoryCount(config: SharedMemoryBackendConfig): Promise<number> {
    const response = await callShared<{ count?: number }>(config, 'count', {});
    return Number(response.count) || 0;
}

export async function bulkArchiveSharedMemories(
    config: SharedMemoryBackendConfig,
    memoryIds: string[],
    archived: boolean,
): Promise<boolean> {
    if (!memoryIds.length) return true;
    const original_ids = await Promise.all(memoryIds.map(localIdToStableUuid));
    await callShared(config, 'bulk_update', {
        original_ids,
        changes: { status: archived ? 'archived' : 'active', manual_metadata: { archived } },
    });
    return true;
}

export async function bulkMoveSharedMemories(
    config: SharedMemoryBackendConfig,
    memoryIds: string[],
    room: string,
): Promise<boolean> {
    if (!memoryIds.length) return true;
    const original_ids = await Promise.all(memoryIds.map(localIdToStableUuid));
    await callShared(config, 'bulk_update', {
        original_ids,
        changes: { manual_metadata: { room } },
    });
    return true;
}

export async function tombstoneSharedMemory(config: SharedMemoryBackendConfig, memoryId: string): Promise<boolean> {
    const original_id = await localIdToStableUuid(memoryId);
    await callShared(config, 'tombstone', { original_id });
    return true;
}
