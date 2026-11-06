export const MATERIALS = ['bone', 'fang', 'eye', 'pearl'] as const;
export type Material = typeof MATERIALS[number];
export type ItemId = Material | 'portal-key';
export type ItemCounts = Record<ItemId, number>;
export const ITEM_NAMES: Record<ItemId, string> = { bone: 'Rotting Bone', fang: 'Werewolf Fang', eye: 'Eldritch Eye', pearl: 'Brine Pearl', 'portal-key': 'Portal Key' };
export const ITEM_COLORS: Record<ItemId, string> = { bone: '#d5ebb6', fang: '#ff9b91', eye: '#dba0fa', pearl: '#8cf4df', 'portal-key': '#ffe09a' };
export const PORTAL_RECIPE: Partial<Record<Material, number>> = { bone: 3, fang: 2, eye: 1 };
export const DRAGON_RECIPE: Partial<Record<Material, number>> = { bone: 1, fang: 1, eye: 1, pearl: 1 };
export const DRAGON_ALTAR = { x: 1440, y: 260, range: 100 };
export const emptyInventory = (): ItemCounts => ({ bone: 0, fang: 0, eye: 0, pearl: 0, 'portal-key': 0 });
export function canPay(counts: ItemCounts, recipe: Partial<Record<Material, number>>) {
    return MATERIALS.every(item => counts[item] >= (recipe[item] ?? 0));
}
export function enemyDrop(variant: string, roll: number): Material | null {
    if (['zombie', 'zombie-female', 'zombie-skeleton', 'zombie-blue'].includes(variant))
        return roll < 0.6 ? 'bone' : null;
    if (['werewolf', 'werewolf-albino'].includes(variant))
        return roll < 0.5 ? 'fang' : null;
    if (['witch', 'witch-red'].includes(variant))
        return 'eye';
    if (variant === 'drowner')
        return 'pearl';
    return null;
}
