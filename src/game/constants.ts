/**
 * Core game constants — tweak freely.
 */

//  Game title
export const GAME_TITLE = 'Overrun';

//  Viewport size. Scale.FIT keeps this aspect ratio on any window size.
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

//  Expanded Map World size (4x area: 2x width & 2x height = 120x80 tiles of 16px)
export const MAP_WIDTH = 1920;
export const MAP_HEIGHT = 1280;
export const MAP_TILES_X = 120;
export const MAP_TILES_Y = 80;

//  Spawn locations in corners and player center
export const ZOMBIE_ALTAR_X = 260;
export const ZOMBIE_ALTAR_Y = 240;
export const WEREWOLF_ALTAR_X = 1660;
export const WEREWOLF_ALTAR_Y = 1040;
export const VENDOR_X = 260;
export const VENDOR_Y = 1060;
export const PLAYER_SPAWN_X = 960;
export const PLAYER_SPAWN_Y = 640;

//  Portal in Meadow (top of the map)
export const PORTAL_MEADOW_X = 960;
export const PORTAL_MEADOW_Y = 80;

//  Castle Zone (32x24 tiles of 32px = 1024x768)
export const CASTLE_ORIGIN_X = 2400;
export const CASTLE_ORIGIN_Y = 160;
export const CASTLE_TILES_X = 32;
export const CASTLE_TILES_Y = 24;
export const CASTLE_TILE_SIZE = 32;
export const CASTLE_WIDTH = CASTLE_TILES_X * CASTLE_TILE_SIZE;   // 1024
export const CASTLE_HEIGHT = CASTLE_TILES_Y * CASTLE_TILE_SIZE; // 768

export const CASTLE_SPAWN_X = CASTLE_ORIGIN_X + 16 * CASTLE_TILE_SIZE; // 2912
export const CASTLE_SPAWN_Y = CASTLE_ORIGIN_Y + 20 * CASTLE_TILE_SIZE; // 800
export const PORTAL_CASTLE_X = CASTLE_SPAWN_X;
export const PORTAL_CASTLE_Y = CASTLE_ORIGIN_Y + 22 * CASTLE_TILE_SIZE; // 864

// Castle Prison Drowner Cistern Altar (North Vault chamber)
export const DROWNER_ALTAR_X = CASTLE_ORIGIN_X + 16 * CASTLE_TILE_SIZE; // 2912
export const DROWNER_ALTAR_Y = CASTLE_ORIGIN_Y + 3 * CASTLE_TILE_SIZE;  // 256

// Total physics world size covering Meadow and Castle
export const TOTAL_WORLD_WIDTH = 3600;
export const TOTAL_WORLD_HEIGHT = 1280;

//  Background color of the game canvas (deep space).
export const BACKGROUND_COLOR = '#0a0a1a';

//  Tuning values for the action shooter.
export const PLAYER_SPEED = 300;       // px/second, player movement speed
export const BULLET_SPEED = 600;       // px/second, bullet travel speed
export const FIRE_RATE = 200;          // ms between rifle shots

//  Weapon arsenal constants
export const RIFLE_MAX_AMMO = 7;
export const SHOTGUN_MAX_AMMO = 4;
export const SHOTGUN_FIRE_RATE = 480;  // ms between shotgun blasts
export const SHOTGUN_PELLETS = 5;      // 5-pellet cone
export const SHOTGUN_SPREAD_DEG = 28;  // total spread angle
export const SHOTGUN_PRICE = 10;       // kills required to purchase
export const FIRST_AID_PRICE = 2;       // kills required to purchase first-aid kit
export const FIRST_AID_HEAL_AMOUNT = 2; // HP restored per first-aid kit


// Bottom-center cauldron territory and ranged witch tuning (pixels / milliseconds).
export const WITCH_ALTAR_X = MAP_WIDTH / 2;
export const WITCH_ALTAR_Y = MAP_HEIGHT - 160;
export const WITCH_TUNING = {
    hp: 4, speed: 95, retreatRange: 180, holdRange: 280, throwRange: 310,
    throwCooldown: 1700, windup: 320, potionSpeed: 260, splashRadius: 42,
    territoryRange: 260, spawnCooldown: 4800, maxActive: 6
} as const;
