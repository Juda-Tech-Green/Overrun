export interface ZombieVariantConfig {
    key: 'zombie' | 'zombie-female' | 'zombie-skeleton' | 'zombie-blue' | 'werewolf' | 'werewolf-albino' | 'witch' | 'witch-red' | 'drowner';
    name: string;
    speed: number;
    hp: number;
    tintColor: number;
}

export const ZOMBIE_VARIANTS: ZombieVariantConfig[] = [
    { key: 'zombie', name: 'Rotting Zombie', speed: 85, hp: 3, tintColor: 0xdd88ff },
    { key: 'zombie-female', name: 'Banshee Zombie', speed: 95, hp: 3, tintColor: 0xff88cc },
    { key: 'zombie-skeleton', name: 'Crypt Skeleton', speed: 105, hp: 2, tintColor: 0x88ffff },
    { key: 'zombie-blue', name: 'Frost Ghoul', speed: 75, hp: 4, tintColor: 0x66bbff },
    { key: 'werewolf', name: 'Blood Werewolf', speed: 110, hp: 5, tintColor: 0xff5533 },
    { key: 'werewolf-albino', name: 'Albino Werewolf', speed: 110, hp: 5, tintColor: 0xffbbdd }
];

export const WEREWOLF_VARIANTS = ZOMBIE_VARIANTS.filter(v => v.key.startsWith('werewolf'));
export const UNDEAD_VARIANTS = ZOMBIE_VARIANTS.filter(v => !v.key.startsWith('werewolf'));

export const DROWNER_VARIANTS: ZombieVariantConfig[] = [
    { key: 'drowner', name: 'Brine Drowner', speed: 90, hp: 4, tintColor: 0x33ddcc }
];

