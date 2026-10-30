import { ContextBuilder } from '../utils/context';

import MemoryMaintenancePanel from '../components/chat/MemoryMaintenancePanel';
import ChatHistoryCleanupModal from '../components/chat/ChatHistoryCleanupModal';
import { bindCompat, compatLogin, readCompatBinding } from '../utils/memoryPalace/sullyosCompat';
import { MemoryTimeText } from '../components/MemoryTimeText';
import { relativeTimeEdit } from '../utils/memoryPalace/relativeTime';
import { MemoryContentEditor } from '../components/MemoryContentEditor';
import { DB } from '../utils/db';
import { askLinkedArchiveDeletion, deleteNodeAndLinkedArchive } from '../utils/memoryPalace/linkedArchiveDeletion';
import { markAmsgStateDirty } from '../utils/amsgStateSync';
import { loadRangeMessagePage, formatRangeTimestamp } from '../utils/memoryPalace/rangeMessagePage';
import { MainApiMemoryChoice, SkipVectorMemoryChoice } from '../components/MemoryGuideActions';
import { useFirstUseGuideStep, GUIDE_SULLY_ID } from '../utils/firstUseGuide';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOS } from '../context/OSContext';
import {
    MemoryRoom, MemoryNode, ROOM_CONFIGS, ROOM_LABELS, getRoomLabel,
    MemoryNodeDB, AnticipationDB, MemoryLinkDB, EventBoxDB,
    migrateOldMemories, runCognitiveDigestion, getAvailableMonths, getAvailableChunks,
    detectPersonalityStyle,
    manuallyBindMemories, removeMemoryFromBox, unbindAllLiveMemories,
    reviveArchivedMemory,
    wipeAllMemoryPalace,
    exportMemoryPalace, importMemoryPalace, isMemoryPalaceExportFile,
    DigestReportDB, PLATE_TITLES,
    bootstrapPlatesFromHistory, markPlateBootstrapDone,
    getBootstrapResume, setBootstrapResume, clearBootstrapResume,
    updateStoredMemoryNode,
    regenerateEventBoxSummary,
    DEFAULT_CHARACTER_ACCOMMODATION,
} from '../utils/memoryPalace';
import type { Anticipation, MigrationProgress, DigestResult, MemoryLink, EventBox, DigestReport } from '../utils/memoryPalace';
import { confirmExportSafety } from '../utils/exportGuard';
import type { CharacterAccommodationPolicy, CharacterProfile, MemoryPalaceWaterlinePreset, Message } from '../types';
import { CharacterGroupFilterBar, filterCharactersByGroup, GROUP_FILTER_ALL } from '../components/character/CharacterGroupFilter';
import TokenImg from '../components/os/TokenImg';
import {
    CONTEXT_RANGE_POLICY_VERSION,
    DEFAULT_MANUAL_CONTEXT_LIMIT,
} from '../utils/chatContextRange';
import {
    getRangeEndpointLabel,
    getRangeSelectionHint,
} from '../utils/memoryPalace/rangeSelection';
import { trackEvent } from '../utils/analytics';
import { saveMemoryPalaceExport } from '../utils/memoryPalace/saveExport';
import {
    EXTERNAL_MEMORY_MAX_CHARS,
    getExternalMemoryLengthInfo,
    getExternalMemoryOverLimitMessage,
} from '../utils/memoryPalace/externalMemory';
import {
    MAX_MEMORY_BUFFER_THRESHOLD,
    MAX_MEMORY_HOT_ZONE_SIZE,
    MEMORY_PALACE_WATERLINE_PRESETS,
    MIN_MEMORY_BUFFER_THRESHOLD,
    MIN_MEMORY_HOT_ZONE_SIZE,
    makeCustomMemoryPalaceWaterline,
    resolveMemoryPalaceWaterline,
} from '../utils/memoryPalace/waterline';

const PixelHomeView = React.lazy(() => import('./pixelHome/PixelHomeView'));

function CharacterHomePages({pixel=false,onChange}:{pixel?:boolean;onChange:(page:'palace'|'pixelHome')=>void}) {
    return <nav aria-label="角色房间页面" style={{display:'flex',gap:4,padding:4,margin:'12px 0',borderRadius:14,background:pixel?'#1e293b':'#f3f0fa'}}>
        {([{id:'palace',label:'记忆房间'},{id:'pixelHome',label:'像素家园'}] as const).map(page=><button key={page.id} type="button" aria-pressed={(page.id==='pixelHome')===pixel} onClick={()=>onChange(page.id)} style={{flex:1,padding:'10px 8px',border:0,borderRadius:10,fontSize:12,fontWeight:600,cursor:'pointer',background:(page.id==='pixelHome')===pixel?(pixel?'#475569':'#fff'):'transparent',color:pixel?'#e2e8f0':'#715588'}}>{page.label}</button>)}
    </nav>;
}

/** 手动总结面板：每页渲染多少条聊天记录（翻页，避免一次性塞几百条 DOM 卡顿） */
const RANGE_PAGE_SIZE = 50;

/** 手动总结面板：把毫秒时间戳格式化成「2026-03-20 14:30」 */
const fmtRangeTs = formatRangeTimestamp;

/** UI 内部类型：统一描述"关联"来源（EventBox 兄弟 or 旧 MemoryLink） */
type LinkedMemoryUI = {
    /** 伪 link ID，用于 React key */
    id: string;
    /** 关系类型：box 兄弟（live / summary / archived）或 legacy causal link */
    relation: 'box_live' | 'box_summary' | 'box_archived' | 'legacy_causal';
    /** 所属 EventBox（box 关系时非 null） */
    box?: EventBox | null;
    node: MemoryNode;
};
