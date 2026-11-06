import type * as Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';
import { enemyDrop, ITEM_COLORS, ITEM_NAMES, type ItemId } from '../progression';
export class LootSystem {
    constructor(private readonly scene: GameScene) { }
    pickups = new Map<Phaser.GameObjects.Sprite, {
        id: ItemId;
        amount: number;
    }>();
    reset() { for (const sprite of this.pickups.keys())
        sprite.destroy(); this.pickups.clear(); }
    onEnemyDefeated = (variant: string, x: number, y: number) => { if(this.scene.network?.isGuest)return; const item = enemyDrop(variant, Math.random()); if (item)
        this.spawn(item, x, y); };
    spawn = (id: ItemId, x: number, y: number) => {
        this.scene.audio?.play('loot-drop', { x, y }, .35);
        // Stack nearby identical loot rather than silently lose drops at the world cap.
        for (const [sprite, pickup] of this.pickups)
            if (pickup.id === id && (this.pickups.size >= 128 || Math.hypot(sprite.x - x, sprite.y - y) < 12)) {
                pickup.amount++;
                return sprite;
            }
        const sprite = this.scene.add.sprite(x, y - 8, 'items', `drop-${id}-0`).setDepth(y + 2).setInteractive({ useHandCursor: true });
        sprite.play(`items-drop-${id}`);
        this.pickups.set(sprite, { id, amount: 1 });
        sprite.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
            e.stopPropagation();
            if (this.suspended())
                return;
            if (Math.hypot(sprite.x - this.scene.playerController.player.x, sprite.y - this.scene.playerController.player.y) < 96)
                this.collect(sprite);
        });
        return sprite;
    };
    private suspended = () => this.scene.network?.isConnected && this.scene.network.isHost ? false : this.scene.network?.blocked || this.scene.playerController.isPlayerDead || this.scene.inventory.isOpen || this.scene.menu.isMenuOpen || this.scene.shop.isShopOpen || this.scene.chat.isChatOpen;
    collect = (sprite: Phaser.GameObjects.Sprite, remote = false) => {
        if(this.scene.network?.isGuest){this.scene.network.requestAction('loot',sprite.getData('networkId'));return false;}
        const pickup = this.pickups.get(sprite);
        if (!pickup || (!remote && this.suspended()))
            return false;
        if (pickup.id !== 'portal-key') this.scene.audio?.play(`loot-pickup-${pickup.id}`, sprite, .5);
        this.pickups.delete(sprite);
        this.scene.inventory.add(pickup.id, pickup.amount);
        const text = this.scene.add.text(sprite.x, sprite.y - 20, `+${pickup.amount} ${ITEM_NAMES[pickup.id]}`, { fontFamily: 'monospace', fontSize: '12px', color: ITEM_COLORS[pickup.id], stroke: '#080d15', strokeThickness: 3 }).setOrigin(0.5).setDepth(16000);
        this.scene.tweens.add({ targets: text, y: text.y - 24, alpha: 0, duration: 850, onComplete: () => text.destroy() });
        sprite.destroy();
        return true;
    };
    update = (delta: number) => {
        if (this.scene.network?.isGuest) {
            if (!this.suspended()) for (const [o] of this.pickups) if (Math.hypot(o.x-this.scene.playerController.player.x,o.y-this.scene.playerController.player.y)<24) this.collect(o);
            return;
        }
        if (this.suspended())
            return;
        for (const [sprite] of this.pickups) {
            const player=this.scene.network?.nearestTarget(sprite)??this.scene.playerController.player;
            const dx = player.x - sprite.x, dy = player.y - sprite.y, d = Math.hypot(dx, dy);
            if (d < 24) {
                this.collect(sprite,player===this.scene.network?.remotePlayer);
                continue;
            }
            if (d < 56) {
                const step = Math.min(d - 20, 120 * Math.min(delta, 50) / 1000);
                sprite.setPosition(sprite.x + dx / d * step, sprite.y + dy / d * step).setDepth(sprite.y + 2);
            }
        }
    };
}
