import { interactionPressed, INTERACTION_RANGE } from '../interaction';
import * as Phaser from 'phaser';
import { playerPose } from '../player-facing';
import type { GameScene } from '../scenes/Game';
import { WITCH_ALTAR_X, WITCH_ALTAR_Y, WITCH_TUNING } from '../constants';

/** Cauldron territory, ranged enemy behavior and a dedicated hostile potion pool. */
export class WitchSystem {
    constructor(private readonly scene: GameScene) {}

    altar: Phaser.Physics.Arcade.Sprite;
    proximityBadge: Phaser.GameObjects.Sprite;
    potions: Phaser.Physics.Arcade.Group;
    isSummoning = false;
    nextSpawnTime = 0;
    private castSequence = 0;
    private lastUpdateTime = 0;

    reset() {
        this.isSummoning = false;
        this.nextSpawnTime = 0;
        this.castSequence = 0;
        this.lastUpdateTime = 0;
    }

    private suspended = () => this.scene.network?.isConnected && this.scene.network.isHost ? false : this.scene.network?.blocked || this.scene.playerController.isPlayerDead || this.scene.menu.isMenuOpen ||
        this.scene.chat.isChatOpen || this.scene.inventory?.isOpen || this.scene.shop.isShopOpen;

    create = () => {
        this.altar = this.scene.physics.add.sprite(WITCH_ALTAR_X, WITCH_ALTAR_Y, 'altar-witch', 'idle-0');
        this.altar.setOrigin(0.5, 1).setImmovable(true).setDepth(WITCH_ALTAR_Y);
        this.altar.body?.setSize(40, 22).setOffset(12, 35);
        this.altar.play('altar-witch-idle');
        this.proximityBadge = this.scene.add.sprite(WITCH_ALTAR_X, WITCH_ALTAR_Y - 96, 'hud', 'prompt-altar-witch')
            .setOrigin(0.5).setScale(1.5).setDepth(2000).setVisible(false);
        this.scene.tweens.add({ targets: this.proximityBadge, y: '-=6', duration: 1100,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.potions = this.scene.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 32 });
        this.scene.physics.add.collider(this.scene.playerController.player, this.altar);
        this.scene.physics.add.collider(this.scene.enemies.zombies, this.altar);
        // Single sprite first: Phaser normalizes sprite/group callback ordering.
        this.scene.physics.add.collider(this.altar, this.scene.weapons.bullets, (_altar, bullet) => {
            this.scene.weapons.retireProjectile(bullet as Phaser.Physics.Arcade.Sprite);
        });
        this.scene.physics.add.overlap(this.scene.playerController.player, this.potions, (_player, potion) => {
            this.impact(potion as Phaser.Physics.Arcade.Sprite);
        });
        for (const obstacles of [this.scene.world.trees, this.scene.world.giantTrees, this.scene.world.rocks, this.scene.world.bushes]) {
            this.scene.physics.add.collider(this.potions, obstacles, potion => {
                this.impact(potion as Phaser.Physics.Arcade.Sprite);
            });
        }
    };

    summon = (manual = false) => {
        if (this.scene.network?.isGuest) return;
        if (this.suspended() || this.isSummoning || (!manual && this.scene.time.now < this.nextSpawnTime)) return;
        const active = this.scene.enemies.zombies.getChildren().filter(o => o.active && (o.getData('variant') === 'witch' || o.getData('variant') === 'witch-red')).length;
        if (active >= WITCH_TUNING.maxActive) return;
        this.scene.audio?.play('altar-summon-burst', this.altar);
        this.isSummoning = true;
        this.nextSpawnTime = this.scene.time.now + WITCH_TUNING.spawnCooldown;
        this.altar.play('altar-witch-summon');
        this.scene.time.delayedCall(300, () => {
            if (!this.suspended() && this.spawn()) {
                this.scene.cameras.main.shake(200, 0.008);
            }
        });
        this.altar.once('animationcomplete-altar-witch-summon', () => {
            this.isSummoning = false;
            this.altar.play('altar-witch-idle');
        });
    };

    spawn = (variantOverride?: 'witch' | 'witch-red') => {
        if (this.scene.network?.isGuest) return;
        const x = this.altar.x + (Phaser.Math.Between(0, 1) ? 64 : -64);
        const variant = variantOverride || (Phaser.Math.Between(0, 1) === 0 ? 'witch' : 'witch-red');
        const variantName = variant === 'witch-red' ? 'Scarlet Witch' : 'Briar Witch';
        const witch = this.scene.enemies.zombies.get(x, this.altar.y + 16, variant, 'idle-side-0') as Phaser.Physics.Arcade.Sprite | null;
        if (!witch) return;
        // Shared enemy pool may contain a dead zombie/wolf. Restore every presentation/physics field.
        for (const event of witch.eventNames()) {
            if (typeof event === 'string' && event.startsWith('animationcomplete')) witch.removeAllListeners(event);
        }
        this.scene.tweens.killTweensOf(witch);
        witch.anims.stop();
        witch.setTexture(variant, 'idle-side-0').setActive(true).setVisible(true).clearTint().setAlpha(1);
        witch.setScale(1).setOrigin(0.5, 1).setVelocity(0, 0).setCollideWorldBounds(true);
        (witch.body as Phaser.Physics.Arcade.Body).setEnable(true).setSize(24, 38).setOffset(12, 24);
        witch.setData({ variant, variantName, speed: WITCH_TUNING.speed,
            hp: WITCH_TUNING.hp, maxHp: WITCH_TUNING.hp, state: 'chase', facing: 'n',
            attackCooldown: this.scene.time.now + 800, witchCast: ++this.castSequence });
        this.scene.audio?.enemy(witch, 'spawn');
        this.scene.enemies.faceEnemy(witch);
        witch.play(this.scene.enemies.enemyAnimationKey(witch, 'idle'));
        return witch;
    };

    /** Called by the enemy dispatcher after shared dead/hurt/attack guards. */
    updateEnemy = (witch: Phaser.Physics.Arcade.Sprite, time: number) => {
        if (this.suspended()) { witch.setVelocity(0, 0); return; }
        const player = this.scene.network?.nearestTarget(witch)??this.scene.playerController.player;
        const dx = player.x - witch.x, dy = player.y - witch.y;
        const distance = Math.hypot(dx, dy);
        this.scene.enemies.faceEnemy(witch);
        if (distance < WITCH_TUNING.retreatRange) {
            // Facing remains on the player while walking backward.
            const length = distance || 1;
            witch.setVelocity(distance ? -dx / length * WITCH_TUNING.speed : WITCH_TUNING.speed,
                -dy / length * WITCH_TUNING.speed);
            witch.anims.play(this.scene.enemies.enemyAnimationKey(witch, 'walk'), true);
        } else if (distance > WITCH_TUNING.holdRange) {
            this.scene.physics.moveToObject(witch, player, WITCH_TUNING.speed);
            witch.anims.play(this.scene.enemies.enemyAnimationKey(witch, 'walk'), true);
        } else {
            witch.setVelocity(0, 0);
            witch.anims.play(this.scene.enemies.enemyAnimationKey(witch, 'idle'), true);
        }
        if (distance >= WITCH_TUNING.retreatRange && distance <= WITCH_TUNING.throwRange &&
            time >= (witch.getData('attackCooldown') ?? 0)) this.startThrow(witch, time);
    };

    private startThrow = (witch: Phaser.Physics.Arcade.Sprite, time: number) => {
        const cast = ++this.castSequence;
        const player = this.scene.network?.nearestTarget(witch)??this.scene.playerController.player;
        const target = { x: player.x, y: player.y - 16 };
        witch.setData('witchCast', cast).setData('state', 'attack');
        witch.setData('attackCooldown', time + WITCH_TUNING.throwCooldown);
        witch.setVelocity(0, 0);
        const key = this.scene.enemies.enemyAnimationKey(witch, 'attack');
        witch.play(key);
        this.scene.time.delayedCall(WITCH_TUNING.windup, () => {
            const v = witch.getData('variant');
            if (witch.active && (v === 'witch' || v === 'witch-red') && witch.getData('state') === 'attack' && witch.getData('witchCast') === cast && !this.suspended()) {
                this.throwPotion(witch, target);
            }
        });
        witch.once(`animationcomplete-${key}`, () => {
            const v = witch.getData('variant');
            if (witch.active && (v === 'witch' || v === 'witch-red') && witch.getData('state') === 'attack' && witch.getData('witchCast') === cast) {
                witch.setData('state', 'chase');
            }
        });
    };

    throwPotion = (witch: Phaser.Physics.Arcade.Sprite, target = {
        x: this.scene.playerController.player.x, y: this.scene.playerController.player.y - 16
    }) => {
        const variant = (witch.getData('variant') as string) || 'witch';
        const potionKey = variant === 'witch-red' ? 'witch-potion-red' : 'witch-potion';
        const pose = playerPose(witch.getData('facing') || 'e');
        const metadata = this.scene.cache.json.get(`${variant}-game`) || this.scene.cache.json.get('witch-game');
        const anchor = metadata?.game?.anchors?.find((a: { scope: { animation?: string } }) =>
            a.scope.animation === `attack${pose.suffix}`);
        const x = witch.x + ((anchor?.x ?? 41) - 24) * (pose.flip ? -1 : 1);
        const y = witch.y + (anchor?.y ?? 31) - 64;
        const dx = target.x - x, dy = target.y - y;
        const distance = Math.hypot(dx, dy) || 1;
        const potion = this.potions.get(x, y, potionKey, 'fly-0') as Phaser.Physics.Arcade.Sprite | null;
        if (!potion) return;
        this.scene.audio?.play('witch-potion-throw', witch);
        potion.anims.stop();
        potion.setTexture(potionKey, 'fly-0').setActive(true).setVisible(true).clearTint().setAlpha(1);
        potion.setOrigin(0.5).setScale(1).setRotation(0).setFlip(false, false);
        (potion.body as Phaser.Physics.Arcade.Body).setEnable(true).setSize(10, 13).setOffset(7, 7);
        const vx = dx / distance * WITCH_TUNING.potionSpeed, vy = dy / distance * WITCH_TUNING.potionSpeed;
        potion.setData({ vx, vy, potionKey, landsAt: this.scene.time.now + Math.min(1600, distance / WITCH_TUNING.potionSpeed * 1000) });
        potion.setVelocity(vx, vy).setAngularVelocity(240).setDepth(y);
        potion.play(`${potionKey}-fly`);
    };

    private retire = (potion: Phaser.Physics.Arcade.Sprite) => {
        potion.anims.stop();
        potion.setVelocity(0, 0).setAngularVelocity(0);
        (potion.body as Phaser.Physics.Arcade.Body).setEnable(false);
        this.potions.killAndHide(potion);
    };

    impact = (potion: Phaser.Physics.Arcade.Sprite) => {
        if (!potion.active || !this.potions.contains(potion)) return;
        const x = potion.x, y = potion.y;
        const potionKey = (potion.getData('potionKey') as string) || 'witch-potion';
        this.retire(potion);
        if (this.suspended()) return;
        this.scene.audio?.play('potion-shatter', { x, y }, .45);
        this.scene.audio?.play(potionKey === 'witch-potion-red' ? 'potion-splash-fire' : 'potion-splash-acid', { x, y }, .5);
        const splash = this.scene.add.sprite(x, y, potionKey, 'splash-0').setScale(2).setDepth(y + 1);
        splash.play(`${potionKey}-splash`);
        splash.once(`animationcomplete-${potionKey}-splash`, () => splash.destroy());
        const player = this.scene.playerController.player;
        for(const target of [player,this.scene.network?.remotePlayer]) {
            if(target&&Math.hypot(target.x-x,target.y-16-y)<=WITCH_TUNING.splashRadius){
                if(this.scene.network)this.scene.network.damageTarget(target,1,'witch');else this.scene.playerController.damagePlayer(1,'witch');
            }
        }
    };

    /** Runs even behind modal gates to freeze projectiles/witches without timer leaks. */
    update = (time: number) => {
        if (this.scene.network?.isGuest) {
            const p=this.scene.playerController.player;
            this.proximityBadge.setVisible(!this.suspended() && Math.hypot(p.x-this.altar.x,p.y-this.altar.y)<WITCH_TUNING.territoryRange);
            return;
        }
        const elapsed = this.lastUpdateTime ? Math.max(0, time - this.lastUpdateTime) : 0;
        this.lastUpdateTime = time;
        const suspended = this.suspended();
        if (suspended) {
            this.scene.enemies.zombies.getChildren().forEach(obj => {
                const v = obj.getData('variant');
                if (obj.active && (v === 'witch' || v === 'witch-red')) (obj as Phaser.Physics.Arcade.Sprite).setVelocity(0, 0);
            });
        }
        this.potions.getChildren().forEach(obj => {
            const potion = obj as Phaser.Physics.Arcade.Sprite;
            if (!potion.active) return;
            if (this.scene.playerController.isPlayerDead && !this.scene.network?.isConnected) { this.retire(potion); return; }
            if (suspended) {
                potion.setData('landsAt', potion.getData('landsAt') + elapsed);
                potion.setVelocity(0, 0).setAngularVelocity(0);
            } else {
                potion.setVelocity(potion.getData('vx'), potion.getData('vy')).setAngularVelocity(240).setDepth(potion.y);
                if (time >= potion.getData('landsAt')) this.impact(potion);
            }
        });
        const distance = Phaser.Math.Distance.Between(this.scene.playerController.player.x, this.scene.playerController.player.y,
            WITCH_ALTAR_X, WITCH_ALTAR_Y);
        const showProximity = !suspended && distance < WITCH_TUNING.territoryRange;
        this.proximityBadge.setVisible(showProximity);
        if (suspended) return;
        const near = distance < INTERACTION_RANGE.witch;
        if (!this.isSummoning) this.altar.play(distance < WITCH_TUNING.territoryRange ? 'altar-witch-active' : 'altar-witch-idle', true);
        const manual = near && interactionPressed(this.scene, 'witch');
        if (manual || distance < WITCH_TUNING.territoryRange) {
            this.summon(manual);
        }
    };
}
