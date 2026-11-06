import type * as Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';
import { DRAGON_ALTAR, DRAGON_RECIPE } from '../progression';
import { interactionPressed } from '../interaction';
/** Owns the physical altar and a paid, pause-aware awakening transition. */
export class RitualSystem {
    constructor(private readonly scene: GameScene) { }
    altar: Phaser.Physics.Arcade.Sprite | null = null;
    badge: Phaser.GameObjects.Sprite | null = null;
    remaining = 0;
    private summoner: Phaser.Physics.Arcade.Sprite | null = null;
    reset() { this.altar = null; this.badge = null; this.remaining = 0; this.summoner = null; }
    private blocked = () => this.scene.playerController.isPlayerDead || this.scene.menu.isMenuOpen ||
        this.scene.shop.isShopOpen || this.scene.chat.isChatOpen || this.scene.inventory.isOpen;
    private near = () => !!this.altar && Math.hypot(this.scene.playerController.player.x - this.altar.x, this.scene.playerController.player.y - this.altar.y) < DRAGON_ALTAR.range;
    private bossAlive = () => this.scene.boss.isDragonSpawned && !this.scene.boss.isDragonDead;
    create = () => {
        this.altar = this.scene.physics.add.sprite(DRAGON_ALTAR.x, DRAGON_ALTAR.y, 'altar-dragon', 'idle')
            .setOrigin(0.5, 1).setDepth(DRAGON_ALTAR.y).setImmovable(true).play('altar-dragon-idle');
        const body = this.altar.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false).setSize(42, 16).setOffset(11, 48);
        this.scene.physics.add.collider(this.scene.playerController.player, this.altar);
        this.scene.physics.add.collider(this.scene.enemies.zombies, this.altar);
        this.scene.physics.add.collider(this.altar, this.scene.weapons.bullets, (_altar, bullet) => this.scene.weapons.retireProjectile(bullet as Phaser.Physics.Arcade.Sprite));
        if (this.scene.witches.potions)
            this.scene.physics.add.collider(this.altar, this.scene.witches.potions, (_altar, potion) => this.scene.witches.impact(potion as Phaser.Physics.Arcade.Sprite));
        this.badge = this.scene.add.sprite(DRAGON_ALTAR.x, DRAGON_ALTAR.y - 80, 'portal-progress', 'prompt-altar-dragon').setDepth(2000).setVisible(false);
    };
    offer = (actor = this.scene.playerController.player) => {
        if (this.scene.network?.isGuest) return this.scene.network.requestAction('offer');
        if ((!this.altar || Math.hypot(actor.x-this.altar.x,actor.y-this.altar.y)>=DRAGON_ALTAR.range) || this.remaining > 0 || this.bossAlive() || (actor === this.scene.playerController.player && (this.scene.playerController.isPlayerDead || this.scene.menu.isMenuOpen || this.scene.chat.isChatOpen || this.scene.shop.isShopOpen)))
            return false;
        if (!this.scene.inventory.spend(DRAGON_RECIPE)) {
            this.scene.hud.flashProximityAlert('The ritual needs one Bone, Fang, Eye and Pearl.', '#dba0fa');
            return false;
        }
        if(actor===this.scene.playerController.player)this.scene.inventory.close();
        this.summoner=actor;
        this.remaining = 1000;
        this.altar?.play('altar-dragon-summoning');
        this.presentAwakening();
        return true;
    };
    presentAwakening = () => {
        this.scene.cameras.main.shake(650, 0.012);
        this.scene.cameras.main.flash(400, 100, 40, 130);
        this.scene.audio?.play('ritual-offering-chime');
        this.scene.audio?.play('altar-summon-burst', this.altar ?? undefined);
    };
    update = (delta: number) => {
        this.badge?.setVisible(!this.blocked() && this.near() && this.remaining === 0 && !this.bossAlive());
        if(this.scene.network?.isGuest)return;
        if (this.blocked() && !(this.scene.network?.isConnected && this.scene.network.isHost && this.remaining>0))
            return;
        if (this.remaining > 0) {
            this.remaining = Math.max(0, this.remaining - delta);
            if (this.remaining === 0) {
                this.altar?.play('altar-dragon-active');
                this.scene.boss.summonAncientDragon(this.summoner ?? undefined);
            }
            return;
        }
        if (this.near() && !this.bossAlive() && interactionPressed(this.scene, 'dragon'))
            this.scene.inventory.open('offering');
    };
}
