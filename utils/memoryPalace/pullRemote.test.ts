import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ MemoryNodeDB: { getById: vi.fn(), save: vi.fn(), saveVectorizedMany: vi.fn() } }));
vi.mock('./sullyosCompat', () => ({ isCompat: () => true, compatPersona: () => 'cloud', compatHeaders: async () => ({ Authorization: 'Bearer test' }) }));
vi.mock('./compatRevision', () => ({ observeCloudContent: vi.fn() }));
import { MemoryNodeDB } from './db';
import { pullRemoteMemories } from './pullRemote';
const config = { enabled:true, initialized:true, compatShared:true, supabaseUrl:'https://example.supabase.co', supabaseAnonKey:'public' };
const row = (i:number) => ({ memory_id:String(i), char_id:'cloud', content:'memory '+i, room:'study', vector:'[0.5,0.25]', dimensions:2, model:'test', created_at:123 });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(MemoryNodeDB.getById).mockResolvedValue(undefined); vi.mocked(MemoryNodeDB.saveVectorizedMany).mockResolvedValue(); vi.mocked(MemoryNodeDB.save).mockResolvedValue(); });
it('loads all 554 rows over three pages into local role with vectors',async()=>{
 const rows=Array.from({length:554},(_,i)=>row(i));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{ const offset=Number(new URL(url).searchParams.get('offset')); return {ok:true,json:async()=>rows.slice(offset,offset+200)}; }));
 expect(await pullRemoteMemories(config,'local')).toEqual({added:554,existing:0,relocated:0});
 const entries=vi.mocked(MemoryNodeDB.saveVectorizedMany).mock.calls[0][0];
 expect(entries).toHaveLength(554); expect(entries[0].node.charId).toBe('local'); expect(entries[0].node.createdAt).toBe(123); expect(entries[0].vector.vector).toBeInstanceOf(Float32Array);
});
it('preserves existing local memories',async()=>{
 vi.mocked(MemoryNodeDB.getById).mockResolvedValue({charId:'local',content:'local edit',room:'bedroom'} as any);
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[row(1)]})));
 await pullRemoteMemories(config,'local'); expect(MemoryNodeDB.saveVectorizedMany).toHaveBeenCalledWith([]);
});
it('does not save partial results on a failed page',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>Array.from({length:200},(_,i)=>row(i))}).mockResolvedValueOnce({ok:false,status:401}));
 await expect(pullRemoteMemories(config,'local')).rejects.toThrow('401'); expect(MemoryNodeDB.saveVectorizedMany).not.toHaveBeenCalled();
});
it('rejects another persona',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[{...row(1),char_id:'other'}]})));
 await expect(pullRemoteMemories(config,'local')).rejects.toThrow('角色'); expect(MemoryNodeDB.saveVectorizedMany).not.toHaveBeenCalled();
});
it('rejects invalid vectors without writing text alone',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[{...row(1),vector:null}]})));
 await expect(pullRemoteMemories(config,'local')).rejects.toThrow('向量'); expect(MemoryNodeDB.saveVectorizedMany).not.toHaveBeenCalled();
});
it('relocates old default living_room and rewrites auto tags while preserving manual ones',async()=>{
 vi.mocked(MemoryNodeDB.getById).mockResolvedValue({id:'1',charId:'local',room:'living_room',tags:['回看','来源:旧']} as any);
 vi.stubGlobal('fetch',vi.fn(async(url:string)=> url.includes('select=memory_id') ? {ok:true,json:async()=>[{memory_id:'1',room:'study',tags:['类型:fact','来源:Operit']}]} : {ok:true,json:async()=>[]}));
 const r=await pullRemoteMemories(config,'local'); expect(r.relocated).toBe(1);
 expect(MemoryNodeDB.save).toHaveBeenCalledWith(expect.objectContaining({room:'study',tags:expect.arrayContaining(['回看','类型:fact','来源:Operit'])}));
});
it('preserves manually changed room during refresh',async()=>{
 vi.mocked(MemoryNodeDB.getById).mockResolvedValue({id:'2',charId:'local',room:'bedroom',tags:['我的标签']} as any);
 vi.stubGlobal('fetch',vi.fn(async(url:string)=> url.includes('select=memory_id') ? {ok:true,json:async()=>[{memory_id:'2',room:'study',tags:['类型:event','来源:Operit']}]} : {ok:true,json:async()=>[]}));
 await pullRemoteMemories(config,'local');
 const saved=vi.mocked(MemoryNodeDB.save).mock.calls[0][0] as any; expect(saved.room).toBe('bedroom');
});
