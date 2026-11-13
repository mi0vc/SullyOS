import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {normalizeStoryTheater,createStoryTheaterDraft} from './storyTheater';
import {renderTavernText} from './tavernMacros';
describe('Tavern opening belongs to story theater',()=>{
 it('retains opening through story normalization',()=>{
  const cardOpening={characterId:'a',greetingIndex:1,content:'{{char}}来到{{user}}面前'};
  expect(normalizeStoryTheater({...createStoryTheaterDraft(),cardOpening}).cardOpening).toEqual(cardOpening);
  expect(renderTavernText(cardOpening.content,'甲','面具乙')).toBe('甲来到面具乙面前');
 });
 it('removes incorrect companion entry and uses isolated story persistence',()=>{
  const companion=readFileSync(new URL('../apps/DateApp.tsx',import.meta.url),'utf8');
  expect(companion).not.toContain('使用角色卡开场');
  const session=readFileSync(new URL('../components/date/story/StoryTheaterSession.tsx',import.meta.url),'utf8');
  expect(session).toContain('before.length === 0 && entry.cardOpening');
  expect(session).toContain("saveCentralAndMirrors('assistant', renderTavernText");
  expect(session).toContain('theaterCardOpening: true');
 });
});
