/**
 * Memory Palace — IndexedDB CRUD 操作
 */

import { openDB } from '../db';
import type {
    MemoryNode, MemoryVector, MemoryLink, MemoryBatch,
    TopicBox, Anticipation, MemoryRoom, AnticipationStatus,
    EventBox, RoomPlate, PlateRoom, DigestReport,
} from './types';
import { DIGEST_REPORT_KEEP, EVENT_BOX_SEAL_THRESHOLD } from './types';
import { bm25Index } from './bm25Index';
import { notifyMemoryNodesChanged } from './nodeChanges';
import { compactMemoryLink } from './linkPrecision';
import { normalizeMemoryNodeRecord } from './nodeNormalize';
import type { VectorIndexEntry as VectorBackupIndexEntry } from '../backupFormat';

const STORE_MEMORY_NODES   = 'memory_nodes';
const STORE_MEMORY_VECTORS = 'memory_vectors';
const STORE_MEMORY_LINKS   = 'memory_links';
const STORE_MEMORY_BATCHES = 'memory_batches';
const STORE_TOPIC_BOXES    = 'topic_boxes';
const STORE_ANTICIPATIONS  = 'anticipations';
const STORE_EVENT_BOXES    = 'event_boxes';
const STORE_ROOM_PLATES    = 'room_plates';
const STORE_DIGEST_REPORTS = 'digest_reports';

async function getAllByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const index = tx.objectStore(storeName).index(indexName);
        const req = index.getAll(IDBKeyRange.only(value));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function put<T>(storeName: string, data: T): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(data);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getByKey<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function deleteByKey(storeName: string, key: IDBValidKey): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getAll<T>(storeName: string): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

/** 读一批节点并逐条规整：脏数据变成安全默认值或直接跳过 */
async function readNormalizedNodesByCharId(charId: string): Promise<MemoryNode[]> {
    const raw = await getAllByIndex<unknown>(STORE_MEMORY_NODES, 'charId', charId);
    const out: MemoryNode[] = [];
    const now = Date.now();
    for (const item of raw) {
        const node = normalizeMemoryNodeRecord(item, now);
        if (node) out.push(node);
    }
    return out;
}

function getRemoteVectorConfig(): { enabled: boolean; supabaseUrl: string; supabaseAnonKey: string; initialized: boolean } | null {
    try {
        const raw = localStorage.getItem('os_remote_vector_config');
        if (!raw) return null;
        const c = JSON.parse(raw);
        return (c.enabled && c.initialized) ? c : null;
    } catch { return null; }
}

function syncNodeMetadataToRemote(node: MemoryNode): void {
    if (!node.embedded) return;
    const rc = getRemoteVectorConfig();
    if (!rc) return;
    import('./supabaseVector').then(({ upsertVector }) => {
        getByKey<MemoryVector>(STORE_MEMORY_VECTORS, node.id).then(vec => {
            if (!vec) return;
            const vector = ensureFloat32(vec.vector);
            upsertVector(rc, node.id, node.charId, vector, node, vec.dimensions, vec.model).catch(() => {});
        });
    }).catch(() => {});
}
