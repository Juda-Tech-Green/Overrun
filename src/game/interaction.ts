import * as Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import { PORTAL_MEADOW_X, PORTAL_MEADOW_Y, PORTAL_CASTLE_X, PORTAL_CASTLE_Y } from './constants';

import { DRAGON_ALTAR } from './progression';

export type InteractionId = 'dragon' | 'portal' | 'vendor' | 'zombie' | 'wolf' | 'drowner' | 'witch' | 'enter' | 'return';
export const INTERACTION_RANGE = { vendor: 110, altar: 65, witch: 100, portal: 75 };

/** Matches the keyboard interaction geometry, using live object positions. */
export function interactionContext(scene: GameScene): { id: InteractionId; label: string } | null {
    const player = scene.playerController.player;
    const near = (point: { x: number; y: number } | null | undefined, range: number) =>
        point && Math.hypot(player.x - point.x, player.y - point.y) < range;
    if (near(scene.shop.vendor, INTERACTION_RANGE.vendor)) return { id: 'vendor', label: 'SHOP' };
    for (const [id, object] of [['zombie', scene.altars.altar], ['wolf', scene.altars.wolfAltar],
        ['drowner', scene.altars.drownerAltar]] as const) {
        if (near(object, INTERACTION_RANGE.altar)) return { id, label: 'SUMMON' };
    }
    if (near(scene.witches?.altar, INTERACTION_RANGE.witch)) return { id: 'witch', label: 'SUMMON' };
    if (near(scene.ritual?.altar, DRAGON_ALTAR.range)) return {id:'dragon',label:'OFFER'};
    if (scene.castle?.currentZone === 'meadow' && near({ x: PORTAL_MEADOW_X, y: PORTAL_MEADOW_Y - 16 }, INTERACTION_RANGE.portal))
        return scene.castle.portalUnlocked ? {id:'enter',label:'ENTER'} : {id:'portal',label:scene.inventory?.hasPortalKey?'UNLOCK':'LOCKED'};
    if (scene.castle?.currentZone === 'castle' && near({ x: PORTAL_CASTLE_X, y: PORTAL_CASTLE_Y - 16 }, INTERACTION_RANGE.portal))
        return { id: 'return', label: 'RETURN' };
    return null;
}

/** One touch request follows the same owner-side guards as one E key edge. */
export function interactionPressed(scene: GameScene, id: InteractionId): boolean {
    return Boolean(scene.mobileControls?.consumeInteraction(id)) || Phaser.Input.Keyboard.JustDown(scene.controls.interactKey);
}
