/**
 * 兼容层：记忆节点读取兜底。
 *
 * 真实实现放在 nodeNormalize.ts，这里只做重新导出，
 * 避免其他模块循环引用 db.ts。
 */
export {
    normalizeMemoryNodeRecord,
    normalizeMemoryNodeRecords,
} from './nodeNormalize';
