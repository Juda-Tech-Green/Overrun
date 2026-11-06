export type PlayerFacing = 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'n' | 'ne';
export type PlayerAction = 'idle' | 'walk' | 'shoot' | 'reload' | 'reload-walk' | 'hurt' | 'die';

const FACINGS: PlayerFacing[] = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const POSES = {
    e:  { suffix: '', flip: false, muzzle: { x: 20, y: -33 } },
    se: { suffix: '-front45', flip: false, muzzle: { x: 16, y: -21 } },
    s:  { suffix: '-front', flip: false, muzzle: { x: 2, y: -20 } },
    sw: { suffix: '-front45', flip: true, muzzle: { x: -16, y: -21 } },
    w:  { suffix: '', flip: true, muzzle: { x: -20, y: -33 } },
    nw: { suffix: '-back45', flip: true, muzzle: { x: -16, y: -44 } },
    n:  { suffix: '-back', flip: false, muzzle: { x: 2, y: -48 } },
    ne: { suffix: '-back45', flip: false, muzzle: { x: 16, y: -44 } }
} as const;

export function facingFromVector(x: number, y: number, previous: PlayerFacing): PlayerFacing {
    if (Math.hypot(x, y) < 0.001) return previous;
    return FACINGS[(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8];
}

export function playerPose(facing: PlayerFacing) { return POSES[facing]; }

export function playerAnimation(character: 'player' | 'heroine', action: PlayerAction, facing: PlayerFacing, weapon: 'rifle' | 'shotgun' = 'rifle') {
    const weaponPart = weapon === 'shotgun' ? 'shotgun-' : '';
    return `${character}-${weaponPart}${action}${POSES[facing].suffix}`;
}

export function facingVector(facing: PlayerFacing) {
    const angle = FACINGS.indexOf(facing) * Math.PI / 4;
    return { x: Math.cos(angle), y: Math.sin(angle) };
}
