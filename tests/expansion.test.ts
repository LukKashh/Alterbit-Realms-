import test from 'node:test';
import assert from 'node:assert/strict';
import {ORE_PROGRESSION,SCROLL_CATEGORIES,SYSTEM_WORLD_NAMES,GATE_KEYS,FISHING_RESERVOIRS,FISHING_RODS,canRodFishAtDepth,getFishDepthWeight,isSystemWorld} from '../src/game/expansion.ts';

test('all twelve metallurgy tiers and mineable limits are represented',()=>{
 assert.equal(ORE_PROGRESSION.length,12);
 assert.deepEqual(ORE_PROGRESSION.map(x=>x.maxMineableTier),[1,4,6,6,6,7,8,9,10,11,12,12]);
 assert.deepEqual(ORE_PROGRESSION.slice(1).map(x=>x.cavePoints),[2,3,5,8,12,18,25,35,50,75,120]);
 assert.equal(ORE_PROGRESSION[8].smelt?.[4][0],'obsidium_bar');
});
test('scroll category data retains confirmed values',()=>{
 assert.deepEqual(SCROLL_CATEGORIES.map(x=>[x.minOreTier,x.maxOreTier,x.densityPct,x.price]),[[1,5,18,25],[1,8,24,150],[1,10,30,500],[1,12,38,1500]]);
 assert.ok(SCROLL_CATEGORIES.slice(0,3).every(x=>x.nextDropChance===0.0005));
});
test('system worlds are exactly the four named hubs',()=>{
 assert.deepEqual(SYSTEM_WORLD_NAMES,['NEXUS','DWELLER','FISHING','STATION']);
 assert.equal(isSystemWorld(' fishing '),true); assert.equal(isSystemWorld('START'),false);
});
test('gate keys preserve level, price, room and XP values',()=>{
 assert.deepEqual(GATE_KEYS.map(x=>[x.minLevel,x.gemPrice,x.worldLockPrice,x.rooms,x.xp]),[[1,50,1,3,60],[3,120,1,4,140],[6,250,2,5,300],[10,500,4,6,650],[15,1000,8,7,1400]]);
});
test('reservoirs and six rod types are mapped to depth levels',()=>{
 assert.deepEqual(FISHING_RESERVOIRS.map(x=>x.fishingDepthLevel),[1,3,6,null]);
 assert.deepEqual(FISHING_RODS.map(x=>x.maxDepthLevel),[1,2,3,4,5,6]);
 assert.ok(FISHING_RODS.every(x=>x.upgradeLevels.length===3));
 for(let type=1;type<=6;type++){assert.equal(canRodFishAtDepth(type,type),true);assert.equal(canRodFishAtDepth(type,type+1),false);}
});
test('fish can overlap depth bands but preferred depth has strongest weight',()=>{
 const fish={minDepthLevel:2,maxDepthLevel:4,preferredDepthLevel:3};
 assert.equal(getFishDepthWeight(fish,1),0);assert.equal(getFishDepthWeight(fish,2),0.35);assert.equal(getFishDepthWeight(fish,3),1);assert.equal(getFishDepthWeight(fish,4),0.35);
});
