import {afterEach,it,expect,vi} from 'vitest';
import {withExpectedRevisions} from './compatRevision';
const c={enabled:true,initialized:true,supabaseUrl:'https://one.supabase.co/',supabaseAnonKey:'public'};
afterEach(()=>vi.unstubAllGlobals());
it('existing revision attached without changing row',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>7}));const row={memory_id:'x',content:'original'};expect(await withExpectedRevisions(c,'persona',[row],{Authorization:'Bearer user'})).toEqual([{...row,expected_revision:7}]);expect(row).not.toHaveProperty('expected_revision');});
it('new memory expects zero',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>null}));expect(await withExpectedRevisions(c,'persona',[{memory_id:'new'}],{})).toEqual([{memory_id:'new',expected_revision:0}]);});
it('lookup failure blocks write preparation',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,text:async()=>'denied'}));await expect(withExpectedRevisions(c,'persona',[{memory_id:'x'}],{})).rejects.toThrow('denied');});
