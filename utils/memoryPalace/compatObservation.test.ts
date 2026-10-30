import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {observeCloudContent,withExpectedRevisions} from './compatRevision';
const c={enabled:true,initialized:true,supabaseUrl:'https://one.supabase.co',supabaseAnonKey:'public'};
const auth={Authorization:'Bearer e30.'+btoa(JSON.stringify({sub:'owner'}))+'.sig'};
beforeEach(()=>{const m=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>m.get(k)||null,setItem:(k:string,v:string)=>m.set(k,v)});vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>4}));});
afterEach(()=>vi.unstubAllGlobals());
it('observed original sent with update',async()=>{observeCloudContent(c,'persona',[{memory_id:'m',content:'old'}],auth);expect(await withExpectedRevisions(c,'persona',[{memory_id:'m',content:'edit'}],auth)).toEqual([{memory_id:'m',content:'edit',expected_revision:4,expected_content:'old'}]);});
it('background reread cannot silently rebase offline edit',async()=>{observeCloudContent(c,'persona',[{memory_id:'m',content:'old'}],auth);observeCloudContent(c,'persona',[{memory_id:'m',content:'remote changed'}],auth);const rows=await withExpectedRevisions(c,'persona',[{memory_id:'m',content:'offline edit'}],auth);expect((rows[0] as any).expected_content).toBe('old');});
it('other persona receives no observed content',async()=>{observeCloudContent(c,'one',[{memory_id:'m',content:'private'}],auth);expect((await withExpectedRevisions(c,'two',[{memory_id:'m'}],auth))[0]).not.toHaveProperty('expected_content');});
