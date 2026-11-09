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
