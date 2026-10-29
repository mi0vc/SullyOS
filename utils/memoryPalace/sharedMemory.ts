/**
 * memory-dual-v1 共享记忆适配器。
 * SullyOS 本地记忆仍保存在 IndexedDB；本模块负责共享云端记忆的登录、读取、推送和事件回拉。
 */
import type { MemoryNode } from './types';
export const SHARED_MEMORY_URL='https://seosxqrdqqolsmjsljze.supabase.co/functions/v1/sullyos-memory';
const SESSION_KEY='sullyos.shared.supabase.session';
export interface SharedMemorySession{access_token:string;refresh_token?:string;expires_at?:number;user?:{id?:string;email?:string}}
export interface SharedMemoryConfig{personaId:string;endpoint?:string}
export interface SharedMemoryRecord{id?:string;original_id:string;content:string;status?:string;revision?:number;memory_type?:string;importance?:number;tags?:string[];entities?:unknown[];manual_metadata?:Record<string,unknown>;source_hash?:string;source_key?:string}
export function getSharedSession():SharedMemorySession|null{try{const raw=localStorage.getItem(SESSION_KEY);if(!raw)return null;const v=JSON.parse(raw) as SharedMemorySession;return v?.access_token?v:null}catch{return null}}
export function clearSharedSession(){localStorage.removeItem(SESSION_KEY)}
export async function signInSharedMemory(email:string,password:string,supabaseUrl='https://seosxqrdqqolsmjsljze.supabase.co',anonKey?:string){const key=anonKey||localStorage.getItem('sullyos.supabase.anonKey')||'';if(!key)throw new Error('缺少 Supabase anon key，请先在 SullyOS 记忆宫殿设置中配置');const base=supabaseUrl.replace(/\/+$/,'');const r=await fetch(`${base}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok||!d.access_token)throw new Error(d.error_description||d.message||'Supabase 登录失败');localStorage.setItem(SESSION_KEY,JSON.stringify(d));return d as SharedMemorySession}
async function callShared(action:string,config:SharedMemoryConfig,body:Record<string,unknown>={}){const s=getSharedSession();if(!s)throw new Error('请先登录共享记忆库');const r=await fetch(config.endpoint||SHARED_MEMORY_URL,{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,persona_id:config.personaId,...body})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`共享记忆请求失败（${r.status}）`);return d}
export function listSharedMemories(c:SharedMemoryConfig,limit=500){return callShared('list',c,{limit}) as Promise<{memories:SharedMemoryRecord[]}>}
export function pullSharedMemoryEvents(c:SharedMemoryConfig,since='1970-01-01T00:00:00Z',limit=500){return callShared('pull',c,{since,limit}) as Promise<{events:any[]}>}
function toSharedRecord(n:MemoryNode):SharedMemoryRecord{return{original_id:n.id,content:n.content,status:n.archived?'archived':'active',revision:1,memory_type:n.origin||'fact',importance:Math.max(0,Math.min(1,Number(n.importance||5)/10)),tags:n.tags||[],entities:n.entities||[],manual_metadata:{room:n.room,mood:n.mood,char_id:n.charId,source:'sullyos'},source_key:`sullyos:${n.id}`}}
export function buildSharedPushOperation(n:MemoryNode,index=0){const payload=toSharedRecord(n);return{operation_id:`sullyos-${Date.now()}-${index}-${n.id}`,operation_type:'upsert',revision:payload.revision,source_node:'sullyos',payload}}
export function pushSharedMemoryNodes(c:SharedMemoryConfig,nodes:MemoryNode[]){return callShared('push',c,{operations:nodes.map((n,i)=>buildSharedPushOperation(n,i))})}
