import type { PlayerFacing } from './player-facing';
import type { ItemCounts, ItemId } from './progression';

export const PROTOCOL_VERSION = 1;
export const PEER_PREFIX = 'pixelforge-coop-v1-';
export type Skin = 'player' | 'heroine';
export type Weapon = 'rifle' | 'shotgun';
export type Zone = 'meadow' | 'castle';
export type CoopAction =
    | 'zombie'
    | 'wolf'
    | 'witch'
    | 'drowner'
    | 'portal'
    | 'enter'
    | 'return'
    | 'craft'
    | 'offer'
    | 'loot'
    | 'shotgun'
    | 'medkit'
    | 'heal'
    | 'reload';
export interface PlayerState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: PlayerFacing;
    anim: string;
    hp: number;
    isFiring: boolean;
    currentWeapon: Weapon;
    skin: Skin;
    zone: Zone;
    targetX: number;
    targetY: number;
    blocked: boolean;
}
export interface EntityState {
    id: string;
    type: string;
    x: number;
    y: number;
    hp: number;
    anim: string;
    flipX: boolean;
    rotation: number;
    tint: number;
    frame: string | number;
    scaleX: number;
    scaleY: number;
    state: string;
}
export interface DropState {
    id: string;
    item: ItemId;
    x: number;
    y: number;
    amount: number;
}
export interface WorldState {
    enemies: EntityState[];
    boss: EntityState | null;
    hazards: EntityState[];
    altars: EntityState[];
    drops: DropState[];
    inventory: ItemCounts;
    portalUnlocked: boolean;
    /** Receiving guest's personal kill balance, never the host's balance. */
    score: number;
    autoSpawnEnabled: boolean;
    /** Receiving guest's personal first-aid stock. */
    medkits: number;
    hasShotgun: boolean;
    ritual: number;
    guest: PlayerState;
    guestAmmo: { rifle: number; shotgun: number };
}
export interface SceneryState {
    group: 'trees' | 'giantTrees' | 'rocks' | 'bushes';
    type: string;
    frame: string | number;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    originX: number;
    originY: number;
    w: number;
    h: number;
    ox: number;
    oy: number;
    circle: boolean;
    radius: number;
    anim: string;
}
export interface StaticWorld {
    scenery: SceneryState[];
    tiles: number[][];
}
interface Header {
    v: 1;
    seq: number;
}
export type Packet = Header &
    (
        | {
              type: 'ROOM_INIT';
              seed: number;
              difficulty: 'normal';
              skins: { host: Skin; guest: Skin };
              world: WorldState;
              staticWorld: StaticWorld;
              player: PlayerState;
          }
        | { type: 'PLAYER_UPDATE'; player: PlayerState }
        | { type: 'WORLD_SNAPSHOT'; world: WorldState }
        | { type: 'SHOOT_EVENT'; weapon: Weapon; x: number; y: number; targetX: number; targetY: number }
        | { type: 'INTERACT_EVENT'; action: CoopAction; id?: string; weapon?: Weapon }
        | { type: 'ROOM_FULL' }
    );
export type OutgoingPacket = Packet extends infer P
    ? P extends Packet
        ? Omit<P, 'v' | 'seq'>
        : never
    : never;
export const normalizeRoomCode = (value: string) => value.toUpperCase().replace(/[\s-]/g, '');
export const validRoomCode = (value: string) => /^[A-Z0-9]{5,12}$/.test(value);
export function makeRoomCode(bytes: Uint8Array) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(bytes.slice(0, 6), (b) => alphabet[b % alphabet.length]).join('');
}
const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, max = 100000) =>
    typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
const text = (v: unknown) => typeof v === 'string' && v.length <= 100;
const point = (v: Record<string, unknown>) => finite(v.x) && finite(v.y);
const weapon = (v: unknown) => v === 'rifle' || v === 'shotgun';
function player(v: unknown): boolean {
    return (
        object(v) &&
        point(v) &&
        finite(v.vx, 2000) &&
        finite(v.vy, 2000) &&
        finite(v.hp, 5) &&
        text(v.anim) &&
        ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'].includes(String(v.facing)) &&
        weapon(v.currentWeapon) &&
        (v.skin === 'player' || v.skin === 'heroine') &&
        (v.zone === 'meadow' || v.zone === 'castle') &&
        typeof v.isFiring === 'boolean' &&
        typeof v.blocked === 'boolean' &&
        finite(v.targetX) &&
        finite(v.targetY)
    );
}
function entity(v: unknown): boolean {
    return (
        object(v) &&
        point(v) &&
        text(v.id) &&
        text(v.type) &&
        text(v.anim) &&
        text(v.state) &&
        finite(v.hp) &&
        (text(v.frame) || finite(v.frame)) &&
        finite(v.scaleX, 8) &&
        finite(v.scaleY, 8) &&
        typeof v.flipX === 'boolean' &&
        finite(v.rotation, 100) &&
        Number.isInteger(v.tint) &&
        Number(v.tint) >= 0 &&
        Number(v.tint) <= 0xffffff
    );
}
const list = (v: unknown, max: number, check: (v: unknown) => boolean) =>
    Array.isArray(v) && v.length <= max && v.every(check);
function world(v: unknown): boolean {
    return (
        object(v) &&
        list(v.enemies, 40, entity) &&
        (v.boss === null || entity(v.boss)) &&
        list(v.hazards, 100, entity) &&
        list(v.altars, 8, entity) &&
        list(
            v.drops,
            150,
            (d) =>
                object(d) &&
                point(d) &&
                text(d.id) &&
                ['bone', 'fang', 'eye', 'pearl', 'portal-key'].includes(String(d.item)) &&
                finite(d.amount) &&
                Number(d.amount) > 0,
        ) &&
        object(v.inventory) &&
        ['bone', 'fang', 'eye', 'pearl', 'portal-key'].every(
            (k) =>
                finite(v.inventory && (v.inventory as Record<string, unknown>)[k]) &&
                Number((v.inventory as Record<string, unknown>)[k]) >= 0,
        ) &&
        typeof v.portalUnlocked === 'boolean' &&
        typeof v.autoSpawnEnabled === 'boolean' &&
        finite(v.score) &&
        finite(v.medkits) &&
        typeof v.hasShotgun === 'boolean' &&
        finite(v.ritual) &&
        player(v.guest) &&
        object(v.guestAmmo) &&
        finite(v.guestAmmo.rifle, 7) &&
        finite(v.guestAmmo.shotgun, 4)
    );
}
/** Reject malformed/unbounded packets before touching Phaser objects. */
export function isPacket(value: unknown): value is Packet {
    if (!object(value) || value.v !== 1 || !Number.isSafeInteger(value.seq) || Number(value.seq) < 0)
        return false;
    switch (value.type) {
        case 'PLAYER_UPDATE':
            return player(value.player);
        case 'WORLD_SNAPSHOT':
            return world(value.world);
        case 'SHOOT_EVENT':
            return weapon(value.weapon) && point(value) && finite(value.targetX) && finite(value.targetY);
        case 'INTERACT_EVENT':
            return (
                [
                    'zombie',
                    'wolf',
                    'witch',
                    'drowner',
                    'portal',
                    'enter',
                    'return',
                    'craft',
                    'offer',
                    'loot',
                    'shotgun',
                    'medkit',
                    'heal',
                    'reload',
                ].includes(String(value.action)) &&
                (value.id === undefined || text(value.id)) &&
                (value.weapon === undefined || weapon(value.weapon))
            );
        case 'ROOM_FULL':
            return true;
        case 'ROOM_INIT':
            return (
                finite(value.seed) &&
                value.difficulty === 'normal' &&
                object(value.skins) &&
                ['player', 'heroine'].includes(String(value.skins.host)) &&
                ['player', 'heroine'].includes(String(value.skins.guest)) &&
                value.skins.host !== value.skins.guest &&
                world(value.world) &&
                player(value.player) &&
                object(value.staticWorld) &&
                list(
                    value.staticWorld.scenery,
                    1000,
                    (s) =>
                        object(s) &&
                        point(s) &&
                        ['trees', 'giantTrees', 'rocks', 'bushes'].includes(String(s.group)) &&
                        text(s.type) &&
                        (text(s.frame) || finite(s.frame)) &&
                        ['scaleX', 'scaleY', 'originX', 'originY', 'w', 'h', 'ox', 'oy', 'radius'].every(
                            (k) => finite(s[k]),
                        ) &&
                        typeof s.circle === 'boolean' &&
                        text(s.anim),
                ) &&
                list(value.staticWorld.tiles, 80, (row) =>
                    list(row, 120, (n) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < 20),
                )
            );
        default:
            return false;
    }
}
export const smoothFactor = (delta: number) => 1 - Math.exp(-Math.min(100, Math.max(0, delta)) / 65);
