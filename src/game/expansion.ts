import type { FishingMechanicsConfig } from './config.ts';

/** Source-confirmed progression data from the revised implementation blueprint.
 * Unknown balance values are intentionally left undefined. */
export const ORE_PROGRESSION = [
 {tier:1,id:'coal',maxMineableTier:1,cavePoints:undefined,smelt:null,pickaxe:null},
 {tier:2,id:'copper',maxMineableTier:4,cavePoints:2,smelt:[['copper_ore',2],['copper_ingot',1]],pickaxe:{id:'copper_pickaxe',previous:'stone_pickaxe',ingredients:[['stone_pickaxe',1],['copper_ingot',3],['wood',2]]}},
 {tier:3,id:'iron',maxMineableTier:6,cavePoints:3,smelt:[['iron_ore',2],['iron_ingot',1]],pickaxe:{id:'iron_pickaxe',previous:'copper_pickaxe',ingredients:[['copper_pickaxe',1],['iron_ingot',4],['wood',2]]}},
 {tier:4,id:'silver',maxMineableTier:6,cavePoints:5,smelt:[['silver_ore',3],['silver_ingot',1]],pickaxe:{id:'silver_pickaxe',previous:'iron_pickaxe',ingredients:[['iron_pickaxe',1],['silver_ingot',4],['copper_ingot',2]]}},
 {tier:5,id:'gold',maxMineableTier:6,cavePoints:8,smelt:[['gold_ore',4],['gold_ingot',1]],pickaxe:{id:'gold_pickaxe',previous:'silver_pickaxe',ingredients:[['silver_pickaxe',1],['gold_ingot',5],['silver_ingot',2]]}},
 {tier:6,id:'diamond',maxMineableTier:7,cavePoints:12,smelt:[['diamond_ore',5],['diamond_ingot',1]],pickaxe:{id:'diamond_pickaxe',previous:'gold_pickaxe',ingredients:[['gold_pickaxe',1],['diamond_ingot',5],['gold_ingot',2]]}},
 {tier:7,id:'rubidrite',maxMineableTier:8,cavePoints:18,smelt:[['rubidrite_ore',6],['rubidrite_ingot',1]],pickaxe:{id:'rubidrite_pickaxe',previous:'diamond_pickaxe',ingredients:[['diamond_pickaxe',1],['rubidrite_ingot',5],['diamond_ingot',2]]}},
 {tier:8,id:'emeraldazyte',maxMineableTier:9,cavePoints:25,smelt:[['emeraldazyte_ore',6],['emeraldazyte_ingot',1]],pickaxe:{id:'emeraldazyte_pickaxe',previous:'rubidrite_pickaxe',ingredients:[['rubidrite_pickaxe',1],['emeraldazyte_ingot',5],['rubidrite_ingot',2]]}},
 {tier:9,id:'obsidium',maxMineableTier:10,cavePoints:35,smelt:[['obsidium_ore',1],['diamond_ore',1],['rubidrite_ore',1],['emeraldazyte_ore',1],['obsidium_bar',1]],pickaxe:{id:'obsidium_pickaxe',previous:'emeraldazyte_pickaxe',ingredients:[['emeraldazyte_pickaxe',1],['obsidium_bar',4],['emeraldazyte_ingot',2]]}},
 {tier:10,id:'divinium',maxMineableTier:11,cavePoints:50,smelt:[['divinium_ore',2],['obsidium_bar',2],['gold_ingot',6],['divinium_ingot',1]],pickaxe:{id:'divinium_pickaxe',previous:'obsidium_pickaxe',ingredients:[['obsidium_pickaxe',1],['divinium_ingot',4],['obsidium_bar',2]]}},
 {tier:11,id:'mythrilyte',maxMineableTier:12,cavePoints:75,smelt:[['mythrilyte_ore',3],['divinium_ingot',2],['obsidium_bar',2],['mythrilyte_ingot',1]],pickaxe:{id:'mythrilyte_pickaxe',previous:'divinium_pickaxe',ingredients:[['divinium_pickaxe',1],['mythrilyte_ingot',4],['divinium_ingot',2]]}},
 {tier:12,id:'omegazyte',maxMineableTier:12,cavePoints:120,smelt:[['omegazyte_ore',3],['mythrilyte_ingot',3],['divinium_ingot',4],['omegazyte_ingot',1]],pickaxe:{id:'omegazyte_pickaxe',previous:'mythrilyte_pickaxe',ingredients:[['mythrilyte_pickaxe',1],['omegazyte_ingot',4],['mythrilyte_ingot',2],['obsidium_bar',2]]}},
] as const;

export const SCROLL_CATEGORIES = [
 {category:1,id:'cave_dweller_scroll_i',minOreTier:1,maxOreTier:5,densityPct:18,price:25,next:'cave_dweller_scroll_ii',nextDropChance:0.0005},
 {category:2,id:'cave_dweller_scroll_ii',minOreTier:1,maxOreTier:8,densityPct:24,price:150,next:'cave_dweller_scroll_iii',nextDropChance:0.0005},
 {category:3,id:'cave_dweller_scroll_iii',minOreTier:1,maxOreTier:10,densityPct:30,price:500,next:'cave_dweller_scroll_iv',nextDropChance:0.0005},
 {category:4,id:'cave_dweller_scroll_iv',minOreTier:1,maxOreTier:12,densityPct:38,price:1500,next:null,nextDropChance:0},
] as const;

export const SYSTEM_WORLD_NAMES = ['NEXUS','DWELLER','FISHING','STATION'] as const;
export type SystemWorldName = typeof SYSTEM_WORLD_NAMES[number];
export function isSystemWorld(name:string): name is SystemWorldName {
 return (SYSTEM_WORLD_NAMES as readonly string[]).includes(name.trim().toUpperCase());
}

export const GATE_KEYS = [
 {tier:1,id:'station_gate_key_i',minLevel:1,gemPrice:50,worldLockPrice:1,rooms:3,xp:60,enemyFamily:'Cavern Slimes & Drones',orePool:['copper','iron','silver','gold']},
 {tier:2,id:'station_gate_key_ii',minLevel:3,gemPrice:120,worldLockPrice:1,rooms:4,xp:140,enemyFamily:'Sentinel Golems',orePool:['gold','diamond','rubidrite']},
 {tier:3,id:'station_gate_key_iii',minLevel:6,gemPrice:250,worldLockPrice:2,rooms:5,xp:300,enemyFamily:'Emerald Stalkers',orePool:['rubidrite','emeraldazyte','obsidium']},
 {tier:4,id:'station_gate_key_iv',minLevel:10,gemPrice:500,worldLockPrice:4,rooms:6,xp:650,enemyFamily:'Divinium Wardens',orePool:['obsidium','divinium','mythrilyte']},
 {tier:5,id:'station_gate_key_v',minLevel:15,gemPrice:1000,worldLockPrice:8,rooms:7,xp:1400,enemyFamily:'Omegazyte Overlords',orePool:['divinium','mythrilyte','omegazyte']},
] as const;

export const FISHING_RESERVOIRS = [
 {id:'shallow_stream',name:'Shallow Stream',sourceDepthLabel:2,fishingDepthLevel:1,environment:'shallow_freshwater'},
 {id:'mid_cavern_pond',name:'Mid Cavern Pond',sourceDepthLabel:6,fishingDepthLevel:3,environment:'mid_cavern'},
 {id:'abyssal_glacier_trench',name:'Abyssal Glacier Trench',sourceDepthLabel:12,fishingDepthLevel:6,environment:'deep_icy'},
 {id:'toxic_acid_basin',name:'Toxic Acid Basin',sourceDepthLabel:null,fishingDepthLevel:null,environment:'acid_special'},
] as const;

// Each rod type unlocks its matching depth ceiling. Its three upgrades improve
// pulling capability, but numeric strength/costs are not set by the source.
export const FISHING_RODS = [1,2,3,4,5,6].map((type)=>({
 type, id:`fishing_rod_type_${type}`, maxDepthLevel:type, upgradeLevels:[1,2,3] as const,
})) as readonly {type:number;id:string;maxDepthLevel:number;upgradeLevels:readonly [1,2,3]}[];

export type FishDepthProfile={minDepthLevel:number;maxDepthLevel:number;preferredDepthLevel:number};
export function getFishingDepthLevel(poolDepth:number):number {
 if (!Number.isFinite(poolDepth) || poolDepth <= 0) return 0;
 return Math.min(6, Math.max(1, Math.ceil(poolDepth / 2)));
}
export function canRodFishAtDepth(rodType:number,depthLevel:number):boolean {
 return Number.isInteger(rodType)&&rodType>=1&&rodType<=6&&Number.isInteger(depthLevel)&&depthLevel>=1&&depthLevel<=rodType;
}
export function isFishEligibleAtDepth(fish:FishDepthProfile,depth:number):boolean {
 return depth>=fish.minDepthLevel&&depth<=fish.maxDepthLevel;
}
export function getFishDepthWeight(fish:FishDepthProfile,depth:number):number {
 if(!isFishEligibleAtDepth(fish,depth)) return 0;
 return depth===fish.preferredDepthLevel?1:0.35;
}


/** Gem cost to reach a target rod upgrade level (1–3). */
export function getRodUpgradeGemCost(
 rodType:number,
 targetUpgradeLevel:number,
 config:FishingMechanicsConfig
):number {
 if(!Number.isInteger(rodType)||rodType<1||rodType>6||!Number.isInteger(targetUpgradeLevel)||targetUpgradeLevel<1||targetUpgradeLevel>3) return 0;
 return config.upgradeGemCostsByRodType[rodType-1]?.[targetUpgradeLevel-1] ?? 0;
}

/** Effective pulling power combines rod tier and its individual upgrade level. */
export function getFishingPullStrength(
 rodType:number,
 upgradeLevel:number,
 config:FishingMechanicsConfig
):number {
 if(!Number.isInteger(rodType)||rodType<1||rodType>6||!Number.isInteger(upgradeLevel)||upgradeLevel<1||upgradeLevel>3) return 0;
 return rodType * (config.pullingMultiplierByUpgrade[upgradeLevel-1] ?? 1);
}

/** Fish resistance is a balance multiplier; missing entries safely use 1. */
export function getFishPullResistance(itemId:number,config:FishingMechanicsConfig):number {
 const value=config.fishResistanceByItemId[itemId];
 return Number.isFinite(value)?Math.max(0.1,Math.min(5,value)):1;
}
