import type * as Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';
import { canPay, DRAGON_RECIPE, emptyInventory, ITEM_NAMES, MATERIALS, PORTAL_RECIPE, type ItemCounts, type ItemId, type Material } from '../progression';
/** Per-run items and atomic recipes; a responsive, unscaled screen-space modal. */
export class InventorySystem {
    constructor(private readonly scene: GameScene) { }
    counts: ItemCounts = emptyInventory();
    hasPortalKey = false;
    isOpen = false;
    mode: 'inventory' | 'offering' = 'inventory';
    container: Phaser.GameObjects.Container | null = null;
    private backdrop: Phaser.GameObjects.Rectangle;
    private panel: Phaser.GameObjects.Rectangle;
    private title: Phaser.GameObjects.Text;
    private closeButton: Phaser.GameObjects.Text;
    private slots: {
        box: Phaser.GameObjects.Rectangle;
        icon: Phaser.GameObjects.Image;
        text: Phaser.GameObjects.Text;
        id: ItemId;
    }[] = [];
    private recipeText: Phaser.GameObjects.Text;
    private status: Phaser.GameObjects.Text;
    actionButton: Phaser.GameObjects.Text;
    reset() { this.counts = emptyInventory(); this.hasPortalKey = false; this.isOpen = false; this.mode = 'inventory'; this.container = null; this.slots = []; }
    add = (id: ItemId, amount = 1) => {
        if (!Number.isInteger(amount) || amount <= 0)
            return;
        this.counts[id] += amount;
        if (id === 'portal-key') {
            this.hasPortalKey = true;
            this.counts[id] = 1;
        }
        this.refresh();
    };
    spend = (recipe: Partial<Record<Material, number>>) => {
        if (!canPay(this.counts, recipe))
            return false;
        for (const id of MATERIALS)
            this.counts[id] -= recipe[id] ?? 0;
        this.refresh();
        return true;
    };
    craftPortalKey = () => {
        if (this.scene.network?.isGuest) return this.scene.network.requestAction('craft');
        if (this.hasPortalKey || !this.spend(PORTAL_RECIPE))
            return false;
        this.scene.audio?.play('crafting-forge-key');
        this.hasPortalKey = true;
        this.counts['portal-key'] = 1;
        this.refresh();
        this.scene.hud.flashProximityAlert('Portal Key crafted. Unlock the northern Meadow Portal.', '#ffe09a');
        return true;
    };
    toggle = () => { if (this.isOpen)
        this.close();
    else
        this.open('inventory'); };
    open = (mode: 'inventory' | 'offering' = 'inventory') => {
        if (this.scene.playerController.isPlayerDead || this.scene.menu.isMenuOpen || this.scene.shop.isShopOpen || this.scene.chat.isChatOpen || this.scene.network?.blocked)
            return;
        if (!this.isOpen) this.scene.audio?.play('inventory-open');
        this.mode = mode;
        this.isOpen = true;
        this.container?.setVisible(true);
        this.refresh();
        this.scene.playerController.player.setVelocity(0, 0);
        this.scene.mobileControls.releaseAll();
        if (!this.scene.network?.isConnected) this.scene.physics.pause();
    };
    close = () => {
        if (!this.isOpen)
            return;
        this.scene.audio?.play('inventory-close');
        this.isOpen = false;
        this.container?.setVisible(false);
        if (!this.scene.menu.isMenuOpen)
            this.scene.physics.resume();
    };
    create = () => {
        this.container = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(35000).setVisible(false);
        const attach = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor>(o: T) => { o.setScrollFactor(0); this.container!.add(o); return o; };
        this.backdrop = attach(this.scene.add.rectangle(0, 0, 1, 1, 0x060a12, 0.82).setInteractive());
        this.backdrop.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); this.close(); });
        this.panel = attach(this.scene.add.rectangle(0, 0, 1, 1, 0x151e27, 0.99).setStrokeStyle(2, 0x99b6a4).setInteractive());
        this.panel.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => e.stopPropagation());
        const text = (value: string, size = 16) => attach(this.scene.add.text(0, 0, value, { fontFamily: 'monospace', fontSize: `${size}px`, color: '#e5ead8' }));
        this.title = text('INVENTORY & CRAFTING', 18).setOrigin(0.5);
        const button = (label: string, callback: () => void) => {
            const b = text(label, 16).setOrigin(0.5).setPadding(12).setBackgroundColor('#32534c').setFixedSize(label === 'X' ? 48 : 220, 48).setAlign('center').setInteractive({ useHandCursor: true });
            b.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); callback(); });
            return b;
        };
        this.closeButton = button('X', this.close);
        for (const id of [...MATERIALS, 'portal-key'] as ItemId[]) {
            const box = attach(this.scene.add.rectangle(0, 0, 48, 56, 0x23313d).setStrokeStyle(1, 0x526a6d).setInteractive());
            box.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); this.status.setText(`${ITEM_NAMES[id]}: ${this.counts[id]}`); });
            this.slots.push({ id, box, icon: attach(this.scene.add.image(0, 0, 'items', `icon-${id}`)), text: text('', 12).setOrigin(0.5) });
        }
        this.recipeText = text('', 14);
        this.status = text('', 13).setOrigin(0.5);
        this.actionButton = button('CRAFT PORTAL KEY', () => { if (this.mode === 'offering') {
            this.scene.ritual.offer();
        }
        else if (!this.craftPortalKey())
            this.status.setText(this.hasPortalKey ? 'Portal Key already crafted.' : 'Collect the missing materials first.'); });
        this.layout();
        this.refresh();
        this.scene.scale.on('resize', this.layout);
        this.scene.events.once('shutdown', () => this.scene.scale.off('resize', this.layout));
    };
    layout = () => {
        if (!this.container)
            return;
        const { width, height } = this.scene.scale, w = Math.min(560, width - 24), h = Math.min(600, height - 24), left = (width - w) / 2, top = (height - h) / 2;
        this.backdrop.setPosition(width / 2, height / 2).setSize(width, height);
        this.panel.setPosition(width / 2, height / 2).setSize(w, h);
        this.title.setPosition(width / 2 - 20, top + 30).setFontSize(w < 400 ? 14 : 18);
        this.closeButton.setPosition(left + w - 28, top + 28);
        const compact = h < 360;
        const columns = w >= 500 || (compact && w >= 440) ? 5 : h < 430 ? 3 : 2, cell = (w - 32) / columns;
        for (const [i, slot] of this.slots.entries()) {
            const x = left + 16 + cell * (i % columns + 0.5), y = top + (compact ? 84 : 96) + Math.floor(i / columns) * 64;
            slot.box.setPosition(x, y).setSize(cell - 8, 56);
            slot.icon.setPosition(x - 20, y - 7);
            slot.text.setPosition(x + 10, y + 12);
        }
        const recipeY = top + (compact ? 58 : 78) + Math.ceil(this.slots.length / columns) * 64;
        this.recipeText.setPosition(left + 20, recipeY).setFontSize(compact ? 12 : 14).setWordWrapWidth(w - 40);
        this.status.setPosition(width / 2, top + h - 90).setWordWrapWidth(w - 32).setVisible(!compact);
        this.actionButton.setPosition(width / 2, top + h - 40);
    };
    refresh = () => {
        if (!this.container)
            return;
        for (const slot of this.slots)
            slot.text.setText(`${slot.id === 'portal-key' ? 'Key' : slot.id}\nx${this.counts[slot.id]}`);
        const offering = this.mode === 'offering', recipe = offering ? DRAGON_RECIPE : PORTAL_RECIPE;
        this.title.setText(offering ? 'DRAGON OFFERING' : 'INVENTORY & CRAFTING');
        this.actionButton.setText(offering ? 'OFFER & AWAKEN' : 'CRAFT PORTAL KEY');
        this.recipeText.setText(offering ? `RITUAL: ONE OF EACH FACTION\nBone ${this.counts.bone}/1 · Fang ${this.counts.fang}/1\nEye ${this.counts.eye}/1 · Pearl ${this.counts.pearl}/1` :
            `PORTAL KEY RECIPE\nBone ${this.counts.bone}/3 · Fang ${this.counts.fang}/2 · Eye ${this.counts.eye}/1\nUnlocks the Flooded Realm.`);
        this.status.setText(this.hasPortalKey && !offering ? 'Portal Key: crafted' : canPay(this.counts, recipe) ? 'Materials ready.' : 'Collect the missing materials.');
        this.actionButton.setBackgroundColor(canPay(this.counts, recipe) && (!this.hasPortalKey || offering) ? '#396354' : '#37424a');
    };
}
