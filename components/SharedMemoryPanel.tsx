import React, { useState } from 'react';
import { getSharedMemoryConfig, updateSharedMemoryConfig } from '../utils/memoryPalace/sharedMemoryConfig';
import { clearSharedSession, getSharedSession, listSharedMemories, pullSharedMemoryEvents, pushSharedMemoryNodes, signInSharedMemory } from '../utils/memoryPalace/sharedMemory';
import { MemoryNodeDB } from '../utils/memoryPalace/db';

export default function SharedMemoryPanel() {
 const initial=getSharedMemoryConfig();
 const [personaId,setPersonaId]=useState(initial.personaId),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[count,setCount]=useState<number|null>(null),[events,setEvents]=useState(0),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[logged,setLogged]=useState(!!getSharedSession());
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await fn()}catch(e:any){setError(e?.message||'操作失败')}finally{setBusy(false)}};
 const login=()=>run(async()=>{await signInSharedMemory(email,password);updateSharedMemoryConfig({personaId});setLogged(true);setMessage('共享记忆库登录成功')});
 const read=()=>run(async()=>{updateSharedMemoryConfig({personaId});const r=await listSharedMemories({personaId});setCount(r.memories.length);setMessage(`已读取云端记忆 ${r.memories.length} 条`)});
 const pull=()=>run(async()=>{const r=await pullSharedMemoryEvents({personaId});setEvents(r.events.length);setMessage(`已读取同步事件 ${r.events.length} 条`)});
 const push=()=>run(async()=>{const nodes=await MemoryNodeDB.getAll();const r=await pushSharedMemoryNodes({personaId},nodes as any);setMessage(`上传完成：接受 ${r.accepted?.length||0} 条，重复 ${r.duplicate?.length||0} 条，拒绝 ${r.rejected?.length||0} 条`)});
 return <section style={{padding:16,borderRadius:16,background:'rgba(255,255,255,.72)',display:'grid',gap:10}}><h3 style={{margin:0}}>共享云端记忆库</h3><p style={{margin:0,fontSize:12,opacity:.7}}>SullyOS ⇄ Supabase · sullyos-memory</p><input value={personaId} onChange={e=>setPersonaId(e.target.value)} placeholder="角色标识"/><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Supabase 邮箱" type="email"/><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Supabase 密码" type="password"/><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={login} disabled={busy}>登录共享库</button><button onClick={read} disabled={busy||!logged}>读取云端记忆</button><button onClick={push} disabled={busy||!logged}>上传本地记忆</button><button onClick={pull} disabled={busy||!logged}>读取同步事件</button><button onClick={()=>{clearSharedSession();setLogged(false);setMessage('已退出共享库')}}>退出</button></div>{count!==null&&<div>云端记忆：{count} 条 · 同步事件：{events} 条</div>}{message&&<div style={{color:'#176b45'}}>{message}</div>}{error&&<div style={{color:'#b42318'}}>{error}</div>}</section>;
}
