export type ItemCategory =
  | 'tool'
  | 'foreground'
  | 'farmable'
  | 'background'
  | 'seed'
  | 'interactive'
  | 'lock'
  | 'wearable'
  | 'fluid'
  | 'material'
  | 'consumable';

export type CollisionType = 'none' | 'solid' | 'platform';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type WearableSlot = 'head' | 'face' | 'back';

export type ToolKind = 'fist' | 'wrench' | 'pickaxe' | 'rod' | 'hoe';

export type BiomeBranch = 'starter' | 'desert' | 'arctic' | 'cave' | 'tech';

export type BuffType = 'move_speed' | 'break_speed' | 'luck';

export interface BuffEffect {
  buffType: BuffType;
  label: string;
  bonusPct: number;
  durationMs: number;
}

export interface DropEntry {
  itemId: number;
  chance: number; // 0..1
  minQty: number;
  maxQty: number;
}

export interface ItemDefinition {
  id: number;
  key: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  stackLimit: number;
  collision: CollisionType;
  breakable: boolean;
  hardness: number;
  placeable: boolean;
  tradeable: boolean;
  gemValue: number;
  xpValue: number;
  storePrice?: number;
  producesTileId?: number;
  growthTimeMs?: number;
  seedId?: number;
  wearableSlot?: WearableSlot;
  lockRadius?: number;
  drops?: DropEntry[];
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  transparent?: boolean;
  growPixelRarity?: number;
  hardnessVerified?: boolean;
  seedDropChance?: number | null;
  seedDropChanceVerified?: boolean;
  gemValueVerified?: boolean;
  treeHarvestYield?: { minBlocks: number; maxBlocks: number; seedChance: number };
  treeHarvestYieldVerified?: boolean;
  bonusHarvestDrops?: DropEntry[];
  bonusHarvestDropsVerified?: boolean;
  referenceNote?: string;
  economyValue?: number | null;
  spliceIngredients?: [number, number];
  biomeBranch?: BiomeBranch;
  fluidKind?: 'water' | 'acid';
  surfaceEffect?: 'ice' | 'bounce' | 'hazard';
  toolKind?: ToolKind;
  toolPower?: number;
  rodType?: 1 | 2 | 3 | 4 | 5 | 6;
  rodUpgradeLevels?: readonly [1, 2, 3];
  fishDepthProfile?: { minDepthLevel: number; maxDepthLevel: number; preferredDepthLevel: number };
  maxDurability?: number;
  repairMaterialId?: number;
  repairQty?: number;
  buffEffect?: BuffEffect;
  farmableTier?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  seedMedium?: 'pot' | 'plowed_soil';
  worldXpValue?: number;
  cropSellAlterbits?: number;
  cropGemPrice?: number;
  cropAlterbitPrice?: number;
  undroppable?: boolean;
}

// Stable numeric item & tile IDs (Unified GrowPixel + Core Primitives + Locks + Vending + Wearables)
export const ITEM_IDS = {
  AIR: 0,
  FIST: 1,
  WRENCH: 2,
  BG_SKY: 3,

  // Abyssal Bedrock (10) & Entrance Portal (100) & Locks & Vending
  BEDROCK: 10,
  ENTRANCE_PORTAL: 100,
  WORLD_LOCK: 101,
  SMALL_LOCK: 102, // Legacy lock item retained for old saves only
  MICRO_SHARE_LOCK: 150,
  SMALL_SHARE_LOCK: 151,
  COVER_SHARE_LOCK: 152,
  WORLD_CORE: 153,
  LANDLORD_NPC: 154,
  WORLD_BLAST: 155,
  GREENS_VENDOR_NPC: 156,
  STARTER_LOOTBOX: 157,
  VENDING_MACHINE: 103,

  // Fluids & Parkour (110..119)
  WATER_SOURCE: 110,
  ACID_SOURCE: 111,
  BOUNCE_PAD: 112,

  // Machines & Expeditions (120..129)
  STONE_FURNACE: 120,
  BFG_COLLECTOR: 121,
  EXCHANGE_TERMINAL: 122,
  MINING_SCROLL: 123,

  // Pickaxes, Hoe & Fishing Rods (130..140)
  STONE_PICKAXE: 130,
  IRON_PICKAXE: 131,
  CRYSTAL_PICKAXE: 132,
  FARMING_HOE: 133,
  BAMBOO_ROD: 135,
  ANGLER_ROD: 136,
  FISHING_ROD_III: 137,
  FISHING_ROD_IV: 138,
  FISHING_ROD_V: 139,
  FISHING_ROD_VI: 140,

  // Exclusive Mining Materials & Ingots (200..219)
  COAL_FUEL: 200,
  COPPER_FRAGMENT: 201,
  IRON_FRAGMENT: 202,
  CRYSTAL_FRAGMENT: 203,
  OBSIDIAN_FRAGMENT: 204,
  COPPER_INGOT: 210,
  IRON_INGOT: 211,
  CRYSTAL_INGOT: 212,
  OBSIDIAN_INGOT: 213,

  // Fishing Catches & Culinary Buff Foods (220..239)
  FISH_MINNOW: 220,
  FISH_CARP: 221,
  FISH_GLACIER_TROUT: 222,
  FISH_SLIMEFIN: 223,
  STARTER_BAIT: 224,
  BUFF_GLACIER_FILLET: 230,
  BUFF_MINER_CHOWDER: 231,
  BUFF_LUCK_BROTH: 232,

  // Wearables & Cosmetics (401..404)
  WEAR_GOLD_CROWN: 401,
  WEAR_EXPLORER_HAT: 402,
  WEAR_CYBER_VISOR: 403,
  WEAR_SKY_WINGS: 404,

  // GrowPixel collection blocks (500..541) and matching seeds (600..641)
  GP_DIRT: 500,
  GP_ROCK: 501,
  GP_LAVA: 502,
  GP_CAVE_BACKGROUND: 503,
  GP_SAND: 504,
  GP_DOOR: 505,
  GP_GLASS_PANE: 506,
  GP_GRASS: 507,
  GP_LAVA_ROCK: 508,
  GP_SIGN: 509,
  WOODEN_SIGN: 509,
  GP_WOOD_BLOCK: 510,
  GP_BRICKS: 511,
  GP_CRAPPY_SIGN: 512,
  GP_DAISY: 513,
  GP_MUSHROOM: 514,
  GP_ROSE: 515,
  GP_WHEAT: 516,
  GP_WOODEN_PLATFORM: 517,
  GP_BLACK_BLOCK: 518,
  GP_BROWN_BLOCK: 519,
  GP_GREY_BLOCK: 520,
  GP_RED_BLOCK: 521,
  GP_AQUA_BLOCK: 522,
  GP_GREEN_BLOCK: 523,
  GP_WHITE_BLOCK: 524,
  GP_WINDOW: 525,
  GP_YELLOW_BLOCK: 526,
  GP_GLASS_BLOCK: 527,
  GP_TOILET: 528,
  GP_RED_BRICKS: 529,
  GP_DEATH_SPIKES: 530,
  GP_DUNGEON_DOOR: 531,
  GP_BUSH: 532,
  GP_HEDGE: 533,
  GP_ORANGE_BLOCK: 534,
  GP_BLUE_BLOCK: 535,
  GP_POPPY: 536,
  GP_WOODEN_BACKGROUND: 537,
  GP_ROCK_BACKGROUND: 538,
  GP_POINTY_SIGN: 539,
  GP_DANGER_SIGN: 540,
  GP_BLUEBERRY: 541,

  GP_SEED_DIRT: 600,
  GP_SEED_ROCK: 601,
  GP_SEED_LAVA: 602,
  GP_SEED_CAVE_BACKGROUND: 603,
  GP_SEED_SAND: 604,
  GP_SEED_DOOR: 605,
  GP_SEED_GLASS_PANE: 606,
  GP_SEED_GRASS: 607,
  GP_SEED_LAVA_ROCK: 608,
  GP_SEED_SIGN: 609,
  GP_SEED_WOOD_BLOCK: 610,
  GP_SEED_BRICKS: 611,
  GP_SEED_CRAPPY_SIGN: 612,
  GP_SEED_DAISY: 613,
  GP_SEED_MUSHROOM: 614,
  GP_SEED_ROSE: 615,
  GP_SEED_WHEAT: 616,
  GP_SEED_WOODEN_PLATFORM: 617,
  GP_SEED_BLACK_BLOCK: 618,
  GP_SEED_BROWN_BLOCK: 619,
  GP_SEED_GREY_BLOCK: 620,
  GP_SEED_RED_BLOCK: 621,
  GP_SEED_AQUA_BLOCK: 622,
  GP_SEED_GREEN_BLOCK: 623,
  GP_SEED_WHITE_BLOCK: 624,
  GP_SEED_WINDOW: 625,
  GP_SEED_YELLOW_BLOCK: 626,
  GP_SEED_GLASS_BLOCK: 627,
  GP_SEED_TOILET: 628,
  GP_SEED_RED_BRICKS: 629,
  GP_SEED_DEATH_SPIKES: 630,
  GP_SEED_DUNGEON_DOOR: 631,
  GP_SEED_BUSH: 632,
  GP_SEED_HEDGE: 633,
  GP_SEED_ORANGE_BLOCK: 634,
  GP_SEED_BLUE_BLOCK: 635,
  GP_SEED_POPPY: 636,
  GP_SEED_WOODEN_BACKGROUND: 637,
  GP_SEED_ROCK_BACKGROUND: 638,
  GP_SEED_POINTY_SIGN: 639,
  GP_SEED_DANGER_SIGN: 640,
  GP_SEED_BLUEBERRY: 641,

  // World-specific natural blocks (700..748)
  DESERT_SAND: 700,
  RED_SANDSTONE: 701,
  DESERT_HARDPAN: 702,
  SALT_CRUST: 703,
  DUNE_GRASS: 704,
  CACTUS: 705,
  DRY_ROOT: 706,
  DESERT_GRAVEL: 707,
  FROST_SNOW: 720,
  PACKED_SNOW: 721,
  GLACIER_ICE: 722,
  PERMAFROST: 723,
  FROZEN_DIRT: 724,
  BLUE_ICE: 725,
  FROST_ROCK: 726,
  ICICLE: 727,
  CAVE_LIMESTONE: 740,
  CAVE_SHALE: 741,
  CAVE_GRAVEL: 742,
  GRANITE: 743,
  STALACTITE: 744,
  STALAGMITE: 745,
  CRYSTAL_ORE: 746,
  UNDERGROUND_CLAY: 747,
  CAVE_BACKGROUND_WALL: 748,

  // Biome Tech Tree Seeds (750..774) & Tech Splices (780..782)
  SEED_DESERT_SAND: 750,
  SEED_RED_SANDSTONE: 751,
  SEED_DESERT_HARDPAN: 752,
  SEED_SALT_CRUST: 753,
  SEED_DUNE_GRASS: 754,
  SEED_CACTUS: 755,
  SEED_DRY_ROOT: 756,
  SEED_DESERT_GRAVEL: 757,
  SEED_FROST_SNOW: 758,
  SEED_PACKED_SNOW: 759,
  SEED_GLACIER_ICE: 760,
  SEED_PERMAFROST: 761,
  SEED_FROZEN_DIRT: 762,
  SEED_BLUE_ICE: 763,
  SEED_FROST_ROCK: 764,
  SEED_ICICLE: 765,
  SEED_CAVE_LIMESTONE: 766,
  SEED_CAVE_SHALE: 767,
  SEED_CAVE_GRAVEL: 768,
  SEED_GRANITE: 769,
  SEED_STALACTITE: 770,
  SEED_STALAGMITE: 771,
  SEED_CRYSTAL_ORE: 772,
  SEED_UNDERGROUND_CLAY: 773,
  SEED_CAVE_BACKGROUND_WALL: 774,
  SEED_WATER_SOURCE: 780,
  SEED_ACID_SOURCE: 781,
  SEED_BOUNCE_PAD: 782,

  // Mine Shaft Ore Veins (790..793)
  COAL_VEIN: 790,
  COPPER_VEIN: 791,
  IRON_VEIN: 792,
  OBSIDIAN_VEIN: 793,

  // Station Gate Keys (810..814)
  GATE_KEY_I: 810,
  GATE_KEY_II: 811,
  GATE_KEY_III: 812,
  GATE_KEY_IV: 813,
  GATE_KEY_V: 814,

  // Raw expedition ore rewards (830..841)
  RAW_COAL_ORE: 830,
  RAW_COPPER_ORE: 831,
  RAW_IRON_ORE: 832,
  RAW_SILVER_ORE: 833,
  RAW_GOLD_ORE: 834,
  RAW_DIAMOND_ORE: 835,
  RAW_RUBIDRITE_ORE: 836,
  RAW_EMERALDAZYTE_ORE: 837,
  RAW_OBSIDIUM_ORE: 838,
  RAW_DIVINIUM_ORE: 839,
  RAW_MYTHRILYTE_ORE: 840,
  RAW_OMEGAZYTE_ORE: 841,

    // Agricultural Overhaul & Machinery
  SEED_POT: 550,
  MATTERAGEN_BOTANICAL: 551,
  MATTERAGEN_GEOMINERAL: 552,
  MATTERAGEN_LUMINESCENT: 553,
  MATTERAGEN_ARCANE: 554,
  MATTERAGEN_COSMIC: 555,
  ATM_MACHINE: 556,
  VAULTBOX: 557,
  PLOWED_DIRT_SOIL: 558,

  // Architectural Wallpapers & Interior Background Walls (560..567)
  WALLPAPER_WAINSCOT: 560,
  WALLPAPER_EMERALD_STRIPE: 561,
  WALLPAPER_VENETIAN_PLASTER: 562,
  WALLPAPER_STARLIGHT_VELVET: 563,
  WALLPAPER_SUBWAY_TILE: 564,
  WALLPAPER_CEDAR_SHIPLAP: 565,
  WALLPAPER_HERRINGBONE_PARQUET: 566,
  WALLPAPER_MOROCCAN_MOSAIC: 567,

  // 40 Dedicated Farmable Blocks (900..939)
  FARM_SUGAR_CANE: 900,
  FARM_PEPPER_BUSH: 901,
  FARM_BOUNTY_WHEAT: 902,
  FARM_GLOW_SHROOM: 903,
  FARM_BAMBOO_SHOOT: 904,
  FARM_HONEY_COMB: 905,
  FARM_PINBALL_BUMPER: 906,
  FARM_VENUS_TRAP: 907,
  FARM_BLACKROCK_GEM: 908,
  FARM_GOLD_TREASURE: 909,
  FARM_CHANDELIER: 910,
  FARM_LASER_GRID: 911,
  FARM_SORCERER_ORB: 912,
  FARM_EMERALD_GEODE: 913,
  FARM_SUNSTONE_PILLAR: 914,
  FARM_FROST_LOTUS: 915,
  FARM_STARLIGHT_PRISM: 916,
  FARM_DRAGON_HOARD: 917,
  FARM_AETHER_REACTOR: 918,
  FARM_CELESTIAL_MONOLITH: 919,
  FARM_CRYSTAL_BLOSSOM: 920,
  FARM_MAGMA_ROSE: 921,
  FARM_SHADOW_TENDRIL: 922,
  FARM_PLASMA_ORCHID: 923,
  FARM_PRISM_SHARD: 924,
  FARM_THUNDER_CACTUS: 925,
  FARM_VOID_LILY: 926,
  FARM_HYPERION_BULB: 927,
  FARM_SOLARIUM_BLOOM: 928,
  FARM_CHRONO_FERN: 929,
  FARM_NEBULA_SPORE: 930,
  FARM_DARK_MATTER_CORE: 931,
  FARM_PULSAR_BLOSSOM: 932,
  FARM_SUPERNOVA_FRUIT: 933,
  FARM_TITAN_THORN: 934,
  FARM_QUANTUM_VINE: 935,
  FARM_ASTRAL_CHRYSALIS: 936,
  FARM_GENESIS_SEEDLING: 937,
  FARM_INFINITY_LOTUS: 938,
  FARM_OMEGA_MONOLITH: 939,

  // Matching 40 Farmable Seeds (950..989)
  SEED_FARM_SUGAR_CANE: 950,
  SEED_FARM_PEPPER_BUSH: 951,
  SEED_FARM_BOUNTY_WHEAT: 952,
  SEED_FARM_GLOW_SHROOM: 953,
  SEED_FARM_BAMBOO_SHOOT: 954,
  SEED_FARM_HONEY_COMB: 955,
  SEED_FARM_PINBALL_BUMPER: 956,
  SEED_FARM_VENUS_TRAP: 957,
  SEED_FARM_BLACKROCK_GEM: 958,
  SEED_FARM_GOLD_TREASURE: 959,
  SEED_FARM_CHANDELIER: 960,
  SEED_FARM_LASER_GRID: 961,
  SEED_FARM_SORCERER_ORB: 962,
  SEED_FARM_EMERALD_GEODE: 963,
  SEED_FARM_SUNSTONE_PILLAR: 964,
  SEED_FARM_FROST_LOTUS: 965,
  SEED_FARM_STARLIGHT_PRISM: 966,
  SEED_FARM_DRAGON_HOARD: 967,
  SEED_FARM_AETHER_REACTOR: 968,
  SEED_FARM_CELESTIAL_MONOLITH: 969,
  SEED_FARM_CRYSTAL_BLOSSOM: 970,
  SEED_FARM_MAGMA_ROSE: 971,
  SEED_FARM_SHADOW_TENDRIL: 972,
  SEED_FARM_PLASMA_ORCHID: 973,
  SEED_FARM_PRISM_SHARD: 974,
  SEED_FARM_THUNDER_CACTUS: 975,
  SEED_FARM_VOID_LILY: 976,
  SEED_FARM_HYPERION_BULB: 977,
  SEED_FARM_SOLARIUM_BLOOM: 978,
  SEED_FARM_CHRONO_FERN: 979,
  SEED_FARM_NEBULA_SPORE: 980,
  SEED_FARM_DARK_MATTER_CORE: 981,
  SEED_FARM_PULSAR_BLOSSOM: 982,
  SEED_FARM_SUPERNOVA_FRUIT: 983,
  SEED_FARM_TITAN_THORN: 984,
  SEED_FARM_QUANTUM_VINE: 985,
  SEED_FARM_ASTRAL_CHRYSALIS: 986,
  SEED_FARM_GENESIS_SEEDLING: 987,
  SEED_FARM_INFINITY_LOTUS: 988,
  SEED_FARM_OMEGA_MONOLITH: 989,

  // Fresh Greens Vendor Crop Seeds (1000..1005), Crop Blocks (1010..1015), and Harvested Crops (1020..1025)
  CROP_SEED_RADISH: 1000,
  CROP_SEED_CARROT: 1001,
  CROP_SEED_CABBAGE: 1002,
  CROP_SEED_TOMATO: 1003,
  CROP_SEED_CORN: 1004,
  CROP_SEED_MELON: 1005,

  CROP_BLOCK_RADISH: 1010,
  CROP_BLOCK_CARROT: 1011,
  CROP_BLOCK_CABBAGE: 1012,
  CROP_BLOCK_TOMATO: 1013,
  CROP_BLOCK_CORN: 1014,
  CROP_BLOCK_MELON: 1015,

  CROP_RADISH: 1020,
  CROP_CARROT: 1021,
  CROP_CABBAGE: 1022,
  CROP_TOMATO: 1023,
  CROP_CORN: 1024,
  CROP_MELON: 1025,
} as const;

export const CATALOG: Record<number, ItemDefinition> = {
  // World-specific natural blocks: Desert Blast, Arctic Tundra, and Cave Blast
  [ITEM_IDS.DESERT_SAND]: {
    id: ITEM_IDS.DESERT_SAND, key: 'desert_sand', name: 'Desert Sand',
    description: 'Fine wind-shaped sand forming the surface and dunes of arid desert worlds.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_DESERT_SAND, biomeBranch: 'desert',
    drops: [{ itemId: ITEM_IDS.DESERT_SAND, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_DESERT_SAND, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#e6c477', colorSecondary: '#ad8745', colorAccent: '#f7e5a9',
  },
  [ITEM_IDS.RED_SANDSTONE]: {
    id: ITEM_IDS.RED_SANDSTONE, key: 'red_sandstone', name: 'Red Sandstone',
    description: 'Iron-rich sandstone exposed in desert cliffs and beneath the dunes.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_RED_SANDSTONE, biomeBranch: 'desert',
    drops: [{ itemId: ITEM_IDS.RED_SANDSTONE, chance: 0.76, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_RED_SANDSTONE, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#b96d45', colorSecondary: '#79442f', colorAccent: '#e6a078',
  },
  [ITEM_IDS.DESERT_HARDPAN]: {
    id: ITEM_IDS.DESERT_HARDPAN, key: 'desert_hardpan', name: 'Desert Hardpan',
    description: 'Compacted mineral crust found below loose desert sand.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_DESERT_HARDPAN, biomeBranch: 'desert',
    drops: [{ itemId: ITEM_IDS.DESERT_HARDPAN, chance: 0.76, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_DESERT_HARDPAN, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#b69a63', colorSecondary: '#75613f', colorAccent: '#ddc58e',
  },
  [ITEM_IDS.SALT_CRUST]: {
    id: ITEM_IDS.SALT_CRUST, key: 'salt_crust', name: 'Salt Crust',
    description: 'Bright evaporite deposits left behind by ancient dried lakes.',
    category: 'foreground', rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    seedId: ITEM_IDS.SEED_SALT_CRUST, biomeBranch: 'desert',
    drops: [{ itemId: ITEM_IDS.SALT_CRUST, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_SALT_CRUST, chance: 0.24, minQty: 1, maxQty: 1 }],
    colorPrimary: '#e7e2cf', colorSecondary: '#aaa38e', colorAccent: '#fffbed',
  },
  [ITEM_IDS.DUNE_GRASS]: {
    id: ITEM_IDS.DUNE_GRASS, key: 'dune_grass', name: 'Dune Grass',
    description: 'Tough clumps of dry grass adapted to shifting desert dunes.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_DUNE_GRASS, biomeBranch: 'desert',
    drops: [{ itemId: ITEM_IDS.DUNE_GRASS, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_DUNE_GRASS, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#a9a04f', colorSecondary: '#656532', colorAccent: '#d3c978',
  },
  [ITEM_IDS.CACTUS]: {
    id: ITEM_IDS.CACTUS, key: 'cactus', name: 'Desert Cactus',
    description: 'A hardy cactus growing in sun-baked desert soils.',
    category: 'foreground', rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    seedId: ITEM_IDS.SEED_CACTUS, biomeBranch: 'desert',
    drops: [{ itemId: ITEM_IDS.CACTUS, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_CACTUS, chance: 0.24, minQty: 1, maxQty: 1 }],
    colorPrimary: '#4f9b55', colorSecondary: '#28613b', colorAccent: '#9cdb79',
  },
  [ITEM_IDS.DRY_ROOT]: {
    id: ITEM_IDS.DRY_ROOT, key: 'dry_root', name: 'Dry Root',
    description: 'A branching woody root from scarce desert vegetation.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_DRY_ROOT, biomeBranch: 'desert',
    drops: [{ itemId: ITEM_IDS.DRY_ROOT, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_DRY_ROOT, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#987044', colorSecondary: '#5b422e', colorAccent: '#c79c63',
  },
  [ITEM_IDS.DESERT_GRAVEL]: {
    id: ITEM_IDS.DESERT_GRAVEL, key: 'desert_gravel', name: 'Desert Gravel',
    description: 'Loose pebbles and coarse gravel in stony desert patches.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_DESERT_GRAVEL, biomeBranch: 'desert',
    drops: [{ itemId: ITEM_IDS.DESERT_GRAVEL, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_DESERT_GRAVEL, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#aa987a', colorSecondary: '#6d6252', colorAccent: '#d5c3a0',
  },
  [ITEM_IDS.FROST_SNOW]: {
    id: ITEM_IDS.FROST_SNOW, key: 'frost_snow', name: 'Powder Snow',
    description: 'Loose powder snow blanketing exposed arctic ground with mild slip.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_FROST_SNOW, biomeBranch: 'arctic', surfaceEffect: 'ice',
    drops: [{ itemId: ITEM_IDS.FROST_SNOW, chance: 0.80, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_FROST_SNOW, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#e9f5ff', colorSecondary: '#b5d2e5', colorAccent: '#ffffff',
  },
  [ITEM_IDS.PACKED_SNOW]: {
    id: ITEM_IDS.PACKED_SNOW, key: 'packed_snow', name: 'Packed Snow',
    description: 'Wind-compacted snow forming firm icy layers.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_PACKED_SNOW, biomeBranch: 'arctic',
    drops: [{ itemId: ITEM_IDS.PACKED_SNOW, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_PACKED_SNOW, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#c8e3f2', colorSecondary: '#88b5cc', colorAccent: '#f0fbff',
  },
  [ITEM_IDS.GLACIER_ICE]: {
    id: ITEM_IDS.GLACIER_ICE, key: 'glacier_ice', name: 'Glacier Ice',
    description: 'Low-friction ancient ice prized by parkour builders for momentum slides.',
    category: 'foreground', rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    seedId: ITEM_IDS.SEED_GLACIER_ICE, biomeBranch: 'arctic', surfaceEffect: 'ice',
    drops: [{ itemId: ITEM_IDS.GLACIER_ICE, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_GLACIER_ICE, chance: 0.24, minQty: 1, maxQty: 1 }],
    colorPrimary: '#86c7de', colorSecondary: '#477f9d', colorAccent: '#d5f8ff',
  },
  [ITEM_IDS.PERMAFROST]: {
    id: ITEM_IDS.PERMAFROST, key: 'permafrost', name: 'Permafrost',
    description: 'Permanently frozen soil with embedded stones and ice.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_PERMAFROST, biomeBranch: 'arctic',
    drops: [{ itemId: ITEM_IDS.PERMAFROST, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_PERMAFROST, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#879c9c', colorSecondary: '#53686c', colorAccent: '#c2d4d0',
  },
  [ITEM_IDS.FROZEN_DIRT]: {
    id: ITEM_IDS.FROZEN_DIRT, key: 'frozen_dirt', name: 'Frozen Tundra Soil',
    description: 'Dark mineral-rich tundra soil locked beneath seasonal frost.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_FROZEN_DIRT, biomeBranch: 'arctic',
    drops: [{ itemId: ITEM_IDS.FROZEN_DIRT, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_FROZEN_DIRT, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#786d60', colorSecondary: '#4a4744', colorAccent: '#aaa08f',
  },
  [ITEM_IDS.BLUE_ICE]: {
    id: ITEM_IDS.BLUE_ICE, key: 'blue_ice', name: 'Blue Ice',
    description: 'Ultra-slick compressed glacial ice for high-speed parkour runs.',
    category: 'foreground', rarity: 'rare', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 3, xpValue: 4,
    seedId: ITEM_IDS.SEED_BLUE_ICE, biomeBranch: 'arctic', surfaceEffect: 'ice',
    drops: [{ itemId: ITEM_IDS.BLUE_ICE, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_BLUE_ICE, chance: 0.24, minQty: 1, maxQty: 1 }],
    colorPrimary: '#4b9fc9', colorSecondary: '#245c88', colorAccent: '#a4e7ff',
  },
  [ITEM_IDS.FROST_ROCK]: {
    id: ITEM_IDS.FROST_ROCK, key: 'frost_rock', name: 'Frost Rock',
    description: 'Weathered stone exposed through snow and frozen ground.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_FROST_ROCK, biomeBranch: 'arctic',
    drops: [{ itemId: ITEM_IDS.FROST_ROCK, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_FROST_ROCK, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#788995', colorSecondary: '#46545e', colorAccent: '#b9cad2',
  },
  [ITEM_IDS.ICICLE]: {
    id: ITEM_IDS.ICICLE, key: 'icicle', name: 'Icicle',
    description: 'A hanging shard of clear ice formed by repeated freezing and dripping.',
    category: 'foreground', rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    seedId: ITEM_IDS.SEED_ICICLE, biomeBranch: 'arctic', transparent: true,
    drops: [{ itemId: ITEM_IDS.ICICLE, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_ICICLE, chance: 0.24, minQty: 1, maxQty: 1 }],
    colorPrimary: '#b9e7f4', colorSecondary: '#6fa8bd', colorAccent: '#efffff',
  },
  [ITEM_IDS.CAVE_LIMESTONE]: {
    id: ITEM_IDS.CAVE_LIMESTONE, key: 'cave_limestone', name: 'Cave Limestone',
    description: 'Pale sedimentary rock forming broad cave walls and ceilings.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_CAVE_LIMESTONE, biomeBranch: 'cave',
    drops: [{ itemId: ITEM_IDS.CAVE_LIMESTONE, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_CAVE_LIMESTONE, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#b6ad91', colorSecondary: '#746d5a', colorAccent: '#e3dcc1',
  },
  [ITEM_IDS.CAVE_SHALE]: {
    id: ITEM_IDS.CAVE_SHALE, key: 'cave_shale', name: 'Cave Shale',
    description: 'Thin-layered dark sedimentary rock found in deep cave strata.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_CAVE_SHALE, biomeBranch: 'cave',
    drops: [{ itemId: ITEM_IDS.CAVE_SHALE, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_CAVE_SHALE, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#657078', colorSecondary: '#3d454c', colorAccent: '#9aa8ad',
  },
  [ITEM_IDS.CAVE_GRAVEL]: {
    id: ITEM_IDS.CAVE_GRAVEL, key: 'cave_gravel', name: 'Cave Gravel',
    description: 'Loose angular fragments accumulated on underground floors.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_CAVE_GRAVEL, biomeBranch: 'cave',
    drops: [{ itemId: ITEM_IDS.CAVE_GRAVEL, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_CAVE_GRAVEL, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#8e8173', colorSecondary: '#554d47', colorAccent: '#c2b4a2',
  },
  [ITEM_IDS.GRANITE]: {
    id: ITEM_IDS.GRANITE, key: 'granite', name: 'Granite',
    description: 'Hard speckled igneous stone exposed in deep underground formations.',
    category: 'foreground', rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    seedId: ITEM_IDS.SEED_GRANITE, biomeBranch: 'cave',
    drops: [{ itemId: ITEM_IDS.GRANITE, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_GRANITE, chance: 0.24, minQty: 1, maxQty: 1 }],
    colorPrimary: '#9a8580', colorSecondary: '#5f5353', colorAccent: '#c8b6ae',
  },
  [ITEM_IDS.STALACTITE]: {
    id: ITEM_IDS.STALACTITE, key: 'stalactite', name: 'Stalactite',
    description: 'A mineral formation hanging from cave ceilings, built by dripping mineral water.',
    category: 'foreground', rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    seedId: ITEM_IDS.SEED_STALACTITE, biomeBranch: 'cave', transparent: true,
    drops: [{ itemId: ITEM_IDS.STALACTITE, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_STALACTITE, chance: 0.24, minQty: 1, maxQty: 1 }],
    colorPrimary: '#b7aa8b', colorSecondary: '#786e58', colorAccent: '#e6d8b8',
  },
  [ITEM_IDS.STALAGMITE]: {
    id: ITEM_IDS.STALAGMITE, key: 'stalagmite', name: 'Stalagmite',
    description: 'A mineral formation rising from cave floors beneath dripping ceilings.',
    category: 'foreground', rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    seedId: ITEM_IDS.SEED_STALAGMITE, biomeBranch: 'cave', transparent: true,
    drops: [{ itemId: ITEM_IDS.STALAGMITE, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_STALAGMITE, chance: 0.24, minQty: 1, maxQty: 1 }],
    colorPrimary: '#aa9b7a', colorSecondary: '#6a5f49', colorAccent: '#dfcca3',
  },
  [ITEM_IDS.CRYSTAL_ORE]: {
    id: ITEM_IDS.CRYSTAL_ORE, key: 'crystal_ore', name: 'Crystal Ore',
    description: 'A rare crystal-bearing vein embedded in deep cave stone.',
    category: 'foreground', rarity: 'rare', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 9,
    placeable: true, tradeable: true, gemValue: 3, xpValue: 4,
    seedId: ITEM_IDS.SEED_CRYSTAL_ORE, biomeBranch: 'cave',
    drops: [{ itemId: ITEM_IDS.CRYSTAL_ORE, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_CRYSTAL_ORE, chance: 0.24, minQty: 1, maxQty: 1 }],
    colorPrimary: '#8d79ce', colorSecondary: '#51427f', colorAccent: '#d7c8ff',
  },
  [ITEM_IDS.UNDERGROUND_CLAY]: {
    id: ITEM_IDS.UNDERGROUND_CLAY, key: 'underground_clay', name: 'Cave Clay',
    description: 'Moist fine-grained clay deposited in underground water channels.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_UNDERGROUND_CLAY, biomeBranch: 'cave',
    drops: [{ itemId: ITEM_IDS.UNDERGROUND_CLAY, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_UNDERGROUND_CLAY, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#a56f5d', colorSecondary: '#69473f', colorAccent: '#d7a18b',
  },
  [ITEM_IDS.CAVE_BACKGROUND_WALL]: {
    id: ITEM_IDS.CAVE_BACKGROUND_WALL, key: 'cave_background_wall', name: 'Rugged Cave Wall',
    description: 'A rough natural wall lining underground chambers.',
    category: 'background', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.SEED_CAVE_BACKGROUND_WALL, biomeBranch: 'cave',
    drops: [{ itemId: ITEM_IDS.CAVE_BACKGROUND_WALL, chance: 0.78, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.SEED_CAVE_BACKGROUND_WALL, chance: 0.22, minQty: 1, maxQty: 1 }],
    colorPrimary: '#554e4b', colorSecondary: '#302d2c', colorAccent: '#82756b',
  },

  // --- Fluids, Parkour, Machines, Scrolls, Pickaxes, Rods, Ores, Fish & Buffs ---
  [ITEM_IDS.WATER_SOURCE]: {
    id: ITEM_IDS.WATER_SOURCE, key: 'water_source', name: 'Water Source',
    description: 'Pour dynamic cellular-automata water that flows downhill, fills pools for fishing, and allows swimming.',
    category: 'fluid', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2,
    fluidKind: 'water', seedId: ITEM_IDS.SEED_WATER_SOURCE, biomeBranch: 'tech', transparent: true,
    colorPrimary: '#38a8eb', colorSecondary: '#1d69a8', colorAccent: '#b8f3ff',
  },
  [ITEM_IDS.ACID_SOURCE]: {
    id: ITEM_IDS.ACID_SOURCE, key: 'acid_source', name: 'Acid Vat',
    description: 'Pour corrosive glowing acid for parkour hazards and catching rare Slimefins.',
    category: 'fluid', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 3,
    fluidKind: 'acid', seedId: ITEM_IDS.SEED_ACID_SOURCE, biomeBranch: 'tech', transparent: true,
    colorPrimary: '#63d93b', colorSecondary: '#2d7a1d', colorAccent: '#d2ff8c',
  },
  [ITEM_IDS.BOUNCE_PAD]: {
    id: ITEM_IDS.BOUNCE_PAD, key: 'bounce_pad', name: 'Bounce Pad',
    description: 'Spring-loaded parkour launch pad that catapults players high into the air.',
    category: 'interactive', rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 2, xpValue: 3,
    surfaceEffect: 'bounce', transparent: true, biomeBranch: 'tech',
    drops: [{ itemId: ITEM_IDS.BOUNCE_PAD, chance: 1, minQty: 1, maxQty: 1 }],
    colorPrimary: '#e67e32', colorSecondary: '#6b3e24', colorAccent: '#ffe38c',
  },
  [ITEM_IDS.STONE_FURNACE]: {
    id: ITEM_IDS.STONE_FURNACE, key: 'stone_furnace', name: 'Stone Furnace',
    description: 'Place and wrench to smelt ore fragments into ingots, craft gear, cook fish buffs, and repair tools.',
    category: 'interactive', rarity: 'uncommon', stackLimit: 50,
    collision: 'solid', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 8,
    drops: [{ itemId: ITEM_IDS.STONE_FURNACE, chance: 1, minQty: 1, maxQty: 1 }],
    colorPrimary: '#727b88', colorSecondary: '#3b424d', colorAccent: '#ff963b',
  },
  [ITEM_IDS.BFG_COLLECTOR]: {
    id: ITEM_IDS.BFG_COLLECTOR, key: 'bfg_collector', name: 'BFG Auto-Collector',
    description: 'Automated farm extractor for locked worlds. Harvests mature trees within 3 tiles and pulls nearby drops into storage.',
    category: 'interactive', rarity: 'epic', stackLimit: 20,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 25,
    drops: [{ itemId: ITEM_IDS.BFG_COLLECTOR, chance: 1, minQty: 1, maxQty: 1 }],
    colorPrimary: '#4794d4', colorSecondary: '#1c3e61', colorAccent: '#78f5c8',
  },
  [ITEM_IDS.EXCHANGE_TERMINAL]: {
    id: ITEM_IDS.EXCHANGE_TERMINAL, key: 'exchange_terminal', name: 'Exchange Terminal',
    description: 'Place in any buildable world and wrench to open the Global World Lock Exchange.',
    category: 'interactive', rarity: 'rare', stackLimit: 25,
    collision: 'solid', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 12,
    drops: [{ itemId: ITEM_IDS.EXCHANGE_TERMINAL, chance: 1, minQty: 1, maxQty: 1 }],
    colorPrimary: '#f2b738', colorSecondary: '#2d4b6e', colorAccent: '#8cf7ee',
  },
  [ITEM_IDS.MINING_SCROLL]: {
    id: ITEM_IDS.MINING_SCROLL, key: 'mining_scroll', name: 'Mining Shaft Scroll',
    description: 'Activate to open a private 50×150 Mining Shaft expedition rich in Coal, Copper, Iron, Crystal, and Obsidian veins.',
    category: 'consumable', rarity: 'uncommon', stackLimit: 50,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 5,
    colorPrimary: '#e8d4a3', colorSecondary: '#8c663b', colorAccent: '#78e3ff',
  },
  [ITEM_IDS.STONE_PICKAXE]: {
    id: ITEM_IDS.STONE_PICKAXE, key: 'stone_pickaxe', name: 'Stone Pickaxe',
    description: '2× mining power against stone & ore veins (120 Durability). Repair at any Stone Furnace.',
    category: 'tool', rarity: 'common', stackLimit: 1,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 4,
    toolKind: 'pickaxe', toolPower: 2, maxDurability: 120,
    repairMaterialId: ITEM_IDS.GP_ROCK, repairQty: 4,
    colorPrimary: '#9aa4b2', colorSecondary: '#6b4222', colorAccent: '#e2ebf5',
  },
  [ITEM_IDS.IRON_PICKAXE]: {
    id: ITEM_IDS.IRON_PICKAXE, key: 'iron_pickaxe', name: 'Iron Pickaxe',
    description: '3× mining power and +15% ore fragment bonus (240 Durability). Repair with Iron Ingots.',
    category: 'tool', rarity: 'uncommon', stackLimit: 1,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 8,
    toolKind: 'pickaxe', toolPower: 3, maxDurability: 240,
    repairMaterialId: ITEM_IDS.IRON_INGOT, repairQty: 1,
    colorPrimary: '#c9daeb', colorSecondary: '#6b4222', colorAccent: '#ffffff',
  },
  [ITEM_IDS.CRYSTAL_PICKAXE]: {
    id: ITEM_IDS.CRYSTAL_PICKAXE, key: 'crystal_pickaxe', name: 'Crystal Pickaxe',
    description: '4× mining power and +30% rare fragment bonus (420 Durability). Repair with Crystal Ingots.',
    category: 'tool', rarity: 'epic', stackLimit: 1,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 16,
    toolKind: 'pickaxe', toolPower: 4, maxDurability: 420,
    repairMaterialId: ITEM_IDS.CRYSTAL_INGOT, repairQty: 1,
    colorPrimary: '#9b78ff', colorSecondary: '#413270', colorAccent: '#e8d9ff',
  },
  [ITEM_IDS.BAMBOO_ROD]: {
    id: ITEM_IDS.BAMBOO_ROD, key: 'bamboo_rod', name: 'Bamboo Fishing Rod',
    description: 'Cast into Water or Acid pools to catch aquatic species scaled to liquid depth (80 Durability).',
    category: 'tool', rarity: 'common', stackLimit: 1,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 4,
    toolKind: 'rod', toolPower: 1, rodType: 1, rodUpgradeLevels: [1, 2, 3], maxDurability: 80,
    repairMaterialId: ITEM_IDS.GP_WOOD_BLOCK, repairQty: 3,
    colorPrimary: '#86bf52', colorSecondary: '#4f7a2d', colorAccent: '#e8f7b8',
  },
  [ITEM_IDS.ANGLER_ROD]: {
    id: ITEM_IDS.ANGLER_ROD, key: 'angler_rod', name: 'Deep Angler Rod',
    description: 'Faster bites and higher abyssal treasure chance when fishing deep reservoirs (180 Durability).',
    category: 'tool', rarity: 'rare', stackLimit: 1,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 10,
    toolKind: 'rod', toolPower: 2, rodType: 2, rodUpgradeLevels: [1, 2, 3], maxDurability: 180,
    repairMaterialId: ITEM_IDS.IRON_INGOT, repairQty: 1,
    colorPrimary: '#38a3d8', colorSecondary: '#1d4d6e', colorAccent: '#b8f5ff',
  },
  [ITEM_IDS.FISHING_ROD_III]: {
    id: ITEM_IDS.FISHING_ROD_III, key: 'fishing_rod_iii', name: 'Fishing Rod III',
    description: 'Type III fishing rod. Supports fishing depth levels 1–3 and has three upgrade levels.',
    category: 'tool', rarity: 'rare', stackLimit: 1,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 12,
    toolKind: 'rod', toolPower: 3, rodType: 3, rodUpgradeLevels: [1, 2, 3], maxDurability: 240,
    repairMaterialId: ITEM_IDS.CRYSTAL_INGOT, repairQty: 1,
    colorPrimary: '#55b6a2', colorSecondary: '#205f58', colorAccent: '#c7fff0',
  },
  [ITEM_IDS.FISHING_ROD_IV]: {
    id: ITEM_IDS.FISHING_ROD_IV, key: 'fishing_rod_iv', name: 'Fishing Rod IV',
    description: 'Type IV fishing rod. Supports fishing depth levels 1–4 and has three upgrade levels.',
    category: 'tool', rarity: 'epic', stackLimit: 1,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 14,
    toolKind: 'rod', toolPower: 4, rodType: 4, rodUpgradeLevels: [1, 2, 3], maxDurability: 320,
    repairMaterialId: ITEM_IDS.CRYSTAL_INGOT, repairQty: 2,
    colorPrimary: '#8a78d8', colorSecondary: '#40356f', colorAccent: '#e3dcff',
  },
  [ITEM_IDS.FISHING_ROD_V]: {
    id: ITEM_IDS.FISHING_ROD_V, key: 'fishing_rod_v', name: 'Fishing Rod V',
    description: 'Type V fishing rod. Supports fishing depth levels 1–5 and has three upgrade levels.',
    category: 'tool', rarity: 'epic', stackLimit: 1,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 16,
    toolKind: 'rod', toolPower: 5, rodType: 5, rodUpgradeLevels: [1, 2, 3], maxDurability: 420,
    repairMaterialId: ITEM_IDS.OBSIDIAN_INGOT, repairQty: 1,
    colorPrimary: '#d28b45', colorSecondary: '#70451f', colorAccent: '#ffe1a6',
  },
  [ITEM_IDS.FISHING_ROD_VI]: {
    id: ITEM_IDS.FISHING_ROD_VI, key: 'fishing_rod_vi', name: 'Fishing Rod VI',
    description: 'Type VI fishing rod. Supports fishing depth levels 1–6 and has three upgrade levels.',
    category: 'tool', rarity: 'epic', stackLimit: 1,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 18,
    toolKind: 'rod', toolPower: 6, rodType: 6, rodUpgradeLevels: [1, 2, 3], maxDurability: 540,
    repairMaterialId: ITEM_IDS.OBSIDIAN_INGOT, repairQty: 2,
    colorPrimary: '#e6e8f2', colorSecondary: '#68738c', colorAccent: '#ffffff',
  },
  [ITEM_IDS.COAL_FUEL]: {
    id: ITEM_IDS.COAL_FUEL, key: 'coal_fuel', name: 'Coal Fuel',
    description: 'Combustible mineral fuel required to power Stone Furnaces.',
    category: 'material', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 1,
    colorPrimary: '#303642', colorSecondary: '#161921', colorAccent: '#69748a',
  },
  [ITEM_IDS.COPPER_FRAGMENT]: {
    id: ITEM_IDS.COPPER_FRAGMENT, key: 'copper_fragment', name: 'Copper Fragment',
    description: 'Raw copper ore shard mined from upper Mining Shaft strata.',
    category: 'material', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 2,
    fishDepthProfile: { minDepthLevel: 1, maxDepthLevel: 2, preferredDepthLevel: 1 },
    colorPrimary: '#d97c43', colorSecondary: '#7d3d1d', colorAccent: '#ffbf8c',
  },
  [ITEM_IDS.IRON_FRAGMENT]: {
    id: ITEM_IDS.IRON_FRAGMENT, key: 'iron_fragment', name: 'Iron Fragment',
    description: 'Dense iron ore shard mined from mid-level Mining Shaft slate.',
    category: 'material', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 3,
    colorPrimary: '#aebbc9', colorSecondary: '#586473', colorAccent: '#eff7ff',
  },
  [ITEM_IDS.CRYSTAL_FRAGMENT]: {
    id: ITEM_IDS.CRYSTAL_FRAGMENT, key: 'crystal_fragment', name: 'Crystal Fragment',
    description: 'Luminous crystal shard mined deep inside subterranean caverns.',
    category: 'material', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 5,
    colorPrimary: '#8c6ef5', colorSecondary: '#483494', colorAccent: '#e4d6ff',
  },
  [ITEM_IDS.OBSIDIAN_FRAGMENT]: {
    id: ITEM_IDS.OBSIDIAN_FRAGMENT, key: 'obsidian_fragment', name: 'Obsidian Fragment',
    description: 'Volcanic glass shard harvested from the deepest magma pockets.',
    category: 'material', rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 7,
    colorPrimary: '#4d3b63', colorSecondary: '#1c1526', colorAccent: '#b98cff',
  },
  [ITEM_IDS.COPPER_INGOT]: {
    id: ITEM_IDS.COPPER_INGOT, key: 'copper_ingot', name: 'Copper Ingot',
    description: 'Smelted copper bar used for Bounce Pads, Rods, and Scrolls.',
    category: 'material', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 5,
    colorPrimary: '#e38749', colorSecondary: '#8c441c', colorAccent: '#ffd1a3',
  },
  [ITEM_IDS.IRON_INGOT]: {
    id: ITEM_IDS.IRON_INGOT, key: 'iron_ingot', name: 'Refined Iron Ingot',
    description: 'Smelted structural iron used for Furnaces, Pickaxes, and BFG Collectors.',
    category: 'material', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 7,
    colorPrimary: '#d5e2f0', colorSecondary: '#6b7b8c', colorAccent: '#ffffff',
  },
  [ITEM_IDS.CRYSTAL_INGOT]: {
    id: ITEM_IDS.CRYSTAL_INGOT, key: 'crystal_ingot', name: 'Crystal Ingot',
    description: 'Arcane crystalline alloy used in high-tier automation and crystal gear.',
    category: 'material', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 12,
    colorPrimary: '#9d82ff', colorSecondary: '#4d399c', colorAccent: '#f2ebff',
  },
  [ITEM_IDS.OBSIDIAN_INGOT]: {
    id: ITEM_IDS.OBSIDIAN_INGOT, key: 'obsidian_ingot', name: 'Obsidian Ingot',
    description: 'Tempered abyssal bar forged for endgame tools and parkour mastery.',
    category: 'material', rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 16,
    colorPrimary: '#5f497a', colorSecondary: '#20182b', colorAccent: '#cfabff',
  },
  [ITEM_IDS.FISH_MINNOW]: {
    id: ITEM_IDS.FISH_MINNOW, key: 'fish_minnow', name: 'Stream Minnow',
    description: 'Quick silver fish caught in shallow water pools (Depth 1–3). Ingredient for Culinary buffs.',
    category: 'material', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 2,
    fishDepthProfile: { minDepthLevel: 1, maxDepthLevel: 2, preferredDepthLevel: 1 },
    colorPrimary: '#8cd4e8', colorSecondary: '#407f99', colorAccent: '#e8fbff',
  },
  [ITEM_IDS.FISH_CARP]: {
    id: ITEM_IDS.FISH_CARP, key: 'fish_carp', name: 'Cavern Carp',
    description: 'Sturdy golden carp hooked in mid-depth reservoirs (Depth 4–8).',
    category: 'material', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 4,
    fishDepthProfile: { minDepthLevel: 2, maxDepthLevel: 4, preferredDepthLevel: 3 },
    colorPrimary: '#e39b49', colorSecondary: '#8c4e1c', colorAccent: '#ffe0a3',
  },
  [ITEM_IDS.FISH_GLACIER_TROUT]: {
    id: ITEM_IDS.FISH_GLACIER_TROUT, key: 'fish_glacier_trout', name: 'Glacier Trout',
    description: 'Prized deep-water trout caught in abyssal reservoirs (Depth 9+).',
    category: 'material', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 7,
    fishDepthProfile: { minDepthLevel: 5, maxDepthLevel: 6, preferredDepthLevel: 6 },
    colorPrimary: '#4fc7e8', colorSecondary: '#1c638c', colorAccent: '#d9fbff',
  },
  [ITEM_IDS.FISH_SLIMEFIN]: {
    id: ITEM_IDS.FISH_SLIMEFIN, key: 'fish_slimefin', name: 'Toxic Slimefin',
    description: 'Bio-luminescent mutant fish reeled from Acid pools.',
    category: 'material', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 8,
    colorPrimary: '#7be849', colorSecondary: '#2d781c', colorAccent: '#e2ff99',
  },
  [ITEM_IDS.STARTER_BAIT]: {
    id: ITEM_IDS.STARTER_BAIT, key: 'starter_bait', name: 'Starter Earthworm Bait',
    description: 'Juicy wiggling earthworms dug up from damp island sands. Increases bite attraction in Fishcore.',
    category: 'consumable', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 1, xpValue: 1,
    colorPrimary: '#c46a47', colorSecondary: '#783820', colorAccent: '#ffb394',
  },
  [ITEM_IDS.BUFF_GLACIER_FILLET]: {
    id: ITEM_IDS.BUFF_GLACIER_FILLET, key: 'buff_glacier_fillet', name: 'Glacier Fillet',
    description: 'Use to gain +25% Movement Speed for 5 minutes across all worlds and parkour courses.',
    category: 'consumable', rarity: 'uncommon', stackLimit: 50,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 6,
    buffEffect: { buffType: 'move_speed', label: '+25% Move Speed', bonusPct: 25, durationMs: 300_000 },
    colorPrimary: '#8ce3ff', colorSecondary: '#2d78a6', colorAccent: '#ffffff',
  },
  [ITEM_IDS.BUFF_MINER_CHOWDER]: {
    id: ITEM_IDS.BUFF_MINER_CHOWDER, key: 'buff_miner_chowder', name: "Miner's Chowder",
    description: 'Use to gain +30% Break Speed for 5 minutes while farming or mining shafts.',
    category: 'consumable', rarity: 'uncommon', stackLimit: 50,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 6,
    buffEffect: { buffType: 'break_speed', label: '+30% Break Speed', bonusPct: 30, durationMs: 300_000 },
    colorPrimary: '#f2c166', colorSecondary: '#8c5320', colorAccent: '#fff6cc',
  },
  [ITEM_IDS.BUFF_LUCK_BROTH]: {
    id: ITEM_IDS.BUFF_LUCK_BROTH, key: 'buff_luck_broth', name: 'Abyssal Luck Broth',
    description: 'Use to gain +15% Bonus Seed & Ore Fragment Luck for 8 minutes.',
    category: 'consumable', rarity: 'rare', stackLimit: 50,
    collision: 'none', breakable: false, hardness: 0,
    placeable: false, tradeable: true, gemValue: 0, xpValue: 10,
    buffEffect: { buffType: 'luck', label: '+15% Drop Luck', bonusPct: 15, durationMs: 480_000 },
    colorPrimary: '#89f263', colorSecondary: '#2c7524', colorAccent: '#e8ffb8',
  },
  [ITEM_IDS.COAL_VEIN]: {
    id: ITEM_IDS.COAL_VEIN, key: 'coal_vein', name: 'Coal Ore Vein',
    description: 'Rich coal seam generating inside Mining Shafts. Drops Coal Fuel.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 3,
    drops: [{ itemId: ITEM_IDS.COAL_FUEL, chance: 1, minQty: 1, maxQty: 2 }],
    colorPrimary: '#4d5361', colorSecondary: '#1c1f26', colorAccent: '#8690a3',
  },
  [ITEM_IDS.COPPER_VEIN]: {
    id: ITEM_IDS.COPPER_VEIN, key: 'copper_vein', name: 'Copper Ore Vein',
    description: 'Metallic copper seam inside upper Mining Shafts. Drops Copper Fragments.',
    category: 'foreground', rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 4,
    drops: [{ itemId: ITEM_IDS.COPPER_FRAGMENT, chance: 1, minQty: 1, maxQty: 2 }],
    colorPrimary: '#d97c43', colorSecondary: '#586270', colorAccent: '#ffbf8c',
  },
  [ITEM_IDS.IRON_VEIN]: {
    id: ITEM_IDS.IRON_VEIN, key: 'iron_vein', name: 'Iron Ore Vein',
    description: 'Dense iron seam in mid-depth Mining Shafts. Drops Iron Fragments.',
    category: 'foreground', rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 6,
    drops: [{ itemId: ITEM_IDS.IRON_FRAGMENT, chance: 1, minQty: 1, maxQty: 2 }],
    colorPrimary: '#c2d1e0', colorSecondary: '#47505c', colorAccent: '#ffffff',
  },
  [ITEM_IDS.OBSIDIAN_VEIN]: {
    id: ITEM_IDS.OBSIDIAN_VEIN, key: 'obsidian_vein', name: 'Obsidian Core Vein',
    description: 'Volcanic seam in deep Mining Shafts. Drops Obsidian Fragments.',
    category: 'foreground', rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 12,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 10,
    drops: [{ itemId: ITEM_IDS.OBSIDIAN_FRAGMENT, chance: 1, minQty: 1, maxQty: 2 }],
    colorPrimary: '#583f73', colorSecondary: '#1d1626', colorAccent: '#c496ff',
  },

  

  [ITEM_IDS.AIR]: {
    id: ITEM_IDS.AIR,
    key: 'air',
    name: 'Empty Air',
    description: 'Open sky space.',
    category: 'foreground',
    rarity: 'common',
    stackLimit: 0,
    collision: 'none',
    breakable: false,
    hardness: 0,
    placeable: false,
    tradeable: false,
    gemValue: 0,
    xpValue: 0,
    transparent: true,
    colorPrimary: '#7ec8f2',
    colorSecondary: '#bce6ff',
    colorAccent: '#ffffff',
  },
  [ITEM_IDS.FIST]: {
    id: ITEM_IDS.FIST,
    key: 'fist',
    name: 'Builder Fist',
    description: 'Punch blocks to mine resources, harvest mature trees, and gather gems.',
    category: 'tool',
    rarity: 'common',
    stackLimit: 1,
    collision: 'none',
    breakable: false,
    hardness: 0,
    placeable: false,
    tradeable: false,
    gemValue: 0,
    xpValue: 0,
    colorPrimary: '#f2b880',
    colorSecondary: '#c9824f',
    colorAccent: '#ffe2c2',
  },
  [ITEM_IDS.WRENCH]: {
    id: ITEM_IDS.WRENCH,
    key: 'wrench',
    name: 'Tinker Wrench',
    description: 'Configure Share Locks, Vending Machines, and Signs.',
    category: 'tool',
    rarity: 'uncommon',
    stackLimit: 1,
    collision: 'none',
    breakable: false,
    hardness: 0,
    placeable: false,
    tradeable: false,
    gemValue: 0,
    xpValue: 0,
    colorPrimary: '#9bb4c9',
    colorSecondary: '#586d80',
    colorAccent: '#e2eef7',
  },
  [ITEM_IDS.BEDROCK]: {
    id: ITEM_IDS.BEDROCK,
    key: 'bedrock',
    name: 'Abyssal Bedrock',
    description: 'Indestructible foundation layer forming the bottom six rows of every world.',
    category: 'foreground',
    rarity: 'epic',
    stackLimit: 200,
    collision: 'solid',
    breakable: false,
    hardness: 999,
    placeable: false,
    tradeable: false,
    gemValue: 0,
    xpValue: 0,
    colorPrimary: '#2a2e38',
    colorSecondary: '#171a21',
    colorAccent: '#464d5e',
  },
  [ITEM_IDS.ENTRANCE_PORTAL]: {
    id: ITEM_IDS.ENTRANCE_PORTAL,
    key: 'entrance_portal',
    name: 'World Gate',
    description: 'Arrival archway marking this world’s spawn point.',
    category: 'interactive',
    rarity: 'epic',
    stackLimit: 1,
    collision: 'none',
    breakable: false,
    hardness: 999,
    placeable: false,
    tradeable: false,
    gemValue: 0,
    xpValue: 0,
    transparent: true,
    colorPrimary: '#d9d0b8',
    colorSecondary: '#665b4c',
    colorAccent: '#78e3ff',
  },
  [ITEM_IDS.WORLD_LOCK]: {
    id: ITEM_IDS.WORLD_LOCK,
    key: 'world_lock',
    name: 'World Lock',
    description: 'Legacy item retained for old inventory records. World ownership is now assigned by the world system.',
    category: 'lock',
    rarity: 'epic',
    stackLimit: 50,
    collision: 'solid',
    breakable: true,
    hardness: 4,
    placeable: false,
    tradeable: true,
    gemValue: 0,
    xpValue: 20,
    storePrice: 200,
    lockRadius: 0,
    drops: [{ itemId: ITEM_IDS.WORLD_LOCK, chance: 1, minQty: 1, maxQty: 1 }],
    colorPrimary: '#f2b738',
    colorSecondary: '#8f5f14',
    colorAccent: '#fff0a8',
  },
  [ITEM_IDS.SMALL_LOCK]: {
    id: ITEM_IDS.SMALL_LOCK,
    key: 'small_lock',
    name: 'Builder Area Lock',
    description: 'Legacy item retained for old inventory records. Use Share Locks to grant area access.',
    category: 'lock',
    rarity: 'rare',
    stackLimit: 100,
    collision: 'solid',
    breakable: true,
    hardness: 4,
    placeable: false,
    tradeable: true,
    gemValue: 0,
    xpValue: 10,
    storePrice: 50,
    lockRadius: 3,
    drops: [{ itemId: ITEM_IDS.SMALL_LOCK, chance: 1, minQty: 1, maxQty: 1 }],
    colorPrimary: '#52b888',
    colorSecondary: '#20593e',
    colorAccent: '#b4f7d6',
  },
  [ITEM_IDS.MICRO_SHARE_LOCK]: {
    id: ITEM_IDS.MICRO_SHARE_LOCK, key: 'micro_share_lock', name: 'Micro-Share Lock',
    description: 'Claims a 3×2 area in a world you own and lets you grant selected players access.',
    category: 'lock', rarity: 'uncommon', stackLimit: 50, collision: 'solid',
    breakable: true, hardness: 4, placeable: true, tradeable: false,
    gemValue: 0, xpValue: 10, storePrice: 500,
    colorPrimary: '#48c6d5', colorSecondary: '#15556a', colorAccent: '#a8f7ff',
  },
  [ITEM_IDS.SMALL_SHARE_LOCK]: {
    id: ITEM_IDS.SMALL_SHARE_LOCK, key: 'small_share_lock', name: 'Small-Share Lock',
    description: 'Claims a 5×5 area in a world you own and lets you grant selected players access.',
    category: 'lock', rarity: 'rare', stackLimit: 50, collision: 'solid',
    breakable: true, hardness: 5, placeable: true, tradeable: false,
    gemValue: 0, xpValue: 15, storePrice: 1500,
    colorPrimary: '#57c887', colorSecondary: '#1c5d3e', colorAccent: '#b7ffd7',
  },
  [ITEM_IDS.COVER_SHARE_LOCK]: {
    id: ITEM_IDS.COVER_SHARE_LOCK, key: 'cover_share_lock', name: 'Cover-Share Lock',
    description: 'Claims a 7×10 area in a world you own and lets you grant selected players access.',
    category: 'lock', rarity: 'epic', stackLimit: 25, collision: 'solid',
    breakable: true, hardness: 6, placeable: true, tradeable: false,
    gemValue: 0, xpValue: 20, storePrice: 3500,
    colorPrimary: '#b68aff', colorSecondary: '#56347f', colorAccent: '#ead7ff',
  },
  [ITEM_IDS.WORLD_CORE]: {
    id: ITEM_IDS.WORLD_CORE, key: 'world_core', name: 'WorldCore',
    description: 'The permanent ownership anchor of a private realm. Only its owner can open the Manager Panel.',
    category: 'interactive', rarity: 'epic', stackLimit: 1, collision: 'solid',
    breakable: false, hardness: 0, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 0,
    colorPrimary: '#f4c45f', colorSecondary: '#805324', colorAccent: '#fff1a8',
  },
  [ITEM_IDS.LANDLORD_NPC]: {
    id: ITEM_IDS.LANDLORD_NPC, key: 'landlord_npc', name: 'Landlord',
    description: 'Nexus realm steward. Manage your existing realms or conjure a fresh one.',
    category: 'interactive', rarity: 'epic', stackLimit: 1, collision: 'none',
    breakable: false, hardness: 0, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 0,
    colorPrimary: '#8fc8e8', colorSecondary: '#315b83', colorAccent: '#f5e4b2',
  },
  [ITEM_IDS.WORLD_BLAST]: {
    id: ITEM_IDS.WORLD_BLAST, key: 'world_blast', name: 'World Blast',
    description: 'A one-use Terra Blast catalyst consumed when creating a specially themed realm.',
    category: 'consumable', rarity: 'epic', stackLimit: 10, collision: 'none',
    breakable: false, hardness: 0, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 0,
    colorPrimary: '#d58aff', colorSecondary: '#623d88', colorAccent: '#f4d8ff',
  },
  [ITEM_IDS.GREENS_VENDOR_NPC]: {
    id: ITEM_IDS.GREENS_VENDOR_NPC, key: 'greens_vendor_npc', name: 'Fresh Greens Vendor',
    description: 'Nexus Marketplace Vendor. Buy Crop Seeds or sell harvested Crops for Digibits.',
    category: 'interactive', rarity: 'epic', stackLimit: 1, collision: 'none',
    breakable: false, hardness: 0, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 0, transparent: true,
    colorPrimary: '#4ade80', colorSecondary: '#166534', colorAccent: '#fef08a',
  },
  [ITEM_IDS.STARTER_LOOTBOX]: {
    id: ITEM_IDS.STARTER_LOOTBOX, key: 'starter_lootbox', name: 'Starter Supply Lootbox',
    description: 'One-time starter supply crate on your personal realm platform. Break to claim 1× Farming Hoe, 25× Dirt Soil, and 3× Crisp Radish Seeds!',
    category: 'interactive', rarity: 'epic', stackLimit: 1, collision: 'none',
    transparent: true, breakable: true, hardness: 3, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 5, worldXpValue: 10,
    colorPrimary: '#f59e0b', colorSecondary: '#78350f', colorAccent: '#38bdf8',
  },
  [ITEM_IDS.FARMING_HOE]: {
    id: ITEM_IDS.FARMING_HOE, key: 'farming_hoe', name: 'Farming Hoe',
    description: 'Essential cultivation tool claimed from your Starter Supply Lootbox. Use on Dirt Soil to plow fertile furrows ready for sowing Crop Seeds.',
    category: 'tool', toolKind: 'hoe', rarity: 'uncommon', stackLimit: 1, collision: 'none',
    breakable: false, hardness: 0, placeable: false, tradeable: false, undroppable: true,
    gemValue: 0, xpValue: 0,
    colorPrimary: '#94a3b8', colorSecondary: '#78350f', colorAccent: '#e2e8f0',
  },
  [ITEM_IDS.PLOWED_DIRT_SOIL]: {
    id: ITEM_IDS.PLOWED_DIRT_SOIL, key: 'plowed_dirt_soil', name: 'Plowed Dirt Soil',
    description: 'Tilled Dirt Soil furrowed with a Farming Hoe. Sow Crop Seeds directly into the tile above it.',
    category: 'foreground', rarity: 'common', stackLimit: 200, collision: 'solid',
    breakable: true, hardness: 3, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 1, worldXpValue: 1,
    drops: [{ itemId: ITEM_IDS.GP_DIRT, chance: 0.125, minQty: 1, maxQty: 1 }],
    colorPrimary: '#6b4226', colorSecondary: '#432818', colorAccent: '#9c6644',
  },
  [ITEM_IDS.VENDING_MACHINE]: {
    id: ITEM_IDS.VENDING_MACHINE,
    key: 'vending_machine',
    name: 'Personal Vending Machine',
    description: 'Place in your world and wrench to list items for sale in exchange for locks or crystals.',
    category: 'interactive',
    rarity: 'rare',
    stackLimit: 50,
    collision: 'solid',
    breakable: true,
    hardness: 4,
    placeable: true,
    tradeable: true,
    gemValue: 0,
    xpValue: 12,
    storePrice: 80,
    drops: [{ itemId: ITEM_IDS.VENDING_MACHINE, chance: 1, minQty: 1, maxQty: 1 }],
    colorPrimary: '#3b82c4',
    colorSecondary: '#1c4166',
    colorAccent: '#8ce3ff',
  },
  [ITEM_IDS.WEAR_GOLD_CROWN]: {
    id: ITEM_IDS.WEAR_GOLD_CROWN,
    key: 'wear_gold_crown',
    name: 'Sunforged Monarch Crown',
    description: 'Regal golden pixel crown worn atop your head.',
    category: 'wearable',
    rarity: 'epic',
    stackLimit: 5,
    collision: 'none',
    breakable: false,
    hardness: 0,
    placeable: false,
    tradeable: true,
    gemValue: 0,
    xpValue: 0,
    wearableSlot: 'head',
    storePrice: 120,
    colorPrimary: '#f2b738',
    colorSecondary: '#99620c',
    colorAccent: '#ff4f5e',
  },
  [ITEM_IDS.WEAR_EXPLORER_HAT]: {
    id: ITEM_IDS.WEAR_EXPLORER_HAT,
    key: 'wear_explorer_hat',
    name: 'Frontier Ranger Hat',
    description: 'Wide-brimmed leather expedition hat.',
    category: 'wearable',
    rarity: 'uncommon',
    stackLimit: 5,
    collision: 'none',
    breakable: false,
    hardness: 0,
    placeable: false,
    tradeable: true,
    gemValue: 0,
    xpValue: 0,
    wearableSlot: 'head',
    storePrice: 45,
    colorPrimary: '#8c5630',
    colorSecondary: '#523018',
    colorAccent: '#e6b85c',
  },
  [ITEM_IDS.WEAR_CYBER_VISOR]: {
    id: ITEM_IDS.WEAR_CYBER_VISOR,
    key: 'wear_cyber_visor',
    name: 'Crystal Sight Visor',
    description: 'Luminous cyan crystal lens worn across the eyes.',
    category: 'wearable',
    rarity: 'rare',
    stackLimit: 5,
    collision: 'none',
    breakable: false,
    hardness: 0,
    placeable: false,
    tradeable: true,
    gemValue: 0,
    xpValue: 0,
    wearableSlot: 'face',
    storePrice: 75,
    colorPrimary: '#38e8d8',
    colorSecondary: '#164e63',
    colorAccent: '#d6ffff',
  },
  [ITEM_IDS.WEAR_SKY_WINGS]: {
    id: ITEM_IDS.WEAR_SKY_WINGS,
    key: 'wear_sky_wings',
    name: 'Aether Feather Wings',
    description: 'Light-woven back wings prized by master world builders.',
    category: 'wearable',
    rarity: 'epic',
    stackLimit: 5,
    collision: 'none',
    breakable: false,
    hardness: 0,
    placeable: false,
    tradeable: true,
    gemValue: 0,
    xpValue: 0,
    wearableSlot: 'back',
    storePrice: 160,
    colorPrimary: '#9ce5ff',
    colorSecondary: '#3b82c4',
    colorAccent: '#ffffff',
  },

  // --- GrowPixel Collection Blocks (500..541) ---
  [ITEM_IDS.GP_DIRT]: {
    id: ITEM_IDS.GP_DIRT, key: 'gp_dirt', name: "Dirt",
    description: "Dirt — GrowPixel collection item. Natural world-generation material.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_DIRT, drops: [{ itemId: ITEM_IDS.GP_DIRT, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_DIRT, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 1, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    colorPrimary: '#8b5a35', colorSecondary: '#5b3925', colorAccent: '#bd895c',
  },
  [ITEM_IDS.GP_ROCK]: {
    id: ITEM_IDS.GP_ROCK, key: 'gp_rock', name: "Rock",
    description: "Rock — GrowPixel collection item. Natural world-generation material.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 10,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_ROCK, drops: [{ itemId: ITEM_IDS.GP_ROCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_ROCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 1, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    colorPrimary: '#737b86', colorSecondary: '#454b55', colorAccent: '#aab3bf',
  },
  [ITEM_IDS.GP_LAVA]: {
    id: ITEM_IDS.GP_LAVA, key: 'gp_lava', name: "Lava",
    description: "Lava — GrowPixel collection item. Natural world-generation material.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_LAVA, drops: [{ itemId: ITEM_IDS.GP_LAVA, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_LAVA, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 1, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    colorPrimary: '#d64a24', colorSecondary: '#782b1b', colorAccent: '#ff9a42',
  },
  [ITEM_IDS.GP_CAVE_BACKGROUND]: {
    id: ITEM_IDS.GP_CAVE_BACKGROUND, key: 'gp_cave_background', name: "Cave Background",
    description: "Cave Background — GrowPixel collection item. Natural world-generation material.",
    category: 'background', rarity: 'common',
    stackLimit: 200, collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_CAVE_BACKGROUND, drops: [{ itemId: ITEM_IDS.GP_CAVE_BACKGROUND, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_CAVE_BACKGROUND, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 1, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    colorPrimary: '#49372f', colorSecondary: '#2e241f', colorAccent: '#765846',
  },
  [ITEM_IDS.GP_SAND]: {
    id: ITEM_IDS.GP_SAND, key: 'gp_sand', name: "Sand",
    description: "Sand — GrowPixel collection item. Natural world-generation material.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_SAND, drops: [{ itemId: ITEM_IDS.GP_SAND, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_SAND, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 1, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    colorPrimary: '#d9c17b', colorSecondary: '#a88d4d', colorAccent: '#f3e1a5',
  },
  [ITEM_IDS.GP_DOOR]: {
    id: ITEM_IDS.GP_DOOR, key: 'gp_door', name: "Door",
    description: "Door — Pass-through background doorway with gateway linking capability. Wrench to link coordinates or punch to travel.",
    category: 'background', rarity: 'common',
    stackLimit: 200, collision: 'none', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_DOOR, drops: [{ itemId: ITEM_IDS.GP_DOOR, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_DOOR, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 2, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_DIRT, ITEM_IDS.GP_SEED_CAVE_BACKGROUND],
    colorPrimary: '#a76b3e', colorSecondary: '#694126', colorAccent: '#d99a62',
  },
  [ITEM_IDS.GP_GLASS_PANE]: {
    id: ITEM_IDS.GP_GLASS_PANE, key: 'gp_glass_pane', name: "Glass Pane",
    description: "Glass Pane — GrowPixel collection item. Splice Rock Seed + Lava Seed.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_GLASS_PANE, drops: [{ itemId: ITEM_IDS.GP_GLASS_PANE, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_GLASS_PANE, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 2, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_ROCK, ITEM_IDS.GP_SEED_LAVA],
    colorPrimary: '#a5e7f4', colorSecondary: '#5599b1', colorAccent: '#e8ffff',
  },
  [ITEM_IDS.GP_GRASS]: {
    id: ITEM_IDS.GP_GRASS, key: 'gp_grass', name: "Grass",
    description: "Grass — GrowPixel collection item. Splice Dirt Seed + Rock Seed.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_GRASS, drops: [{ itemId: ITEM_IDS.GP_GRASS, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_GRASS, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 2, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_DIRT, ITEM_IDS.GP_SEED_ROCK],
    colorPrimary: '#4caa45', colorSecondary: '#2f7434', colorAccent: '#8add64',
  },
  [ITEM_IDS.GP_LAVA_ROCK]: {
    id: ITEM_IDS.GP_LAVA_ROCK, key: 'gp_lava_rock', name: "Lava Rock",
    description: "Lava Rock — GrowPixel collection item. Splice Lava Seed + Cave Background Seed.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_LAVA_ROCK, drops: [{ itemId: ITEM_IDS.GP_LAVA_ROCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_LAVA_ROCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 2, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_LAVA, ITEM_IDS.GP_SEED_CAVE_BACKGROUND],
    colorPrimary: '#8e3927', colorSecondary: '#4e241f', colorAccent: '#e66a3e',
  },
  [ITEM_IDS.GP_SIGN]: {
    id: ITEM_IDS.GP_SIGN, key: 'gp_sign', name: "Sign",
    description: "Sign — GrowPixel collection item. Walkthrough editable message signboard.",
    category: 'interactive', rarity: 'common',
    stackLimit: 200, collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_SIGN, drops: [{ itemId: ITEM_IDS.GP_SIGN, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_SIGN, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 2, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_ROCK, ITEM_IDS.GP_SEED_CAVE_BACKGROUND],
    colorPrimary: '#b47c45', colorSecondary: '#6d4829', colorAccent: '#e1b67a',
  },
  [ITEM_IDS.GP_WOOD_BLOCK]: {
    id: ITEM_IDS.GP_WOOD_BLOCK, key: 'gp_wood_block', name: "Wood Block",
    description: "Wood Block — GrowPixel collection item. Splice Dirt Seed + Lava Seed.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_WOOD_BLOCK, drops: [{ itemId: ITEM_IDS.GP_WOOD_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_WOOD_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 2, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_DIRT, ITEM_IDS.GP_SEED_LAVA],
    colorPrimary: '#9c6538', colorSecondary: '#624025', colorAccent: '#d39a60',
  },
  [ITEM_IDS.GP_BRICKS]: {
    id: ITEM_IDS.GP_BRICKS, key: 'gp_bricks', name: "Bricks",
    description: "Bricks — GrowPixel collection item. Splice Rock Seed + Grass Seed.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_BRICKS, drops: [{ itemId: ITEM_IDS.GP_BRICKS, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_BRICKS, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 3, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_ROCK, ITEM_IDS.GP_SEED_GRASS],
    colorPrimary: '#a65c4c', colorSecondary: '#683a35', colorAccent: '#d58c79',
  },
  [ITEM_IDS.GP_CRAPPY_SIGN]: {
    id: ITEM_IDS.GP_CRAPPY_SIGN, key: 'gp_crappy_sign', name: "Crappy Sign",
    description: "Crappy Sign — GrowPixel collection item. Walkthrough editable message signboard.",
    category: 'interactive', rarity: 'common',
    stackLimit: 200, collision: 'none', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_CRAPPY_SIGN, drops: [{ itemId: ITEM_IDS.GP_CRAPPY_SIGN, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_CRAPPY_SIGN, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 3, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_DOOR, ITEM_IDS.GP_SEED_DIRT],
    colorPrimary: '#8d653d', colorSecondary: '#5c432b', colorAccent: '#c79b61',
  },
  [ITEM_IDS.GP_DAISY]: {
    id: ITEM_IDS.GP_DAISY, key: 'gp_daisy', name: "Daisy",
    description: "Daisy — GrowPixel collection item. Splice Grass Seed + Dirt Seed.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_DAISY, drops: [{ itemId: ITEM_IDS.GP_DAISY, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_DAISY, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 3, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_GRASS, ITEM_IDS.GP_SEED_DIRT],
    colorPrimary: '#f2df56', colorSecondary: '#b89a2d', colorAccent: '#fff6a3',
  },
  [ITEM_IDS.GP_MUSHROOM]: {
    id: ITEM_IDS.GP_MUSHROOM, key: 'gp_mushroom', name: "Mushroom",
    description: "Mushroom — GrowPixel collection item. Splice Cave Background Seed + Grass Seed.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_MUSHROOM, drops: [{ itemId: ITEM_IDS.GP_MUSHROOM, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_MUSHROOM, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 3, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_CAVE_BACKGROUND, ITEM_IDS.GP_SEED_GRASS],
    colorPrimary: '#c35c4c', colorSecondary: '#713d39', colorAccent: '#f2b5a4',
  },
  [ITEM_IDS.GP_ROSE]: {
    id: ITEM_IDS.GP_ROSE, key: 'gp_rose', name: "Rose",
    description: "Rose — GrowPixel collection item. Splice Grass Seed + Lava Seed.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_ROSE, drops: [{ itemId: ITEM_IDS.GP_ROSE, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_ROSE, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 3, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_GRASS, ITEM_IDS.GP_SEED_LAVA],
    colorPrimary: '#c83d62', colorSecondary: '#76253f', colorAccent: '#ff9bb3',
  },
  [ITEM_IDS.GP_WHEAT]: {
    id: ITEM_IDS.GP_WHEAT, key: 'gp_wheat', name: "Wheat",
    description: "Wheat — GrowPixel collection item. Splice Grass Seed + Sand Seed.",
    category: 'foreground', rarity: 'common',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_WHEAT, drops: [{ itemId: ITEM_IDS.GP_WHEAT, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_WHEAT, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 3, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_GRASS, ITEM_IDS.GP_SEED_SAND],
    colorPrimary: '#d9b84c', colorSecondary: '#8d7130', colorAccent: '#f5e29a',
  },
  [ITEM_IDS.GP_WOODEN_PLATFORM]: {
    id: ITEM_IDS.GP_WOODEN_PLATFORM, key: 'gp_wooden_platform', name: "Wooden Platform",
    description: "Wooden Platform — GrowPixel collection item. Splice Wood Block Seed + Grass Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'platform', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_WOODEN_PLATFORM, drops: [{ itemId: ITEM_IDS.GP_WOODEN_PLATFORM, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_WOODEN_PLATFORM, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 4, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_WOOD_BLOCK, ITEM_IDS.GP_SEED_GRASS],
    colorPrimary: '#b77b45', colorSecondary: '#704723', colorAccent: '#e0ad70',
  },
  [ITEM_IDS.GP_BLACK_BLOCK]: {
    id: ITEM_IDS.GP_BLACK_BLOCK, key: 'gp_black_block', name: "Black Block",
    description: "Black Block — GrowPixel collection item. Splice Bricks Seed + Cave Background Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_BLACK_BLOCK, drops: [{ itemId: ITEM_IDS.GP_BLACK_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_BLACK_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 4, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_CAVE_BACKGROUND],
    colorPrimary: '#34343c', colorSecondary: '#17171d', colorAccent: '#666675',
  },
  [ITEM_IDS.GP_BROWN_BLOCK]: {
    id: ITEM_IDS.GP_BROWN_BLOCK, key: 'gp_brown_block', name: "Brown Block",
    description: "Brown Block — GrowPixel collection item. Splice Bricks Seed + Dirt Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_BROWN_BLOCK, drops: [{ itemId: ITEM_IDS.GP_BROWN_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_BROWN_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 4, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_DIRT],
    colorPrimary: '#815239', colorSecondary: '#4f3024', colorAccent: '#bd8964',
  },
  [ITEM_IDS.GP_GREY_BLOCK]: {
    id: ITEM_IDS.GP_GREY_BLOCK, key: 'gp_grey_block', name: "Grey Block",
    description: "Grey Block — GrowPixel collection item. Splice Bricks Seed + Rock Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_GREY_BLOCK, drops: [{ itemId: ITEM_IDS.GP_GREY_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_GREY_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 4, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_ROCK],
    colorPrimary: '#89909a', colorSecondary: '#535b65', colorAccent: '#c1c7ce',
  },
  [ITEM_IDS.GP_RED_BLOCK]: {
    id: ITEM_IDS.GP_RED_BLOCK, key: 'gp_red_block', name: "Red Block",
    description: "Red Block — GrowPixel collection item. Splice Bricks Seed + Lava Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_RED_BLOCK, drops: [{ itemId: ITEM_IDS.GP_RED_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_RED_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 4, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_LAVA],
    colorPrimary: '#c43e43', colorSecondary: '#76252b', colorAccent: '#ff8588',
  },
  [ITEM_IDS.GP_AQUA_BLOCK]: {
    id: ITEM_IDS.GP_AQUA_BLOCK, key: 'gp_aqua_block', name: "Aqua Block",
    description: "Aqua Block — GrowPixel collection item. Splice Bricks Seed + Glass Pane Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_AQUA_BLOCK, drops: [{ itemId: ITEM_IDS.GP_AQUA_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_AQUA_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 5, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_GLASS_PANE],
    colorPrimary: '#42c9c5', colorSecondary: '#237a83', colorAccent: '#a1fff2',
  },
  [ITEM_IDS.GP_GREEN_BLOCK]: {
    id: ITEM_IDS.GP_GREEN_BLOCK, key: 'gp_green_block', name: "Green Block",
    description: "Green Block — GrowPixel collection item. Splice Bricks Seed + Grass Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_GREEN_BLOCK, drops: [{ itemId: ITEM_IDS.GP_GREEN_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_GREEN_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 5, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_GRASS],
    colorPrimary: '#4eaa50', colorSecondary: '#286b35', colorAccent: '#a1e878',
  },
  [ITEM_IDS.GP_WHITE_BLOCK]: {
    id: ITEM_IDS.GP_WHITE_BLOCK, key: 'gp_white_block', name: "White Block",
    description: "White Block — GrowPixel collection item. Splice Bricks Seed + Mushroom Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_WHITE_BLOCK, drops: [{ itemId: ITEM_IDS.GP_WHITE_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_WHITE_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 6, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_MUSHROOM],
    colorPrimary: '#e8e8e0', colorSecondary: '#a6a69d', colorAccent: '#ffffff',
  },
  [ITEM_IDS.GP_WINDOW]: {
    id: ITEM_IDS.GP_WINDOW, key: 'gp_window', name: "Window",
    description: "Window — GrowPixel collection item. Splice Glass Pane Seed + Wooden Background Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_WINDOW, drops: [{ itemId: ITEM_IDS.GP_WINDOW, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_WINDOW, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 4, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_GLASS_PANE, ITEM_IDS.GP_SEED_WOODEN_BACKGROUND],
    colorPrimary: '#a5e7f4', colorSecondary: '#5599b1', colorAccent: '#e8ffff',
  },
  [ITEM_IDS.GP_YELLOW_BLOCK]: {
    id: ITEM_IDS.GP_YELLOW_BLOCK, key: 'gp_yellow_block', name: "Yellow Block",
    description: "Yellow Block — GrowPixel collection item. Splice Bricks Seed + Daisy Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_YELLOW_BLOCK, drops: [{ itemId: ITEM_IDS.GP_YELLOW_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_YELLOW_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 4, hardnessVerified: false, referenceNote: 'Rarity index lists R4.',
    seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_DAISY],
    colorPrimary: '#e5c747', colorSecondary: '#a58626', colorAccent: '#fff19a',
  },
  [ITEM_IDS.GP_GLASS_BLOCK]: {
    id: ITEM_IDS.GP_GLASS_BLOCK, key: 'gp_glass_block', name: "Glass Block",
    description: "Glass Block — GrowPixel collection item. Splice Aqua Block Seed + Glass Pane Seed.",
    category: 'foreground', rarity: 'rare',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_GLASS_BLOCK, drops: [{ itemId: ITEM_IDS.GP_GLASS_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_GLASS_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 7, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_AQUA_BLOCK, ITEM_IDS.GP_SEED_GLASS_PANE],
    colorPrimary: '#8bd8e9', colorSecondary: '#3e879c', colorAccent: '#e4ffff',
  },
  [ITEM_IDS.GP_TOILET]: {
    id: ITEM_IDS.GP_TOILET, key: 'gp_toilet', name: "Toilet",
    description: "Toilet — GrowPixel collection item. Splice Crappy Sign Seed + Brown Block Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_TOILET, drops: [{ itemId: ITEM_IDS.GP_TOILET, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_TOILET, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 6, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_CRAPPY_SIGN, ITEM_IDS.GP_SEED_BROWN_BLOCK],
    colorPrimary: '#e8e9e7', colorSecondary: '#9fa4a7', colorAccent: '#ffffff',
  },
  [ITEM_IDS.GP_RED_BRICKS]: {
    id: ITEM_IDS.GP_RED_BRICKS, key: 'gp_red_bricks', name: "Red Bricks",
    description: "Red Bricks — GrowPixel collection item. Splice Red Block Seed + Bricks Seed.",
    category: 'foreground', rarity: 'rare',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_RED_BRICKS, drops: [{ itemId: ITEM_IDS.GP_RED_BRICKS, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_RED_BRICKS, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 7, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_RED_BLOCK, ITEM_IDS.GP_SEED_BRICKS],
    colorPrimary: '#a94740', colorSecondary: '#682b2a', colorAccent: '#e17c6f',
  },
  [ITEM_IDS.GP_DEATH_SPIKES]: {
    id: ITEM_IDS.GP_DEATH_SPIKES, key: 'gp_death_spikes', name: "Death Spikes",
    description: "Death Spikes — GrowPixel collection item. Hazard spikes.",
    category: 'foreground', rarity: 'rare',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_DEATH_SPIKES, drops: [{ itemId: ITEM_IDS.GP_DEATH_SPIKES, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_DEATH_SPIKES, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 8, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_DANGER_SIGN, ITEM_IDS.GP_SEED_ROCK_BACKGROUND],
    colorPrimary: '#55515c', colorSecondary: '#25232b', colorAccent: '#ff6464',
  },
  [ITEM_IDS.GP_DUNGEON_DOOR]: {
    id: ITEM_IDS.GP_DUNGEON_DOOR, key: 'gp_dungeon_door', name: "Dungeon Door",
    description: "Dungeon Door — Pass-through background iron archway with gateway linking capability. Wrench to link coordinates or punch to travel.",
    category: 'background', rarity: 'rare',
    stackLimit: 200, collision: 'none', breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_DUNGEON_DOOR, drops: [{ itemId: ITEM_IDS.GP_DUNGEON_DOOR, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_DUNGEON_DOOR, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 8, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_DOOR, ITEM_IDS.GP_SEED_WINDOW],
    colorPrimary: '#665247', colorSecondary: '#342a27', colorAccent: '#b48c6e',
  },
  [ITEM_IDS.GP_BUSH]: {
    id: ITEM_IDS.GP_BUSH, key: 'gp_bush', name: "Bush",
    description: "Bush — GrowPixel collection item. Splice Poppy Seed + Rose Seed.",
    category: 'foreground', rarity: 'rare',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_BUSH, drops: [{ itemId: ITEM_IDS.GP_BUSH, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_BUSH, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 9, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_POPPY, ITEM_IDS.GP_SEED_ROSE],
    colorPrimary: '#3e9148', colorSecondary: '#235a32', colorAccent: '#8bd66c',
  },
  [ITEM_IDS.GP_HEDGE]: {
    id: ITEM_IDS.GP_HEDGE, key: 'gp_hedge', name: "Hedge",
    description: "Hedge — GrowPixel collection item. Harvest drop from Bush tree.",
    category: 'foreground', rarity: 'rare',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_HEDGE, drops: [{ itemId: ITEM_IDS.GP_HEDGE, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_HEDGE, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 9, hardnessVerified: true, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    colorPrimary: '#347c3e', colorSecondary: '#1d4e2b', colorAccent: '#74bd5c',
  },
  [ITEM_IDS.GP_ORANGE_BLOCK]: {
    id: ITEM_IDS.GP_ORANGE_BLOCK, key: 'gp_orange_block', name: "Orange Block",
    description: "Orange Block — GrowPixel collection item. Splice Bricks Seed + Poppy Seed.",
    category: 'foreground', rarity: 'rare',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_ORANGE_BLOCK, drops: [{ itemId: ITEM_IDS.GP_ORANGE_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_ORANGE_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 9, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_POPPY],
    colorPrimary: '#e68a32', colorSecondary: '#985020', colorAccent: '#ffc16c',
  },
  [ITEM_IDS.GP_BLUE_BLOCK]: {
    id: ITEM_IDS.GP_BLUE_BLOCK, key: 'gp_blue_block', name: "Blue Block",
    description: "Blue Block — GrowPixel collection item. Splice Bricks Seed + Blueberry Seed.",
    category: 'foreground', rarity: 'epic',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 4,
    seedId: ITEM_IDS.GP_SEED_BLUE_BLOCK, drops: [{ itemId: ITEM_IDS.GP_BLUE_BLOCK, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_BLUE_BLOCK, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 15, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_BRICKS, ITEM_IDS.GP_SEED_BLUEBERRY],
    colorPrimary: '#438ad5', colorSecondary: '#254b8b', colorAccent: '#a6d8ff',
  },
  [ITEM_IDS.GP_POPPY]: {
    id: ITEM_IDS.GP_POPPY, key: 'gp_poppy', name: "Poppy",
    description: "Poppy — GrowPixel collection item. Splice Rose Seed + Daisy Seed.",
    category: 'foreground', rarity: 'uncommon',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_POPPY, drops: [{ itemId: ITEM_IDS.GP_POPPY, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_POPPY, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 6, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_ROSE, ITEM_IDS.GP_SEED_DAISY],
    colorPrimary: '#e34b63', colorSecondary: '#87283f', colorAccent: '#ff9cab',
  },
  [ITEM_IDS.GP_WOODEN_BACKGROUND]: {
    id: ITEM_IDS.GP_WOODEN_BACKGROUND, key: 'gp_wooden_background', name: "Wooden Background",
    description: "Wooden Background — GrowPixel collection item. Splice Grass Seed + Door Seed.",
    category: 'background', rarity: 'uncommon',
    stackLimit: 200, collision: 'none', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_WOODEN_BACKGROUND, drops: [{ itemId: ITEM_IDS.GP_WOODEN_BACKGROUND, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_WOODEN_BACKGROUND, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 4, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_GRASS, ITEM_IDS.GP_SEED_DOOR],
    colorPrimary: '#795332', colorSecondary: '#4b321f', colorAccent: '#bd8b59',
  },
  [ITEM_IDS.GP_ROCK_BACKGROUND]: {
    id: ITEM_IDS.GP_ROCK_BACKGROUND, key: 'gp_rock_background', name: "Rock Background",
    description: "Rock Background — GrowPixel collection item. Splice Rock Seed + Door Seed.",
    category: 'background', rarity: 'common',
    stackLimit: 200, collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_ROCK_BACKGROUND, drops: [{ itemId: ITEM_IDS.GP_ROCK_BACKGROUND, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_ROCK_BACKGROUND, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 3, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    spliceIngredients: [ITEM_IDS.GP_SEED_ROCK, ITEM_IDS.GP_SEED_DOOR],
    colorPrimary: '#555d68', colorSecondary: '#303640', colorAccent: '#8994a4',
  },
  [ITEM_IDS.GP_POINTY_SIGN]: {
    id: ITEM_IDS.GP_POINTY_SIGN, key: 'gp_pointy_sign', name: "Pointy Sign",
    description: "Pointy Sign — GrowPixel collection item. Walkthrough directional message sign.",
    category: 'interactive', rarity: 'uncommon',
    stackLimit: 200, collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 1,
    seedId: ITEM_IDS.GP_SEED_POINTY_SIGN, drops: [{ itemId: ITEM_IDS.GP_POINTY_SIGN, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_POINTY_SIGN, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 4, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_DOOR, ITEM_IDS.GP_SEED_SIGN],
    colorPrimary: '#b47c45', colorSecondary: '#6d4829', colorAccent: '#e1b67a',
  },
  [ITEM_IDS.GP_DANGER_SIGN]: {
    id: ITEM_IDS.GP_DANGER_SIGN, key: 'gp_danger_sign', name: "Danger Sign",
    description: "Danger Sign — GrowPixel collection item. Walkthrough warning message sign.",
    category: 'interactive', rarity: 'uncommon',
    stackLimit: 200, collision: 'none', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 2,
    seedId: ITEM_IDS.GP_SEED_DANGER_SIGN, drops: [{ itemId: ITEM_IDS.GP_DANGER_SIGN, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_DANGER_SIGN, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 5, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_LAVA, ITEM_IDS.GP_SEED_POINTY_SIGN],
    colorPrimary: '#d45a37', colorSecondary: '#7d3025', colorAccent: '#ffb15f',
  },
  [ITEM_IDS.GP_BLUEBERRY]: {
    id: ITEM_IDS.GP_BLUEBERRY, key: 'gp_blueberry', name: "Blueberry",
    description: "Blueberry — GrowPixel collection item. Splice Bush Seed + Mushroom Seed.",
    category: 'foreground', rarity: 'epic',
    stackLimit: 200, collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 1, xpValue: 3,
    seedId: ITEM_IDS.GP_SEED_BLUEBERRY, drops: [{ itemId: ITEM_IDS.GP_BLUEBERRY, chance: 1, minQty: 1, maxQty: 1 }, { itemId: ITEM_IDS.GP_SEED_BLUEBERRY, chance: 0.2, minQty: 1, maxQty: 1 }],
    growPixelRarity: 12, hardnessVerified: false, seedDropChance: 0.2, seedDropChanceVerified: false, gemValueVerified: false, economyValue: null,
    transparent: true,
    spliceIngredients: [ITEM_IDS.GP_SEED_BUSH, ITEM_IDS.GP_SEED_MUSHROOM],
    colorPrimary: '#3d68b8', colorSecondary: '#263c75', colorAccent: '#91b6ff',
  },

  // --- GrowPixel Collection Seeds (600..641) ---
  [ITEM_IDS.GP_SEED_DIRT]: {
    id: ITEM_IDS.GP_SEED_DIRT, key: 'gp_seed_dirt', name: "Dirt Seed",
    description: "Plant to grow a Dirt tree. Growth time 31s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_DIRT,
    growthTimeMs: 31000, growPixelRarity: 1, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#8b5a35', colorSecondary: '#5b3925', colorAccent: '#bd895c',
  },
  [ITEM_IDS.GP_SEED_ROCK]: {
    id: ITEM_IDS.GP_SEED_ROCK, key: 'gp_seed_rock', name: "Rock Seed",
    description: "Plant to grow a Rock tree. Growth time 31s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_ROCK,
    growthTimeMs: 31000, growPixelRarity: 1, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#737b86', colorSecondary: '#454b55', colorAccent: '#aab3bf',
  },
  [ITEM_IDS.GP_SEED_LAVA]: {
    id: ITEM_IDS.GP_SEED_LAVA, key: 'gp_seed_lava', name: "Lava Seed",
    description: "Plant to grow a Lava tree. Growth time 31s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_LAVA,
    growthTimeMs: 31000, growPixelRarity: 1, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#d64a24', colorSecondary: '#782b1b', colorAccent: '#ff9a42',
  },
  [ITEM_IDS.GP_SEED_CAVE_BACKGROUND]: {
    id: ITEM_IDS.GP_SEED_CAVE_BACKGROUND, key: 'gp_seed_cave_background', name: "Cave Background Seed",
    description: "Plant to grow a Cave Background tree. Growth time 31s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_CAVE_BACKGROUND,
    growthTimeMs: 31000, growPixelRarity: 1, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#49372f', colorSecondary: '#2e241f', colorAccent: '#765846',
  },
  [ITEM_IDS.GP_SEED_SAND]: {
    id: ITEM_IDS.GP_SEED_SAND, key: 'gp_seed_sand', name: "Sand Seed",
    description: "Plant to grow a Sand tree. Growth time 31s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_SAND,
    growthTimeMs: 31000, growPixelRarity: 1, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#d9c17b', colorSecondary: '#a88d4d', colorAccent: '#f3e1a5',
  },
  [ITEM_IDS.GP_SEED_DOOR]: {
    id: ITEM_IDS.GP_SEED_DOOR, key: 'gp_seed_door', name: "Door Seed",
    description: "Plant to grow a Door tree. Growth time 1m 8s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_DOOR,
    growthTimeMs: 68000, growPixelRarity: 2, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#a76b3e', colorSecondary: '#694126', colorAccent: '#d99a62',
  },
  [ITEM_IDS.GP_SEED_GLASS_PANE]: {
    id: ITEM_IDS.GP_SEED_GLASS_PANE, key: 'gp_seed_glass_pane', name: "Glass Pane Seed",
    description: "Plant to grow a Glass Pane tree. Growth time 1m 8s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_GLASS_PANE,
    growthTimeMs: 68000, growPixelRarity: 2, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#a5e7f4', colorSecondary: '#5599b1', colorAccent: '#e8ffff',
  },
  [ITEM_IDS.GP_SEED_GRASS]: {
    id: ITEM_IDS.GP_SEED_GRASS, key: 'gp_seed_grass', name: "Grass Seed",
    description: "Plant to grow a Grass tree. Growth time 1m 8s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_GRASS,
    growthTimeMs: 68000, growPixelRarity: 2, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#4caa45', colorSecondary: '#2f7434', colorAccent: '#8add64',
  },
  [ITEM_IDS.GP_SEED_LAVA_ROCK]: {
    id: ITEM_IDS.GP_SEED_LAVA_ROCK, key: 'gp_seed_lava_rock', name: "Lava Rock Seed",
    description: "Plant to grow a Lava Rock tree. Growth time 1m 8s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_LAVA_ROCK,
    growthTimeMs: 68000, growPixelRarity: 2, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#8e3927', colorSecondary: '#4e241f', colorAccent: '#e66a3e',
  },
  [ITEM_IDS.GP_SEED_SIGN]: {
    id: ITEM_IDS.GP_SEED_SIGN, key: 'gp_seed_sign', name: "Sign Seed",
    description: "Plant to grow a Sign tree. Growth time 1m 8s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_SIGN,
    growthTimeMs: 68000, growPixelRarity: 2, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#b47c45', colorSecondary: '#6d4829', colorAccent: '#e1b67a',
  },
  [ITEM_IDS.GP_SEED_WOOD_BLOCK]: {
    id: ITEM_IDS.GP_SEED_WOOD_BLOCK, key: 'gp_seed_wood_block', name: "Wood Block Seed",
    description: "Plant to grow a Wood Block tree. Growth time 1m 8s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_WOOD_BLOCK,
    growthTimeMs: 68000, growPixelRarity: 2, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#9c6538', colorSecondary: '#624025', colorAccent: '#d39a60',
  },
  [ITEM_IDS.GP_SEED_BRICKS]: {
    id: ITEM_IDS.GP_SEED_BRICKS, key: 'gp_seed_bricks', name: "Bricks Seed",
    description: "Plant to grow a Bricks tree. Growth time 1m 57s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_BRICKS,
    growthTimeMs: 117000, growPixelRarity: 3, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#a65c4c', colorSecondary: '#683a35', colorAccent: '#d58c79',
  },
  [ITEM_IDS.GP_SEED_CRAPPY_SIGN]: {
    id: ITEM_IDS.GP_SEED_CRAPPY_SIGN, key: 'gp_seed_crappy_sign', name: "Crappy Sign Seed",
    description: "Plant to grow a Crappy Sign tree. Growth time 1m 57s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_CRAPPY_SIGN,
    growthTimeMs: 117000, growPixelRarity: 3, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#8d653d', colorSecondary: '#5c432b', colorAccent: '#c79b61',
  },
  [ITEM_IDS.GP_SEED_DAISY]: {
    id: ITEM_IDS.GP_SEED_DAISY, key: 'gp_seed_daisy', name: "Daisy Seed",
    description: "Plant to grow a Daisy tree. Growth time 1m 57s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_DAISY,
    growthTimeMs: 117000, growPixelRarity: 3, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#f2df56', colorSecondary: '#b89a2d', colorAccent: '#fff6a3',
  },
  [ITEM_IDS.GP_SEED_MUSHROOM]: {
    id: ITEM_IDS.GP_SEED_MUSHROOM, key: 'gp_seed_mushroom', name: "Mushroom Seed",
    description: "Plant to grow a Mushroom tree. Growth time 1m 57s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_MUSHROOM,
    growthTimeMs: 117000, growPixelRarity: 3, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#c35c4c', colorSecondary: '#713d39', colorAccent: '#f2b5a4',
  },
  [ITEM_IDS.GP_SEED_ROSE]: {
    id: ITEM_IDS.GP_SEED_ROSE, key: 'gp_seed_rose', name: "Rose Seed",
    description: "Plant to grow a Rose tree. Growth time 1m 57s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_ROSE,
    growthTimeMs: 117000, growPixelRarity: 3, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#c83d62', colorSecondary: '#76253f', colorAccent: '#ff9bb3',
  },
  [ITEM_IDS.GP_SEED_WHEAT]: {
    id: ITEM_IDS.GP_SEED_WHEAT, key: 'gp_seed_wheat', name: "Wheat Seed",
    description: "Plant to grow a Wheat tree. Growth time 1m 57s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_WHEAT,
    growthTimeMs: 117000, growPixelRarity: 3, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#d9b84c', colorSecondary: '#8d7130', colorAccent: '#f5e29a',
  },
  [ITEM_IDS.GP_SEED_WOODEN_PLATFORM]: {
    id: ITEM_IDS.GP_SEED_WOODEN_PLATFORM, key: 'gp_seed_wooden_platform', name: "Wooden Platform Seed",
    description: "Plant to grow a Wooden Platform tree. Growth time 3m 4s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_WOODEN_PLATFORM,
    growthTimeMs: 184000, growPixelRarity: 4, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#b77b45', colorSecondary: '#704723', colorAccent: '#e0ad70',
  },
  [ITEM_IDS.GP_SEED_BLACK_BLOCK]: {
    id: ITEM_IDS.GP_SEED_BLACK_BLOCK, key: 'gp_seed_black_block', name: "Black Block Seed",
    description: "Plant to grow a Black Block tree. Growth time 3m 4s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_BLACK_BLOCK,
    growthTimeMs: 184000, growPixelRarity: 4, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#34343c', colorSecondary: '#17171d', colorAccent: '#666675',
  },
  [ITEM_IDS.GP_SEED_BROWN_BLOCK]: {
    id: ITEM_IDS.GP_SEED_BROWN_BLOCK, key: 'gp_seed_brown_block', name: "Brown Block Seed",
    description: "Plant to grow a Brown Block tree. Growth time 3m 4s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_BROWN_BLOCK,
    growthTimeMs: 184000, growPixelRarity: 4, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#815239', colorSecondary: '#4f3024', colorAccent: '#bd8964',
  },
  [ITEM_IDS.GP_SEED_GREY_BLOCK]: {
    id: ITEM_IDS.GP_SEED_GREY_BLOCK, key: 'gp_seed_grey_block', name: "Grey Block Seed",
    description: "Plant to grow a Grey Block tree. Growth time 3m 4s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_GREY_BLOCK,
    growthTimeMs: 184000, growPixelRarity: 4, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#89909a', colorSecondary: '#535b65', colorAccent: '#c1c7ce',
  },
  [ITEM_IDS.GP_SEED_RED_BLOCK]: {
    id: ITEM_IDS.GP_SEED_RED_BLOCK, key: 'gp_seed_red_block', name: "Red Block Seed",
    description: "Plant to grow a Red Block tree. Growth time 3m 4s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_RED_BLOCK,
    growthTimeMs: 184000, growPixelRarity: 4, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#c43e43', colorSecondary: '#76252b', colorAccent: '#ff8588',
  },
  [ITEM_IDS.GP_SEED_AQUA_BLOCK]: {
    id: ITEM_IDS.GP_SEED_AQUA_BLOCK, key: 'gp_seed_aqua_block', name: "Aqua Block Seed",
    description: "Plant to grow an Aqua Block tree. Growth time 4m 35s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_AQUA_BLOCK,
    growthTimeMs: 275000, growPixelRarity: 5, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#42c9c5', colorSecondary: '#237a83', colorAccent: '#a1fff2',
  },
  [ITEM_IDS.GP_SEED_GREEN_BLOCK]: {
    id: ITEM_IDS.GP_SEED_GREEN_BLOCK, key: 'gp_seed_green_block', name: "Green Block Seed",
    description: "Plant to grow a Green Block tree. Growth time 4m 35s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_GREEN_BLOCK,
    growthTimeMs: 275000, growPixelRarity: 5, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#4eaa50', colorSecondary: '#286b35', colorAccent: '#a1e878',
  },
  [ITEM_IDS.GP_SEED_WHITE_BLOCK]: {
    id: ITEM_IDS.GP_SEED_WHITE_BLOCK, key: 'gp_seed_white_block', name: "White Block Seed",
    description: "Plant to grow a White Block tree. Growth time 6m 36s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_WHITE_BLOCK,
    growthTimeMs: 396000, growPixelRarity: 6, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#e8e8e0', colorSecondary: '#a6a69d', colorAccent: '#ffffff',
  },
  [ITEM_IDS.GP_SEED_WINDOW]: {
    id: ITEM_IDS.GP_SEED_WINDOW, key: 'gp_seed_window', name: "Window Seed",
    description: "Plant to grow a Window tree. Growth time 3m 4s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_WINDOW,
    growthTimeMs: 184000, growPixelRarity: 4, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#a5e7f4', colorSecondary: '#5599b1', colorAccent: '#e8ffff',
  },
  [ITEM_IDS.GP_SEED_YELLOW_BLOCK]: {
    id: ITEM_IDS.GP_SEED_YELLOW_BLOCK, key: 'gp_seed_yellow_block', name: "Yellow Block Seed",
    description: "Plant to grow a Yellow Block tree. Growth time 3m 4s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_YELLOW_BLOCK,
    growthTimeMs: 184000, growPixelRarity: 4, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#e5c747', colorSecondary: '#a58626', colorAccent: '#fff19a',
  },
  [ITEM_IDS.GP_SEED_GLASS_BLOCK]: {
    id: ITEM_IDS.GP_SEED_GLASS_BLOCK, key: 'gp_seed_glass_block', name: "Glass Block Seed",
    description: "Plant to grow a Glass Block tree. Growth time 9m 13s.",
    category: 'seed', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_GLASS_BLOCK,
    growthTimeMs: 553000, growPixelRarity: 7, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#8bd8e9', colorSecondary: '#3e879c', colorAccent: '#e4ffff',
  },
  [ITEM_IDS.GP_SEED_TOILET]: {
    id: ITEM_IDS.GP_SEED_TOILET, key: 'gp_seed_toilet', name: "Toilet Seed",
    description: "Plant to grow a Toilet tree. Growth time 6m 36s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_TOILET,
    growthTimeMs: 396000, growPixelRarity: 6, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#e8e9e7', colorSecondary: '#9fa4a7', colorAccent: '#ffffff',
  },
  [ITEM_IDS.GP_SEED_RED_BRICKS]: {
    id: ITEM_IDS.GP_SEED_RED_BRICKS, key: 'gp_seed_red_bricks', name: "Red Bricks Seed",
    description: "Plant to grow a Red Bricks tree. Growth time 9m 13s.",
    category: 'seed', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_RED_BRICKS,
    growthTimeMs: 553000, growPixelRarity: 7, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#a94740', colorSecondary: '#682b2a', colorAccent: '#e17c6f',
  },
  [ITEM_IDS.GP_SEED_DEATH_SPIKES]: {
    id: ITEM_IDS.GP_SEED_DEATH_SPIKES, key: 'gp_seed_death_spikes', name: "Death Spikes Seed",
    description: "Plant to grow a Death Spikes tree. Growth time 12m 32s.",
    category: 'seed', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_DEATH_SPIKES,
    growthTimeMs: 752000, growPixelRarity: 8, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#55515c', colorSecondary: '#25232b', colorAccent: '#ff6464',
  },
  [ITEM_IDS.GP_SEED_DUNGEON_DOOR]: {
    id: ITEM_IDS.GP_SEED_DUNGEON_DOOR, key: 'gp_seed_dungeon_door', name: "Dungeon Door Seed",
    description: "Plant to grow a Dungeon Door tree. Growth time 12m 32s.",
    category: 'seed', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_DUNGEON_DOOR,
    growthTimeMs: 752000, growPixelRarity: 8, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#665247', colorSecondary: '#342a27', colorAccent: '#b48c6e',
  },
  [ITEM_IDS.GP_SEED_BUSH]: {
    id: ITEM_IDS.GP_SEED_BUSH, key: 'gp_seed_bush', name: "Bush Seed",
    description: "Plant to grow a Bush tree. Growth time 16m 39s.",
    category: 'seed', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_BUSH,
    growthTimeMs: 999000, growPixelRarity: 9, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, bonusHarvestDrops: [{ itemId: ITEM_IDS.GP_HEDGE, chance: 0.2, minQty: 1, maxQty: 1 }], bonusHarvestDropsVerified: false, colorPrimary: '#3e9148', colorSecondary: '#235a32', colorAccent: '#8bd66c',
  },
  [ITEM_IDS.GP_SEED_HEDGE]: {
    id: ITEM_IDS.GP_SEED_HEDGE, key: 'gp_seed_hedge', name: "Hedge Seed",
    description: "Plant to grow a Hedge tree. Growth time 16m 39s.",
    category: 'seed', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_HEDGE,
    growthTimeMs: 999000, growPixelRarity: 9, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#347c3e', colorSecondary: '#1d4e2b', colorAccent: '#74bd5c',
  },
  [ITEM_IDS.GP_SEED_ORANGE_BLOCK]: {
    id: ITEM_IDS.GP_SEED_ORANGE_BLOCK, key: 'gp_seed_orange_block', name: "Orange Block Seed",
    description: "Plant to grow an Orange Block tree. Growth time 16m 39s.",
    category: 'seed', rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_ORANGE_BLOCK,
    growthTimeMs: 999000, growPixelRarity: 9, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#e68a32', colorSecondary: '#985020', colorAccent: '#ffc16c',
  },
  [ITEM_IDS.GP_SEED_BLUE_BLOCK]: {
    id: ITEM_IDS.GP_SEED_BLUE_BLOCK, key: 'gp_seed_blue_block', name: "Blue Block Seed",
    description: "Plant to grow a Blue Block tree. Growth time 63m 45s.",
    category: 'seed', rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 4, producesTileId: ITEM_IDS.GP_BLUE_BLOCK,
    growthTimeMs: 3825000, growPixelRarity: 15, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#438ad5', colorSecondary: '#254b8b', colorAccent: '#a6d8ff',
  },
  [ITEM_IDS.GP_SEED_POPPY]: {
    id: ITEM_IDS.GP_SEED_POPPY, key: 'gp_seed_poppy', name: "Poppy Seed",
    description: "Plant to grow a Poppy tree. Growth time 6m 36s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_POPPY,
    growthTimeMs: 396000, growPixelRarity: 6, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#e34b63', colorSecondary: '#87283f', colorAccent: '#ff9cab',
  },
  [ITEM_IDS.GP_SEED_WOODEN_BACKGROUND]: {
    id: ITEM_IDS.GP_SEED_WOODEN_BACKGROUND, key: 'gp_seed_wooden_background', name: "Wooden Background Seed",
    description: "Plant to grow a Wooden Background tree. Growth time 3m 4s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_WOODEN_BACKGROUND,
    growthTimeMs: 184000, growPixelRarity: 4, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#795332', colorSecondary: '#4b321f', colorAccent: '#bd8b59',
  },
  [ITEM_IDS.GP_SEED_ROCK_BACKGROUND]: {
    id: ITEM_IDS.GP_SEED_ROCK_BACKGROUND, key: 'gp_seed_rock_background', name: "Rock Background Seed",
    description: "Plant to grow a Rock Background tree. Growth time 1m 57s.",
    category: 'seed', rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_ROCK_BACKGROUND,
    growthTimeMs: 117000, growPixelRarity: 3, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#555d68', colorSecondary: '#303640', colorAccent: '#8994a4',
  },
  [ITEM_IDS.GP_SEED_POINTY_SIGN]: {
    id: ITEM_IDS.GP_SEED_POINTY_SIGN, key: 'gp_seed_pointy_sign', name: "Pointy Sign Seed",
    description: "Plant to grow a Pointy Sign tree. Growth time 3m 4s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.GP_POINTY_SIGN,
    growthTimeMs: 184000, growPixelRarity: 4, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#b47c45', colorSecondary: '#6d4829', colorAccent: '#e1b67a',
  },
  [ITEM_IDS.GP_SEED_DANGER_SIGN]: {
    id: ITEM_IDS.GP_SEED_DANGER_SIGN, key: 'gp_seed_danger_sign', name: "Danger Sign Seed",
    description: "Plant to grow a Danger Sign tree. Growth time 4m 35s.",
    category: 'seed', rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.GP_DANGER_SIGN,
    growthTimeMs: 275000, growPixelRarity: 5, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#d45a37', colorSecondary: '#7d3025', colorAccent: '#ffb15f',
  },
  [ITEM_IDS.GP_SEED_BLUEBERRY]: {
    id: ITEM_IDS.GP_SEED_BLUEBERRY, key: 'gp_seed_blueberry', name: "Blueberry Seed",
    description: "Plant to grow a Blueberry tree. Growth time 34m 48s.",
    category: 'seed', rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true,
    gemValue: 0, xpValue: 3, producesTileId: ITEM_IDS.GP_BLUEBERRY,
    growthTimeMs: 2088000, growPixelRarity: 12, seedDropChance: null,
    economyValue: null, treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 }, treeHarvestYieldVerified: false, colorPrimary: '#3d68b8', colorSecondary: '#263c75', colorAccent: '#91b6ff',
  },

  // --- Biome Tech Tree Seeds (750..774) & Fluid/Parkour Seeds (780..782) ---
  [ITEM_IDS.SEED_DESERT_SAND]: {
    id: ITEM_IDS.SEED_DESERT_SAND, key: 'seed_desert_sand', name: 'Desert Sand Seed',
    description: 'Plant to grow Desert Sand. Spliced from Sand + Dirt.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 1, producesTileId: ITEM_IDS.DESERT_SAND,
    growthTimeMs: 36000, biomeBranch: 'desert', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.GP_SEED_SAND, ITEM_IDS.GP_SEED_DIRT],
    colorPrimary: '#e6c477', colorSecondary: '#ad8745', colorAccent: '#f7e5a9',
  },
  [ITEM_IDS.SEED_RED_SANDSTONE]: {
    id: ITEM_IDS.SEED_RED_SANDSTONE, key: 'seed_red_sandstone', name: 'Red Sandstone Seed',
    description: 'Plant to grow Red Sandstone. Spliced from Desert Sand + Rock.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.RED_SANDSTONE,
    growthTimeMs: 65000, biomeBranch: 'desert', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_DESERT_SAND, ITEM_IDS.GP_SEED_ROCK],
    colorPrimary: '#b96d45', colorSecondary: '#79442f', colorAccent: '#e6a078',
  },
  [ITEM_IDS.SEED_DESERT_HARDPAN]: {
    id: ITEM_IDS.SEED_DESERT_HARDPAN, key: 'seed_desert_hardpan', name: 'Desert Hardpan Seed',
    description: 'Plant to grow Desert Hardpan. Spliced from Desert Sand + Cave Background.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.DESERT_HARDPAN,
    growthTimeMs: 65000, biomeBranch: 'desert', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_DESERT_SAND, ITEM_IDS.GP_SEED_CAVE_BACKGROUND],
    colorPrimary: '#b69a63', colorSecondary: '#75613f', colorAccent: '#ddc58e',
  },
  [ITEM_IDS.SEED_SALT_CRUST]: {
    id: ITEM_IDS.SEED_SALT_CRUST, key: 'seed_salt_crust', name: 'Salt Crust Seed',
    description: 'Plant to grow Salt Crust. Spliced from Desert Hardpan + White Block.',
    category: 'seed', rarity: 'uncommon', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 3, producesTileId: ITEM_IDS.SALT_CRUST,
    growthTimeMs: 98000, biomeBranch: 'desert', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_DESERT_HARDPAN, ITEM_IDS.GP_SEED_WHITE_BLOCK],
    colorPrimary: '#e7e2cf', colorSecondary: '#aaa38e', colorAccent: '#fffbed',
  },
  [ITEM_IDS.SEED_DUNE_GRASS]: {
    id: ITEM_IDS.SEED_DUNE_GRASS, key: 'seed_dune_grass', name: 'Dune Grass Seed',
    description: 'Plant to grow Dune Grass. Spliced from Desert Sand + Grass.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.DUNE_GRASS,
    growthTimeMs: 65000, biomeBranch: 'desert', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_DESERT_SAND, ITEM_IDS.GP_SEED_GRASS],
    colorPrimary: '#a9a04f', colorSecondary: '#656532', colorAccent: '#d3c978',
  },
  [ITEM_IDS.SEED_CACTUS]: {
    id: ITEM_IDS.SEED_CACTUS, key: 'seed_cactus', name: 'Desert Cactus Seed',
    description: 'Plant to grow Desert Cactus. Spliced from Dune Grass + Green Block.',
    category: 'seed', rarity: 'uncommon', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 3, producesTileId: ITEM_IDS.CACTUS,
    growthTimeMs: 98000, biomeBranch: 'desert', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_DUNE_GRASS, ITEM_IDS.GP_SEED_GREEN_BLOCK],
    colorPrimary: '#4f9b55', colorSecondary: '#28613b', colorAccent: '#9cdb79',
  },
  [ITEM_IDS.SEED_DRY_ROOT]: {
    id: ITEM_IDS.SEED_DRY_ROOT, key: 'seed_dry_root', name: 'Dry Root Seed',
    description: 'Plant to grow Dry Root. Spliced from Desert Sand + Wood Block.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.DRY_ROOT,
    growthTimeMs: 65000, biomeBranch: 'desert', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_DESERT_SAND, ITEM_IDS.GP_SEED_WOOD_BLOCK],
    colorPrimary: '#987044', colorSecondary: '#5b422e', colorAccent: '#c79c63',
  },
  [ITEM_IDS.SEED_DESERT_GRAVEL]: {
    id: ITEM_IDS.SEED_DESERT_GRAVEL, key: 'seed_desert_gravel', name: 'Desert Gravel Seed',
    description: 'Plant to grow Desert Gravel. Spliced from Red Sandstone + Sand.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.DESERT_GRAVEL,
    growthTimeMs: 65000, biomeBranch: 'desert', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_RED_SANDSTONE, ITEM_IDS.GP_SEED_SAND],
    colorPrimary: '#aa987a', colorSecondary: '#6d6252', colorAccent: '#d5c3a0',
  },
  [ITEM_IDS.SEED_FROST_SNOW]: {
    id: ITEM_IDS.SEED_FROST_SNOW, key: 'seed_frost_snow', name: 'Powder Snow Seed',
    description: 'Plant to grow Powder Snow. Spliced from Glass Pane + Sand.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.FROST_SNOW,
    growthTimeMs: 42000, biomeBranch: 'arctic', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.GP_SEED_GLASS_PANE, ITEM_IDS.GP_SEED_SAND],
    colorPrimary: '#e9f5ff', colorSecondary: '#b5d2e5', colorAccent: '#ffffff',
  },
  [ITEM_IDS.SEED_PACKED_SNOW]: {
    id: ITEM_IDS.SEED_PACKED_SNOW, key: 'seed_packed_snow', name: 'Packed Snow Seed',
    description: 'Plant to grow Packed Snow. Spliced from Powder Snow + Dirt.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.PACKED_SNOW,
    growthTimeMs: 68000, biomeBranch: 'arctic', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_FROST_SNOW, ITEM_IDS.GP_SEED_DIRT],
    colorPrimary: '#c8e3f2', colorSecondary: '#88b5cc', colorAccent: '#f0fbff',
  },
  [ITEM_IDS.SEED_GLACIER_ICE]: {
    id: ITEM_IDS.SEED_GLACIER_ICE, key: 'seed_glacier_ice', name: 'Glacier Ice Seed',
    description: 'Plant to grow slick Glacier Ice. Spliced from Packed Snow + Glass Block.',
    category: 'seed', rarity: 'uncommon', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 3, producesTileId: ITEM_IDS.GLACIER_ICE,
    growthTimeMs: 110000, biomeBranch: 'arctic', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_PACKED_SNOW, ITEM_IDS.GP_SEED_GLASS_BLOCK],
    colorPrimary: '#86c7de', colorSecondary: '#477f9d', colorAccent: '#d5f8ff',
  },
  [ITEM_IDS.SEED_PERMAFROST]: {
    id: ITEM_IDS.SEED_PERMAFROST, key: 'seed_permafrost', name: 'Permafrost Seed',
    description: 'Plant to grow Permafrost. Spliced from Powder Snow + Rock.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.PERMAFROST,
    growthTimeMs: 74000, biomeBranch: 'arctic', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_FROST_SNOW, ITEM_IDS.GP_SEED_ROCK],
    colorPrimary: '#879c9c', colorSecondary: '#53686c', colorAccent: '#c2d4d0',
  },
  [ITEM_IDS.SEED_FROZEN_DIRT]: {
    id: ITEM_IDS.SEED_FROZEN_DIRT, key: 'seed_frozen_dirt', name: 'Frozen Tundra Seed',
    description: 'Plant to grow Frozen Tundra Soil. Spliced from Permafrost + Dirt.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.FROZEN_DIRT,
    growthTimeMs: 74000, biomeBranch: 'arctic', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_PERMAFROST, ITEM_IDS.GP_SEED_DIRT],
    colorPrimary: '#786d60', colorSecondary: '#4a4744', colorAccent: '#aaa08f',
  },
  [ITEM_IDS.SEED_BLUE_ICE]: {
    id: ITEM_IDS.SEED_BLUE_ICE, key: 'seed_blue_ice', name: 'Blue Ice Seed',
    description: 'Plant to grow ultra-slick Blue Ice. Spliced from Glacier Ice + Aqua Block.',
    category: 'seed', rarity: 'rare', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 5, producesTileId: ITEM_IDS.BLUE_ICE,
    growthTimeMs: 185000, biomeBranch: 'arctic', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_GLACIER_ICE, ITEM_IDS.GP_SEED_AQUA_BLOCK],
    colorPrimary: '#4b9fc9', colorSecondary: '#245c88', colorAccent: '#a4e7ff',
  },
  [ITEM_IDS.SEED_FROST_ROCK]: {
    id: ITEM_IDS.SEED_FROST_ROCK, key: 'seed_frost_rock', name: 'Frost Rock Seed',
    description: 'Plant to grow Frost Rock. Spliced from Glacier Ice + Rock.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.FROST_ROCK,
    growthTimeMs: 85000, biomeBranch: 'arctic', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_GLACIER_ICE, ITEM_IDS.GP_SEED_ROCK],
    colorPrimary: '#788995', colorSecondary: '#46545e', colorAccent: '#b9cad2',
  },
  [ITEM_IDS.SEED_ICICLE]: {
    id: ITEM_IDS.SEED_ICICLE, key: 'seed_icicle', name: 'Icicle Seed',
    description: 'Plant to grow Icicles. Spliced from Glacier Ice + Window.',
    category: 'seed', rarity: 'uncommon', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 3, producesTileId: ITEM_IDS.ICICLE,
    growthTimeMs: 110000, biomeBranch: 'arctic', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_GLACIER_ICE, ITEM_IDS.GP_SEED_WINDOW],
    colorPrimary: '#b9e7f4', colorSecondary: '#6fa8bd', colorAccent: '#efffff',
  },
  [ITEM_IDS.SEED_CAVE_LIMESTONE]: {
    id: ITEM_IDS.SEED_CAVE_LIMESTONE, key: 'seed_cave_limestone', name: 'Cave Limestone Seed',
    description: 'Plant to grow Cave Limestone. Spliced from Cave Background + Rock.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.CAVE_LIMESTONE,
    growthTimeMs: 50000, biomeBranch: 'cave', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.GP_SEED_CAVE_BACKGROUND, ITEM_IDS.GP_SEED_ROCK],
    colorPrimary: '#b6ad91', colorSecondary: '#746d5a', colorAccent: '#e3dcc1',
  },
  [ITEM_IDS.SEED_CAVE_SHALE]: {
    id: ITEM_IDS.SEED_CAVE_SHALE, key: 'seed_cave_shale', name: 'Cave Shale Seed',
    description: 'Plant to grow Cave Shale. Spliced from Cave Limestone + Rock Background.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.CAVE_SHALE,
    growthTimeMs: 68000, biomeBranch: 'cave', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_CAVE_LIMESTONE, ITEM_IDS.GP_SEED_ROCK_BACKGROUND],
    colorPrimary: '#657078', colorSecondary: '#3d454c', colorAccent: '#9aa8ad',
  },
  [ITEM_IDS.SEED_CAVE_GRAVEL]: {
    id: ITEM_IDS.SEED_CAVE_GRAVEL, key: 'seed_cave_gravel', name: 'Cave Gravel Seed',
    description: 'Plant to grow Cave Gravel. Spliced from Cave Limestone + Sand.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.CAVE_GRAVEL,
    growthTimeMs: 62000, biomeBranch: 'cave', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_CAVE_LIMESTONE, ITEM_IDS.GP_SEED_SAND],
    colorPrimary: '#8e8173', colorSecondary: '#554d47', colorAccent: '#c2b4a2',
  },
  [ITEM_IDS.SEED_GRANITE]: {
    id: ITEM_IDS.SEED_GRANITE, key: 'seed_granite', name: 'Granite Seed',
    description: 'Plant to grow Granite. Spliced from Cave Shale + Lava Rock.',
    category: 'seed', rarity: 'uncommon', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 3, producesTileId: ITEM_IDS.GRANITE,
    growthTimeMs: 112000, biomeBranch: 'cave', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_CAVE_SHALE, ITEM_IDS.GP_SEED_LAVA_ROCK],
    colorPrimary: '#9a8580', colorSecondary: '#5f5353', colorAccent: '#c8b6ae',
  },
  [ITEM_IDS.SEED_STALACTITE]: {
    id: ITEM_IDS.SEED_STALACTITE, key: 'seed_stalactite', name: 'Stalactite Seed',
    description: 'Plant to grow Stalactites. Spliced from Cave Limestone + Pointy Sign.',
    category: 'seed', rarity: 'uncommon', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 3, producesTileId: ITEM_IDS.STALACTITE,
    growthTimeMs: 112000, biomeBranch: 'cave', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_CAVE_LIMESTONE, ITEM_IDS.GP_SEED_POINTY_SIGN],
    colorPrimary: '#b7aa8b', colorSecondary: '#786e58', colorAccent: '#e6d8b8',
  },
  [ITEM_IDS.SEED_STALAGMITE]: {
    id: ITEM_IDS.SEED_STALAGMITE, key: 'seed_stalagmite', name: 'Stalagmite Seed',
    description: 'Plant to grow Stalagmites. Spliced from Cave Shale + Pointy Sign.',
    category: 'seed', rarity: 'uncommon', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 3, producesTileId: ITEM_IDS.STALAGMITE,
    growthTimeMs: 112000, biomeBranch: 'cave', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_CAVE_SHALE, ITEM_IDS.GP_SEED_POINTY_SIGN],
    colorPrimary: '#aa9b7a', colorSecondary: '#6a5f49', colorAccent: '#dfcca3',
  },
  [ITEM_IDS.SEED_CRYSTAL_ORE]: {
    id: ITEM_IDS.SEED_CRYSTAL_ORE, key: 'seed_crystal_ore', name: 'Crystal Ore Seed',
    description: 'Plant to grow Crystal Ore. Spliced from Granite + Aqua Block.',
    category: 'seed', rarity: 'rare', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 5, producesTileId: ITEM_IDS.CRYSTAL_ORE,
    growthTimeMs: 190000, biomeBranch: 'cave', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_GRANITE, ITEM_IDS.GP_SEED_AQUA_BLOCK],
    colorPrimary: '#8d79ce', colorSecondary: '#51427f', colorAccent: '#d7c8ff',
  },
  [ITEM_IDS.SEED_UNDERGROUND_CLAY]: {
    id: ITEM_IDS.SEED_UNDERGROUND_CLAY, key: 'seed_underground_clay', name: 'Cave Clay Seed',
    description: 'Plant to grow Cave Clay. Spliced from Cave Gravel + Dirt.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.UNDERGROUND_CLAY,
    growthTimeMs: 68000, biomeBranch: 'cave', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_CAVE_GRAVEL, ITEM_IDS.GP_SEED_DIRT],
    colorPrimary: '#a56f5d', colorSecondary: '#69473f', colorAccent: '#d7a18b',
  },
  [ITEM_IDS.SEED_CAVE_BACKGROUND_WALL]: {
    id: ITEM_IDS.SEED_CAVE_BACKGROUND_WALL, key: 'seed_cave_background_wall', name: 'Rugged Cave Wall Seed',
    description: 'Plant to grow Rugged Cave Walls. Spliced from Cave Background + Wood Block.',
    category: 'seed', rarity: 'common', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 2, producesTileId: ITEM_IDS.CAVE_BACKGROUND_WALL,
    growthTimeMs: 68000, biomeBranch: 'cave', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.GP_SEED_CAVE_BACKGROUND, ITEM_IDS.GP_SEED_WOOD_BLOCK],
    colorPrimary: '#554e4b', colorSecondary: '#302d2c', colorAccent: '#82756b',
  },
  [ITEM_IDS.SEED_WATER_SOURCE]: {
    id: ITEM_IDS.SEED_WATER_SOURCE, key: 'seed_water_source', name: 'Water Essence Seed',
    description: 'Plant to harvest Water Sources. Spliced from Glacier Ice + Glass Pane.',
    category: 'seed', rarity: 'uncommon', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 4, producesTileId: ITEM_IDS.WATER_SOURCE,
    growthTimeMs: 95000, biomeBranch: 'tech', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_GLACIER_ICE, ITEM_IDS.GP_SEED_GLASS_PANE],
    colorPrimary: '#38a8eb', colorSecondary: '#1d69a8', colorAccent: '#b8f3ff',
  },
  [ITEM_IDS.SEED_ACID_SOURCE]: {
    id: ITEM_IDS.SEED_ACID_SOURCE, key: 'seed_acid_source', name: 'Acid Essence Seed',
    description: 'Plant to harvest Acid Vats. Spliced from Water Essence + Danger Sign.',
    category: 'seed', rarity: 'rare', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 5, producesTileId: ITEM_IDS.ACID_SOURCE,
    growthTimeMs: 135000, biomeBranch: 'tech', treeHarvestYield: { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.SEED_WATER_SOURCE, ITEM_IDS.GP_SEED_DANGER_SIGN],
    colorPrimary: '#63d93b', colorSecondary: '#2d7a1d', colorAccent: '#d2ff8c',
  },
  [ITEM_IDS.SEED_BOUNCE_PAD]: {
    id: ITEM_IDS.SEED_BOUNCE_PAD, key: 'seed_bounce_pad', name: 'Bounce Pad Seed',
    description: 'Plant to harvest Bounce Pads. Spliced from Wooden Platform + Mushroom.',
    category: 'seed', rarity: 'uncommon', stackLimit: 200, collision: 'none', breakable: true, hardness: 1,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 4, producesTileId: ITEM_IDS.BOUNCE_PAD,
    growthTimeMs: 110000, biomeBranch: 'tech', treeHarvestYield: { minBlocks: 1, maxBlocks: 2, seedChance: 0.65 },
    spliceIngredients: [ITEM_IDS.GP_SEED_WOODEN_PLATFORM, ITEM_IDS.GP_SEED_MUSHROOM],
    colorPrimary: '#e67e32', colorSecondary: '#6b3e24', colorAccent: '#ffe38c',
  },
  [ITEM_IDS.GATE_KEY_I]: {
    id: ITEM_IDS.GATE_KEY_I, key: 'station_gate_key_i', name: 'Station Gate Key I',
    description: 'Opens a Tier I Station dungeon expedition. Consumed when the expedition is created.',
    category: 'material', rarity: 'common', stackLimit: 20,
    collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 0, colorPrimary: '#b9a16a', colorSecondary: '#6b5633', colorAccent: '#f4d98b',
  },
  [ITEM_IDS.GATE_KEY_II]: {
    id: ITEM_IDS.GATE_KEY_II, key: 'station_gate_key_ii', name: 'Station Gate Key II',
    description: 'Opens a Tier II Station dungeon expedition. Consumed when the expedition is created.',
    category: 'material', rarity: 'uncommon', stackLimit: 20,
    collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 0, colorPrimary: '#8c9eaa', colorSecondary: '#425866', colorAccent: '#d7efff',
  },
  [ITEM_IDS.GATE_KEY_III]: {
    id: ITEM_IDS.GATE_KEY_III, key: 'station_gate_key_iii', name: 'Station Gate Key III',
    description: 'Opens a Tier III Station dungeon expedition. Consumed when the expedition is created.',
    category: 'material', rarity: 'rare', stackLimit: 20,
    collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 0, colorPrimary: '#4e9a78', colorSecondary: '#245944', colorAccent: '#9bf2c1',
  },
  [ITEM_IDS.GATE_KEY_IV]: {
    id: ITEM_IDS.GATE_KEY_IV, key: 'station_gate_key_iv', name: 'Station Gate Key IV',
    description: 'Opens a Tier IV Station dungeon expedition. Consumed when the expedition is created.',
    category: 'material', rarity: 'epic', stackLimit: 20,
    collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 0, colorPrimary: '#8361bb', colorSecondary: '#49326e', colorAccent: '#d2b8ff',
  },
  [ITEM_IDS.GATE_KEY_V]: {
    id: ITEM_IDS.GATE_KEY_V, key: 'station_gate_key_v', name: 'Station Gate Key V',
    description: 'Opens a Tier V Station dungeon expedition. Consumed when the expedition is created.',
    category: 'material', rarity: 'epic', stackLimit: 20,
    collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: false,
    gemValue: 0, xpValue: 0, colorPrimary: '#d28c3b', colorSecondary: '#75451e', colorAccent: '#ffe0a0',
  },

  [ITEM_IDS.RAW_COAL_ORE]: {
    id: ITEM_IDS.RAW_COAL_ORE, key: 'raw_coal_ore', name: 'Raw Coal Ore', description: 'Unrefined Coal recovered from dungeon deposits.',
    category: 'material', rarity: 'common', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#555b63', colorSecondary: '#292e35', colorAccent: '#9aa3ad',
  },
  [ITEM_IDS.RAW_COPPER_ORE]: {
    id: ITEM_IDS.RAW_COPPER_ORE, key: 'raw_copper_ore', name: 'Raw Copper Ore', description: 'Unrefined Copper recovered from dungeon deposits.',
    category: 'material', rarity: 'common', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#b87545', colorSecondary: '#75452f', colorAccent: '#e8b17a',
  },
  [ITEM_IDS.RAW_IRON_ORE]: {
    id: ITEM_IDS.RAW_IRON_ORE, key: 'raw_iron_ore', name: 'Raw Iron Ore', description: 'Unrefined Iron recovered from dungeon deposits.',
    category: 'material', rarity: 'common', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#8c949b', colorSecondary: '#4d555e', colorAccent: '#d2d9df',
  },
  [ITEM_IDS.RAW_SILVER_ORE]: {
    id: ITEM_IDS.RAW_SILVER_ORE, key: 'raw_silver_ore', name: 'Raw Silver Ore', description: 'Unrefined Silver recovered from dungeon deposits.',
    category: 'material', rarity: 'uncommon', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#a9bac5', colorSecondary: '#647987', colorAccent: '#eef7ff',
  },
  [ITEM_IDS.RAW_GOLD_ORE]: {
    id: ITEM_IDS.RAW_GOLD_ORE, key: 'raw_gold_ore', name: 'Raw Gold Ore', description: 'Unrefined Gold recovered from dungeon deposits.',
    category: 'material', rarity: 'uncommon', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#d2a33d', colorSecondary: '#806020', colorAccent: '#ffe89a',
  },
  [ITEM_IDS.RAW_DIAMOND_ORE]: {
    id: ITEM_IDS.RAW_DIAMOND_ORE, key: 'raw_diamond_ore', name: 'Raw Diamond Ore', description: 'Unrefined Diamond recovered from dungeon deposits.',
    category: 'material', rarity: 'rare', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#5ec9d7', colorSecondary: '#276e85', colorAccent: '#c4fbff',
  },
  [ITEM_IDS.RAW_RUBIDRITE_ORE]: {
    id: ITEM_IDS.RAW_RUBIDRITE_ORE, key: 'raw_rubidrite_ore', name: 'Raw Rubidrite Ore', description: 'Unrefined Rubidrite recovered from dungeon deposits.',
    category: 'material', rarity: 'rare', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#bd4e6a', colorSecondary: '#70283d', colorAccent: '#ffb1c6',
  },
  [ITEM_IDS.RAW_EMERALDAZYTE_ORE]: {
    id: ITEM_IDS.RAW_EMERALDAZYTE_ORE, key: 'raw_emeraldazyte_ore', name: 'Raw Emeraldazyte Ore', description: 'Unrefined Emeraldazyte recovered from dungeon deposits.',
    category: 'material', rarity: 'rare', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#36a978', colorSecondary: '#1e6147', colorAccent: '#9affc7',
  },
  [ITEM_IDS.RAW_OBSIDIUM_ORE]: {
    id: ITEM_IDS.RAW_OBSIDIUM_ORE, key: 'raw_obsidium_ore', name: 'Raw Obsidium Ore', description: 'Unrefined Obsidium recovered from dungeon deposits.',
    category: 'material', rarity: 'epic', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#665a88', colorSecondary: '#30283f', colorAccent: '#c7b4ff',
  },
  [ITEM_IDS.RAW_DIVINIUM_ORE]: {
    id: ITEM_IDS.RAW_DIVINIUM_ORE, key: 'raw_divinium_ore', name: 'Raw Divinium Ore', description: 'Unrefined Divinium recovered from dungeon deposits.',
    category: 'material', rarity: 'epic', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#4d8fc0', colorSecondary: '#294d78', colorAccent: '#b1e1ff',
  },
  [ITEM_IDS.RAW_MYTHRILYTE_ORE]: {
    id: ITEM_IDS.RAW_MYTHRILYTE_ORE, key: 'raw_mythrilyte_ore', name: 'Raw Mythrilyte Ore', description: 'Unrefined Mythrilyte recovered from dungeon deposits.',
    category: 'material', rarity: 'epic', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#9b74c9', colorSecondary: '#51366e', colorAccent: '#e2c9ff',
  },
  [ITEM_IDS.RAW_OMEGAZYTE_ORE]: {
    id: ITEM_IDS.RAW_OMEGAZYTE_ORE, key: 'raw_omegazyte_ore', name: 'Raw Omegazyte Ore', description: 'Unrefined Omegazyte recovered from dungeon deposits.',
    category: 'material', rarity: 'epic', stackLimit: 999, collision: 'none', breakable: false, hardness: 0, placeable: false, tradeable: true, gemValue: 0, xpValue: 0,
    colorPrimary: '#d17c39', colorSecondary: '#79411d', colorAccent: '#ffe0a5',
  },

  // ============================================================================
  // AGRICULTURAL MACHINERY & GROWBOX CONTAINERS (550..555)
  // ============================================================================
  [ITEM_IDS.SEED_POT]: {
    id: ITEM_IDS.SEED_POT, key: 'seed_pot', name: 'Seed Pot / Growbox',
    description: 'Specialized terracotta agricultural planter. Strictly required to plant any farmable seed (1 seed per pot).',
    category: 'interactive', rarity: 'uncommon', stackLimit: 200,
    collision: 'platform', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 100, xpValue: 5,
    storePrice: 500,
    drops: [{ itemId: ITEM_IDS.SEED_POT, chance: 1.0, minQty: 1, maxQty: 1 }],
    colorPrimary: '#b45309', colorSecondary: '#78350f', colorAccent: '#f59e0b',
  },
  [ITEM_IDS.MATTERAGEN_BOTANICAL]: {
    id: ITEM_IDS.MATTERAGEN_BOTANICAL, key: 'matteragen_botanical', name: 'Botanical Matteragen Engine',
    description: 'Gen 1 Synthesizer (Farmables 1–6, 10m cycle). Upgrades reduce cycle time by 5% per level. Interact to claim yield.',
    category: 'interactive', rarity: 'rare', stackLimit: 500,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 250, xpValue: 15,
    drops: [{ itemId: ITEM_IDS.MATTERAGEN_BOTANICAL, chance: 1.0, minQty: 1, maxQty: 1 }],
    colorPrimary: '#15803d', colorSecondary: '#166534', colorAccent: '#4ade80',
  },
  [ITEM_IDS.MATTERAGEN_GEOMINERAL]: {
    id: ITEM_IDS.MATTERAGEN_GEOMINERAL, key: 'matteragen_geomineral', name: 'Geomineral Matteragen Engine',
    description: 'Gen 2 Synthesizer (Farmables 3–14, 30m cycle). Upgrades reduce cycle time by 5% per level. Interact to claim yield.',
    category: 'interactive', rarity: 'rare', stackLimit: 500,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 350, xpValue: 20,
    drops: [{ itemId: ITEM_IDS.MATTERAGEN_GEOMINERAL, chance: 1.0, minQty: 1, maxQty: 1 }],
    colorPrimary: '#b45309', colorSecondary: '#78350f', colorAccent: '#fde047',
  },
  [ITEM_IDS.MATTERAGEN_LUMINESCENT]: {
    id: ITEM_IDS.MATTERAGEN_LUMINESCENT, key: 'matteragen_luminescent', name: 'Luminescent Matteragen Engine',
    description: 'Gen 3 Synthesizer (Farmables 6–16, 1h cycle). Upgrades reduce cycle time by 5% per level. Interact to claim yield.',
    category: 'interactive', rarity: 'rare', stackLimit: 500,
    collision: 'solid', breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 500, xpValue: 25,
    drops: [{ itemId: ITEM_IDS.MATTERAGEN_LUMINESCENT, chance: 1.0, minQty: 1, maxQty: 1 }],
    colorPrimary: '#0284c7', colorSecondary: '#0369a1', colorAccent: '#38bdf8',
  },
  [ITEM_IDS.MATTERAGEN_ARCANE]: {
    id: ITEM_IDS.MATTERAGEN_ARCANE, key: 'matteragen_arcane', name: 'Arcane Matteragen Engine',
    description: 'Gen 4 Synthesizer (Farmables 8–20, 2h cycle). Upgrades reduce cycle time by 5% per level. Interact to claim yield.',
    category: 'interactive', rarity: 'epic', stackLimit: 500,
    collision: 'solid', breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 750, xpValue: 35,
    drops: [{ itemId: ITEM_IDS.MATTERAGEN_ARCANE, chance: 1.0, minQty: 1, maxQty: 1 }],
    colorPrimary: '#7e22ce', colorSecondary: '#581c87', colorAccent: '#d8b4fe',
  },
  [ITEM_IDS.MATTERAGEN_COSMIC]: {
    id: ITEM_IDS.MATTERAGEN_COSMIC, key: 'matteragen_cosmic', name: 'Cosmic Matteragen Engine',
    description: 'Gen 5 Synthesizer (Farmables 10–30, 5h cycle). Upgrades reduce cycle time by 5% per level. Interact to claim yield.',
    category: 'interactive', rarity: 'epic', stackLimit: 500,
    collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 1200, xpValue: 50,
    drops: [{ itemId: ITEM_IDS.MATTERAGEN_COSMIC, chance: 1.0, minQty: 1, maxQty: 1 }],
    colorPrimary: '#be185d', colorSecondary: '#831843', colorAccent: '#f472b6',
  },
  [ITEM_IDS.ATM_MACHINE]: {
    id: ITEM_IDS.ATM_MACHINE, key: 'atm_machine', name: 'ATM Machine',
    description: 'Automated Gem Synthesizer. Generates 5–125 Gems every 30m–1.5h. Punch when ready to collect Gems.',
    category: 'interactive', rarity: 'epic', stackLimit: 500,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 2000, xpValue: 35,
    storePrice: 10000,
    drops: [{ itemId: ITEM_IDS.ATM_MACHINE, chance: 1.0, minQty: 1, maxQty: 1 }],
    colorPrimary: '#0ea5e9', colorSecondary: '#0c4a6e', colorAccent: '#fde047',
  },
  [ITEM_IDS.VAULTBOX]: {
    id: ITEM_IDS.VAULTBOX, key: 'vaultbox', name: 'Vaultbox',
    description: 'Player-owned secure storage block with 10 item storage slots.',
    category: 'interactive', rarity: 'rare', stackLimit: 500,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 400, xpValue: 15,
    storePrice: 1750,
    drops: [{ itemId: ITEM_IDS.VAULTBOX, chance: 1.0, minQty: 1, maxQty: 1 }],
    colorPrimary: '#64748b', colorSecondary: '#1e293b', colorAccent: '#fbbf24',
  },
  [ITEM_IDS.WALLPAPER_WAINSCOT]: {
    id: ITEM_IDS.WALLPAPER_WAINSCOT, key: 'wallpaper_wainscot', name: 'Heritage Wainscot Wallpaper',
    description: 'Warm sage-cream damask plaster framed above dark walnut beadboard wainscoting and a molded chair rail.',
    category: 'background', rarity: 'uncommon', stackLimit: 500,
    collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 1, storePrice: 25,
    drops: [{ itemId: ITEM_IDS.WALLPAPER_WAINSCOT, chance: 0.125, minQty: 1, maxQty: 1 }],
    colorPrimary: '#e8dec8', colorSecondary: '#5c3b24', colorAccent: '#8ea382',
  },
  [ITEM_IDS.WALLPAPER_EMERALD_STRIPE]: {
    id: ITEM_IDS.WALLPAPER_EMERALD_STRIPE, key: 'wallpaper_emerald_stripe', name: 'Emerald Regency Wallpaper',
    description: 'Tailored forest-emerald satin stripes accented with antique gold pinstripes and dark mahogany trim.',
    category: 'background', rarity: 'uncommon', stackLimit: 500,
    collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 1, storePrice: 25,
    drops: [{ itemId: ITEM_IDS.WALLPAPER_EMERALD_STRIPE, chance: 0.125, minQty: 1, maxQty: 1 }],
    colorPrimary: '#1e523a', colorSecondary: '#2d6e4f', colorAccent: '#d4af37',
  },
  [ITEM_IDS.WALLPAPER_VENETIAN_PLASTER]: {
    id: ITEM_IDS.WALLPAPER_VENETIAN_PLASTER, key: 'wallpaper_venetian_plaster', name: 'Venetian Plaster Wall',
    description: 'Hand-troweled Mediterranean terracotta lime plaster with organic mineral mottling and warm sheen.',
    category: 'background', rarity: 'uncommon', stackLimit: 500,
    collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 1, storePrice: 25,
    drops: [{ itemId: ITEM_IDS.WALLPAPER_VENETIAN_PLASTER, chance: 0.125, minQty: 1, maxQty: 1 }],
    colorPrimary: '#c86d51', colorSecondary: '#8c4330', colorAccent: '#eab096',
  },
  [ITEM_IDS.WALLPAPER_STARLIGHT_VELVET]: {
    id: ITEM_IDS.WALLPAPER_STARLIGHT_VELVET, key: 'wallpaper_starlight_velvet', name: 'Midnight Starlight Wallpaper',
    description: 'Deep indigo-velvet celestial wall inlaid with gilded stars, crescent motifs, and warm brass edging.',
    category: 'background', rarity: 'rare', stackLimit: 500,
    collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 1, storePrice: 35,
    drops: [{ itemId: ITEM_IDS.WALLPAPER_STARLIGHT_VELVET, chance: 0.125, minQty: 1, maxQty: 1 }],
    colorPrimary: '#162044', colorSecondary: '#0c1229', colorAccent: '#f6d365',
  },
  [ITEM_IDS.WALLPAPER_SUBWAY_TILE]: {
    id: ITEM_IDS.WALLPAPER_SUBWAY_TILE, key: 'wallpaper_subway_tile', name: 'Subway Ceramic Tile Wall',
    description: 'Glossy ivory ceramic subway tiles laid in crisp running bond with recessed slate mortar grout.',
    category: 'background', rarity: 'uncommon', stackLimit: 500,
    collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 1, storePrice: 25,
    drops: [{ itemId: ITEM_IDS.WALLPAPER_SUBWAY_TILE, chance: 0.125, minQty: 1, maxQty: 1 }],
    colorPrimary: '#eef2f6', colorSecondary: '#475569', colorAccent: '#ffffff',
  },
  [ITEM_IDS.WALLPAPER_CEDAR_SHIPLAP]: {
    id: ITEM_IDS.WALLPAPER_CEDAR_SHIPLAP, key: 'wallpaper_cedar_shiplap', name: 'Honey Cedar Shiplap Wall',
    description: 'Horizontal tongue-and-groove honey cedar boards featuring natural knots and warm shadow lap seams.',
    category: 'background', rarity: 'uncommon', stackLimit: 500,
    collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 1, storePrice: 25,
    drops: [{ itemId: ITEM_IDS.WALLPAPER_CEDAR_SHIPLAP, chance: 0.125, minQty: 1, maxQty: 1 }],
    colorPrimary: '#c98a4b', colorSecondary: '#7a4c23', colorAccent: '#e6b87d',
  },
  [ITEM_IDS.WALLPAPER_HERRINGBONE_PARQUET]: {
    id: ITEM_IDS.WALLPAPER_HERRINGBONE_PARQUET, key: 'wallpaper_herringbone_parquet', name: 'Oak Herringbone Parquet',
    description: 'Architectural chevron-inlaid oak and chestnut hardwood wall slats with crisp mitered joinery.',
    category: 'background', rarity: 'rare', stackLimit: 500,
    collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 1, storePrice: 35,
    drops: [{ itemId: ITEM_IDS.WALLPAPER_HERRINGBONE_PARQUET, chance: 0.125, minQty: 1, maxQty: 1 }],
    colorPrimary: '#b37d4e', colorSecondary: '#6b4222', colorAccent: '#dfb486',
  },
  [ITEM_IDS.WALLPAPER_MOROCCAN_MOSAIC]: {
    id: ITEM_IDS.WALLPAPER_MOROCCAN_MOSAIC, key: 'wallpaper_moroccan_mosaic', name: 'Cobalt Moroccan Mosaic',
    description: 'Glazed cobalt and turquoise geometric eight-point zellige tilework set in crisp ivory mortar.',
    category: 'background', rarity: 'rare', stackLimit: 500,
    collision: 'none', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 0, xpValue: 1, storePrice: 35,
    drops: [{ itemId: ITEM_IDS.WALLPAPER_MOROCCAN_MOSAIC, chance: 0.125, minQty: 1, maxQty: 1 }],
    colorPrimary: '#1d4ed8', colorSecondary: '#0f766e', colorAccent: '#f8fafc',
  },

  // ============================================================================
  // 40 DEDICATED FARMABLE BLOCKS (900..939) & SEEDS (950..989) — TIERS 1 TO 8
  // ============================================================================
  // --- TIER 1 (LOW TIER FARMABLES: Fast growth, 2-3 hits, reliable early Gem income) ---
  [ITEM_IDS.FARM_SUGAR_CANE]: {
    id: ITEM_IDS.FARM_SUGAR_CANE, key: 'farm_sugar_cane', name: 'Sugar Cane Stalk',
    description: 'Tier I Farmable. Fast-multiplying sweet reed that showers early Gems and extra seeds when broken.',
    category: 'farmable', farmableTier: 1, rarity: 'common', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 4, xpValue: 2,
    seedId: ITEM_IDS.SEED_FARM_SUGAR_CANE,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 4, seedChance: 0.25 },
    drops: [
      { itemId: ITEM_IDS.FARM_SUGAR_CANE, chance: 0.68, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_SUGAR_CANE, chance: 0.34, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#78d64b', colorSecondary: '#3b8220', colorAccent: '#d9ff9e',
  },
  [ITEM_IDS.FARM_PEPPER_BUSH]: {
    id: ITEM_IDS.FARM_PEPPER_BUSH, key: 'farm_pepper_bush', name: 'Crimson Pepper Tree',
    description: 'Tier I Farmable. Classic spicy bush prized by farmers for steady Gem drops and rapid seed multiplication.',
    category: 'farmable', farmableTier: 1, rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 5, xpValue: 2,
    seedId: ITEM_IDS.SEED_FARM_PEPPER_BUSH,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 4, seedChance: 0.25 },
    drops: [
      { itemId: ITEM_IDS.FARM_PEPPER_BUSH, chance: 0.68, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_PEPPER_BUSH, chance: 0.34, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#dc2626', colorSecondary: '#15803d', colorAccent: '#fde047',
  },
  [ITEM_IDS.FARM_BOUNTY_WHEAT]: {
    id: ITEM_IDS.FARM_BOUNTY_WHEAT, key: 'farm_bounty_wheat', name: 'Golden Bounty Bale',
    description: 'Tier I Farmable. Tightly bound harvest bale with generous Gem yield and effortless break speed.',
    category: 'farmable', farmableTier: 1, rarity: 'common', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 2,
    placeable: true, tradeable: true, gemValue: 5, xpValue: 2,
    seedId: ITEM_IDS.SEED_FARM_BOUNTY_WHEAT,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.24 },
    drops: [
      { itemId: ITEM_IDS.FARM_BOUNTY_WHEAT, chance: 0.67, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_BOUNTY_WHEAT, chance: 0.33, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#eab308', colorSecondary: '#a16207', colorAccent: '#fef08a',
  },
  [ITEM_IDS.FARM_GLOW_SHROOM]: {
    id: ITEM_IDS.FARM_GLOW_SHROOM, key: 'farm_glow_shroom', name: 'Luminous Spore Cap',
    description: 'Tier I Farmable. Bioluminescent cave fungus that drops glowing Gems and fertile spores.',
    category: 'farmable', farmableTier: 1, rarity: 'common', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 6, xpValue: 3,
    seedId: ITEM_IDS.SEED_FARM_GLOW_SHROOM,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 4, seedChance: 0.25 },
    drops: [
      { itemId: ITEM_IDS.FARM_GLOW_SHROOM, chance: 0.68, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_GLOW_SHROOM, chance: 0.34, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#22d3ee', colorSecondary: '#0e7490', colorAccent: '#cffafe',
  },

  // --- TIER 2 (LOW-MID TIER FARMABLES: 3-4 hits, strong Gem & XP output) ---
  [ITEM_IDS.FARM_BAMBOO_SHOOT]: {
    id: ITEM_IDS.FARM_BAMBOO_SHOOT, key: 'farm_bamboo_shoot', name: 'Jade Bamboo Bundle',
    description: 'Tier II Farmable. Dense emerald bamboo stalks engineered for high-efficiency Gem farming rows.',
    category: 'farmable', farmableTier: 2, rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 3,
    placeable: true, tradeable: true, gemValue: 8, xpValue: 3,
    seedId: ITEM_IDS.SEED_FARM_BAMBOO_SHOOT,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.26 },
    drops: [
      { itemId: ITEM_IDS.FARM_BAMBOO_SHOOT, chance: 0.68, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_BAMBOO_SHOOT, chance: 0.34, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#10b981', colorSecondary: '#047857', colorAccent: '#a7f3d0',
  },
  [ITEM_IDS.FARM_HONEY_COMB]: {
    id: ITEM_IDS.FARM_HONEY_COMB, key: 'farm_honey_comb', name: 'Amber Honeycomb',
    description: 'Tier II Farmable. Crystalline golden hive cell brimming with crystallized Gem nectar.',
    category: 'farmable', farmableTier: 2, rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 9, xpValue: 4,
    seedId: ITEM_IDS.SEED_FARM_HONEY_COMB,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.26 },
    drops: [
      { itemId: ITEM_IDS.FARM_HONEY_COMB, chance: 0.68, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_HONEY_COMB, chance: 0.34, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#f59e0b', colorSecondary: '#b45309', colorAccent: '#fde68a',
  },
  [ITEM_IDS.FARM_PINBALL_BUMPER]: {
    id: ITEM_IDS.FARM_PINBALL_BUMPER, key: 'farm_pinball_bumper', name: 'Arcade Pinball Bumper',
    description: 'Tier II Farmable. Neon spring-loaded bumper block famous for massive Gem jackpots when farmed in bulk.',
    category: 'farmable', farmableTier: 2, rarity: 'uncommon', stackLimit: 200,
    collision: 'solid', surfaceEffect: 'bounce', breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 10, xpValue: 4,
    seedId: ITEM_IDS.SEED_FARM_PINBALL_BUMPER,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.26 },
    drops: [
      { itemId: ITEM_IDS.FARM_PINBALL_BUMPER, chance: 0.69, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_PINBALL_BUMPER, chance: 0.34, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#ec4899', colorSecondary: '#6d28d9', colorAccent: '#fef08a',
  },
  [ITEM_IDS.FARM_VENUS_TRAP]: {
    id: ITEM_IDS.FARM_VENUS_TRAP, key: 'farm_venus_trap', name: 'Venus Snapjaw Pod',
    description: 'Tier II Farmable. Carnivorous botanical pod that digests minerals into concentrated Gems.',
    category: 'farmable', farmableTier: 2, rarity: 'uncommon', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 4,
    placeable: true, tradeable: true, gemValue: 11, xpValue: 4,
    seedId: ITEM_IDS.SEED_FARM_VENUS_TRAP,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.26 },
    drops: [
      { itemId: ITEM_IDS.FARM_VENUS_TRAP, chance: 0.68, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_VENUS_TRAP, chance: 0.34, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#84cc16', colorSecondary: '#991b1b', colorAccent: '#fda4af',
  },

  // --- TIER 3 (MID TIER FARMABLES: 4-5 hits, high Gem density) ---
  [ITEM_IDS.FARM_BLACKROCK_GEM]: {
    id: ITEM_IDS.FARM_BLACKROCK_GEM, key: 'farm_blackrock_gem', name: 'Blackrock Gem Matrix',
    description: 'Tier III Farmable. Obsidian basalt studded with pressurized ruby and sapphire veins.',
    category: 'farmable', farmableTier: 3, rarity: 'rare', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 14, xpValue: 5,
    seedId: ITEM_IDS.SEED_FARM_BLACKROCK_GEM,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.27 },
    drops: [
      { itemId: ITEM_IDS.FARM_BLACKROCK_GEM, chance: 0.69, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_BLACKROCK_GEM, chance: 0.35, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#334155', colorSecondary: '#0f172a', colorAccent: '#f43f5e',
  },
  [ITEM_IDS.FARM_GOLD_TREASURE]: {
    id: ITEM_IDS.FARM_GOLD_TREASURE, key: 'farm_gold_treasure', name: 'Gilded Bullion Crate',
    description: 'Tier III Farmable. Reinforced treasury coffer packed with minted gold coins and sparkling Gems.',
    category: 'farmable', farmableTier: 3, rarity: 'rare', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 16, xpValue: 6,
    seedId: ITEM_IDS.SEED_FARM_GOLD_TREASURE,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.27 },
    drops: [
      { itemId: ITEM_IDS.FARM_GOLD_TREASURE, chance: 0.69, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_GOLD_TREASURE, chance: 0.35, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#fbbf24', colorSecondary: '#78350f', colorAccent: '#fef9c3',
  },
  [ITEM_IDS.FARM_CHANDELIER]: {
    id: ITEM_IDS.FARM_CHANDELIER, key: 'farm_chandelier', name: 'Royal Crystal Chandelier',
    description: 'Tier III Farmable. Iconic aristocratic fixture whose cut-glass pendants burst into high-value Gems.',
    category: 'farmable', farmableTier: 3, rarity: 'rare', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 18, xpValue: 6,
    seedId: ITEM_IDS.SEED_FARM_CHANDELIER,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.27 },
    drops: [
      { itemId: ITEM_IDS.FARM_CHANDELIER, chance: 0.69, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_CHANDELIER, chance: 0.35, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#facc15', colorSecondary: '#ca8a04', colorAccent: '#e0f2fe',
  },
  [ITEM_IDS.FARM_LASER_GRID]: {
    id: ITEM_IDS.FARM_LASER_GRID, key: 'farm_laser_grid', name: 'Photon Laser Emitter',
    description: 'Tier III Farmable. High-tech optical grid block favored for automated BFG Gem rooms.',
    category: 'farmable', farmableTier: 3, rarity: 'rare', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 5,
    placeable: true, tradeable: true, gemValue: 19, xpValue: 7,
    seedId: ITEM_IDS.SEED_FARM_LASER_GRID,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.27 },
    drops: [
      { itemId: ITEM_IDS.FARM_LASER_GRID, chance: 0.69, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_LASER_GRID, chance: 0.35, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#06b6d4', colorSecondary: '#1e293b', colorAccent: '#ef4444',
  },

  // --- TIER 4 (HIGH TIER FARMABLES: 6 hits, luxury Gem fountains) ---
  [ITEM_IDS.FARM_SORCERER_ORB]: {
    id: ITEM_IDS.FARM_SORCERER_ORB, key: 'farm_sorcerer_orb', name: 'Sorcerer Mana Sphere',
    description: 'Tier IV Farmable. Arcane levitating orb that condenses ambient ether into rich purple and gold Gems.',
    category: 'farmable', farmableTier: 4, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 24, xpValue: 8,
    seedId: ITEM_IDS.SEED_FARM_SORCERER_ORB,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.28 },
    drops: [
      { itemId: ITEM_IDS.FARM_SORCERER_ORB, chance: 0.70, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_SORCERER_ORB, chance: 0.35, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#a855f7', colorSecondary: '#4c1d95', colorAccent: '#f0abfc',
  },
  [ITEM_IDS.FARM_EMERALD_GEODE]: {
    id: ITEM_IDS.FARM_EMERALD_GEODE, key: 'farm_emerald_geode', name: 'Verdant Emerald Geode',
    description: 'Tier IV Farmable. Hollow crystal cavity lined with razor-sharp emerald spires and high Gem payouts.',
    category: 'farmable', farmableTier: 4, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 26, xpValue: 9,
    seedId: ITEM_IDS.SEED_FARM_EMERALD_GEODE,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.28 },
    drops: [
      { itemId: ITEM_IDS.FARM_EMERALD_GEODE, chance: 0.70, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_EMERALD_GEODE, chance: 0.35, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#10b981', colorSecondary: '#064e3b', colorAccent: '#6ee7b7',
  },
  [ITEM_IDS.FARM_SUNSTONE_PILLAR]: {
    id: ITEM_IDS.FARM_SUNSTONE_PILLAR, key: 'farm_sunstone_pillar', name: 'Solar Sunstone Obelisk',
    description: 'Tier IV Farmable. Carved desert-gold monument infused with concentrated solar Gem energy.',
    category: 'farmable', farmableTier: 4, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 28, xpValue: 9,
    seedId: ITEM_IDS.SEED_FARM_SUNSTONE_PILLAR,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.28 },
    drops: [
      { itemId: ITEM_IDS.FARM_SUNSTONE_PILLAR, chance: 0.70, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_SUNSTONE_PILLAR, chance: 0.35, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#f97316', colorSecondary: '#9a3412', colorAccent: '#fde047',
  },
  [ITEM_IDS.FARM_FROST_LOTUS]: {
    id: ITEM_IDS.FARM_FROST_LOTUS, key: 'farm_frost_lotus', name: 'Glacial Diamond Lotus',
    description: 'Tier IV Farmable. Crystalline ice blossom whose petals shatter into pure diamond-grade Gems.',
    category: 'farmable', farmableTier: 4, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 6,
    placeable: true, tradeable: true, gemValue: 30, xpValue: 10,
    seedId: ITEM_IDS.SEED_FARM_FROST_LOTUS,
    treeHarvestYield: { minBlocks: 2, maxBlocks: 5, seedChance: 0.28 },
    drops: [
      { itemId: ITEM_IDS.FARM_FROST_LOTUS, chance: 0.70, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_FROST_LOTUS, chance: 0.35, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#38bdf8', colorSecondary: '#0369a1', colorAccent: '#f0f9ff',
  },

  // --- TIER 5 (APEX TIER FARMABLES: 7-8 hits, endgame Gem wealth generators) ---
  [ITEM_IDS.FARM_STARLIGHT_PRISM]: {
    id: ITEM_IDS.FARM_STARLIGHT_PRISM, key: 'farm_starlight_prism', name: 'Starlight Refracting Prism',
    description: 'Tier V Farmable. Precision-cut astral prism that splits starlight into a cascade of high-denomination Gems.',
    category: 'farmable', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 36, xpValue: 12,
    seedId: ITEM_IDS.SEED_FARM_STARLIGHT_PRISM,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 5, seedChance: 0.29 },
    drops: [
      { itemId: ITEM_IDS.FARM_STARLIGHT_PRISM, chance: 0.71, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_STARLIGHT_PRISM, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#818cf8', colorSecondary: '#312e81', colorAccent: '#fdf4ff',
  },
  [ITEM_IDS.FARM_DRAGON_HOARD]: {
    id: ITEM_IDS.FARM_DRAGON_HOARD, key: 'farm_dragon_hoard', name: 'Drake Sovereign Hoard',
    description: 'Tier V Farmable. Smoldering vault of ancient draconic rubies and imperial gold crowns.',
    category: 'farmable', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 40, xpValue: 13,
    seedId: ITEM_IDS.SEED_FARM_DRAGON_HOARD,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 5, seedChance: 0.29 },
    drops: [
      { itemId: ITEM_IDS.FARM_DRAGON_HOARD, chance: 0.71, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_DRAGON_HOARD, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#ef4444', colorSecondary: '#7f1d1d', colorAccent: '#facc15',
  },
  [ITEM_IDS.FARM_AETHER_REACTOR]: {
    id: ITEM_IDS.FARM_AETHER_REACTOR, key: 'farm_aether_reactor', name: 'Quantum Aether Core',
    description: 'Tier V Farmable. Hyper-dense plasma containment cell engineered for elite Gem magnates.',
    category: 'farmable', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 45, xpValue: 15,
    seedId: ITEM_IDS.SEED_FARM_AETHER_REACTOR,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 5, seedChance: 0.30 },
    drops: [
      { itemId: ITEM_IDS.FARM_AETHER_REACTOR, chance: 0.72, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_AETHER_REACTOR, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#2dd4bf', colorSecondary: '#115e59', colorAccent: '#f472b6',
  },
  [ITEM_IDS.FARM_CELESTIAL_MONOLITH]: {
    id: ITEM_IDS.FARM_CELESTIAL_MONOLITH, key: 'farm_celestial_monolith', name: 'Celestial Crown Monolith',
    description: 'Tier V Apex Farmable. The pinnacle of agricultural wealth—erupts with massive Gem clusters on every break.',
    category: 'farmable', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 52, xpValue: 18,
    seedId: ITEM_IDS.SEED_FARM_CELESTIAL_MONOLITH,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 6, seedChance: 0.30 },
    drops: [
      { itemId: ITEM_IDS.FARM_CELESTIAL_MONOLITH, chance: 0.72, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_CELESTIAL_MONOLITH, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#c084fc', colorSecondary: '#3b0764', colorAccent: '#fef08a',
  },

  // --- TIER 5 EXTENDED & TIER 6 (ADVANCED FARMABLES: 7-8 hits, crystalline wealth) ---
  [ITEM_IDS.FARM_CRYSTAL_BLOSSOM]: {
    id: ITEM_IDS.FARM_CRYSTAL_BLOSSOM, key: 'farm_crystal_blossom', name: 'Crystal Rose Blossom',
    description: 'Tier V Botanical Farmable. Crystalline petals that shimmer with mineral pollen and concentrated Gems.',
    category: 'farmable', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 42, xpValue: 14,
    seedId: ITEM_IDS.SEED_FARM_CRYSTAL_BLOSSOM,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 5, seedChance: 0.29 },
    drops: [
      { itemId: ITEM_IDS.FARM_CRYSTAL_BLOSSOM, chance: 0.71, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_CRYSTAL_BLOSSOM, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#ec4899', colorSecondary: '#9d174d', colorAccent: '#fbcfe8',
  },
  [ITEM_IDS.FARM_MAGMA_ROSE]: {
    id: ITEM_IDS.FARM_MAGMA_ROSE, key: 'farm_magma_rose', name: 'Obsidian Magma Rose',
    description: 'Tier V Botanical Farmable. Volcanic flora forged in subterranean heat, yielding heated ruby Gems.',
    category: 'farmable', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 44, xpValue: 14,
    seedId: ITEM_IDS.SEED_FARM_MAGMA_ROSE,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 5, seedChance: 0.29 },
    drops: [
      { itemId: ITEM_IDS.FARM_MAGMA_ROSE, chance: 0.71, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_MAGMA_ROSE, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#f97316', colorSecondary: '#9a3412', colorAccent: '#fde047',
  },
  [ITEM_IDS.FARM_SHADOW_TENDRIL]: {
    id: ITEM_IDS.FARM_SHADOW_TENDRIL, key: 'farm_shadow_tendril', name: 'Umbral Shadow Tendril',
    description: 'Tier V Arcane Farmable. Wreathed in dark violet tendrils that condense shadowy Gem clusters.',
    category: 'farmable', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 46, xpValue: 15,
    seedId: ITEM_IDS.SEED_FARM_SHADOW_TENDRIL,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 5, seedChance: 0.29 },
    drops: [
      { itemId: ITEM_IDS.FARM_SHADOW_TENDRIL, chance: 0.71, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_SHADOW_TENDRIL, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#6366f1', colorSecondary: '#312e81', colorAccent: '#c7d2fe',
  },
  [ITEM_IDS.FARM_PLASMA_ORCHID]: {
    id: ITEM_IDS.FARM_PLASMA_ORCHID, key: 'farm_plasma_orchid', name: 'Radiant Plasma Orchid',
    description: 'Tier V Luminescent Farmable. Vibrant electric bloom emitting ion clouds and high Gem wealth.',
    category: 'farmable', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 7,
    placeable: true, tradeable: true, gemValue: 48, xpValue: 16,
    seedId: ITEM_IDS.SEED_FARM_PLASMA_ORCHID,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 5, seedChance: 0.30 },
    drops: [
      { itemId: ITEM_IDS.FARM_PLASMA_ORCHID, chance: 0.72, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_PLASMA_ORCHID, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#06b6d4', colorSecondary: '#0e7490', colorAccent: '#a5f3fc',
  },
  [ITEM_IDS.FARM_PRISM_SHARD]: {
    id: ITEM_IDS.FARM_PRISM_SHARD, key: 'farm_prism_shard', name: 'Refractive Prism Spire',
    description: 'Tier VI Geomineral Farmable. Multi-faceted crystalline quartz cluster that bursts into diamond-grade Gems.',
    category: 'farmable', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 56, xpValue: 19,
    seedId: ITEM_IDS.SEED_FARM_PRISM_SHARD,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 6, seedChance: 0.30 },
    drops: [
      { itemId: ITEM_IDS.FARM_PRISM_SHARD, chance: 0.72, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_PRISM_SHARD, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#a855f7', colorSecondary: '#581c87', colorAccent: '#f0abfc',
  },
  [ITEM_IDS.FARM_THUNDER_CACTUS]: {
    id: ITEM_IDS.FARM_THUNDER_CACTUS, key: 'farm_thunder_cactus', name: 'Fulgarite Thunder Spike',
    description: 'Tier VI Geomineral Farmable. Vitrified lightning formation charged with crackling topaz Gem energy.',
    category: 'farmable', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 60, xpValue: 20,
    seedId: ITEM_IDS.SEED_FARM_THUNDER_CACTUS,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 6, seedChance: 0.30 },
    drops: [
      { itemId: ITEM_IDS.FARM_THUNDER_CACTUS, chance: 0.72, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_THUNDER_CACTUS, chance: 0.36, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#eab308', colorSecondary: '#854d0e', colorAccent: '#fef08a',
  },
  [ITEM_IDS.FARM_VOID_LILY]: {
    id: ITEM_IDS.FARM_VOID_LILY, key: 'farm_void_lily', name: 'Abyssal Void Lily',
    description: 'Tier VI Arcane Farmable. Deep abyss blossom blooming with shimmering dark amethyst Gems.',
    category: 'farmable', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 64, xpValue: 21,
    seedId: ITEM_IDS.SEED_FARM_VOID_LILY,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 6, seedChance: 0.31 },
    drops: [
      { itemId: ITEM_IDS.FARM_VOID_LILY, chance: 0.73, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_VOID_LILY, chance: 0.37, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#8b5cf6', colorSecondary: '#4c1d95', colorAccent: '#ddd6fe',
  },
  [ITEM_IDS.FARM_HYPERION_BULB]: {
    id: ITEM_IDS.FARM_HYPERION_BULB, key: 'farm_hyperion_bulb', name: 'Hyperion Sol Globe',
    description: 'Tier VI Luminescent Farmable. Miniature solar lamp containing blazing white-hot Gem plasma.',
    category: 'farmable', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 68, xpValue: 22,
    seedId: ITEM_IDS.SEED_FARM_HYPERION_BULB,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 6, seedChance: 0.31 },
    drops: [
      { itemId: ITEM_IDS.FARM_HYPERION_BULB, chance: 0.73, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_HYPERION_BULB, chance: 0.37, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#f59e0b', colorSecondary: '#b45309', colorAccent: '#fef3c7',
  },
  [ITEM_IDS.FARM_SOLARIUM_BLOOM]: {
    id: ITEM_IDS.FARM_SOLARIUM_BLOOM, key: 'farm_solarium_bloom', name: 'Solarium Core Blossom',
    description: 'Tier VI Luminescent Farmable. Engineered radiant flora producing dazzling golden Gem shards.',
    category: 'farmable', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 72, xpValue: 24,
    seedId: ITEM_IDS.SEED_FARM_SOLARIUM_BLOOM,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 6, seedChance: 0.31 },
    drops: [
      { itemId: ITEM_IDS.FARM_SOLARIUM_BLOOM, chance: 0.73, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_SOLARIUM_BLOOM, chance: 0.37, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#facc15', colorSecondary: '#ca8a04', colorAccent: '#ffffff',
  },
  [ITEM_IDS.FARM_CHRONO_FERN]: {
    id: ITEM_IDS.FARM_CHRONO_FERN, key: 'farm_chrono_fern', name: 'Temporal Chrono Fern',
    description: 'Tier VI Arcane Farmable. Plant tissue oscillating between time streams, dropping dense sapphire Gems.',
    category: 'farmable', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 8,
    placeable: true, tradeable: true, gemValue: 76, xpValue: 25,
    seedId: ITEM_IDS.SEED_FARM_CHRONO_FERN,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 6, seedChance: 0.32 },
    drops: [
      { itemId: ITEM_IDS.FARM_CHRONO_FERN, chance: 0.73, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_CHRONO_FERN, chance: 0.37, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#3b82f6', colorSecondary: '#1e3a8a', colorAccent: '#bfdbfe',
  },

  // --- TIER 7 (EPIC HIGH TIER FARMABLES: 9 hits, colossal Gem cascades) ---
  [ITEM_IDS.FARM_NEBULA_SPORE]: {
    id: ITEM_IDS.FARM_NEBULA_SPORE, key: 'farm_nebula_spore', name: 'Cosmic Nebula Spore',
    description: 'Tier VII Cosmic Farmable. Interstellar spore cluster swirling with iridescent violet Gem star dust.',
    category: 'farmable', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 9,
    placeable: true, tradeable: true, gemValue: 84, xpValue: 28,
    seedId: ITEM_IDS.SEED_FARM_NEBULA_SPORE,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 6, seedChance: 0.32 },
    drops: [
      { itemId: ITEM_IDS.FARM_NEBULA_SPORE, chance: 0.74, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_NEBULA_SPORE, chance: 0.37, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#d946ef', colorSecondary: '#701a75', colorAccent: '#f5d0fe',
  },
  [ITEM_IDS.FARM_DARK_MATTER_CORE]: {
    id: ITEM_IDS.FARM_DARK_MATTER_CORE, key: 'farm_dark_matter_core', name: 'Dark Matter Crucible',
    description: 'Tier VII Cosmic Farmable. Gravitationally collapsed core that erupts into ultra-dense onyx Gems.',
    category: 'farmable', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 9,
    placeable: true, tradeable: true, gemValue: 90, xpValue: 30,
    seedId: ITEM_IDS.SEED_FARM_DARK_MATTER_CORE,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 6, seedChance: 0.32 },
    drops: [
      { itemId: ITEM_IDS.FARM_DARK_MATTER_CORE, chance: 0.74, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_DARK_MATTER_CORE, chance: 0.38, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#18181b', colorSecondary: '#09090b', colorAccent: '#818cf8',
  },
  [ITEM_IDS.FARM_PULSAR_BLOSSOM]: {
    id: ITEM_IDS.FARM_PULSAR_BLOSSOM, key: 'farm_pulsar_blossom', name: 'Pulsar Neutron Blossom',
    description: 'Tier VII Luminescent Farmable. Rotating beam petal formation releasing rhythmic Gem surges.',
    category: 'farmable', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 9,
    placeable: true, tradeable: true, gemValue: 96, xpValue: 32,
    seedId: ITEM_IDS.SEED_FARM_PULSAR_BLOSSOM,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 7, seedChance: 0.33 },
    drops: [
      { itemId: ITEM_IDS.FARM_PULSAR_BLOSSOM, chance: 0.74, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_PULSAR_BLOSSOM, chance: 0.38, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#38bdf8', colorSecondary: '#075985', colorAccent: '#e0f2fe',
  },
  [ITEM_IDS.FARM_SUPERNOVA_FRUIT]: {
    id: ITEM_IDS.FARM_SUPERNOVA_FRUIT, key: 'farm_supernova_fruit', name: 'Supernova Fusion Fruit',
    description: 'Tier VII Cosmic Farmable. Concentrated stellar explosion trapped in crystalline hull, dropping fiery Gems.',
    category: 'farmable', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 9,
    placeable: true, tradeable: true, gemValue: 104, xpValue: 35,
    seedId: ITEM_IDS.SEED_FARM_SUPERNOVA_FRUIT,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 7, seedChance: 0.33 },
    drops: [
      { itemId: ITEM_IDS.FARM_SUPERNOVA_FRUIT, chance: 0.75, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_SUPERNOVA_FRUIT, chance: 0.38, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#ef4444', colorSecondary: '#7f1d1d', colorAccent: '#fed7aa',
  },
  [ITEM_IDS.FARM_TITAN_THORN]: {
    id: ITEM_IDS.FARM_TITAN_THORN, key: 'farm_titan_thorn', name: 'Colossal Titan Thorn',
    description: 'Tier VII Botanical Farmable. Petrified primordial wood that shatters into emerald and gold wealth.',
    category: 'farmable', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 9,
    placeable: true, tradeable: true, gemValue: 110, xpValue: 37,
    seedId: ITEM_IDS.SEED_FARM_TITAN_THORN,
    treeHarvestYield: { minBlocks: 3, maxBlocks: 7, seedChance: 0.33 },
    drops: [
      { itemId: ITEM_IDS.FARM_TITAN_THORN, chance: 0.75, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_TITAN_THORN, chance: 0.38, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#16a34a', colorSecondary: '#14532d', colorAccent: '#bbf7d0',
  },

  // --- TIER 8 (GOD TIER APEX FARMABLES: 10 hits, supreme economy pinnacles) ---
  [ITEM_IDS.FARM_QUANTUM_VINE]: {
    id: ITEM_IDS.FARM_QUANTUM_VINE, key: 'farm_quantum_vine', name: 'Quantum Entangled Vine',
    description: 'Tier VIII Botanical Farmable. Multidimensional vine weaving probability fields into endless Gem riches.',
    category: 'farmable', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 10,
    placeable: true, tradeable: true, gemValue: 120, xpValue: 40,
    seedId: ITEM_IDS.SEED_FARM_QUANTUM_VINE,
    treeHarvestYield: { minBlocks: 4, maxBlocks: 7, seedChance: 0.34 },
    drops: [
      { itemId: ITEM_IDS.FARM_QUANTUM_VINE, chance: 0.75, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_QUANTUM_VINE, chance: 0.39, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#10b981', colorSecondary: '#064e3b', colorAccent: '#a7f3d0',
  },
  [ITEM_IDS.FARM_ASTRAL_CHRYSALIS]: {
    id: ITEM_IDS.FARM_ASTRAL_CHRYSALIS, key: 'farm_astral_chrysalis', name: 'Astral Monarch Chrysalis',
    description: 'Tier VIII Arcane Farmable. Divine etheric cocoon radiating celestial luminescence and regal Gem showers.',
    category: 'farmable', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 10,
    placeable: true, tradeable: true, gemValue: 130, xpValue: 43,
    seedId: ITEM_IDS.SEED_FARM_ASTRAL_CHRYSALIS,
    treeHarvestYield: { minBlocks: 4, maxBlocks: 7, seedChance: 0.34 },
    drops: [
      { itemId: ITEM_IDS.FARM_ASTRAL_CHRYSALIS, chance: 0.75, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_ASTRAL_CHRYSALIS, chance: 0.39, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#8b5cf6', colorSecondary: '#4c1d95', colorAccent: '#fdf4ff',
  },
  [ITEM_IDS.FARM_GENESIS_SEEDLING]: {
    id: ITEM_IDS.FARM_GENESIS_SEEDLING, key: 'farm_genesis_seedling', name: 'Genesis World Sapling',
    description: 'Tier VIII Botanical Farmable. World-tree branch blessed by ancient earth deities, dropping massive wealth.',
    category: 'farmable', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 10,
    placeable: true, tradeable: true, gemValue: 140, xpValue: 46,
    seedId: ITEM_IDS.SEED_FARM_GENESIS_SEEDLING,
    treeHarvestYield: { minBlocks: 4, maxBlocks: 7, seedChance: 0.35 },
    drops: [
      { itemId: ITEM_IDS.FARM_GENESIS_SEEDLING, chance: 0.76, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_GENESIS_SEEDLING, chance: 0.40, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#22c55e', colorSecondary: '#15803d', colorAccent: '#fef08a',
  },
  [ITEM_IDS.FARM_INFINITY_LOTUS]: {
    id: ITEM_IDS.FARM_INFINITY_LOTUS, key: 'farm_infinity_lotus', name: 'Infinity Prism Lotus',
    description: 'Tier VIII Cosmic Farmable. Sacred multidimensional lotus whose endless bloom generates supreme Gem fortunes.',
    category: 'farmable', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'none', transparent: true, breakable: true, hardness: 10,
    placeable: true, tradeable: true, gemValue: 155, xpValue: 50,
    seedId: ITEM_IDS.SEED_FARM_INFINITY_LOTUS,
    treeHarvestYield: { minBlocks: 4, maxBlocks: 8, seedChance: 0.35 },
    drops: [
      { itemId: ITEM_IDS.FARM_INFINITY_LOTUS, chance: 0.76, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_INFINITY_LOTUS, chance: 0.40, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#06b6d4', colorSecondary: '#0f766e', colorAccent: '#f43f5e',
  },
  [ITEM_IDS.FARM_OMEGA_MONOLITH]: {
    id: ITEM_IDS.FARM_OMEGA_MONOLITH, key: 'farm_omega_monolith', name: 'Omega Sovereign Monolith',
    description: 'Tier VIII Sovereign Apex Farmable. The ultimate manifestation of agricultural mastery in the cosmos.',
    category: 'farmable', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'solid', breakable: true, hardness: 10,
    placeable: true, tradeable: true, gemValue: 175, xpValue: 60,
    seedId: ITEM_IDS.SEED_FARM_OMEGA_MONOLITH,
    treeHarvestYield: { minBlocks: 4, maxBlocks: 8, seedChance: 0.36 },
    drops: [
      { itemId: ITEM_IDS.FARM_OMEGA_MONOLITH, chance: 0.77, minQty: 1, maxQty: 1 },
      { itemId: ITEM_IDS.SEED_FARM_OMEGA_MONOLITH, chance: 0.40, minQty: 1, maxQty: 1 },
    ],
    colorPrimary: '#e11d48', colorSecondary: '#4c0519', colorAccent: '#fbbf24',
  },

  // --- MATCHING 40 FARMABLE SEEDS (950..989) ---
  [ITEM_IDS.SEED_FARM_SUGAR_CANE]: {
    id: ITEM_IDS.SEED_FARM_SUGAR_CANE, key: 'seed_farm_sugar_cane', name: 'Sugar Cane Seed',
    description: 'Tier I Farmable Seed. Plant or mix with another planted seed to splice higher-tier Farmables.',
    category: 'seed', farmableTier: 1, rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    producesTileId: ITEM_IDS.FARM_SUGAR_CANE, growthTimeMs: 14000,
    spliceIngredients: [ITEM_IDS.GP_SEED_GRASS, ITEM_IDS.GP_SEED_SAND],
    colorPrimary: '#78d64b', colorSecondary: '#3b8220', colorAccent: '#d9ff9e',
  },
  [ITEM_IDS.SEED_FARM_PEPPER_BUSH]: {
    id: ITEM_IDS.SEED_FARM_PEPPER_BUSH, key: 'seed_farm_pepper_bush', name: 'Crimson Pepper Seed',
    description: 'Tier I Farmable Seed. Grows into a high-yield Crimson Pepper Tree.',
    category: 'seed', farmableTier: 1, rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    producesTileId: ITEM_IDS.FARM_PEPPER_BUSH, growthTimeMs: 16000,
    spliceIngredients: [ITEM_IDS.GP_SEED_GRASS, ITEM_IDS.GP_SEED_LAVA],
    colorPrimary: '#dc2626', colorSecondary: '#15803d', colorAccent: '#fde047',
  },
  [ITEM_IDS.SEED_FARM_BOUNTY_WHEAT]: {
    id: ITEM_IDS.SEED_FARM_BOUNTY_WHEAT, key: 'seed_farm_bounty_wheat', name: 'Golden Bounty Seed',
    description: 'Tier I Farmable Seed. Grows into a Golden Bounty Bale.',
    category: 'seed', farmableTier: 1, rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 2, xpValue: 2,
    producesTileId: ITEM_IDS.FARM_BOUNTY_WHEAT, growthTimeMs: 15000,
    spliceIngredients: [ITEM_IDS.GP_SEED_DIRT, ITEM_IDS.GP_SEED_WHEAT],
    colorPrimary: '#eab308', colorSecondary: '#a16207', colorAccent: '#fef08a',
  },
  [ITEM_IDS.SEED_FARM_GLOW_SHROOM]: {
    id: ITEM_IDS.SEED_FARM_GLOW_SHROOM, key: 'seed_farm_glow_shroom', name: 'Luminous Spore Seed',
    description: 'Tier I Farmable Seed. Grows into a Luminous Spore Cap.',
    category: 'seed', farmableTier: 1, rarity: 'common', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 3, xpValue: 3,
    producesTileId: ITEM_IDS.FARM_GLOW_SHROOM, growthTimeMs: 18000,
    spliceIngredients: [ITEM_IDS.GP_SEED_CAVE_BACKGROUND, ITEM_IDS.GP_SEED_MUSHROOM],
    colorPrimary: '#22d3ee', colorSecondary: '#0e7490', colorAccent: '#cffafe',
  },
  [ITEM_IDS.SEED_FARM_BAMBOO_SHOOT]: {
    id: ITEM_IDS.SEED_FARM_BAMBOO_SHOOT, key: 'seed_farm_bamboo_shoot', name: 'Jade Bamboo Seed',
    description: 'Tier II Farmable Seed. Grows into a Jade Bamboo Bundle.',
    category: 'seed', farmableTier: 2, rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 4, xpValue: 3,
    producesTileId: ITEM_IDS.FARM_BAMBOO_SHOOT, growthTimeMs: 24000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_SUGAR_CANE, ITEM_IDS.GP_SEED_WOOD_BLOCK],
    colorPrimary: '#10b981', colorSecondary: '#047857', colorAccent: '#a7f3d0',
  },
  [ITEM_IDS.SEED_FARM_HONEY_COMB]: {
    id: ITEM_IDS.SEED_FARM_HONEY_COMB, key: 'seed_farm_honey_comb', name: 'Amber Honeycomb Seed',
    description: 'Tier II Farmable Seed. Grows into an Amber Honeycomb.',
    category: 'seed', farmableTier: 2, rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 4, xpValue: 4,
    producesTileId: ITEM_IDS.FARM_HONEY_COMB, growthTimeMs: 26000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_BOUNTY_WHEAT, ITEM_IDS.GP_SEED_DAISY],
    colorPrimary: '#f59e0b', colorSecondary: '#b45309', colorAccent: '#fde68a',
  },
  [ITEM_IDS.SEED_FARM_PINBALL_BUMPER]: {
    id: ITEM_IDS.SEED_FARM_PINBALL_BUMPER, key: 'seed_farm_pinball_bumper', name: 'Arcade Bumper Seed',
    description: 'Tier II Farmable Seed. Grows into an Arcade Pinball Bumper.',
    category: 'seed', farmableTier: 2, rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 5, xpValue: 4,
    producesTileId: ITEM_IDS.FARM_PINBALL_BUMPER, growthTimeMs: 28000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_PEPPER_BUSH, ITEM_IDS.GP_SEED_GLASS_PANE],
    colorPrimary: '#ec4899', colorSecondary: '#6d28d9', colorAccent: '#fef08a',
  },
  [ITEM_IDS.SEED_FARM_VENUS_TRAP]: {
    id: ITEM_IDS.SEED_FARM_VENUS_TRAP, key: 'seed_farm_venus_trap', name: 'Venus Snapjaw Seed',
    description: 'Tier II Farmable Seed. Grows into a Venus Snapjaw Pod.',
    category: 'seed', farmableTier: 2, rarity: 'uncommon', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 5, xpValue: 4,
    producesTileId: ITEM_IDS.FARM_VENUS_TRAP, growthTimeMs: 30000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_PEPPER_BUSH, ITEM_IDS.SEED_FARM_GLOW_SHROOM],
    colorPrimary: '#84cc16', colorSecondary: '#991b1b', colorAccent: '#fda4af',
  },
  [ITEM_IDS.SEED_FARM_BLACKROCK_GEM]: {
    id: ITEM_IDS.SEED_FARM_BLACKROCK_GEM, key: 'seed_farm_blackrock_gem', name: 'Blackrock Matrix Seed',
    description: 'Tier III Farmable Seed. Grows into a Blackrock Gem Matrix.',
    category: 'seed', farmableTier: 3, rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 7, xpValue: 5,
    producesTileId: ITEM_IDS.FARM_BLACKROCK_GEM, growthTimeMs: 38000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_PINBALL_BUMPER, ITEM_IDS.GP_SEED_LAVA_ROCK],
    colorPrimary: '#334155', colorSecondary: '#0f172a', colorAccent: '#f43f5e',
  },
  [ITEM_IDS.SEED_FARM_GOLD_TREASURE]: {
    id: ITEM_IDS.SEED_FARM_GOLD_TREASURE, key: 'seed_farm_gold_treasure', name: 'Gilded Bullion Seed',
    description: 'Tier III Farmable Seed. Grows into a Gilded Bullion Crate.',
    category: 'seed', farmableTier: 3, rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 8, xpValue: 6,
    producesTileId: ITEM_IDS.FARM_GOLD_TREASURE, growthTimeMs: 42000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_HONEY_COMB, ITEM_IDS.GP_SEED_YELLOW_BLOCK],
    colorPrimary: '#fbbf24', colorSecondary: '#78350f', colorAccent: '#fef9c3',
  },
  [ITEM_IDS.SEED_FARM_CHANDELIER]: {
    id: ITEM_IDS.SEED_FARM_CHANDELIER, key: 'seed_farm_chandelier', name: 'Royal Chandelier Seed',
    description: 'Tier III Farmable Seed. Grows into a Royal Crystal Chandelier.',
    category: 'seed', farmableTier: 3, rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 9, xpValue: 6,
    producesTileId: ITEM_IDS.FARM_CHANDELIER, growthTimeMs: 45000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_HONEY_COMB, ITEM_IDS.GP_SEED_GLASS_BLOCK],
    colorPrimary: '#facc15', colorSecondary: '#ca8a04', colorAccent: '#e0f2fe',
  },
  [ITEM_IDS.SEED_FARM_LASER_GRID]: {
    id: ITEM_IDS.SEED_FARM_LASER_GRID, key: 'seed_farm_laser_grid', name: 'Photon Laser Seed',
    description: 'Tier III Farmable Seed. Grows into a Photon Laser Emitter.',
    category: 'seed', farmableTier: 3, rarity: 'rare', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 9, xpValue: 7,
    producesTileId: ITEM_IDS.FARM_LASER_GRID, growthTimeMs: 48000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_PINBALL_BUMPER, ITEM_IDS.GP_SEED_RED_BLOCK],
    colorPrimary: '#06b6d4', colorSecondary: '#1e293b', colorAccent: '#ef4444',
  },
  [ITEM_IDS.SEED_FARM_SORCERER_ORB]: {
    id: ITEM_IDS.SEED_FARM_SORCERER_ORB, key: 'seed_farm_sorcerer_orb', name: 'Sorcerer Mana Seed',
    description: 'Tier IV Farmable Seed. Grows into a Sorcerer Mana Sphere.',
    category: 'seed', farmableTier: 4, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 12, xpValue: 8,
    producesTileId: ITEM_IDS.FARM_SORCERER_ORB, growthTimeMs: 60000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_CHANDELIER, ITEM_IDS.SEED_FARM_BLACKROCK_GEM],
    colorPrimary: '#a855f7', colorSecondary: '#4c1d95', colorAccent: '#f0abfc',
  },
  [ITEM_IDS.SEED_FARM_EMERALD_GEODE]: {
    id: ITEM_IDS.SEED_FARM_EMERALD_GEODE, key: 'seed_farm_emerald_geode', name: 'Emerald Geode Seed',
    description: 'Tier IV Farmable Seed. Grows into a Verdant Emerald Geode.',
    category: 'seed', farmableTier: 4, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 13, xpValue: 9,
    producesTileId: ITEM_IDS.FARM_EMERALD_GEODE, growthTimeMs: 64000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_BAMBOO_SHOOT, ITEM_IDS.SEED_FARM_BLACKROCK_GEM],
    colorPrimary: '#10b981', colorSecondary: '#064e3b', colorAccent: '#6ee7b7',
  },
  [ITEM_IDS.SEED_FARM_SUNSTONE_PILLAR]: {
    id: ITEM_IDS.SEED_FARM_SUNSTONE_PILLAR, key: 'seed_farm_sunstone_pillar', name: 'Sunstone Obelisk Seed',
    description: 'Tier IV Farmable Seed. Grows into a Solar Sunstone Obelisk.',
    category: 'seed', farmableTier: 4, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 14, xpValue: 9,
    producesTileId: ITEM_IDS.FARM_SUNSTONE_PILLAR, growthTimeMs: 68000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_GOLD_TREASURE, ITEM_IDS.SEED_FARM_CHANDELIER],
    colorPrimary: '#f97316', colorSecondary: '#9a3412', colorAccent: '#fde047',
  },
  [ITEM_IDS.SEED_FARM_FROST_LOTUS]: {
    id: ITEM_IDS.SEED_FARM_FROST_LOTUS, key: 'seed_farm_frost_lotus', name: 'Glacial Lotus Seed',
    description: 'Tier IV Farmable Seed. Grows into a Glacial Diamond Lotus.',
    category: 'seed', farmableTier: 4, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 15, xpValue: 10,
    producesTileId: ITEM_IDS.FARM_FROST_LOTUS, growthTimeMs: 72000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_LASER_GRID, ITEM_IDS.SEED_FARM_CHANDELIER],
    colorPrimary: '#38bdf8', colorSecondary: '#0369a1', colorAccent: '#f0f9ff',
  },
  [ITEM_IDS.SEED_FARM_STARLIGHT_PRISM]: {
    id: ITEM_IDS.SEED_FARM_STARLIGHT_PRISM, key: 'seed_farm_starlight_prism', name: 'Starlight Prism Seed',
    description: 'Tier V Farmable Seed. Grows into a Starlight Refracting Prism.',
    category: 'seed', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 18, xpValue: 12,
    producesTileId: ITEM_IDS.FARM_STARLIGHT_PRISM, growthTimeMs: 85000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_SORCERER_ORB, ITEM_IDS.SEED_FARM_FROST_LOTUS],
    colorPrimary: '#818cf8', colorSecondary: '#312e81', colorAccent: '#fdf4ff',
  },
  [ITEM_IDS.SEED_FARM_DRAGON_HOARD]: {
    id: ITEM_IDS.SEED_FARM_DRAGON_HOARD, key: 'seed_farm_dragon_hoard', name: 'Drake Hoard Seed',
    description: 'Tier V Farmable Seed. Grows into a Drake Sovereign Hoard.',
    category: 'seed', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 20, xpValue: 13,
    producesTileId: ITEM_IDS.FARM_DRAGON_HOARD, growthTimeMs: 90000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_SUNSTONE_PILLAR, ITEM_IDS.SEED_FARM_EMERALD_GEODE],
    colorPrimary: '#ef4444', colorSecondary: '#7f1d1d', colorAccent: '#facc15',
  },
  [ITEM_IDS.SEED_FARM_AETHER_REACTOR]: {
    id: ITEM_IDS.SEED_FARM_AETHER_REACTOR, key: 'seed_farm_aether_reactor', name: 'Quantum Aether Seed',
    description: 'Tier V Farmable Seed. Grows into a Quantum Aether Core.',
    category: 'seed', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 22, xpValue: 15,
    producesTileId: ITEM_IDS.FARM_AETHER_REACTOR, growthTimeMs: 95000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_STARLIGHT_PRISM, ITEM_IDS.SEED_FARM_LASER_GRID],
    colorPrimary: '#2dd4bf', colorSecondary: '#115e59', colorAccent: '#f472b6',
  },
  [ITEM_IDS.SEED_FARM_CELESTIAL_MONOLITH]: {
    id: ITEM_IDS.SEED_FARM_CELESTIAL_MONOLITH, key: 'seed_farm_celestial_monolith', name: 'Celestial Monolith Seed',
    description: 'Tier V Apex Farmable Seed. Grows into a Celestial Crown Monolith.',
    category: 'seed', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 26, xpValue: 18,
    producesTileId: ITEM_IDS.FARM_CELESTIAL_MONOLITH, growthTimeMs: 105000,
    spliceIngredients: [ITEM_IDS.SEED_FARM_STARLIGHT_PRISM, ITEM_IDS.SEED_FARM_DRAGON_HOARD],
    colorPrimary: '#c084fc', colorSecondary: '#3b0764', colorAccent: '#fef08a',
  },
  [ITEM_IDS.SEED_FARM_CRYSTAL_BLOSSOM]: {
    id: ITEM_IDS.SEED_FARM_CRYSTAL_BLOSSOM, key: 'seed_farm_crystal_blossom', name: 'Crystal Blossom Seed',
    description: 'Tier V Botanical Seed. Grows into a Crystal Rose Blossom.',
    category: 'seed', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 21, xpValue: 14,
    producesTileId: ITEM_IDS.FARM_CRYSTAL_BLOSSOM, growthTimeMs: 110000,
    colorPrimary: '#ec4899', colorSecondary: '#9d174d', colorAccent: '#fbcfe8',
  },
  [ITEM_IDS.SEED_FARM_MAGMA_ROSE]: {
    id: ITEM_IDS.SEED_FARM_MAGMA_ROSE, key: 'seed_farm_magma_rose', name: 'Magma Rose Seed',
    description: 'Tier V Botanical Seed. Grows into an Obsidian Magma Rose.',
    category: 'seed', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 22, xpValue: 14,
    producesTileId: ITEM_IDS.FARM_MAGMA_ROSE, growthTimeMs: 115000,
    colorPrimary: '#f97316', colorSecondary: '#9a3412', colorAccent: '#fde047',
  },
  [ITEM_IDS.SEED_FARM_SHADOW_TENDRIL]: {
    id: ITEM_IDS.SEED_FARM_SHADOW_TENDRIL, key: 'seed_farm_shadow_tendril', name: 'Shadow Tendril Seed',
    description: 'Tier V Arcane Seed. Grows into an Umbral Shadow Tendril.',
    category: 'seed', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 23, xpValue: 15,
    producesTileId: ITEM_IDS.FARM_SHADOW_TENDRIL, growthTimeMs: 125000,
    colorPrimary: '#6366f1', colorSecondary: '#312e81', colorAccent: '#c7d2fe',
  },
  [ITEM_IDS.SEED_FARM_PLASMA_ORCHID]: {
    id: ITEM_IDS.SEED_FARM_PLASMA_ORCHID, key: 'seed_farm_plasma_orchid', name: 'Plasma Orchid Seed',
    description: 'Tier V Luminescent Seed. Grows into a Radiant Plasma Orchid.',
    category: 'seed', farmableTier: 5, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 24, xpValue: 16,
    producesTileId: ITEM_IDS.FARM_PLASMA_ORCHID, growthTimeMs: 130000,
    colorPrimary: '#06b6d4', colorSecondary: '#0e7490', colorAccent: '#a5f3fc',
  },
  [ITEM_IDS.SEED_FARM_PRISM_SHARD]: {
    id: ITEM_IDS.SEED_FARM_PRISM_SHARD, key: 'seed_farm_prism_shard', name: 'Prism Spire Seed',
    description: 'Tier VI Geomineral Seed. Grows into a Refractive Prism Spire.',
    category: 'seed', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 28, xpValue: 19,
    producesTileId: ITEM_IDS.FARM_PRISM_SHARD, growthTimeMs: 150000,
    colorPrimary: '#a855f7', colorSecondary: '#581c87', colorAccent: '#f0abfc',
  },
  [ITEM_IDS.SEED_FARM_THUNDER_CACTUS]: {
    id: ITEM_IDS.SEED_FARM_THUNDER_CACTUS, key: 'seed_farm_thunder_cactus', name: 'Thunder Spike Seed',
    description: 'Tier VI Geomineral Seed. Grows into a Fulgarite Thunder Spike.',
    category: 'seed', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 30, xpValue: 20,
    producesTileId: ITEM_IDS.FARM_THUNDER_CACTUS, growthTimeMs: 165000,
    colorPrimary: '#eab308', colorSecondary: '#854d0e', colorAccent: '#fef08a',
  },
  [ITEM_IDS.SEED_FARM_VOID_LILY]: {
    id: ITEM_IDS.SEED_FARM_VOID_LILY, key: 'seed_farm_void_lily', name: 'Void Lily Seed',
    description: 'Tier VI Arcane Seed. Grows into an Abyssal Void Lily.',
    category: 'seed', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 32, xpValue: 21,
    producesTileId: ITEM_IDS.FARM_VOID_LILY, growthTimeMs: 180000,
    colorPrimary: '#8b5cf6', colorSecondary: '#4c1d95', colorAccent: '#ddd6fe',
  },
  [ITEM_IDS.SEED_FARM_HYPERION_BULB]: {
    id: ITEM_IDS.SEED_FARM_HYPERION_BULB, key: 'seed_farm_hyperion_bulb', name: 'Hyperion Globe Seed',
    description: 'Tier VI Luminescent Seed. Grows into a Hyperion Sol Globe.',
    category: 'seed', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 34, xpValue: 22,
    producesTileId: ITEM_IDS.FARM_HYPERION_BULB, growthTimeMs: 195000,
    colorPrimary: '#f59e0b', colorSecondary: '#b45309', colorAccent: '#fef3c7',
  },
  [ITEM_IDS.SEED_FARM_SOLARIUM_BLOOM]: {
    id: ITEM_IDS.SEED_FARM_SOLARIUM_BLOOM, key: 'seed_farm_solarium_bloom', name: 'Solarium Core Seed',
    description: 'Tier VI Luminescent Seed. Grows into a Solarium Core Blossom.',
    category: 'seed', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 36, xpValue: 24,
    producesTileId: ITEM_IDS.FARM_SOLARIUM_BLOOM, growthTimeMs: 210000,
    colorPrimary: '#facc15', colorSecondary: '#ca8a04', colorAccent: '#ffffff',
  },
  [ITEM_IDS.SEED_FARM_CHRONO_FERN]: {
    id: ITEM_IDS.SEED_FARM_CHRONO_FERN, key: 'seed_farm_chrono_fern', name: 'Chrono Fern Seed',
    description: 'Tier VI Arcane Seed. Grows into a Temporal Chrono Fern.',
    category: 'seed', farmableTier: 6, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 38, xpValue: 25,
    producesTileId: ITEM_IDS.FARM_CHRONO_FERN, growthTimeMs: 225000,
    colorPrimary: '#3b82f6', colorSecondary: '#1e3a8a', colorAccent: '#bfdbfe',
  },
  [ITEM_IDS.SEED_FARM_NEBULA_SPORE]: {
    id: ITEM_IDS.SEED_FARM_NEBULA_SPORE, key: 'seed_farm_nebula_spore', name: 'Nebula Spore Seed',
    description: 'Tier VII Cosmic Seed. Grows into a Cosmic Nebula Spore.',
    category: 'seed', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 42, xpValue: 28,
    producesTileId: ITEM_IDS.FARM_NEBULA_SPORE, growthTimeMs: 250000,
    colorPrimary: '#d946ef', colorSecondary: '#701a75', colorAccent: '#f5d0fe',
  },
  [ITEM_IDS.SEED_FARM_DARK_MATTER_CORE]: {
    id: ITEM_IDS.SEED_FARM_DARK_MATTER_CORE, key: 'seed_farm_dark_matter_core', name: 'Dark Matter Seed',
    description: 'Tier VII Cosmic Seed. Grows into a Dark Matter Crucible.',
    category: 'seed', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 45, xpValue: 30,
    producesTileId: ITEM_IDS.FARM_DARK_MATTER_CORE, growthTimeMs: 275000,
    colorPrimary: '#18181b', colorSecondary: '#09090b', colorAccent: '#818cf8',
  },
  [ITEM_IDS.SEED_FARM_PULSAR_BLOSSOM]: {
    id: ITEM_IDS.SEED_FARM_PULSAR_BLOSSOM, key: 'seed_farm_pulsar_blossom', name: 'Pulsar Blossom Seed',
    description: 'Tier VII Luminescent Seed. Grows into a Pulsar Neutron Blossom.',
    category: 'seed', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 48, xpValue: 32,
    producesTileId: ITEM_IDS.FARM_PULSAR_BLOSSOM, growthTimeMs: 300000,
    colorPrimary: '#38bdf8', colorSecondary: '#075985', colorAccent: '#e0f2fe',
  },
  [ITEM_IDS.SEED_FARM_SUPERNOVA_FRUIT]: {
    id: ITEM_IDS.SEED_FARM_SUPERNOVA_FRUIT, key: 'seed_farm_supernova_fruit', name: 'Supernova Seed',
    description: 'Tier VII Cosmic Seed. Grows into a Supernova Fusion Fruit.',
    category: 'seed', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 52, xpValue: 35,
    producesTileId: ITEM_IDS.FARM_SUPERNOVA_FRUIT, growthTimeMs: 330000,
    colorPrimary: '#ef4444', colorSecondary: '#7f1d1d', colorAccent: '#fed7aa',
  },
  [ITEM_IDS.SEED_FARM_TITAN_THORN]: {
    id: ITEM_IDS.SEED_FARM_TITAN_THORN, key: 'seed_farm_titan_thorn', name: 'Titan Thorn Seed',
    description: 'Tier VII Botanical Seed. Grows into a Colossal Titan Thorn.',
    category: 'seed', farmableTier: 7, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 55, xpValue: 37,
    producesTileId: ITEM_IDS.FARM_TITAN_THORN, growthTimeMs: 360000,
    colorPrimary: '#16a34a', colorSecondary: '#14532d', colorAccent: '#bbf7d0',
  },
  [ITEM_IDS.SEED_FARM_QUANTUM_VINE]: {
    id: ITEM_IDS.SEED_FARM_QUANTUM_VINE, key: 'seed_farm_quantum_vine', name: 'Quantum Vine Seed',
    description: 'Tier VIII Botanical Seed. Grows into a Quantum Entangled Vine.',
    category: 'seed', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 60, xpValue: 40,
    producesTileId: ITEM_IDS.FARM_QUANTUM_VINE, growthTimeMs: 400000,
    colorPrimary: '#10b981', colorSecondary: '#064e3b', colorAccent: '#a7f3d0',
  },
  [ITEM_IDS.SEED_FARM_ASTRAL_CHRYSALIS]: {
    id: ITEM_IDS.SEED_FARM_ASTRAL_CHRYSALIS, key: 'seed_farm_astral_chrysalis', name: 'Astral Chrysalis Seed',
    description: 'Tier VIII Arcane Seed. Grows into an Astral Monarch Chrysalis.',
    category: 'seed', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 65, xpValue: 43,
    producesTileId: ITEM_IDS.FARM_ASTRAL_CHRYSALIS, growthTimeMs: 450000,
    colorPrimary: '#8b5cf6', colorSecondary: '#4c1d95', colorAccent: '#fdf4ff',
  },
  [ITEM_IDS.SEED_FARM_GENESIS_SEEDLING]: {
    id: ITEM_IDS.SEED_FARM_GENESIS_SEEDLING, key: 'seed_farm_genesis_seedling', name: 'Genesis Seedling',
    description: 'Tier VIII Botanical Seed. Grows into a Genesis World Sapling.',
    category: 'seed', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 70, xpValue: 46,
    producesTileId: ITEM_IDS.FARM_GENESIS_SEEDLING, growthTimeMs: 500000,
    colorPrimary: '#22c55e', colorSecondary: '#15803d', colorAccent: '#fef08a',
  },
  [ITEM_IDS.SEED_FARM_INFINITY_LOTUS]: {
    id: ITEM_IDS.SEED_FARM_INFINITY_LOTUS, key: 'seed_farm_infinity_lotus', name: 'Infinity Lotus Seed',
    description: 'Tier VIII Cosmic Seed. Grows into an Infinity Prism Lotus.',
    category: 'seed', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 78, xpValue: 50,
    producesTileId: ITEM_IDS.FARM_INFINITY_LOTUS, growthTimeMs: 550000,
    colorPrimary: '#06b6d4', colorSecondary: '#0f766e', colorAccent: '#f43f5e',
  },
  [ITEM_IDS.SEED_FARM_OMEGA_MONOLITH]: {
    id: ITEM_IDS.SEED_FARM_OMEGA_MONOLITH, key: 'seed_farm_omega_monolith', name: 'Omega Monolith Seed',
    description: 'Tier VIII Sovereign Apex Seed. Grows into an Omega Sovereign Monolith.',
    category: 'seed', farmableTier: 8, rarity: 'epic', stackLimit: 200,
    collision: 'none', breakable: true, hardness: 1, placeable: true, tradeable: true, gemValue: 88, xpValue: 60,
    producesTileId: ITEM_IDS.FARM_OMEGA_MONOLITH, growthTimeMs: 600000,
    colorPrimary: '#e11d48', colorSecondary: '#4c0519', colorAccent: '#fbbf24',
  },
};

export type FarmableBranch = 'botanical' | 'geomineral' | 'luminescent' | 'arcane' | 'cosmic';

export interface FarmableSpec {
  id: number;
  seedId: number;
  key: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  branch: FarmableBranch;
  growthTimeSec: number;
  gemValue: number;
  xpValue: number;
  hardness: number;
  minBlocks: number;
  maxBlocks: number;
  seedDropRate: number;
  blockDropRate: number;
  description: string;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
}

export const FARMABLE_SPECS: FarmableSpec[] = [
  // 1..5
  { id: 900, seedId: 950, key: 'farm_sugar_cane', name: 'Sugar Cane Stalk', tier: 1, branch: 'botanical', growthTimeSec: 14, gemValue: 4, xpValue: 2, hardness: 2, minBlocks: 2, maxBlocks: 4, seedDropRate: 0.25, blockDropRate: 0.68, description: 'Fast-multiplying sweet reed.', colorPrimary: '#78d64b', colorSecondary: '#3b8220', colorAccent: '#d9ff9e' },
  { id: 901, seedId: 951, key: 'farm_pepper_bush', name: 'Crimson Pepper Tree', tier: 1, branch: 'botanical', growthTimeSec: 16, gemValue: 5, xpValue: 2, hardness: 3, minBlocks: 2, maxBlocks: 4, seedDropRate: 0.25, blockDropRate: 0.68, description: 'Classic spicy bush with steady gems.', colorPrimary: '#dc2626', colorSecondary: '#15803d', colorAccent: '#fde047' },
  { id: 902, seedId: 952, key: 'farm_bounty_wheat', name: 'Golden Bounty Bale', tier: 1, branch: 'botanical', growthTimeSec: 18, gemValue: 5, xpValue: 2, hardness: 2, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.24, blockDropRate: 0.67, description: 'Golden grain bale with generous gems.', colorPrimary: '#eab308', colorSecondary: '#a16207', colorAccent: '#fef08a' },
  { id: 903, seedId: 953, key: 'farm_glow_shroom', name: 'Luminous Spore Cap', tier: 1, branch: 'luminescent', growthTimeSec: 20, gemValue: 6, xpValue: 3, hardness: 3, minBlocks: 2, maxBlocks: 4, seedDropRate: 0.25, blockDropRate: 0.68, description: 'Bioluminescent cave fungus.', colorPrimary: '#22d3ee', colorSecondary: '#0e7490', colorAccent: '#cffafe' },
  { id: 904, seedId: 954, key: 'farm_bamboo_shoot', name: 'Jade Bamboo Bundle', tier: 2, branch: 'botanical', growthTimeSec: 24, gemValue: 8, xpValue: 3, hardness: 3, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.26, blockDropRate: 0.68, description: 'Dense emerald bamboo stalks.', colorPrimary: '#10b981', colorSecondary: '#047857', colorAccent: '#a7f3d0' },

  // 6..10
  { id: 905, seedId: 955, key: 'farm_honey_comb', name: 'Amber Honeycomb', tier: 2, branch: 'arcane', growthTimeSec: 28, gemValue: 9, xpValue: 4, hardness: 4, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.26, blockDropRate: 0.68, description: 'Golden hive cell of crystallized nectar.', colorPrimary: '#f59e0b', colorSecondary: '#92400e', colorAccent: '#fde68a' },
  { id: 906, seedId: 956, key: 'farm_pinball_bumper', name: 'Pinball Pulse Bumper', tier: 2, branch: 'arcane', growthTimeSec: 32, gemValue: 10, xpValue: 4, hardness: 4, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.26, blockDropRate: 0.68, description: 'Kinetic rubber bumper bursting with spark gems.', colorPrimary: '#ec4899', colorSecondary: '#831843', colorAccent: '#fbcfe8' },
  { id: 907, seedId: 957, key: 'farm_venus_trap', name: 'Carnivorous Venus Trap', tier: 2, branch: 'botanical', growthTimeSec: 36, gemValue: 12, xpValue: 4, hardness: 4, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.26, blockDropRate: 0.68, description: 'Ferocious jungle trap dropping rich gems.', colorPrimary: '#84cc16', colorSecondary: '#3f6212', colorAccent: '#f43f5e' },
  { id: 908, seedId: 958, key: 'farm_blackrock_gem', name: 'Obsidian Blackrock Core', tier: 3, branch: 'geomineral', growthTimeSec: 42, gemValue: 14, xpValue: 5, hardness: 5, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.27, blockDropRate: 0.69, description: 'Hardened basalt embedded with dark gems.', colorPrimary: '#334155', colorSecondary: '#0f172a', colorAccent: '#f43f5e' },
  { id: 909, seedId: 959, key: 'farm_gold_treasure', name: 'Gilded Bullion Crate', tier: 3, branch: 'geomineral', growthTimeSec: 48, gemValue: 16, xpValue: 6, hardness: 5, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.27, blockDropRate: 0.69, description: 'Reinforced coffer of minted gold coins.', colorPrimary: '#fbbf24', colorSecondary: '#78350f', colorAccent: '#fef9c3' },

  // 11..15
  { id: 910, seedId: 960, key: 'farm_chandelier', name: 'Royal Crystal Chandelier', tier: 3, branch: 'luminescent', growthTimeSec: 54, gemValue: 18, xpValue: 6, hardness: 5, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.27, blockDropRate: 0.69, description: 'Iconic crystal chandelier bursting into gems.', colorPrimary: '#facc15', colorSecondary: '#ca8a04', colorAccent: '#e0f2fe' },
  { id: 911, seedId: 961, key: 'farm_laser_grid', name: 'Photon Laser Emitter', tier: 3, branch: 'luminescent', growthTimeSec: 60, gemValue: 19, xpValue: 7, hardness: 5, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.27, blockDropRate: 0.69, description: 'High-tech optical grid emitter.', colorPrimary: '#06b6d4', colorSecondary: '#1e293b', colorAccent: '#ef4444' },
  { id: 912, seedId: 962, key: 'farm_sorcerer_orb', name: 'Sorcerer Mana Sphere', tier: 4, branch: 'arcane', growthTimeSec: 68, gemValue: 24, xpValue: 8, hardness: 6, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.28, blockDropRate: 0.70, description: 'Arcane levitating sphere of condensed ether.', colorPrimary: '#a855f7', colorSecondary: '#4c1d95', colorAccent: '#f0abfc' },
  { id: 913, seedId: 963, key: 'farm_emerald_geode', name: 'Verdant Emerald Geode', tier: 4, branch: 'geomineral', growthTimeSec: 74, gemValue: 26, xpValue: 9, hardness: 6, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.28, blockDropRate: 0.70, description: 'Hollow cavity lined with emerald spires.', colorPrimary: '#10b981', colorSecondary: '#064e3b', colorAccent: '#6ee7b7' },
  { id: 914, seedId: 964, key: 'farm_sunstone_pillar', name: 'Solar Sunstone Obelisk', tier: 4, branch: 'geomineral', growthTimeSec: 80, gemValue: 28, xpValue: 9, hardness: 6, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.28, blockDropRate: 0.70, description: 'Desert-gold monument infused with solar energy.', colorPrimary: '#f97316', colorSecondary: '#9a3412', colorAccent: '#fde047' },

  // 16..20
  { id: 915, seedId: 965, key: 'farm_frost_lotus', name: 'Glacial Diamond Lotus', tier: 4, branch: 'arcane', growthTimeSec: 86, gemValue: 30, xpValue: 10, hardness: 6, minBlocks: 2, maxBlocks: 5, seedDropRate: 0.28, blockDropRate: 0.70, description: 'Ice blossom shattering into diamond gems.', colorPrimary: '#38bdf8', colorSecondary: '#0369a1', colorAccent: '#f0f9ff' },
  { id: 916, seedId: 966, key: 'farm_starlight_prism', name: 'Starlight Refracting Prism', tier: 5, branch: 'luminescent', growthTimeSec: 96, gemValue: 36, xpValue: 12, hardness: 7, minBlocks: 3, maxBlocks: 5, seedDropRate: 0.29, blockDropRate: 0.71, description: 'Astral prism splitting starlight into gems.', colorPrimary: '#818cf8', colorSecondary: '#312e81', colorAccent: '#fdf4ff' },
  { id: 917, seedId: 967, key: 'farm_dragon_hoard', name: 'Drake Sovereign Hoard', tier: 5, branch: 'geomineral', growthTimeSec: 108, gemValue: 40, xpValue: 13, hardness: 7, minBlocks: 3, maxBlocks: 5, seedDropRate: 0.29, blockDropRate: 0.71, description: 'Draconic ruby vault of ancient kings.', colorPrimary: '#ef4444', colorSecondary: '#7f1d1d', colorAccent: '#facc15' },
  { id: 918, seedId: 968, key: 'farm_aether_reactor', name: 'Quantum Aether Core', tier: 5, branch: 'cosmic', growthTimeSec: 120, gemValue: 45, xpValue: 15, hardness: 8, minBlocks: 3, maxBlocks: 5, seedDropRate: 0.30, blockDropRate: 0.72, description: 'Hyper-dense plasma containment cell.', colorPrimary: '#2dd4bf', colorSecondary: '#115e59', colorAccent: '#f472b6' },
  { id: 919, seedId: 969, key: 'farm_celestial_monolith', name: 'Celestial Crown Monolith', tier: 5, branch: 'cosmic', growthTimeSec: 140, gemValue: 52, xpValue: 18, hardness: 8, minBlocks: 3, maxBlocks: 6, seedDropRate: 0.30, blockDropRate: 0.72, description: 'Celestial monolith erupting with gem clusters.', colorPrimary: '#c084fc', colorSecondary: '#3b0764', colorAccent: '#fef08a' },

  // 21..25
  { id: 920, seedId: 970, key: 'farm_crystal_blossom', name: 'Crystal Rose Blossom', tier: 5, branch: 'botanical', growthTimeSec: 110, gemValue: 42, xpValue: 14, hardness: 7, minBlocks: 3, maxBlocks: 5, seedDropRate: 0.29, blockDropRate: 0.71, description: 'Crystalline flower with mineral pollen.', colorPrimary: '#ec4899', colorSecondary: '#9d174d', colorAccent: '#fbcfe8' },
  { id: 921, seedId: 971, key: 'farm_magma_rose', name: 'Obsidian Magma Rose', tier: 5, branch: 'botanical', growthTimeSec: 115, gemValue: 44, xpValue: 14, hardness: 7, minBlocks: 3, maxBlocks: 5, seedDropRate: 0.29, blockDropRate: 0.71, description: 'Volcanic rose yielding heated ruby gems.', colorPrimary: '#f97316', colorSecondary: '#9a3412', colorAccent: '#fde047' },
  { id: 922, seedId: 972, key: 'farm_shadow_tendril', name: 'Umbral Shadow Tendril', tier: 5, branch: 'arcane', growthTimeSec: 125, gemValue: 46, xpValue: 15, hardness: 7, minBlocks: 3, maxBlocks: 5, seedDropRate: 0.29, blockDropRate: 0.71, description: 'Dark violet tendrils condensing shadowy gems.', colorPrimary: '#6366f1', colorSecondary: '#312e81', colorAccent: '#c7d2fe' },
  { id: 923, seedId: 973, key: 'farm_plasma_orchid', name: 'Radiant Plasma Orchid', tier: 5, branch: 'luminescent', growthTimeSec: 130, gemValue: 48, xpValue: 16, hardness: 7, minBlocks: 3, maxBlocks: 5, seedDropRate: 0.30, blockDropRate: 0.72, description: 'Vibrant electric bloom emitting ion clouds.', colorPrimary: '#06b6d4', colorSecondary: '#0e7490', colorAccent: '#a5f3fc' },
  { id: 924, seedId: 974, key: 'farm_prism_shard', name: 'Refractive Prism Spire', tier: 6, branch: 'geomineral', growthTimeSec: 150, gemValue: 56, xpValue: 19, hardness: 8, minBlocks: 3, maxBlocks: 6, seedDropRate: 0.30, blockDropRate: 0.72, description: 'Multi-faceted crystalline quartz cluster.', colorPrimary: '#a855f7', colorSecondary: '#581c87', colorAccent: '#f0abfc' },

  // 26..30
  { id: 925, seedId: 975, key: 'farm_thunder_cactus', name: 'Fulgarite Thunder Spike', tier: 6, branch: 'geomineral', growthTimeSec: 165, gemValue: 60, xpValue: 20, hardness: 8, minBlocks: 3, maxBlocks: 6, seedDropRate: 0.30, blockDropRate: 0.72, description: 'Vitrified lightning charged with topaz gems.', colorPrimary: '#eab308', colorSecondary: '#854d0e', colorAccent: '#fef08a' },
  { id: 926, seedId: 976, key: 'farm_void_lily', name: 'Abyssal Void Lily', tier: 6, branch: 'arcane', growthTimeSec: 180, gemValue: 64, xpValue: 21, hardness: 8, minBlocks: 3, maxBlocks: 6, seedDropRate: 0.31, blockDropRate: 0.73, description: 'Deep abyss bloom with dark amethyst gems.', colorPrimary: '#8b5cf6', colorSecondary: '#4c1d95', colorAccent: '#ddd6fe' },
  { id: 927, seedId: 977, key: 'farm_hyperion_bulb', name: 'Hyperion Sol Globe', tier: 6, branch: 'luminescent', growthTimeSec: 195, gemValue: 68, xpValue: 22, hardness: 8, minBlocks: 3, maxBlocks: 6, seedDropRate: 0.31, blockDropRate: 0.73, description: 'Miniature solar lamp of blazing gem plasma.', colorPrimary: '#f59e0b', colorSecondary: '#b45309', colorAccent: '#fef3c7' },
  { id: 928, seedId: 978, key: 'farm_solarium_bloom', name: 'Solarium Core Blossom', tier: 6, branch: 'luminescent', growthTimeSec: 210, gemValue: 72, xpValue: 24, hardness: 8, minBlocks: 3, maxBlocks: 6, seedDropRate: 0.31, blockDropRate: 0.73, description: 'Radiant engineered flora with golden shards.', colorPrimary: '#facc15', colorSecondary: '#ca8a04', colorAccent: '#ffffff' },
  { id: 929, seedId: 979, key: 'farm_chrono_fern', name: 'Temporal Chrono Fern', tier: 6, branch: 'arcane', growthTimeSec: 225, gemValue: 76, xpValue: 25, hardness: 8, minBlocks: 3, maxBlocks: 6, seedDropRate: 0.32, blockDropRate: 0.73, description: 'Temporal fern dropping sapphire gems.', colorPrimary: '#3b82f6', colorSecondary: '#1e3a8a', colorAccent: '#bfdbfe' },

  // 31..35
  { id: 930, seedId: 980, key: 'farm_nebula_spore', name: 'Cosmic Nebula Spore', tier: 7, branch: 'cosmic', growthTimeSec: 250, gemValue: 84, xpValue: 28, hardness: 9, minBlocks: 3, maxBlocks: 6, seedDropRate: 0.32, blockDropRate: 0.74, description: 'Interstellar spore cluster with violet stardust.', colorPrimary: '#d946ef', colorSecondary: '#701a75', colorAccent: '#f5d0fe' },
  { id: 931, seedId: 981, key: 'farm_dark_matter_core', name: 'Dark Matter Crucible', tier: 7, branch: 'cosmic', growthTimeSec: 275, gemValue: 90, xpValue: 30, hardness: 9, minBlocks: 3, maxBlocks: 6, seedDropRate: 0.32, blockDropRate: 0.74, description: 'Gravitationally collapsed core of onyx gems.', colorPrimary: '#18181b', colorSecondary: '#09090b', colorAccent: '#818cf8' },
  { id: 932, seedId: 982, key: 'farm_pulsar_blossom', name: 'Pulsar Neutron Blossom', tier: 7, branch: 'luminescent', growthTimeSec: 300, gemValue: 96, xpValue: 32, hardness: 9, minBlocks: 3, maxBlocks: 7, seedDropRate: 0.33, blockDropRate: 0.74, description: 'Neutron beam petals releasing rhythmic gem surges.', colorPrimary: '#38bdf8', colorSecondary: '#075985', colorAccent: '#e0f2fe' },
  { id: 933, seedId: 983, key: 'farm_supernova_fruit', name: 'Supernova Fusion Fruit', tier: 7, branch: 'cosmic', growthTimeSec: 330, gemValue: 104, xpValue: 35, hardness: 9, minBlocks: 3, maxBlocks: 7, seedDropRate: 0.33, blockDropRate: 0.75, description: 'Concentrated stellar explosion in crystal hull.', colorPrimary: '#ef4444', colorSecondary: '#7f1d1d', colorAccent: '#fed7aa' },
  { id: 934, seedId: 984, key: 'farm_titan_thorn', name: 'Colossal Titan Thorn', tier: 7, branch: 'botanical', growthTimeSec: 360, gemValue: 110, xpValue: 37, hardness: 9, minBlocks: 3, maxBlocks: 7, seedDropRate: 0.33, blockDropRate: 0.75, description: 'Petrified primordial wood of emerald wealth.', colorPrimary: '#16a34a', colorSecondary: '#14532d', colorAccent: '#bbf7d0' },

  // 36..40
  { id: 935, seedId: 985, key: 'farm_quantum_vine', name: 'Quantum Entangled Vine', tier: 8, branch: 'botanical', growthTimeSec: 400, gemValue: 120, xpValue: 40, hardness: 10, minBlocks: 4, maxBlocks: 7, seedDropRate: 0.34, blockDropRate: 0.75, description: 'Multidimensional vine weaving probability fields.', colorPrimary: '#10b981', colorSecondary: '#064e3b', colorAccent: '#a7f3d0' },
  { id: 936, seedId: 986, key: 'farm_astral_chrysalis', name: 'Astral Monarch Chrysalis', tier: 8, branch: 'arcane', growthTimeSec: 450, gemValue: 130, xpValue: 43, hardness: 10, minBlocks: 4, maxBlocks: 7, seedDropRate: 0.34, blockDropRate: 0.75, description: 'Divine etheric cocoon with regal gem showers.', colorPrimary: '#8b5cf6', colorSecondary: '#4c1d95', colorAccent: '#fdf4ff' },
  { id: 937, seedId: 987, key: 'farm_genesis_seedling', name: 'Genesis World Sapling', tier: 8, branch: 'botanical', growthTimeSec: 500, gemValue: 140, xpValue: 46, hardness: 10, minBlocks: 4, maxBlocks: 7, seedDropRate: 0.35, blockDropRate: 0.76, description: 'World-tree sapling blessed by ancient earth deities.', colorPrimary: '#22c55e', colorSecondary: '#15803d', colorAccent: '#fef08a' },
  { id: 938, seedId: 988, key: 'farm_infinity_lotus', name: 'Infinity Prism Lotus', tier: 8, branch: 'cosmic', growthTimeSec: 550, gemValue: 155, xpValue: 50, hardness: 10, minBlocks: 4, maxBlocks: 8, seedDropRate: 0.35, blockDropRate: 0.76, description: 'Sacred multidimensional lotus of endless wealth.', colorPrimary: '#06b6d4', colorSecondary: '#0f766e', colorAccent: '#f43f5e' },
  { id: 939, seedId: 989, key: 'farm_omega_monolith', name: 'Omega Sovereign Monolith', tier: 8, branch: 'cosmic', growthTimeSec: 600, gemValue: 175, xpValue: 60, hardness: 10, minBlocks: 4, maxBlocks: 8, seedDropRate: 0.36, blockDropRate: 0.77, description: 'The ultimate manifestation of agricultural mastery.', colorPrimary: '#e11d48', colorSecondary: '#4c0519', colorAccent: '#fbbf24' },
];

export function getFarmableSpec(idOrSeedId: number): FarmableSpec | undefined {
  return FARMABLE_SPECS.find(s => s.id === idOrSeedId || s.seedId === idOrSeedId);
}

export function getFarmablesByBranch(branch: FarmableBranch): FarmableSpec[] {
  return FARMABLE_SPECS.filter(s => s.branch === branch);
}

export function isFarmableSeed(seedId: number): boolean {
  return seedId >= 950 && seedId <= 989;
}

export interface CropSpec {
  seedId: number;
  blockId: number;
  cropItemId: number;
  keyBase: string;
  name: string;
  rarity: ItemRarity;
  growthTimeSec: number;
  seedAlterbitPrice: number;
  seedGemPrice?: number;
  minYield: number;
  maxYield: number;
  sellAlterbits: number;
  xpValue: number;
  worldXpValue: number;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
}

export const CROP_SPECS: CropSpec[] = [
  {
    seedId: ITEM_IDS.CROP_SEED_RADISH,
    blockId: ITEM_IDS.CROP_BLOCK_RADISH,
    cropItemId: ITEM_IDS.CROP_RADISH,
    keyBase: 'radish',
    name: 'Crisp Radish',
    rarity: 'common',
    growthTimeSec: 20,
    seedAlterbitPrice: 10,
    minYield: 2,
    maxYield: 4,
    sellAlterbits: 8,
    xpValue: 3,
    worldXpValue: 5,
    colorPrimary: '#f43f5e',
    colorSecondary: '#9f1239',
    colorAccent: '#fecdd3',
  },
  {
    seedId: ITEM_IDS.CROP_SEED_CARROT,
    blockId: ITEM_IDS.CROP_BLOCK_CARROT,
    cropItemId: ITEM_IDS.CROP_CARROT,
    keyBase: 'carrot',
    name: 'Sunroot Carrot',
    rarity: 'common',
    growthTimeSec: 35,
    seedAlterbitPrice: 25,
    minYield: 2,
    maxYield: 5,
    sellAlterbits: 14,
    xpValue: 5,
    worldXpValue: 8,
    colorPrimary: '#f97316',
    colorSecondary: '#9a3412',
    colorAccent: '#fed7aa',
  },
  {
    seedId: ITEM_IDS.CROP_SEED_CABBAGE,
    blockId: ITEM_IDS.CROP_BLOCK_CABBAGE,
    cropItemId: ITEM_IDS.CROP_CABBAGE,
    keyBase: 'cabbage',
    name: 'Verdant Cabbage',
    rarity: 'uncommon',
    growthTimeSec: 50,
    seedAlterbitPrice: 60,
    minYield: 3,
    maxYield: 5,
    sellAlterbits: 24,
    xpValue: 8,
    worldXpValue: 12,
    colorPrimary: '#4ade80',
    colorSecondary: '#166534',
    colorAccent: '#bbf7d0',
  },
  {
    seedId: ITEM_IDS.CROP_SEED_TOMATO,
    blockId: ITEM_IDS.CROP_BLOCK_TOMATO,
    cropItemId: ITEM_IDS.CROP_TOMATO,
    keyBase: 'tomato',
    name: 'Ruby Vine Tomato',
    rarity: 'uncommon',
    growthTimeSec: 70,
    seedAlterbitPrice: 140,
    minYield: 3,
    maxYield: 6,
    sellAlterbits: 45,
    xpValue: 12,
    worldXpValue: 18,
    colorPrimary: '#ef4444',
    colorSecondary: '#991b1b',
    colorAccent: '#fca5a5',
  },
  {
    seedId: ITEM_IDS.CROP_SEED_CORN,
    blockId: ITEM_IDS.CROP_BLOCK_CORN,
    cropItemId: ITEM_IDS.CROP_CORN,
    keyBase: 'corn',
    name: 'Golden Sweetcorn',
    rarity: 'rare',
    growthTimeSec: 95,
    seedAlterbitPrice: 300,
    minYield: 3,
    maxYield: 6,
    sellAlterbits: 85,
    xpValue: 18,
    worldXpValue: 26,
    colorPrimary: '#facc15',
    colorSecondary: '#a16207',
    colorAccent: '#fef9c3',
  },
  {
    seedId: ITEM_IDS.CROP_SEED_MELON,
    blockId: ITEM_IDS.CROP_BLOCK_MELON,
    cropItemId: ITEM_IDS.CROP_MELON,
    keyBase: 'melon',
    name: 'Starlight Dew Melon',
    rarity: 'epic',
    growthTimeSec: 120,
    seedAlterbitPrice: 650,
    minYield: 2,
    maxYield: 4,
    sellAlterbits: 210,
    xpValue: 28,
    worldXpValue: 40,
    colorPrimary: '#22c55e',
    colorSecondary: '#14532d',
    colorAccent: '#fda4af',
  },
];

export function isCropSeed(itemId: number): boolean {
  return itemId >= ITEM_IDS.CROP_SEED_RADISH && itemId <= ITEM_IDS.CROP_SEED_MELON;
}

export function isCropBlock(itemId: number): boolean {
  return itemId >= ITEM_IDS.CROP_BLOCK_RADISH && itemId <= ITEM_IDS.CROP_BLOCK_MELON;
}

export function isCropItem(itemId: number): boolean {
  return itemId >= ITEM_IDS.CROP_RADISH && itemId <= ITEM_IDS.CROP_MELON;
}

export function getCropSpec(itemId: number): CropSpec | undefined {
  return CROP_SPECS.find(
    (c) => c.seedId === itemId || c.blockId === itemId || c.cropItemId === itemId
  );
}

for (const c of CROP_SPECS) {
  CATALOG[c.seedId] = {
    id: c.seedId,
    key: `crop_seed_${c.keyBase}`,
    name: `${c.name} Seed`,
    description: `Crop Seed from Fresh Greens Vendor. Sow above Plowed Dirt Soil (tilled with Farming Hoe). Harvests into a ${c.name} Crop Block.`,
    category: 'seed',
    rarity: c.rarity,
    stackLimit: 200,
    collision: 'none',
    breakable: true,
    hardness: 1,
    placeable: true,
    tradeable: true,
    gemValue: 0,
    xpValue: c.xpValue,
    worldXpValue: c.worldXpValue,
    seedMedium: 'plowed_soil',
    producesTileId: c.blockId,
    growthTimeMs: c.growthTimeSec * 1000,
    cropAlterbitPrice: c.seedAlterbitPrice,
    cropGemPrice: c.seedGemPrice,
    colorPrimary: c.colorPrimary,
    colorSecondary: c.colorSecondary,
    colorAccent: c.colorAccent,
  };

  CATALOG[c.blockId] = {
    id: c.blockId,
    key: `crop_block_${c.keyBase}`,
    name: `${c.name} Crop Block`,
    description: `Ripe ${c.name} Crop Block spawned on harvest. Mine it to gather ${c.minYield}–${c.maxYield}× ${c.name} produce!`,
    category: 'foreground',
    rarity: c.rarity,
    stackLimit: 200,
    collision: 'none',
    transparent: true,
    breakable: true,
    hardness: 2,
    placeable: false,
    tradeable: false,
    gemValue: 0,
    xpValue: c.xpValue,
    worldXpValue: c.worldXpValue,
    drops: [{ itemId: c.cropItemId, chance: 1, minQty: c.minYield, maxQty: c.maxYield }],
    colorPrimary: c.colorPrimary,
    colorSecondary: c.colorSecondary,
    colorAccent: c.colorAccent,
  };

  CATALOG[c.cropItemId] = {
    id: c.cropItemId,
    key: `crop_${c.keyBase}`,
    name: c.name,
    description: `Freshly harvested ${c.name}. Sell at the Fresh Greens Vendor in NEXUS for ${c.sellAlterbits} Digibits each.`,
    category: 'material',
    rarity: c.rarity,
    stackLimit: 500,
    collision: 'none',
    breakable: false,
    hardness: 0,
    placeable: false,
    tradeable: true,
    gemValue: 0,
    xpValue: 0,
    cropSellAlterbits: c.sellAlterbits,
    colorPrimary: c.colorPrimary,
    colorSecondary: c.colorSecondary,
    colorAccent: c.colorAccent,
  };
}

export function isStandardBaselineBlock(def: ItemDefinition): boolean {
  if (!def || !def.breakable) return false;
  if (def.category === 'farmable' || (def.id >= 900 && def.id <= 939)) return false;
  if (isCropBlock(def.id) || isCropSeed(def.id) || isFarmableSeed(def.id)) return false;
  if (def.id === ITEM_IDS.PLOWED_DIRT_SOIL) return false;
  if (
    def.id === ITEM_IDS.COAL_VEIN ||
    def.id === ITEM_IDS.COPPER_VEIN ||
    def.id === ITEM_IDS.IRON_VEIN ||
    def.id === ITEM_IDS.OBSIDIAN_VEIN
  ) {
    return false;
  }
  return (
    def.category === 'foreground' ||
    def.category === 'background' ||
    def.id === ITEM_IDS.GP_SIGN ||
    def.id === ITEM_IDS.GP_CRAPPY_SIGN ||
    def.id === ITEM_IDS.GP_POINTY_SIGN ||
    def.id === ITEM_IDS.GP_DANGER_SIGN
  );
}

// Prune all non-Farmable, non-Crop seeds from CATALOG and enforce the uniform
// 12.5% single-block return, 0 Gem, 1 XP baseline on all standard placeable blocks.
for (const def of Object.values(CATALOG)) {
  delete def.spliceIngredients;
  if (def.category === 'seed' && !isFarmableSeed(def.id) && !isCropSeed(def.id)) {
    delete CATALOG[def.id];
    continue;
  }
  if (def.category !== 'farmable') {
    if (def.seedId && !isFarmableSeed(def.seedId) && !isCropSeed(def.seedId)) {
      delete def.seedId;
    }
  }
  if (isStandardBaselineBlock(def)) {
    delete def.seedId;
    def.gemValue = 0;
    def.xpValue = 1;
    def.drops = [{ itemId: def.id, chance: 0.125, minQty: 1, maxQty: 1 }];
  }
  if (def.stackLimit > 1) {
    def.stackLimit = 500;
  }
}

for (const spec of FARMABLE_SPECS) {
  const blockDef = CATALOG[spec.id];
  if (blockDef) {
    blockDef.stackLimit = 500;
    blockDef.hardness = spec.hardness;
    blockDef.gemValue = spec.gemValue;
    blockDef.xpValue = spec.xpValue;
    blockDef.farmableTier = spec.tier;
    blockDef.seedId = spec.seedId;
    blockDef.treeHarvestYield = {
      minBlocks: spec.minBlocks,
      maxBlocks: spec.maxBlocks,
      seedChance: spec.seedDropRate,
    };
    blockDef.drops = [
      { itemId: spec.id, chance: spec.blockDropRate, minQty: 1, maxQty: 1 },
      { itemId: spec.seedId, chance: spec.seedDropRate, minQty: 1, maxQty: 1 },
    ];
  }
  const seedDef = CATALOG[spec.seedId];
  if (seedDef) {
    delete seedDef.spliceIngredients;
    seedDef.stackLimit = 500;
    seedDef.description = `Tier ${spec.tier} Farmable Seed (${spec.branch}). Plant inside a Seed Pot to grow ${spec.name}.`;
    seedDef.farmableTier = spec.tier;
    seedDef.growthTimeMs = spec.growthTimeSec * 1000;
    seedDef.gemValue = Math.max(1, Math.round(spec.gemValue * 0.5));
    seedDef.xpValue = spec.xpValue;
    seedDef.placeable = true;
    seedDef.producesTileId = spec.id;
    seedDef.treeHarvestYield = {
      minBlocks: spec.minBlocks,
      maxBlocks: spec.maxBlocks,
      seedChance: spec.seedDropRate,
    };
  }
}

export interface MatteragenGeneratorSpec {
  generation: 1 | 2 | 3 | 4 | 5;
  itemId: number;
  name: string;
  baseIntervalMs: number;
  rangeLabel: string;
  farmablePoolIds: readonly number[];
}

export const MATTERAGEN_LEVEL_TIME_REDUCTION_PCT = 5; // 5% faster per upgrade level above Lv.1
export const MATTERAGEN_YIELD_TOTAL_BLOCKS_RANGE: readonly [number, number] = [1, 10];
export const MATTERAGEN_YIELD_DISTINCT_TYPES_RANGE: readonly [number, number] = [1, 3];

export const MATTERAGEN_GENERATORS: readonly MatteragenGeneratorSpec[] = [
  {
    generation: 1,
    itemId: ITEM_IDS.MATTERAGEN_BOTANICAL,
    name: 'Botanical Matteragen Engine',
    baseIntervalMs: 10 * 60 * 1000,
    rangeLabel: 'Farmables 1–6',
    farmablePoolIds: [900, 901, 902, 903, 904, 905],
  },
  {
    generation: 2,
    itemId: ITEM_IDS.MATTERAGEN_GEOMINERAL,
    name: 'Geomineral Matteragen Engine',
    baseIntervalMs: 30 * 60 * 1000,
    rangeLabel: 'Farmables 3–14',
    farmablePoolIds: [902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913],
  },
  {
    generation: 3,
    itemId: ITEM_IDS.MATTERAGEN_LUMINESCENT,
    name: 'Luminescent Matteragen Engine',
    baseIntervalMs: 60 * 60 * 1000,
    rangeLabel: 'Farmables 6–16',
    farmablePoolIds: [905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915],
  },
  {
    generation: 4,
    itemId: ITEM_IDS.MATTERAGEN_ARCANE,
    name: 'Arcane Matteragen Engine',
    baseIntervalMs: 120 * 60 * 1000,
    rangeLabel: 'Farmables 8–20',
    farmablePoolIds: [907, 908, 909, 910, 911, 912, 913, 914, 915, 916, 917, 918, 919],
  },
  {
    generation: 5,
    itemId: ITEM_IDS.MATTERAGEN_COSMIC,
    name: 'Cosmic Matteragen Engine',
    baseIntervalMs: 300 * 60 * 1000,
    rangeLabel: 'Farmables 10–30',
    farmablePoolIds: [
      909, 910, 911, 912, 913, 914, 915, 916, 917, 918, 919,
      920, 921, 922, 923, 924, 925, 926, 927, 928, 929,
    ],
  },
] as const;

export function getMatteragenGeneratorSpec(typeId: number): MatteragenGeneratorSpec {
  return (
    MATTERAGEN_GENERATORS.find((g) => g.itemId === typeId) ??
    MATTERAGEN_GENERATORS[0]
  );
}

export function getMatteragenPoolIds(typeId: number): readonly number[] {
  return getMatteragenGeneratorSpec(typeId).farmablePoolIds;
}

export function getMatteragenIntervalMs(typeId: number): number {
  return getMatteragenGeneratorSpec(typeId).baseIntervalMs;
}

/**
 * Each upgrade level above Level 1 reduces total production cycle time by 5%:
 * Lv.1 = 100%, Lv.2 = 95% (-5%), Lv.3 = 90% (-10%), Lv.4 = 85% (-15%), Lv.5 = 80% (-20%).
 */
export function getMatteragenEffectiveIntervalMs(typeId: number, level = 1): number {
  const baseMs = getMatteragenIntervalMs(typeId);
  const clampedLevel = Math.max(1, Math.min(5, Math.floor(level || 1)));
  const multiplier = 1 - (MATTERAGEN_LEVEL_TIME_REDUCTION_PCT / 100) * (clampedLevel - 1);
  return Math.max(1000, Math.round(baseMs * multiplier));
}

export function getMatteragenBranch(typeId: number): FarmableBranch {
  switch (typeId) {
    case ITEM_IDS.MATTERAGEN_BOTANICAL:
      return 'botanical';
    case ITEM_IDS.MATTERAGEN_GEOMINERAL:
      return 'geomineral';
    case ITEM_IDS.MATTERAGEN_LUMINESCENT:
      return 'luminescent';
    case ITEM_IDS.MATTERAGEN_ARCANE:
      return 'arcane';
    case ITEM_IDS.MATTERAGEN_COSMIC:
      return 'cosmic';
    default:
      return 'botanical';
  }
}

/**
 * Rolls 1–10 total Farmable Blocks partitioned across 1–3 distinct Farmable Block types
 * drawn strictly from the generator's generation range pool.
 * Yield distribution is identical across all upgrade levels (upgrades only reduce production time).
 */
export function rollMatteragenYield(
  typeId: number,
  _level = 1,
  rng: () => number = Math.random
): { itemId: number; count: number }[] {
  const pool = [...getMatteragenPoolIds(typeId)].filter((id) => Boolean(CATALOG[id]));
  if (pool.length === 0) return [];

  const [minBlocks, maxBlocks] = MATTERAGEN_YIELD_TOTAL_BLOCKS_RANGE;
  const totalBlocks =
    minBlocks + Math.floor(rng() * (maxBlocks - minBlocks + 1));

  const [, maxDistinct] = MATTERAGEN_YIELD_DISTINCT_TYPES_RANGE;
  const maxTypesPossible = Math.min(maxDistinct, totalBlocks, pool.length);
  const distinctTypesCount =
    1 + Math.floor(rng() * maxTypesPossible);

  // Sample distinctTypesCount unique block IDs from pool
  const available = [...pool];
  const chosenIds: number[] = [];
  for (let i = 0; i < distinctTypesCount; i++) {
    const idx = Math.floor(rng() * available.length);
    chosenIds.push(available[idx]);
    available.splice(idx, 1);
  }

  // Partition totalBlocks across chosenIds so each chosen type gets >= 1 block and sum === totalBlocks
  const counts = new Array<number>(distinctTypesCount).fill(1);
  let remaining = totalBlocks - distinctTypesCount;
  while (remaining > 0) {
    const slot = Math.floor(rng() * distinctTypesCount);
    counts[slot] += 1;
    remaining -= 1;
  }

  return chosenIds.map((itemId, index) => ({
    itemId,
    count: counts[index],
  }));
}

// World-relative Core Token upgrade costs for Matteragen Engines (Levels 1->5)
export const MATTERAGEN_UPGRADE_COSTS: Record<number, number> = {
  1: 3,  // Lv.1 -> Lv.2 (3 Core Tokens)
  2: 6,  // Lv.2 -> Lv.3 (6 Core Tokens)
  3: 10, // Lv.3 -> Lv.4 (10 Core Tokens)
  4: 15, // Lv.4 -> Lv.5 (15 Core Tokens)
};

// ============================================================================
// SUB-CATEGORY MASTERY SYSTEM (CROP MASTERY & FARMABLOCK MASTERY)
// ============================================================================

export function xpForNextMasteryLevel(level: number): number {
  const clamped = Math.max(1, Math.floor(level || 1));
  return Math.round(100 * Math.pow(clamped, 1.5));
}

export const CROP_MASTERY_UNLOCK_LEVEL_BY_SEED: Record<number, number> = {
  [ITEM_IDS.CROP_SEED_RADISH]: 1,
  [ITEM_IDS.CROP_SEED_CARROT]: 2,
  [ITEM_IDS.CROP_SEED_CABBAGE]: 4,
  [ITEM_IDS.CROP_SEED_TOMATO]: 6,
  [ITEM_IDS.CROP_SEED_CORN]: 8,
  [ITEM_IDS.CROP_SEED_MELON]: 10,
};

export const CROP_MASTERY_XP_BY_SEED: Record<number, number> = {
  [ITEM_IDS.CROP_SEED_RADISH]: 10,
  [ITEM_IDS.CROP_SEED_CARROT]: 18,
  [ITEM_IDS.CROP_SEED_CABBAGE]: 28,
  [ITEM_IDS.CROP_SEED_TOMATO]: 42,
  [ITEM_IDS.CROP_SEED_CORN]: 60,
  [ITEM_IDS.CROP_SEED_MELON]: 85,
};

export const FARMABLOCK_MASTERY_UNLOCK_LEVEL_BY_TIER: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 6,
  5: 8,
  6: 11,
  7: 14,
  8: 18,
};

export const FARMABLOCK_MASTERY_XP_BY_TIER: Record<number, number> = {
  1: 8,
  2: 14,
  3: 22,
  4: 32,
  5: 45,
  6: 62,
  7: 82,
  8: 110,
};

export function getCropMasteryRequiredLevel(itemId: number): number {
  const spec = getCropSpec(itemId);
  if (!spec) return 1;
  return CROP_MASTERY_UNLOCK_LEVEL_BY_SEED[spec.seedId] ?? 1;
}

export function getCropMasteryXpGrant(itemId: number): number {
  const spec = getCropSpec(itemId);
  if (!spec) return 0;
  return CROP_MASTERY_XP_BY_SEED[spec.seedId] ?? 10;
}

export function getFarmablockMasteryRequiredLevel(itemId: number): number {
  const spec = getFarmableSpec(itemId);
  const tier = spec?.tier ?? CATALOG[itemId]?.farmableTier ?? 1;
  return FARMABLOCK_MASTERY_UNLOCK_LEVEL_BY_TIER[tier] ?? 1;
}

export function getFarmablockMasteryXpGrant(itemId: number): number {
  const spec = getFarmableSpec(itemId);
  const tier = spec?.tier ?? CATALOG[itemId]?.farmableTier ?? 1;
  return FARMABLOCK_MASTERY_XP_BY_TIER[tier] ?? 8;
}

export type CoreTokenSource =
  | { kind: 'block_break' }
  | { kind: 'plow_soil' }
  | { kind: 'soil_crop'; tier: 1 | 2 | 3 | 4 | 5 | 6 }
  | { kind: 'farmable_harvest'; tier: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 }
  | { kind: 'matteragen_harvest'; branchTier: 1 | 2 | 3 | 4 | 5; level: number }
  | { kind: 'atm_harvest' }
  | { kind: 'furnace_smelt' };

export const CORE_TOKEN_MIN_CHANCE = 0.0085; // 0.85% floor
export const CORE_TOKEN_MAX_CHANCE = 0.10;   // 10.0% ceiling

/**
 * Returns the exact Core Token spawn probability in [0.0085, 0.10] for a world-owner action.
 * Whenever triggered, exactly 1 Core Token is awarded to the World's WorldCore storage.
 */
export function getCoreTokenSpawnChance(source: CoreTokenSource): number {
  let raw = CORE_TOKEN_MIN_CHANCE;
  switch (source.kind) {
    case 'block_break':
    case 'plow_soil':
      raw = 0.0085; // 0.85%
      break;
    case 'soil_crop': {
      // Tier 1 (Radish): 1.25% -> Tier 6 (Melon): 3.75% (+0.50% per tier)
      const t = Math.max(1, Math.min(6, source.tier));
      raw = 0.0125 + (t - 1) * 0.005;
      break;
    }
    case 'farmable_harvest': {
      // Tier 1: 1.40% -> Tier 8: 8.00%
      const t = Math.max(1, Math.min(8, source.tier));
      raw = 0.014 + ((t - 1) / 7) * 0.066;
      break;
    }
    case 'matteragen_harvest': {
      // Branch Tier 1 Lv.1: 4.00% -> Branch Tier 5 Lv.5: 10.00%
      const bt = Math.max(1, Math.min(5, source.branchTier));
      const lv = Math.max(1, Math.min(5, source.level));
      raw = 0.04 + (bt - 1) * 0.01 + (lv - 1) * 0.005;
      break;
    }
    case 'atm_harvest':
    case 'furnace_smelt':
      raw = 0.025; // 2.50%
      break;
  }
  return Number(Math.max(CORE_TOKEN_MIN_CHANCE, Math.min(CORE_TOKEN_MAX_CHANCE, raw)).toFixed(4));
}

export const ATM_MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
export const ATM_MAX_INTERVAL_MS = 90 * 60 * 1000; // 1.5 hours
export const ATM_MIN_GEMS = 5;
export const ATM_MAX_GEMS = 125;

export function rollAtmIntervalMs(rng: () => number = Math.random): number {
  const span = ATM_MAX_INTERVAL_MS - ATM_MIN_INTERVAL_MS;
  return ATM_MIN_INTERVAL_MS + Math.round(rng() * span);
}

export function rollAtmGems(rng: () => number = Math.random): number {
  const span = ATM_MAX_GEMS - ATM_MIN_GEMS + 1;
  return ATM_MIN_GEMS + Math.floor(rng() * span);
}


export const GROWPIXEL_COLLECTION_IDS = {
  blocks: [ITEM_IDS.GP_DIRT, ITEM_IDS.GP_ROCK, ITEM_IDS.GP_LAVA, ITEM_IDS.GP_CAVE_BACKGROUND, ITEM_IDS.GP_SAND, ITEM_IDS.GP_DOOR, ITEM_IDS.GP_GLASS_PANE, ITEM_IDS.GP_GRASS, ITEM_IDS.GP_LAVA_ROCK, ITEM_IDS.GP_SIGN, ITEM_IDS.GP_WOOD_BLOCK, ITEM_IDS.GP_BRICKS, ITEM_IDS.GP_CRAPPY_SIGN, ITEM_IDS.GP_DAISY, ITEM_IDS.GP_MUSHROOM, ITEM_IDS.GP_ROSE, ITEM_IDS.GP_WHEAT, ITEM_IDS.GP_WOODEN_PLATFORM, ITEM_IDS.GP_BLACK_BLOCK, ITEM_IDS.GP_BROWN_BLOCK, ITEM_IDS.GP_GREY_BLOCK, ITEM_IDS.GP_RED_BLOCK, ITEM_IDS.GP_AQUA_BLOCK, ITEM_IDS.GP_GREEN_BLOCK, ITEM_IDS.GP_WHITE_BLOCK, ITEM_IDS.GP_WINDOW, ITEM_IDS.GP_YELLOW_BLOCK, ITEM_IDS.GP_GLASS_BLOCK, ITEM_IDS.GP_TOILET, ITEM_IDS.GP_RED_BRICKS, ITEM_IDS.GP_DEATH_SPIKES, ITEM_IDS.GP_DUNGEON_DOOR, ITEM_IDS.GP_BUSH, ITEM_IDS.GP_HEDGE, ITEM_IDS.GP_ORANGE_BLOCK, ITEM_IDS.GP_BLUE_BLOCK, ITEM_IDS.GP_POPPY, ITEM_IDS.GP_WOODEN_BACKGROUND, ITEM_IDS.GP_ROCK_BACKGROUND, ITEM_IDS.GP_POINTY_SIGN, ITEM_IDS.GP_DANGER_SIGN, ITEM_IDS.GP_BLUEBERRY],
  seeds: [] as readonly number[],
} as const;

export interface SpliceRecipe {
  seedA: number;
  seedB: number;
  resultSeedId: number;
  branch?: BiomeBranch;
}

// Splicing system removed: only Crop Seeds and Farmable Seeds exist, with no splice recipes.
export const SPLICE_RECIPES: SpliceRecipe[] = [];

export type FurnaceCategory = 'smelting' | 'gear' | 'culinary';

export interface FurnaceRecipe {
  id: string;
  category: FurnaceCategory;
  name: string;
  description: string;
  inputs: { itemId: number; qty: number }[];
  fuelQty: number; // Coal Fuel required
  outputItemId: number;
  outputQty: number;
  durationMs: number;
}

export const FURNACE_RECIPES: FurnaceRecipe[] = [
  {
    id: 'smelt_copper',
    category: 'smelting',
    name: 'Smelt Copper Ingot',
    description: '3× Copper Fragment + 1× Coal → 1× Copper Ingot.',
    inputs: [{ itemId: ITEM_IDS.COPPER_FRAGMENT, qty: 3 }],
    fuelQty: 1,
    outputItemId: ITEM_IDS.COPPER_INGOT,
    outputQty: 1,
    durationMs: 4000,
  },
  {
    id: 'smelt_iron',
    category: 'smelting',
    name: 'Smelt Refined Iron Ingot',
    description: '3× Iron Fragment + 1× Coal → 1× Iron Ingot.',
    inputs: [{ itemId: ITEM_IDS.IRON_FRAGMENT, qty: 3 }],
    fuelQty: 1,
    outputItemId: ITEM_IDS.IRON_INGOT,
    outputQty: 1,
    durationMs: 5000,
  },
  {
    id: 'smelt_crystal',
    category: 'smelting',
    name: 'Smelt Crystal Ingot',
    description: '3× Crystal Fragment + 2× Coal → 1× Crystal Ingot.',
    inputs: [{ itemId: ITEM_IDS.CRYSTAL_FRAGMENT, qty: 3 }],
    fuelQty: 2,
    outputItemId: ITEM_IDS.CRYSTAL_INGOT,
    outputQty: 1,
    durationMs: 7000,
  },
  {
    id: 'smelt_obsidian',
    category: 'smelting',
    name: 'Forge Obsidian Ingot',
    description: '3× Obsidian Fragment + 2× Coal → 1× Obsidian Ingot.',
    inputs: [{ itemId: ITEM_IDS.OBSIDIAN_FRAGMENT, qty: 3 }],
    fuelQty: 2,
    outputItemId: ITEM_IDS.OBSIDIAN_INGOT,
    outputQty: 1,
    durationMs: 9000,
  },
  {
    id: 'smelt_raw_coal',
    category: 'smelting',
    name: 'Refine Raw Coal Ore',
    description: '2× Raw Coal Ore → 2× Coal Fuel.',
    inputs: [{ itemId: ITEM_IDS.RAW_COAL_ORE, qty: 2 }],
    fuelQty: 0,
    outputItemId: ITEM_IDS.COAL_FUEL,
    outputQty: 2,
    durationMs: 3000,
  },
  {
    id: 'smelt_raw_copper',
    category: 'smelting',
    name: 'Smelt Raw Copper Ore',
    description: '3× Raw Copper Ore + 1× Coal → 1× Copper Ingot.',
    inputs: [{ itemId: ITEM_IDS.RAW_COPPER_ORE, qty: 3 }],
    fuelQty: 1,
    outputItemId: ITEM_IDS.COPPER_INGOT,
    outputQty: 1,
    durationMs: 4000,
  },
  {
    id: 'smelt_raw_iron',
    category: 'smelting',
    name: 'Smelt Raw Iron Ore',
    description: '3× Raw Iron Ore + 1× Coal → 1× Iron Ingot.',
    inputs: [{ itemId: ITEM_IDS.RAW_IRON_ORE, qty: 3 }],
    fuelQty: 1,
    outputItemId: ITEM_IDS.IRON_INGOT,
    outputQty: 1,
    durationMs: 5000,
  },
  {
    id: 'smelt_raw_diamond',
    category: 'smelting',
    name: 'Smelt Raw Diamond Ore',
    description: '3× Raw Diamond Ore + 2× Coal → 1× Crystal Ingot.',
    inputs: [{ itemId: ITEM_IDS.RAW_DIAMOND_ORE, qty: 3 }],
    fuelQty: 2,
    outputItemId: ITEM_IDS.CRYSTAL_INGOT,
    outputQty: 1,
    durationMs: 7000,
  },
  {
    id: 'smelt_raw_obsidium',
    category: 'smelting',
    name: 'Smelt Raw Obsidium Ore',
    description: '3× Raw Obsidium Ore + 2× Coal → 1× Obsidian Ingot.',
    inputs: [{ itemId: ITEM_IDS.RAW_OBSIDIUM_ORE, qty: 3 }],
    fuelQty: 2,
    outputItemId: ITEM_IDS.OBSIDIAN_INGOT,
    outputQty: 1,
    durationMs: 9000,
  },
];

export type StoreSection = 'locks' | 'blocks' | 'seeds' | 'wearables' | 'tools';

export interface GemStoreListing {
  id: string;
  section: StoreSection;
  name: string;
  description: string;
  iconItemId: number;
  gemPrice: number;
  grants: { itemId: number; qty: number }[];
}

export const GEM_STORE_LISTINGS: GemStoreListing[] = [
  {
    id: 'store_seed_pot',
    section: 'seeds',
    name: 'Seed Pot / Growbox',
    description: 'Terracotta planter for Farmable Seeds (1 seed per pot).',
    iconItemId: ITEM_IDS.SEED_POT,
    gemPrice: 500,
    grants: [
      { itemId: ITEM_IDS.SEED_POT, qty: 1 },
    ],
  },
  {
    id: 'store_seed_pot_bundle',
    section: 'seeds',
    name: 'Seed Pot 5-Pack Bundle',
    description: '5× Seed Pots.',
    iconItemId: ITEM_IDS.SEED_POT,
    gemPrice: 2500,
    grants: [
      { itemId: ITEM_IDS.SEED_POT, qty: 5 },
    ],
  },
  {
    id: 'store_matteragen_botanical',
    section: 'blocks',
    name: 'Botanical Matteragen Engine',
    description: 'Gen 1 (Farmables 1–6) • 10m cycle • Lv.1–5 (-5% time/lv).',
    iconItemId: ITEM_IDS.MATTERAGEN_BOTANICAL,
    gemPrice: 1000,
    grants: [
      { itemId: ITEM_IDS.MATTERAGEN_BOTANICAL, qty: 1 },
    ],
  },
  {
    id: 'store_matteragen_geomineral',
    section: 'blocks',
    name: 'Geomineral Matteragen Engine',
    description: 'Gen 2 (Farmables 3–14) • 30m cycle • Lv.1–5 (-5% time/lv).',
    iconItemId: ITEM_IDS.MATTERAGEN_GEOMINERAL,
    gemPrice: 2500,
    grants: [
      { itemId: ITEM_IDS.MATTERAGEN_GEOMINERAL, qty: 1 },
    ],
  },
  {
    id: 'store_matteragen_luminescent',
    section: 'blocks',
    name: 'Luminescent Matteragen Engine',
    description: 'Gen 3 (Farmables 6–16) • 1h cycle • Lv.1–5 (-5% time/lv).',
    iconItemId: ITEM_IDS.MATTERAGEN_LUMINESCENT,
    gemPrice: 5000,
    grants: [
      { itemId: ITEM_IDS.MATTERAGEN_LUMINESCENT, qty: 1 },
    ],
  },
  {
    id: 'store_matteragen_arcane',
    section: 'blocks',
    name: 'Arcane Matteragen Engine',
    description: 'Gen 4 (Farmables 8–20) • 2h cycle • Lv.1–5 (-5% time/lv).',
    iconItemId: ITEM_IDS.MATTERAGEN_ARCANE,
    gemPrice: 10000,
    grants: [
      { itemId: ITEM_IDS.MATTERAGEN_ARCANE, qty: 1 },
    ],
  },
  {
    id: 'store_matteragen_cosmic',
    section: 'blocks',
    name: 'Cosmic Matteragen Engine',
    description: 'Gen 5 (Farmables 10–30) • 5h cycle • Lv.1–5 (-5% time/lv).',
    iconItemId: ITEM_IDS.MATTERAGEN_COSMIC,
    gemPrice: 20000,
    grants: [
      { itemId: ITEM_IDS.MATTERAGEN_COSMIC, qty: 1 },
    ],
  },
  {
    id: 'store_atm_machine',
    section: 'blocks',
    name: 'ATM Machine',
    description: 'Generates 5–125 Gems every 30m–1.5h.',
    iconItemId: ITEM_IDS.ATM_MACHINE,
    gemPrice: 10000,
    grants: [
      { itemId: ITEM_IDS.ATM_MACHINE, qty: 1 },
    ],
  },
  {
    id: 'store_vaultbox',
    section: 'blocks',
    name: 'Vaultbox (10-Slot Storage)',
    description: 'Owner-locked 10-slot storage chest block.',
    iconItemId: ITEM_IDS.VAULTBOX,
    gemPrice: 1750,
    grants: [
      { itemId: ITEM_IDS.VAULTBOX, qty: 1 },
    ],
  },
  {
    id: 'store_builders_mix',
    section: 'blocks',
    name: 'Builders Mix Pack',
    description: '10× Platforms, 10× Bricks, 10× Wood, 10× Glass Panes.',
    iconItemId: ITEM_IDS.GP_WOODEN_PLATFORM,
    gemPrice: 120,
    grants: [
      { itemId: ITEM_IDS.GP_WOODEN_PLATFORM, qty: 10 },
      { itemId: ITEM_IDS.GP_BRICKS, qty: 10 },
      { itemId: ITEM_IDS.GP_WOOD_BLOCK, qty: 10 },
      { itemId: ITEM_IDS.GP_GLASS_PANE, qty: 10 },
    ],
  },
  {
    id: 'store_colour_splatter',
    section: 'blocks',
    name: 'Colour Splatter Paint Pack',
    description: '5× Black, 5× Brown, 5× Grey, 5× Red, 5× Aqua blocks.',
    iconItemId: ITEM_IDS.GP_RED_BLOCK,
    gemPrice: 60,
    grants: [
      { itemId: ITEM_IDS.GP_BLACK_BLOCK, qty: 5 },
      { itemId: ITEM_IDS.GP_BROWN_BLOCK, qty: 5 },
      { itemId: ITEM_IDS.GP_GREY_BLOCK, qty: 5 },
      { itemId: ITEM_IDS.GP_RED_BLOCK, qty: 5 },
      { itemId: ITEM_IDS.GP_AQUA_BLOCK, qty: 5 },
    ],
  },
  {
    id: 'store_architect_support',
    section: 'blocks',
    name: 'Architect Support Bundle',
    description: '10× Bricks, 10× Glass Panes, 5× Windows, 5× Wood.',
    iconItemId: ITEM_IDS.GP_BRICKS,
    gemPrice: 45,
    grants: [
      { itemId: ITEM_IDS.GP_BRICKS, qty: 10 },
      { itemId: ITEM_IDS.GP_GLASS_PANE, qty: 10 },
      { itemId: ITEM_IDS.GP_WINDOW, qty: 5 },
      { itemId: ITEM_IDS.GP_WOOD_BLOCK, qty: 5 },
    ],
  },
  {
    id: 'store_natural_resources',
    section: 'blocks',
    name: 'World Default Natural Resources',
    description: '15× Desert Sand, 15× Sandstone, 15× Snow, 15× Limestone.',
    iconItemId: ITEM_IDS.DESERT_SAND,
    gemPrice: 55,
    grants: [
      { itemId: ITEM_IDS.DESERT_SAND, qty: 15 },
      { itemId: ITEM_IDS.RED_SANDSTONE, qty: 15 },
      { itemId: ITEM_IDS.FROST_SNOW, qty: 15 },
      { itemId: ITEM_IDS.CAVE_LIMESTONE, qty: 15 },
    ],
  },
  {
    id: 'store_wallpaper_wainscot',
    section: 'blocks',
    name: 'Heritage Wainscot Wallpaper (×10)',
    description: '10× sage-cream damask plaster & walnut wainscoting walls.',
    iconItemId: ITEM_IDS.WALLPAPER_WAINSCOT,
    gemPrice: 25,
    grants: [
      { itemId: ITEM_IDS.WALLPAPER_WAINSCOT, qty: 10 },
    ],
  },
  {
    id: 'store_wallpaper_emerald_stripe',
    section: 'blocks',
    name: 'Emerald Regency Wallpaper (×10)',
    description: '10× satin emerald striped & gold-pinstriped walls.',
    iconItemId: ITEM_IDS.WALLPAPER_EMERALD_STRIPE,
    gemPrice: 25,
    grants: [
      { itemId: ITEM_IDS.WALLPAPER_EMERALD_STRIPE, qty: 10 },
    ],
  },
  {
    id: 'store_wallpaper_venetian_plaster',
    section: 'blocks',
    name: 'Venetian Plaster Wall (×10)',
    description: '10× warm hand-troweled Mediterranean terracotta walls.',
    iconItemId: ITEM_IDS.WALLPAPER_VENETIAN_PLASTER,
    gemPrice: 25,
    grants: [
      { itemId: ITEM_IDS.WALLPAPER_VENETIAN_PLASTER, qty: 10 },
    ],
  },
  {
    id: 'store_wallpaper_starlight_velvet',
    section: 'blocks',
    name: 'Midnight Starlight Wallpaper (×10)',
    description: '10× indigo celestial velvet & gold-star walls.',
    iconItemId: ITEM_IDS.WALLPAPER_STARLIGHT_VELVET,
    gemPrice: 35,
    grants: [
      { itemId: ITEM_IDS.WALLPAPER_STARLIGHT_VELVET, qty: 10 },
    ],
  },
  {
    id: 'store_wallpaper_subway_tile',
    section: 'blocks',
    name: 'Subway Ceramic Tile Wall (×10)',
    description: '10× glossy ivory subway tile & slate grout walls.',
    iconItemId: ITEM_IDS.WALLPAPER_SUBWAY_TILE,
    gemPrice: 25,
    grants: [
      { itemId: ITEM_IDS.WALLPAPER_SUBWAY_TILE, qty: 10 },
    ],
  },
  {
    id: 'store_wallpaper_cedar_shiplap',
    section: 'blocks',
    name: 'Honey Cedar Shiplap Wall (×10)',
    description: '10× horizontal tongue-and-groove honey cedar walls.',
    iconItemId: ITEM_IDS.WALLPAPER_CEDAR_SHIPLAP,
    gemPrice: 25,
    grants: [
      { itemId: ITEM_IDS.WALLPAPER_CEDAR_SHIPLAP, qty: 10 },
    ],
  },
  {
    id: 'store_wallpaper_herringbone_parquet',
    section: 'blocks',
    name: 'Oak Herringbone Parquet (×10)',
    description: '10× diagonal chevron oak & chestnut parquet walls.',
    iconItemId: ITEM_IDS.WALLPAPER_HERRINGBONE_PARQUET,
    gemPrice: 35,
    grants: [
      { itemId: ITEM_IDS.WALLPAPER_HERRINGBONE_PARQUET, qty: 10 },
    ],
  },
  {
    id: 'store_wallpaper_moroccan_mosaic',
    section: 'blocks',
    name: 'Cobalt Moroccan Mosaic (×10)',
    description: '10× glazed cobalt & turquoise star mosaic walls.',
    iconItemId: ITEM_IDS.WALLPAPER_MOROCCAN_MOSAIC,
    gemPrice: 35,
    grants: [
      { itemId: ITEM_IDS.WALLPAPER_MOROCCAN_MOSAIC, qty: 10 },
    ],
  },
  {
    id: 'store_explorer_set',
    section: 'wearables',
    name: 'Explorer Ranger Hat & Visor',
    description: 'Expedition hat and crystal sight visor.',
    iconItemId: ITEM_IDS.WEAR_EXPLORER_HAT,
    gemPrice: 90,
    grants: [
      { itemId: ITEM_IDS.WEAR_EXPLORER_HAT, qty: 1 },
      { itemId: ITEM_IDS.WEAR_CYBER_VISOR, qty: 1 },
    ],
  },
  {
    id: 'store_monarch_set',
    section: 'wearables',
    name: 'Sunforged Monarch Crown & Wings',
    description: 'Royal crown and aether feather wings.',
    iconItemId: ITEM_IDS.WEAR_SKY_WINGS,
    gemPrice: 220,
    grants: [
      { itemId: ITEM_IDS.WEAR_GOLD_CROWN, qty: 1 },
      { itemId: ITEM_IDS.WEAR_SKY_WINGS, qty: 1 },
    ],
  },
];

export type PlayerStatKey =
  | 'blocksBroken'
  | 'blocksPlaced'
  | 'treesHarvested'
  | 'seedsSpliced'
  | 'storePurchases'
  | 'vendingTrades'
  | 'locksPlaced'
  | 'friendsAdded'
  | 'oresMined'
  | 'fishCaught'
  | 'itemsSmelted'
  | 'exchangeTrades';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  statKey: PlayerStatKey;
  target: number;
  gemReward: number;
  xpReward: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'ach_first_break',
    name: 'Groundbreaker',
    description: 'Break 5 blocks across any world.',
    category: 'Mining',
    statKey: 'blocksBroken',
    target: 5,
    gemReward: 25,
    xpReward: 20,
  },
  {
    id: 'ach_deep_miner',
    name: 'Deep Delver',
    description: 'Break 40 blocks while mining resources.',
    category: 'Mining',
    statKey: 'blocksBroken',
    target: 40,
    gemReward: 80,
    xpReward: 60,
  },
  {
    id: 'ach_builder',
    name: 'World Architect',
    description: 'Place 10 blocks or background walls.',
    category: 'Building',
    statKey: 'blocksPlaced',
    target: 10,
    gemReward: 30,
    xpReward: 25,
  },
  {
    id: 'ach_harvester',
    name: 'Grove Harvester',
    description: 'Harvest 3 mature trees grown from seeds.',
    category: 'Farming',
    statKey: 'treesHarvested',
    target: 3,
    gemReward: 45,
    xpReward: 35,
  },
  {
    id: 'ach_splicer',
    name: 'Botanical Alchemist',
    description: 'Splice 1 hybrid seed combination.',
    category: 'Discovery',
    statKey: 'seedsSpliced',
    target: 1,
    gemReward: 50,
    xpReward: 40,
  },
  {
    id: 'ach_landlord',
    name: 'Sovereign Claim',
    description: 'Place a Share Lock in a world you own.',
    category: 'Ownership',
    statKey: 'locksPlaced',
    target: 1,
    gemReward: 60,
    xpReward: 50,
  },
  {
    id: 'ach_patron',
    name: 'Gem Store Patron',
    description: 'Complete 1 purchase in the Gem Store.',
    category: 'Economy',
    statKey: 'storePurchases',
    target: 1,
    gemReward: 35,
    xpReward: 30,
  },
  {
    id: 'ach_merchant',
    name: 'Vending Merchant',
    description: 'Complete 1 trade at a Personal Vending Machine.',
    category: 'Economy',
    statKey: 'vendingTrades',
    target: 1,
    gemReward: 60,
    xpReward: 50,
  },
  {
    id: 'ach_social',
    name: 'Friendly Neighbor',
    description: 'Add 1 player to your Friend List.',
    category: 'Social',
    statKey: 'friendsAdded',
    target: 1,
    gemReward: 40,
    xpReward: 30,
  },
  {
    id: 'ach_shaft_miner',
    name: 'Shaft Prospector',
    description: 'Mine 10 ore veins inside a Mining Shaft.',
    category: 'Mining',
    statKey: 'oresMined',
    target: 10,
    gemReward: 50,
    xpReward: 45,
  },
  {
    id: 'ach_angler',
    name: 'Depth Angler',
    description: 'Catch 3 fish from dynamic Water or Acid pools.',
    category: 'Fishing',
    statKey: 'fishCaught',
    target: 3,
    gemReward: 45,
    xpReward: 40,
  },
  {
    id: 'ach_smelter',
    name: 'Master Smelter',
    description: 'Smelt or cook 3 recipes in a Stone Furnace.',
    category: 'Crafting',
    statKey: 'itemsSmelted',
    target: 3,
    gemReward: 50,
    xpReward: 45,
  },
  {
    id: 'ach_exchanger',
    name: 'Global Broker',
    description: 'Complete 1 trade on the World-Lock Global Exchange.',
    category: 'Economy',
    statKey: 'exchangeTrades',
    target: 1,
    gemReward: 65,
    xpReward: 55,
  },
];

export function getItemDef(id: number): ItemDefinition | undefined {
  return CATALOG[id];
}

export function isForegroundSolid(id: number): boolean {
  const def = CATALOG[id];
  return def ? def.collision === 'solid' : false;
}

export function isForegroundPlatform(id: number): boolean {
  const def = CATALOG[id];
  return def ? def.collision === 'platform' : false;
}

export function validateCatalogReferences(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // 1. Validate Block Drops & seedId references
  for (const def of Object.values(CATALOG)) {
    if (def.seedId !== undefined && !CATALOG[def.seedId]) {
      warnings.push(`Item ${def.name} (#${def.id}) had dangling seedId #${def.seedId}; removed.`);
      delete def.seedId;
    }
    if (def.producesTileId !== undefined && !CATALOG[def.producesTileId]) {
      warnings.push(`Seed ${def.name} (#${def.id}) had dangling producesTileId #${def.producesTileId}; removed.`);
      delete def.producesTileId;
    }
    if (Array.isArray(def.drops)) {
      const validDrops = def.drops.filter((d) => {
        if (!CATALOG[d.itemId]) {
          warnings.push(`Item ${def.name} (#${def.id}) had dangling drop itemId #${d.itemId}; stripped.`);
          return false;
        }
        return true;
      });
      if (validDrops.length !== def.drops.length) {
        def.drops =
          validDrops.length > 0
            ? validDrops
            : isStandardBaselineBlock(def)
              ? [{ itemId: def.id, chance: 0.125, minQty: 1, maxQty: 1 }]
              : [];
      }
    }
  }

  // 2. Validate Furnace Recipes (remove entire recipe if any input or output is missing)
  for (let i = FURNACE_RECIPES.length - 1; i >= 0; i--) {
    const rec = FURNACE_RECIPES[i];
    const hasMissingInput = rec.inputs.some((inp) => !CATALOG[inp.itemId]);
    const hasMissingOutput = !CATALOG[rec.outputItemId];
    if (hasMissingInput || hasMissingOutput) {
      warnings.push(`Furnace recipe "${rec.id}" referenced missing itemId; disabled recipe.`);
      FURNACE_RECIPES.splice(i, 1);
    }
  }

  // 3. Validate Gem Store Listings (remove entire listing if icon or any grant is missing)
  for (let i = GEM_STORE_LISTINGS.length - 1; i >= 0; i--) {
    const listing = GEM_STORE_LISTINGS[i];
    const hasMissingGrant = listing.grants.some((g) => !CATALOG[g.itemId]);
    const hasMissingIcon = !CATALOG[listing.iconItemId];
    if (hasMissingGrant || hasMissingIcon) {
      warnings.push(`Gem Store listing "${listing.id}" referenced missing itemId; disabled listing.`);
      GEM_STORE_LISTINGS.splice(i, 1);
    }
  }

  // 4. Validate Crop & Farmable Specs
  for (const crop of CROP_SPECS) {
    if (!CATALOG[crop.seedId] || !CATALOG[crop.blockId] || !CATALOG[crop.cropItemId]) {
      warnings.push(`CropSpec "${crop.keyBase}" has missing catalog entry.`);
    }
  }
  for (const farm of FARMABLE_SPECS) {
    if (!CATALOG[farm.id] || !CATALOG[farm.seedId]) {
      warnings.push(`FarmableSpec "${farm.key}" has missing catalog entry.`);
    }
  }

  for (const w of warnings) {
    console.warn(`[CatalogValidator] ${w}`);
  }

  return { valid: warnings.length === 0, warnings };
}

export interface CollectionDevDefaultEntry {
  hardness: number;
  rarity: ItemRarity;
  gemValue: number;
  xpValue: number;
  growthTimeMs?: number;
  drops?: DropEntry[];
  treeHarvestYield?: { minBlocks: number; maxBlocks: number; seedChance: number };
  bonusHarvestDrops?: DropEntry[];
  cropAlterbitPrice?: number;
  cropGemPrice?: number;
  cropSellAlterbits?: number;
}

/**
 * Hardcoded Development Default snapshot of all Collection Item Values.
 * Acts as the immutable baseline fallback when server config is absent or reset.
 */
export const COLLECTION_DEV_DEFAULTS: Record<number, CollectionDevDefaultEntry> = Object.fromEntries(
  Object.values(CATALOG).map((def) => [
    def.id,
    {
      hardness: def.hardness,
      rarity: def.rarity,
      gemValue: def.gemValue,
      xpValue: def.xpValue,
      ...(def.growthTimeMs !== undefined ? { growthTimeMs: def.growthTimeMs } : {}),
      ...(def.drops ? { drops: def.drops.map((d) => ({ ...d })) } : {}),
      ...(def.treeHarvestYield ? { treeHarvestYield: { ...def.treeHarvestYield } } : {}),
      ...(def.bonusHarvestDrops ? { bonusHarvestDrops: def.bonusHarvestDrops.map((d) => ({ ...d })) } : {}),
      ...(def.cropAlterbitPrice !== undefined ? { cropAlterbitPrice: def.cropAlterbitPrice } : {}),
      ...(def.cropGemPrice !== undefined ? { cropGemPrice: def.cropGemPrice } : {}),
      ...(def.cropSellAlterbits !== undefined ? { cropSellAlterbits: def.cropSellAlterbits } : {}),
    },
  ])
);

export const SYSTEM_CRITICAL_ITEM_IDS: readonly number[] = [
  ITEM_IDS.FIST,
  ITEM_IDS.WRENCH,
  ITEM_IDS.ENTRANCE_PORTAL,
  ITEM_IDS.STONE_FURNACE,
  ITEM_IDS.FARMING_HOE,
  ITEM_IDS.WORLD_CORE,
  ITEM_IDS.STARTER_LOOTBOX,
  ITEM_IDS.COAL_FUEL,
] as const;

export interface ExternalCatalogDataset {
  items?: Partial<ItemDefinition>[];
  collectionDevDefaults?: Record<string | number, Partial<CollectionDevDefaultEntry>>;
  gemStoreListings?: GemStoreListing[];
}

/**
 * Safely merges an external Item Catalogue Dataset JSON into the runtime CATALOG and COLLECTION_DEV_DEFAULTS.
 * Guards against stripping system-critical item IDs or mutating an existing item's structural category.
 */
export function mergeBaselineCatalogDataset(dataset: ExternalCatalogDataset | null | undefined): {
  addedItemIds: number[];
  updatedItemIds: number[];
  warnings: string[];
} {
  const addedItemIds: number[] = [];
  const updatedItemIds: number[] = [];
  const warnings: string[] = [];

  if (!dataset || typeof dataset !== 'object') {
    return { addedItemIds, updatedItemIds, warnings };
  }

  if (Array.isArray(dataset.items)) {
    const incomingIds = new Set<number>();
    for (const rawItem of dataset.items) {
      const id = Number(rawItem?.id);
      if (!Number.isInteger(id) || id < 0) continue;
      incomingIds.add(id);
      const existing = CATALOG[id];
      if (existing) {
        if (rawItem.category && rawItem.category !== existing.category) {
          warnings.push(
            `Blocked category mutation on item #${id} (${existing.key}): "${existing.category}" -> "${rawItem.category}".`
          );
        }
        const merged: ItemDefinition = {
          ...existing,
          ...rawItem,
          id: existing.id,
          key: existing.key,
          category: existing.category,
          stackLimit:
            typeof rawItem.stackLimit === 'number' && rawItem.stackLimit > 1
              ? 500
              : existing.stackLimit,
        };
        CATALOG[id] = merged;
        updatedItemIds.push(id);
      } else if (rawItem.key && rawItem.name && rawItem.category) {
        const newDef: ItemDefinition = {
          id,
          key: String(rawItem.key),
          name: String(rawItem.name),
          description: String(rawItem.description ?? ''),
          category: rawItem.category,
          rarity: rawItem.rarity ?? 'common',
          stackLimit:
            typeof rawItem.stackLimit === 'number'
              ? rawItem.stackLimit > 1
                ? 500
                : rawItem.stackLimit
              : 500,
          collision: rawItem.collision ?? 'none',
          breakable: Boolean(rawItem.breakable ?? true),
          hardness: Number(rawItem.hardness ?? 3),
          placeable: Boolean(rawItem.placeable ?? true),
          tradeable: Boolean(rawItem.tradeable ?? true),
          gemValue: Number(rawItem.gemValue ?? 0),
          xpValue: Number(rawItem.xpValue ?? 1),
          colorPrimary: String(rawItem.colorPrimary ?? '#94a3b8'),
          colorSecondary: String(rawItem.colorSecondary ?? '#475569'),
          colorAccent: String(rawItem.colorAccent ?? '#f8fafc'),
          ...(rawItem.storePrice !== undefined ? { storePrice: Number(rawItem.storePrice) } : {}),
          ...(rawItem.drops ? { drops: rawItem.drops } : {}),
        };
        CATALOG[id] = newDef;
        addedItemIds.push(id);
      }
    }

    for (const critId of SYSTEM_CRITICAL_ITEM_IDS) {
      if (dataset.items.length > 0 && !incomingIds.has(critId)) {
        warnings.push(
          `Dataset omitted system-critical item #${critId} (${CATALOG[critId]?.key ?? 'unknown'}); retained built-in definition.`
        );
      }
    }
  }

  if (dataset.collectionDevDefaults && typeof dataset.collectionDevDefaults === 'object') {
    for (const [k, v] of Object.entries(dataset.collectionDevDefaults)) {
      const id = Number(k);
      if (!CATALOG[id] || !v || typeof v !== 'object') continue;
      COLLECTION_DEV_DEFAULTS[id] = {
        ...(COLLECTION_DEV_DEFAULTS[id] ?? {
          hardness: CATALOG[id].hardness,
          rarity: CATALOG[id].rarity,
          gemValue: CATALOG[id].gemValue,
          xpValue: CATALOG[id].xpValue,
        }),
        ...v,
      };
    }
  }

  return { addedItemIds, updatedItemIds, warnings };
}


