import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ MemoryNodeDB: { getById: vi.fn(), save: vi.fn() } }));
vi.mock('./sullyosCompat', () => ({ isCompat: () => true, compatPersona: () => 'cloud', compatHeaders: async () => ({ Authorization: 'Bearer test' }) }));
import { MemoryNodeDB } from './db';
import { refreshMappedRooms } from './refreshMappedRooms';
const config = { enabled:true, initialized:true, compatShared:true, supabaseUrl:'https://example.supabase.co', supabaseAnonKey:'public' };
beforeEach(()=>vi.clearAllMocks());
it('relocates default living_room to mapped room and adds source/type tags',async()=>{
 vi.mocked(MemoryNodeDB.getById).mockResolvedValue({id:'1',charId:'local',room:'living_room',tags:['回看']} as any);
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[{memory_id:'1',room:'study',tags:['类型:fact','来源:Operit']}]})));
 expect(await refreshMappedRooms(config,'local')).toBe(1);
 expect(MemoryNodeDB.save).toHaveBeenCalledWith(expect.objectContaining({room:'study',tags:expect.arrayContaining(['回看','类型:fact','来源:Operit'])}));
});
it('preserves manual room and rewrites only auto tags',async()=>{
 vi.mocked(MemoryNodeDB.getById).mockResolvedValue({id:'2',charId:'local',room:'bedroom',tags:['我的标签','来源:旧']} as any);
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[{memory_id:'2',room:'study',tags:['类型:event','来源:Operit']}]})));
 await refreshMappedRooms(config,'local');
 const saved=vi.mocked(MemoryNodeDB.save).mock.calls[0][0] as any;
 expect(saved.room).toBe('bedroom');
 expect(saved.tags).toEqual(expect.arrayContaining(['我的标签','类型:event','来源:Operit']));
 expect(saved.tags).not.toContain('来源:旧');
});
it('skips another persona local node',async()=>{
 vi.mocked(MemoryNodeDB.getById).mockResolvedValue({id:'3',charId:'other',room:'living_room',tags:[]} as any);
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[{memory_id:'3',room:'study',tags:['类型:fact']}]})));
 expect(await refreshMappedRooms(config,'local')).toBe(0);
 expect(MemoryNodeDB.save).not.toHaveBeenCalled();
});
