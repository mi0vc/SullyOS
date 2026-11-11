import type { CharacterExportData } from '../types';
import { isPng, pngHasShare, readShareText, readValidatedPngChunks } from './pngShare';
import { parseStandardWorldbook } from './worldbook';
export interface CardImportPreview {
 card: CharacterExportData; format: string; warnings: string[]; greetings: string[]; author: string; notes: string;
}
const text = (v: unknown): string => typeof v === 'string' ? v : '';
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
export { renderTavernText } from './tavernMacros';
export function convertTavernCard(raw: any, avatar = ''): CardImportPreview {
 if (!object(raw)) throw new Error('角色卡必须是有效对象');
 if (raw.type === 'sully_character_card') return { card: raw, format: 'SullyOS', warnings: [], greetings: [], author: '', notes: '' };
 if (raw.spec && !['chara_card_v2', 'chara_card_v3'].includes(raw.spec)) throw new Error('暂不支持此角色卡版本');
 const d = raw.spec ? raw.data : raw;
 if (!object(d) || !text(d.name).trim() || (!raw.spec && !['description','personality','first_mes','scenario','mes_example'].some(k => typeof d[k] === 'string'))) throw new Error('无法识别角色卡：需要酒馆旧版、V2、V3 或 SullyOS 格式');
 for (const key of ['description','personality','scenario','first_mes','mes_example','system_prompt','post_history_instructions']) if (d[key] != null && typeof d[key] !== 'string') throw new Error(`角色卡字段 ${key} 应为文本`);
 const warnings = ['仅转换角色内容，SullyOS 聊天规则与酒馆不同；不会运行卡内脚本或正则插件。'];
 const sections = [['角色描述',d.description],['性格',d.personality],['场景',d.scenario],['角色系统提示',d.system_prompt],['示例对话（仅供参考，不是真实历史）',d.mes_example],['角色补充指令',d.post_history_instructions]];
 const systemPrompt = sections.filter(([,v]) => text(v).trim()).map(([k,v]) => `### ${k}\n${v}`).join('\n\n');
 if (d.post_history_instructions) warnings.push('历史后置提示保留在角色核心设定中，不模拟酒馆历史末尾注入位置。');
 if (object(d.extensions) && Object.keys(d.extensions).length) warnings.push('酒馆扩展配置、正则、美化和插件不执行、不迁移。');
 if (d.assets?.length) warnings.push('V3 外部资源未下载；PNG 原图用作头像，JSON 可导入后手动设置头像。');
 if (d.group_only_greetings?.length) warnings.push('群聊专用开场白暂未接入。');
 const greetings = [text(d.first_mes), ...strings(d.alternate_greetings)].filter(Boolean);
 let mountedWorldbooks: any[] = [];
 if (d.character_book != null) {
  if (!object(d.character_book) || !Array.isArray(d.character_book.entries)) throw new Error('内嵌世界书 entries 必须是数组');
  const entries = d.character_book.entries;
  if (entries.length > 5000) throw new Error('内嵌世界书超过 5000 条');
  if (entries.some((e: any) => !object(e) || typeof e.content !== 'string')) throw new Error('世界书存在无效条目，未导入');
  if (entries.length) {
   mountedWorldbooks = parseStandardWorldbook(JSON.stringify({ entries: entries.map((e: any, i: number) => {
    const x = object(e.extensions) ? e.extensions : {};
    return { uid:e.id ?? i, comment:text(e.name)||text(e.comment), content:e.content,
     key:strings(e.keys), keysecondary:strings(e.secondary_keys), constant:e.constant===true,
     selective:e.selective===true, selectiveLogic:x.selectiveLogic, order:e.insertion_order,
     position:typeof x.position==='number'?x.position:e.position==='before_char'?0:1,
     disable:e.enabled===false, probability:x.probability, useProbability:x.useProbability,
     depth:x.depth, role:x.role, scanDepth:x.scan_depth??d.character_book.scan_depth,
     caseSensitive:e.case_sensitive, matchWholeWords:x.match_whole_words };
   }) }), text(d.character_book.name)||`${d.name} 的世界书`);
   warnings.push('世界书已转换关键词、常驻、启用状态及基础位置；递归扫描、预算、正则关键词及其他扩展不保证与酒馆一致。');
  }
 }
 if (/\{\{(?!char\}\}|user\}\})[^}]+\}\}/i.test(systemPrompt+greetings.join(''))) warnings.push('仅支持 {{char}} 与 {{user}}；其他酒馆宏保留原文、不执行。');
 const author=text(d.creator), notes=text(d.creator_notes);
 const card = { type:'sully_character_card', name:d.name.trim(), avatar, description:'', systemPrompt,
  mountedWorldbooks, memories:[], tavernImport:{version:raw.spec||'v1',author,notes,tags:strings(d.tags),characterVersion:text(d.character_version),greetings,warnings} } as unknown as CharacterExportData;
 return {card,format:raw.spec==='chara_card_v3'?'酒馆 V3':raw.spec?'酒馆 V2':'酒馆旧版',warnings,greetings,author,notes};
}
export function extractTavernPng(bytes: Uint8Array): any {
 const candidates=readValidatedPngChunks(bytes).filter(c=>c.type==='tEXt').map(c=>{
  const zero=c.data.indexOf(0); return {key:new TextDecoder().decode(c.data.subarray(0,zero)).toLowerCase(),value:c.data.subarray(zero+1)};
 });
 const entry=candidates.find(c=>c.key==='ccv3')||candidates.find(c=>c.key==='chara');
 if (!entry) throw new Error('PNG 没有角色数据，请使用角色卡原图，不要截图或压缩图');
 try { const binary=atob(new TextDecoder().decode(entry.value)); return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)))); }
 catch { throw new Error('PNG 中的酒馆角色数据损坏'); }
}
export async function readCharacterImport(file: File): Promise<CardImportPreview> {
 if(file.size>32*1024*1024) throw new Error('角色卡超过 32 MB，请缩小后导入');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(isPng(bytes)) {
  if(pngHasShare(bytes)) return convertTavernCard(JSON.parse(await readShareText(file,'character')));
  const raw=extractTavernPng(bytes);
  const avatar=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('头像读取失败'));r.readAsDataURL(file);});
  return convertTavernCard(raw,avatar);
 }
 if(!/\.json$/i.test(file.name)) throw new Error('本版支持 JSON 和 PNG 原图；YAML、CHARX、BYAF 尚未支持');
 try{return convertTavernCard(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'')));}
 catch(e){if(e instanceof SyntaxError) throw new Error('JSON 文件格式无效');throw e;}
}
