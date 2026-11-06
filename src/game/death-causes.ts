/** Stable damage families; variants share one authored death-screen theme. */
export type DeathCause = 'zombie' | 'werewolf' | 'witch' | 'dragon';

export function deathCauseForEnemy(variant: string): DeathCause {
    if (variant.startsWith('werewolf')) return 'werewolf';
    if (variant.startsWith('witch')) return 'witch';
    if (variant.startsWith('dragon')) return 'dragon';
    return 'zombie';
}

export const DEATH_PRESENTATIONS: Record<DeathCause, { frame: string; title: string; killer: string; color: string }> = {
    zombie: { frame: 'death-zombie', title: 'OVERRUN BY THE UNDEAD', killer: 'ZOMBIE ATTACK', color: '#b7d794' },
    werewolf: { frame: 'death-werewolf', title: 'MAULED BY THE PACK', killer: 'WEREWOLF ATTACK', color: '#ff9586' },
    witch: { frame: 'death-witch', title: 'A DEADLY BREW', killer: 'WITCH POTION', color: '#dba4e5' },
    dragon: { frame: 'death-dragon', title: 'REDUCED TO ASH', killer: 'ANCIENT DRAGON', color: '#ffd474' }
};
