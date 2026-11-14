import test from 'node:test';
import assert from 'node:assert/strict';
import { FURNACE_RECIPES, ITEM_IDS, getItemDef } from '../src/game/catalog.ts';
import {ORE_PROGRESSION,SCROLL_CATEGORIES,SYSTEM_WORLD_NAMES,GATE_KEYS,FISHING_RESERVOIRS,FISHING_RODS,canRodFishAtDepth,getFishingDepthLevel,getFishDepthWeight,getRodUpgradeGemCost,getFishingPullStrength,getFishPullResistance,getFiscoreDepthTier,FISCORE_DEPTH_LEVELS,isSystemWorld} from '../src/game/expansion.ts';
import { DEFAULT_GAME_CONFIG, sanitizeGameConfig } from '../src/game/config.ts';

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
test('Fiscore exposes six server-validated depth zones',()=>{
 assert.deepEqual(FISCORE_DEPTH_LEVELS,[1,2,3,4,5,6]);
 assert.deepEqual(FISCORE_DEPTH_LEVELS.map(getFiscoreDepthTier),['shallow','shallow','deep','deep','abyssal','abyssal']);
 assert.equal(getFiscoreDepthTier(0),'none');
 assert.equal(getFiscoreDepthTier(7),'none');
});

test('fish can overlap depth bands but preferred depth has strongest weight',()=>{
 const fish={minDepthLevel:2,maxDepthLevel:4,preferredDepthLevel:3};
 assert.equal(getFishDepthWeight(fish,1),0);assert.equal(getFishDepthWeight(fish,2),0.35);assert.equal(getFishDepthWeight(fish,3),1);assert.equal(getFishDepthWeight(fish,4),0.35);
});

test('physical reservoir depth maps consistently to six fishing depth levels',()=>{
 assert.deepEqual([1,2,3,4,5,6,7,8,9,10,11,12].map(getFishingDepthLevel),[1,1,2,2,3,3,4,4,5,5,6,6]);
 assert.equal(getFishingDepthLevel(0),0);
});

test('catalog exposes six rod types with three upgrade levels each',()=>{
 const ids=[ITEM_IDS.BAMBOO_ROD,ITEM_IDS.ANGLER_ROD,ITEM_IDS.FISHING_ROD_III,ITEM_IDS.FISHING_ROD_IV,ITEM_IDS.FISHING_ROD_V,ITEM_IDS.FISHING_ROD_VI];
 assert.deepEqual(ids.map(id=>getItemDef(id)?.rodType),[1,2,3,4,5,6]);
 assert.ok(ids.every(id=>getItemDef(id)?.rodUpgradeLevels?.join(',')==='1,2,3'));
});

test('all six fishing rods have durability and a repair path',()=>{
 const ids=[ITEM_IDS.BAMBOO_ROD,ITEM_IDS.ANGLER_ROD,ITEM_IDS.FISHING_ROD_III,ITEM_IDS.FISHING_ROD_IV,ITEM_IDS.FISHING_ROD_V,ITEM_IDS.FISHING_ROD_VI];
 assert.ok(ids.every(id=>{
  const rod=getItemDef(id);
  return rod?.maxDurability && rod.repairMaterialId && rod.repairQty;
 }));
 const recipeIds=['craft_bamboo_rod','craft_angler_rod','craft_fishing_rod_iii','craft_fishing_rod_iv','craft_fishing_rod_v','craft_fishing_rod_vi'];
 assert.ok(recipeIds.every(id=>FURNACE_RECIPES.some(recipe=>recipe.id===id)));
});

test('existing fish species have overlapping depth bands and distinct preferred depths',()=>{
 const minnow=getItemDef(ITEM_IDS.FISH_MINNOW)?.fishDepthProfile;
 const carp=getItemDef(ITEM_IDS.FISH_CARP)?.fishDepthProfile;
 const trout=getItemDef(ITEM_IDS.FISH_GLACIER_TROUT)?.fishDepthProfile;
 assert.deepEqual(minnow,{minDepthLevel:1,maxDepthLevel:2,preferredDepthLevel:1});
 assert.deepEqual(carp,{minDepthLevel:2,maxDepthLevel:4,preferredDepthLevel:3});
 assert.deepEqual(trout,{minDepthLevel:5,maxDepthLevel:6,preferredDepthLevel:6});
 assert.ok(getFishDepthWeight(minnow!,2)>0 && getFishDepthWeight(carp!,2)>0);
 assert.equal(getFishDepthWeight(trout!,4),0);
});


test('fishing upgrade defaults are configurable and sanitize safely',()=>{
 const fishing=DEFAULT_GAME_CONFIG.fishing;
 assert.deepEqual(fishing.upgradeGemCostsByRodType[0],[0,100,250]);
 assert.deepEqual(fishing.pullingMultiplierByUpgrade,[1,1.35,1.75]);
 assert.equal(getRodUpgradeGemCost(6,3,fishing),2750);
 assert.equal(getFishingPullStrength(4,3,fishing),7);
 assert.equal(getFishPullResistance(ITEM_IDS.FISH_GLACIER_TROUT,fishing),1.4);
 const sanitized=sanitizeGameConfig({fishing:{
  upgradeGemCostsByRodType:[[0,-500,999999999]],
  pullingMultiplierByUpgrade:[99,1.5,8],
  fishResistanceByItemId:{[ITEM_IDS.FISH_GLACIER_TROUT]:99},
 }}).fishing;
 assert.deepEqual(sanitized.upgradeGemCostsByRodType[0],[0,0,1000000]);
 assert.deepEqual(sanitized.pullingMultiplierByUpgrade,[1,1.5,5]);
 assert.equal(sanitized.fishResistanceByItemId[ITEM_IDS.FISH_GLACIER_TROUT],5);
 assert.equal(sanitized.fishResistanceByItemId[ITEM_IDS.FISH_MINNOW],0.7);
});
