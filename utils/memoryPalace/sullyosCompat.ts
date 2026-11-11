import { withExpectedRevisions } from './compatRevision';
import type { RemoteVectorConfig } from './types';
interface Session { access_token:string; refresh_token?:string; expires_at?:number; user:{id:string} }
const PREFIX='sullyos.compat.v2.';
function base(c:RemoteVectorConfig):string { const u=new URL(c.supabaseUrl); if(u.protocol!=='https:' && u.hostname!=='localhost') throw new Error('共享库需要安全地址'); return u.origin; }
function sessionKey(c:RemoteVectorConfig){return PREFIX+base(c)+'.session';}
function load(c:RemoteVectorConfig):Session { let s:Session|null=null;try{s=JSON.parse(localStorage.getItem(sessionKey(c))||'null')}catch{} if(!s?.access_token||!s.user?.id)throw new Error('请在此项目登录共享记忆库'); return s; }
function bindingKey(c:RemoteVectorConfig){return PREFIX+base(c)+'.'+load(c).user.id+'.bindings';}
function bindings(c:RemoteVectorConfig):Record<string,string>{try{return JSON.parse(localStorage.getItem(bindingKey(c))||'{}')}catch{return {}}}
export function isCompat(c:RemoteVectorConfig){return c.compatShared===true;}
export function readCompatBinding(id:string,c:RemoteVectorConfig){return bindings(c)[id]||'';}
export interface CompatPersonaPartition { personaId:string; count:number; displayName?:string; }
/** 读取云端为 persona 保存的显示名（表不存在或无权限时静默降级为无名称）。 */
export async function listCompatPersonaLabels(c:RemoteVectorConfig):Promise<Record<string,string>> {
  const authorization=await compatHeaders(c);
  try{
    const r=await fetch(new URL('/rest/v1/aion_persona_labels?select=persona_id,display_name',c.supabaseUrl).href,{headers:{apikey:c.supabaseAnonKey,...authorization}});
    if(!r.ok) return {};
    const rows=await r.json();
    if(!Array.isArray(rows)) return {};
    const out:Record<string,string>={};
    for(const row of rows) if(typeof row?.persona_id==='string'&&typeof row?.display_name==='string'&&row.display_name) out[row.persona_id]=row.display_name;
    return out;
  }catch{return {};}
}
/** 保存/更新某个 persona 的显示名。名称只用于界面展示，不参与记忆匹配。 */
export async function saveCompatPersonaLabel(c:RemoteVectorConfig,personaId:string,displayName:string):Promise<void> {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(personaId)) throw new Error('角色编号格式不正确');
  const name=displayName.trim();
  if(!name) throw new Error('名称不能为空');
  if(name.length>64) throw new Error('名称最多 64 个字符');
  const authorization=await compatHeaders(c);
  const r=await fetch(new URL('/rest/v1/aion_persona_labels?on_conflict=owner_id,persona_id',c.supabaseUrl).href,{
    method:'POST',
    headers:{apikey:c.supabaseAnonKey,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal',...authorization},
    body:JSON.stringify([{persona_id:personaId,display_name:name}]),
  });
  if(!r.ok) throw new Error(await r.text());
}
/** 共享库没有角色名称注册表；这里只读取实际存在的 persona 分区及数量，不猜测名称。 */
export async function listCompatPersonaPartitions(c:RemoteVectorConfig):Promise<CompatPersonaPartition[]> {
  const authorization=await compatHeaders(c);
  const result=new Map<string,number>();
  for(let offset=0;;offset+=1000){
    const q=new URLSearchParams({select:'char_id',order:'char_id.asc',limit:'1000',offset:String(offset)});
    const r=await fetch(new URL('/rest/v1/memory_vectors?'+q,c.supabaseUrl).href,{headers:{apikey:c.supabaseAnonKey,...authorization}});
    if(!r.ok) throw new Error(await r.text());
    const rows=await r.json();
    if(!Array.isArray(rows)) throw new Error('共享库角色分区返回格式错误');
    for(const row of rows) if(typeof row?.char_id==='string'&&row.char_id) result.set(row.char_id,(result.get(row.char_id)||0)+1);
    if(rows.length<1000) break;
  }
  const labels=await listCompatPersonaLabels(c).catch(()=>({} as Record<string,string>));
  for(const id of Object.keys(labels)) if(!result.has(id)) result.set(id,0);
  return [...result].map(([personaId,count])=>({personaId,count,displayName:labels[personaId]}));
}
export function compatPersona(charId:string|undefined,c:RemoteVectorConfig):string {const b=bindings(c);if(charId&&b[charId])return b[charId];throw new Error('共享库操作需要当前角色的明确绑定');}
export function bindCompat(id:string,persona:string,c:RemoteVectorConfig){if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(persona))throw new Error('角色编号格式不正确');localStorage.setItem(bindingKey(c),JSON.stringify({...bindings(c),[id]:persona}));}
async function auth(c:RemoteVectorConfig,grant:string,body:unknown):Promise<Session>{const r=await fetch(base(c)+'/auth/v1/token?grant_type='+grant,{method:'POST',headers:{apikey:c.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok||!d.access_token||!d.user?.id)throw new Error(d.error_description||d.message||'共享库认证失败');if(!d.expires_at&&d.expires_in)d.expires_at=Math.floor(Date.now()/1000)+d.expires_in;return d;}
export async function compatLogin(c:RemoteVectorConfig,email:string,password:string){const d=await auth(c,'password',{email,password});localStorage.setItem(sessionKey(c),JSON.stringify(d));}
const refreshing=new Map<string,Promise<Session>>();
export async function compatHeaders(c:RemoteVectorConfig):Promise<Record<string,string>>{if(!isCompat(c))return {};let s=load(c);if(!s.expires_at||s.expires_at*1000<=Date.now()+60000){if(!s.refresh_token)throw new Error('登录已过期，请重新登录');const key=sessionKey(c);let task=refreshing.get(key);if(!task){const previous=s;task=auth(c,'refresh_token',{refresh_token:s.refresh_token}).then(d=>{if(d.user.id!==previous.user.id)throw new Error('刷新账号不匹配');const current=load(c);if(current.access_token!==previous.access_token)throw new Error('账号已切换，请重试');localStorage.setItem(key,JSON.stringify(d));return d;}).finally(()=>refreshing.delete(key));refreshing.set(key,task);}s=await task;}return {Authorization:`Bearer ${s.access_token}`};}
export async function compatWrite(c:RemoteVectorConfig,action:string,rows:unknown[],ids:string[],patch:unknown,charId?:string){const persona=compatPersona(charId,c);const authorization=await compatHeaders(c);if(compatPersona(charId,c)!==persona)throw new Error('账号或角色已切换，请重试');const preparedRows=action==='upsert'?await withExpectedRevisions(c,persona,rows,authorization):rows;const r=await fetch(base(c)+'/rest/v1/rpc/sullyos_memory_write',{method:'POST',headers:{apikey:c.supabaseAnonKey,'Content-Type':'application/json',...authorization},body:JSON.stringify({p_action:action,p_persona:persona,p_rows:preparedRows,p_ids:ids,p_patch:patch})});if(!r.ok){const text=await r.text();let detail:any;try{detail=JSON.parse(text)}catch{};const message=detail?.message||detail?.error||text;const error:any=new Error(message||'共享库写入失败');error.code=detail?.code||detail?.error_code||'';error.conflict=error.code==='PO001'||/inactive memory requires explicit conflict resolution/i.test(message);throw error;}const d=await r.json();return d.affected===(rows.length||ids.length);}
