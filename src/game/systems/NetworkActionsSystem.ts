import type { GameScene } from '../scenes/Game';
import type { Packet } from '../network-protocol';
import {
    CASTLE_SPAWN_X,
    CASTLE_SPAWN_Y,
    PORTAL_CASTLE_X,
    PORTAL_CASTLE_Y,
    PORTAL_MEADOW_X,
    PORTAL_MEADOW_Y,
} from '../constants';

/** Validates guest requests against host-owned position, inventory and cooldowns. */
export class NetworkActionsSystem {
    constructor(private readonly scene: GameScene) {}
    apply = (packet: Extract<Packet, { type: 'INTERACT_EVENT' }>) => {
        const s = this.scene,
            n = s.network,
            p = n.remotePlayer,
            state = n.remoteState;
        if (!n.isHost || !n.isConnected || !p || !state || state.hp <= 0) return;
        const near = (o: { x: number; y: number } | null | undefined, r: number) =>
            !!o && Math.hypot(p.x - o.x, p.y - o.y) < r;
        switch (packet.action) {
            case 'zombie':
                if (near(s.altars.altar, 65)) s.enemies.summonZombieAtAltar();
                break;
            case 'wolf':
                if (near(s.altars.wolfAltar, 65)) s.enemies.summonWerewolfAtWolfAltar();
                break;
            case 'drowner':
                if (near(s.altars.drownerAltar, 65)) s.enemies.summonDrownerAtAltar();
                break;
            case 'witch':
                if (near(s.witches.altar, 100)) s.witches.summon(true);
                break;
            case 'craft':
                s.inventory.craftPortalKey();
                break;
            case 'offer':
                s.ritual.offer(p);
                break;
            case 'portal':
            case 'enter':
                if (
                    state.zone === 'meadow' &&
                    near({ x: PORTAL_MEADOW_X, y: PORTAL_MEADOW_Y - 16 }, 75) &&
                    s.inventory.hasPortalKey
                ) {
                    s.castle.setPortalUnlocked(true);
                    n.teleportGuest(CASTLE_SPAWN_X, CASTLE_SPAWN_Y, 'castle');
                }
                break;
            case 'return':
                if (state.zone === 'castle' && near({ x: PORTAL_CASTLE_X, y: PORTAL_CASTLE_Y - 16 }, 75))
                    n.teleportGuest(PORTAL_MEADOW_X, PORTAL_MEADOW_Y + 50, 'meadow');
                break;
            case 'loot':
                for (const [o] of s.loot.pickups)
                    if (n.world.id(o) === packet.id && near(o, 96)) {
                        s.loot.collect(o, true);
                        break;
                    }
                break;
            case 'shotgun':
                if (near(s.shop.vendor, 110)) s.shop.buyShotgun(true);
                break;
            case 'medkit':
                if (near(s.shop.vendor, 110)) s.shop.buyFirstAidKit(true);
                break;
            case 'heal':
                n.resources.healGuest();
                break;
            case 'reload':
                n.reloadRemote(packet.weapon ?? state.currentWeapon);
                break;
        }
        n.sendWorld();
    };
}
