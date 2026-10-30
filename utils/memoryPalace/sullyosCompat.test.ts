import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {bindCompat,compatPersona,compatHeaders,compatWrite,readCompatBinding} from './sullyosCompat';
const c={enabled:true,initialized:true,compatShared:true,supabaseUrl:'https://one.supabase.co/',supabaseAnonKey:'public'};
const p='11111111-1111-4111-8111-111111111111';
const key='sullyos.compat.v2.https://one.supabase.co.session';
function seed(user='owner',expires=Date.now()/1000+3600){localStorage.setItem(key,JSON.stringify({access_token:'user-token',refresh_token:'refresh',expires_at:expires,user:{id:user}}));}
beforeEach(()=>{const m=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>m.get(k)||null,setItem:(k:string,v:string)=>m.set(k,v)});vi.stubGlobal('fetch',vi.fn());seed();});
afterEach(()=>vi.unstubAllGlobals());
it('legacy unchanged',async()=>expect(await compatHeaders({...c,compatShared:false})).toEqual({}));
it('no role fallback',()=>{bindCompat('a',p,c);expect(()=>compatPersona('b',c)).toThrow();expect(()=>compatPersona(undefined,c)).toThrow();});
it('project isolated',()=>{bindCompat('a',p,c);expect(readCompatBinding('a',{...c,supabaseUrl:'https://two.supabase.co'})).toBe('');});
it('account isolated',()=>{bindCompat('a',p,c);seed('other');expect(()=>compatPersona('a',c)).toThrow();});
it('partial writes fail',async()=>{bindCompat('a',p,c);vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({affected:0})} as any);expect(await compatWrite(c,'delete',[],['m'],{},'a')).toBe(false);});
it('unbound write makes no fetch',async()=>{await expect(compatWrite(c,'delete',[],['m'],{},'missing')).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();});
it('refresh coalesces',async()=>{seed('owner',1);vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({access_token:'new',refresh_token:'new-refresh',expires_in:3600,user:{id:'owner'}})} as any);const r=await Promise.all([compatHeaders(c),compatHeaders(c)]);expect(fetch).toHaveBeenCalledTimes(1);expect(r[0].Authorization).toBe('Bearer new');expect(r[1]).toEqual(r[0]);});
it('wrong refresh owner rejected',async()=>{seed('owner',1);vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({access_token:'bad',user:{id:'other'}})} as any);await expect(compatHeaders(c)).rejects.toThrow('账号不匹配');expect(JSON.parse(localStorage.getItem(key)!).user.id).toBe('owner');});
