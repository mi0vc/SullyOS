/**
 * memory-dual-v1 共享记忆适配器。
 *
 * SullyOS 本地记忆仍保存在 IndexedDB；本模块只负责把共享记忆
 * 读写到 Supabase 的 sullyos-memory Edge Function，不替换本地检索。
 */

import type { MemoryNode } from './types';

export const SHARED_MEMORY_URL = 'https://seosxqrdqqolsmjsljze.supabase.co/functions/v1/sullyos-memory';
const SESSION_KEY = 'sullyos.shared.supabase.session';

export interface SharedMemorySession {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    user?: { id?: string; email?: string };
}

export interface SharedMemoryConfig {
    personaId: string;
    endpoint?: string;
}

export interface SharedMemoryRecord {
    id?: string;
    original_id: string;
    content: string;
    status?: string;
    revision?: number;
    memory_type?: string;
    importance?: number;
    tags?: string[];
    entities?: unknown[];
    manual_metadata?: Record<string, unknown>;
    source_hash?: string;
    source_key?: string;
}

export function getSharedSession(): SharedMemorySession | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as SharedMemorySession;
        return value?.access_token ? value : null;
    } catch { return null; }
}

export function clearSharedSession(): void {
    localStorage.removeItem(SESSION_KEY);
}

export async function signInSharedMemory(email: string, password: string, supabaseUrl = 'https://seosxqrdqqolsmjsljze.supabase.co', anonKey?: string): Promise<SharedMemorySession> {
    const key = anonKey || localStorage.getItem('sullyos.supabase.anonKey') || '';
    if (!key) throw new Error('缺少 Supabase anon key，请先在 SullyOS 记忆宫殿设置中配置');
    const response = await fetch(`${supabaseUrl.replace(/\\/+$/, '')}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error(data.error_description || data.message || 'Supabase 登录失败');
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data as SharedMemorySession;
}

async function callShared(action: string, config: SharedMemoryConfig, body: Record<string, unknown> = {}): Promise<any> {
    const session = getSharedSession();
    if (!session) throw new Error('请先登录共享记忆库');
    const response = await fetch(config.endpoint || SHARED_MEMORY_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, persona_id: config.personaId, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `共享记忆请求失败（${response.status}）`);
    return data;
}

export function listSharedMemories(config: SharedMemoryConfig, limit = 500): Promise<{ memories: SharedMemoryRecord[] }> {
    return callShared('list', config, { limit });
}

export function pullSharedMemoryEvents(config: SharedMemoryConfig, since = '1970-01-01T00:00:00Z', limit = 500): Promise<{ events: any[] }> {
    return callShared('pull', config, { since, limit });
}

function toSharedRecord(node: MemoryNode): SharedMemoryRecord {
    return {
        original_id: node.id,
        content: node.content,
        status: node.archived ? 'archived' : 'active',
        revision: 1,
        memory_type: node.origin || 'fact',
        importance: Math.max(0, Math.min(1, Number(node.importance || 5) / 10)),
        tags: node.tags || [],
        entities: node.entities || [],
        manual_metadata: { room: node.room, mood: node.mood, char_id: node.charId, source: 'sullyos' },
        source_key: `sullyos:${node.id}`,
    };
}

export function buildSharedPushOperation(node: MemoryNode, index = 0): Record<string, unknown> {
    const payload = toSharedRecord(node);
    return {
        operation_id: `sullyos-${Date.now()}-${index}-${node.id}`,
        operation_type: 'upsert',
        revision: payload.revision,
        source_node: 'sullyos',
        payload,
    };
}

export function pushSharedMemoryNodes(config: SharedMemoryConfig, nodes: MemoryNode[]): Promise<any> {
    return callShared('push', config, { operations: nodes.map((node, index) => buildSharedPushOperation(node, index)) });
}
