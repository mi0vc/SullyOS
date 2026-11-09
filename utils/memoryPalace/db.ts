/**
 * Memory Palace — IndexedDB CRUD 操作
 *
 * 封装 6 张表的增删改查，复用主 db.ts 的 openDB()。
 */

import { openDB } from '../db';
import type {
    MemoryNode, MemoryVector, MemoryLink, MemoryBatch,
    TopicBox, Anticipation, MemoryRoom, BoxStatus, AnticipationStatus,
    EventBox, RoomPlate, PlateRoom, DigestReport,
} from './types';
import { DIGEST_REPORT_KEEP, EVENT_BOX_SEAL_THRESHOLD } from './types';
import { bm25Index } from './bm25Index';
import { notifyMemoryNodesChanged } from './nodeChanges';
import { compactMemoryLink } from './linkPrecision';
import { normalizeMemoryNodeRecord } from './nodeNormalize';
import type { VectorIndexEntry as VectorBackupIndexEntry } from '../backupFormat';

// ─── Store 名称常量 ────────────────────────────────────

const STORE_MEMORY_NODES   = 'memory_nodes';
const STORE_MEMORY_VECTORS = 'memory_vectors';
const STORE_MEMORY_LINKS   = 'memory_links';
const STORE_MEMORY_BATCHES = 'memory_batches';
const STORE_TOPIC_BOXES    = 'topic_boxes';
const STORE_ANTICIPATIONS  = 'anticipations';
const STORE_EVENT_BOXES    = 'event_boxes';
const STORE_ROOM_PLATES    = 'room_plates';
const STORE_DIGEST_REPORTS = 'digest_reports';

// ─── 通用辅助 ──────────────────────────────────────────

/** 通用 getAll by index */
async function getAllByIndex<T>(
    storeName: string, indexName: string, value: IDBValidKey
): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const req = index.getAll(IDBKeyRange.only(value));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}
