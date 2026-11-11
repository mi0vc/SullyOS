import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { File } from 'node:buffer';
import { convertTavernCard,extractTavernPng,readCharacterImport,renderTavernText } from './tavernCard';
import { embedShareInPng } from './pngShare';
import { stripSensitiveCardFields } from './characterCard';
const png=new Uint8Array(readFileSync(new URL('../public/icons/icon-192.png',import.meta.url)));
const data={name:'测试 🌙',description:'我是 {{char}}',personality:'谨慎',scenario:'小镇',first_mes:'你好 {{user}}',alternate_greetings:['另一句'],mes_example:'示例',creator:'作者',creator_notes:'不应进入提示词'};
function addText(base:Uint8Array,key:string,raw:unknown){
 const payload=new TextEncoder().encode(key+'\0'+Buffer.from(JSON.stringify(raw)).toString('base64'));
 const c=new Uint8Array(payload.length+12);const v=new DataView(c.buffer);v.setUint32(0,payload.length);c.set(new TextEncoder().encode('tEXt'),4);c.set(payload,8);
 let crc=0xffffffff;for(const b of c.subarray(4,c.length-4)){crc^=b;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}v.setUint32(c.length-4,(crc^0xffffffff)>>>0);
 const out=new Uint8Array(base.length+c.length);out.set(base.subarray(0,base.length-12));out.set(c,base.length-12);out.set(base.subarray(base.length-12),out.length-12);return out;
}
describe('tavern import',()=>{
 it.each(['v1','chara_card_v2','chara_card_v3'])('maps %s without credentials',spec=>{
  const d={...data,dialogueApi:{apiKey:'SECRET'},embeddingConfig:{apiKey:'SECRET'}};
  const r=convertTavernCard(spec==='v1'?d:{spec,data:d});
  expect(r.card.name).toBe(data.name);expect(r.greetings).toHaveLength(2);expect(r.card.systemPrompt).toContain('谨慎');expect(r.card.systemPrompt).toContain('小镇');expect(r.card.description).toBe('');expect(JSON.stringify(r.card)).not.toContain('SECRET');expect(r.card.systemPrompt).not.toContain(data.creator_notes);
 });
 it('maps worldbook activation and assigns independent ids',()=>{
  const d={...data,character_book:{entries:[{keys:['月亮'],secondary_keys:['海'],content:'设定',enabled:false,constant:false,selective:true,insertion_order:9,position:'before_char',extensions:{probability:25,useProbability:true}}]}};
  const a=convertTavernCard(d),b=convertTavernCard(d);
  expect(a.card.mountedWorldbooks?.[0]).toMatchObject({key:['月亮'],keysecondary:['海'],disable:true,constant:false,selective:true,order:9,position:0,probability:25});
  expect(a.card.mountedWorldbooks?.[0].id).not.toBe(b.card.mountedWorldbooks?.[0].id);
 });
 it.each([null,{}, {name:'x'}, {spec:'unknown',data}, {spec:'chara_card_v2',data:{...data,description:3}}, {...data,character_book:{entries:[{}]}}])('rejects invalid card %j',d=>expect(()=>convertTavernCard(d)).toThrow());
 it('reads Unicode chara PNG',()=>expect(extractTavernPng(addText(png,'chara',data))).toEqual(data));
 it('prefers ccv3',()=>expect(extractTavernPng(addText(addText(png,'chara',data),'ccv3',{spec:'chara_card_v3',data:{...data,name:'V3'}})).data.name).toBe('V3'));
 it('rejects plain and corrupted PNG',()=>{expect(()=>extractTavernPng(png)).toThrow();const p=addText(png,'chara',data);p[p.length-20]^=1;expect(()=>extractTavernPng(p)).toThrow();});
 it('retains Sully JSON compatibility and stripping',async()=>{
  const d={type:'sully_character_card',name:'Sully',systemPrompt:'test',dialogueApi:{apiKey:'SECRET'}};
  const r=await readCharacterImport(new File([JSON.stringify(d)],'s.json') as unknown as globalThis.File);
  expect(r.format).toBe('SullyOS');expect(stripSensitiveCardFields(r.card)).not.toHaveProperty('dialogueApi');
 });
 it('retains Sully PNG compatibility',async()=>{
  const bytes=embedShareInPng(png,{format:'sullyos-share',version:1,kind:'character',title:'测试',author:'',restrictions:'',style:'paper',fileName:'card.json',mimeType:'application/json'},new TextEncoder().encode(JSON.stringify({type:'sully_character_card',name:'Sully'})));
  expect((await readCharacterImport(new File([new Uint8Array(bytes).buffer],'s.png') as unknown as globalThis.File)).format).toBe('SullyOS');
 });
 it('replaces only supported macros safely',()=>expect(renderTavernText('{{char}} {{user}} {{random}}','$&','棠棠')).toBe('$& 棠棠 {{random}}'));
 it('warns about non-equivalent features',()=>{const r=convertTavernCard({...data,post_history_instructions:'末尾',extensions:{scripts:['x']},assets:[{}]});expect(r.warnings.length).toBeGreaterThan(3);expect(r.card.systemPrompt).toContain('末尾');});
});
it('feeds imported personality and worldbook into real context',async()=>{
 const {ContextBuilder}=await import('./context');
 const r=convertTavernCard({...data,character_book:{entries:[{keys:['月亮'],content:'{{char}}与{{user}}的月亮世界',enabled:true,constant:false},{keys:[],content:'不该出现的条目',enabled:false,constant:true}]}});
 const character={...r.card,id:'import-test',memories:[]} as any;
 const user={name:'棠棠',bio:''} as any;
 const result=await ContextBuilder.buildCharacterContext({char:character,user,history:[{role:'user',content:'月亮'}]});
 const s=JSON.stringify(result);expect(s).toContain('我是 测试 🌙');expect(s).toContain('测试 🌙与棠棠的月亮世界');expect(s).not.toContain('不该出现的条目');expect(s).not.toContain(data.creator_notes);
});
