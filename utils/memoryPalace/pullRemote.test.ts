import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ MemoryNodeDB: { getById: vi.fn(), saveVectorizedMany: vi.fn() } }));
vi.mock('./sullyosCompat', () => ({ isCompat: () => true, compatPersona: () => 'cloud', compatHeaders: async () => ({ Authorization: 'Bearer test' }) }));
vi.mock('./compatRevision', () => ({ observeCloudContent: vi.fn() }));
import { MemoryNodeDB } from './db';
import { pullRemoteMemories } from './pullRemote';
const config = { enabled:true, initialized:true, compatShared:true, supabaseUrl:'https://example.supabase.co', supabaseAnonKey:'public' };
const row = (i:number) => ({ memory_id:String(i), char_id:'cloud', content:'memory '+i, room:'study', vector:'[0.5,0.25]', dimensions:2, model:'test', created_at:123 });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(MemoryNodeDB.getById).mockResolvedValue(undefined); vi.mocked(MemoryNodeDB.saveVectorizedMany).mockResolvedValue(); });
it('loads all 554 rows over three pages into local role with vectors',async()=>{
 const rows=Array.from({length:554},(_,i)=>row(i));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{ const offset=Number(new URL(url).searchParams.get('offset')); return {ok:true,json:async()=>rows.slice(offset,offset+200)}; }));
 expect(await pullRemoteMemories(config,'local')).toEqual({added:554,existing:0});
 const entries=vi.mocked(MemoryNodeDB.saveVectorizedMany).mock.calls[0][0];
 expect(entries).toHaveLength(554); expect(entries[0].node.charId).toBe('local'); expect(entries[0].node.createdAt).toBe(123); expect(entries[0].vector.vector).toBeInstanceOf(Float32Array); expect(fetch).toHaveBeenCalledTimes(3);
});
it('preserves existing local memories',async()=>{
 vi.mocked(MemoryNodeDB.getById).mockResolvedValue({charId:'local',content:'local edit'} as any);
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[row(1)]})));
 expect(await pullRemoteMemories(config,'local')).toEqual({added:0,existing:1}); expect(MemoryNodeDB.saveVectorizedMany).toHaveBeenCalledWith([]);
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
