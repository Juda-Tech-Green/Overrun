import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { GAME_WIDTH, MAP_HEIGHT, MAP_WIDTH } from '../constants';
import { facingFromVector, playerPose, type PlayerFacing } from '../player-facing';

export class BossSystem {
    constructor(private readonly scene: GameScene) {}

    // 512 px dragon frames at 0.5 = 256 px, four times the 64 px player frame.
    readonly DRAGON_SCALE: number = 0.5;

    private dragonBulletOverlap: Phaser.Physics.Arcade.Collider | null = null;

    private clearDragonOverlap = () => {
        if (this.dragonBulletOverlap?.world) this.dragonBulletOverlap.destroy();
        this.dragonBulletOverlap = null;
    };

    dragon: Phaser.Physics.Arcade.Sprite | null = null;

    dragonFacing: PlayerFacing = 'e';

    dragonAnimationKey = (action: 'idle' | 'fly' | 'attack' | 'hurt' | 'die') =>
        `dragon-${action}${playerPose(this.dragonFacing).suffix}`;

    private faceDragon = () => {
        if (!this.dragon) return;
        const player = this.scene.network?.nearestTarget(this.dragon!)??this.scene.playerController.player;
        this.dragonFacing = facingFromVector(player.x - this.dragon.x, player.y - this.dragon.y, this.dragonFacing);
        this.dragon.setFlipX(playerPose(this.dragonFacing).flip);
    };


    dragonHp: number = 50;

    dragonMaxHp: number = 50;

    isDragonSpawned: boolean = false;

    isDragonDead: boolean = false;

    dragonAttackCooldown: number = 0;

    dragonFireballs: Phaser.Physics.Arcade.Group;

    bossBarContainer: Phaser.GameObjects.Container | null = null;

    bossBarFill: Phaser.GameObjects.Rectangle | null = null;

    bossBarText: Phaser.GameObjects.Text | null = null;

    summonAncientDragon = (summoner = this.scene.playerController.player) => {
        if (this.scene.network?.isGuest) return;
        if (this.dragon && this.dragon.active && !this.isDragonDead) {
            this.scene.chat.addChatMessage('🔥 ANCIENT DRAGON', 'I am already hovering above you, mortal! Prepare for flame!', '#ff4433');
            return;
        }

        // Camera ferocious rumble and volcanic flash
        this.scene.cameras.main.shake(1200, 0.025);
        this.scene.cameras.main.flash(600, 255, 60, 20);

        // Spawn position in front of player within world bounds (offset 150 px for the 256 px dragon)
        const spawnX = Phaser.Math.Clamp(summoner.x + (summoner.flipX ? -150 : 150), 100, MAP_WIDTH - 100);
        const spawnY = Phaser.Math.Clamp(summoner.y - 50, 80, MAP_HEIGHT - 80);

        this.dragonHp = 50;
        this.dragonMaxHp = 50;
        this.scene.audio?.play('dragon-summon-roar');
        this.isDragonSpawned = true;
        this.isDragonDead = false;
        this.dragonAttackCooldown = this.scene.time.now + 3500;

        this.clearDragonOverlap();
        if (this.dragon) {
            this.dragon.destroy();
        }

        // Every idle/fly/attack/hurt/death frame uses the same 256 px display size.
        this.dragon = this.scene.physics.add.sprite(spawnX, spawnY, 'dragon', 'frame-0');
        this.dragon.setActive(true).setVisible(true);
        this.dragon.setScale(this.DRAGON_SCALE);
        this.dragon.setOrigin(0.5, 0.85);
        // Physics body sized in unscaled frame coords; Phaser scales them automatically
        this.dragon.setSize(340, 360);
        this.dragon.setOffset(86, 90);
        this.dragon.setDepth(this.dragon.y);
        this.faceDragon();
        this.dragon.play(this.dragonAnimationKey('idle'));

        // Collisions
        this.dragonBulletOverlap = this.scene.physics.add.overlap(
            this.dragon,
            this.scene.weapons.bullets,
            this.bulletHitDragon as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this.scene
        );

        this.createBossBar();
        this.scene.hud.flashProximityAlert('🔥 ALERT: The Ancient Crimson Dragon has Awakened!', '#ff3300');

        this.scene.time.delayedCall(400, () => {
            this.scene.chat.addChatMessage('🔥 ANCIENT DRAGON', 'ROAAAR! Who dares awaken the Ancient Crimson Wyrm?!', '#ff3322');
        });
    };

    updateDragonBoss = (time: number) => {
        if (this.scene.network?.isGuest) return;
        if (!this.dragon || !this.dragon.active || this.isDragonDead) return;

        const target=this.scene.network?.nearestTarget(this.dragon)??this.scene.playerController.player;
        // Depth sorting
        this.dragon.setDepth(this.dragon.y);

        const currentAnim = this.dragon.anims.currentAnim?.key;
        const isAttacking = currentAnim?.startsWith('dragon-attack') && this.dragon.anims.isPlaying;
        const isHurt = currentAnim?.startsWith('dragon-hurt') && this.dragon.anims.isPlaying;
        const isDying = currentAnim?.startsWith('dragon-die') && this.dragon.anims.isPlaying;

        if (isDying || isHurt) return;

        // Face player
        if (!isAttacking) {
            this.faceDragon();
        }

        const dist = Phaser.Math.Distance.Between(this.dragon.x, this.dragon.y, target.x, target.y);

        // Preserve the contact radius relative to the larger dragon.
        if (dist < 75 * (this.DRAGON_SCALE / 0.33) ) {
            if(this.scene.network)this.scene.network.damageTarget(target,1,'dragon');
            else this.scene.playerController.damagePlayer(1, 'dragon');
        }

        // Fire Breath Attack trigger
        if (!isAttacking && time > this.dragonAttackCooldown) {
            this.scene.audio?.play('dragon-fireball-charge', this.dragon);
            this.dragonAttackCooldown = time + 5500;
            this.dragon.setVelocity(0, 0);
            this.faceDragon();
            const attackKey = this.dragonAnimationKey('attack');
            this.dragon.play(attackKey);
            this.dragon.setScale(this.DRAGON_SCALE);

            // Delayed effects belong to this particular dragon, never a later summon.
            const attackingDragon = this.dragon;
            this.scene.time.delayedCall(220, () => {
                if (this.dragon === attackingDragon && attackingDragon.active && !this.isDragonDead
                    && attackingDragon.anims.currentAnim?.key === attackKey) {
                    this.scene.cameras.main.shake(400, 0.012);
                    this.launchDragonFireballs();
                }
            });

            this.dragon.once(`animationcomplete-${attackKey}`, () => {
                if (this.dragon === attackingDragon && attackingDragon.active && !this.isDragonDead
                    && attackingDragon.anims.currentAnim?.key === attackKey) {
                    this.dragon.play(this.dragonAnimationKey('fly'), true);
                    this.dragon.setScale(this.DRAGON_SCALE);
                }
            });
            return;
        }

        // Flight & Hover Movement toward player
        if (!isAttacking) {
            const DRAGON_SPEED = 75;
            this.scene.physics.moveToObject(this.dragon, target, DRAGON_SPEED);
            if (currentAnim !== this.dragonAnimationKey('fly')) {
                this.dragon.play(this.dragonAnimationKey('fly'), true);
                this.dragon.setScale(this.DRAGON_SCALE);
            }
        }
    };

    launchDragonFireballs = () => {
        if (!this.dragon || !this.dragon.active || this.isDragonDead) return;

        this.scene.audio?.play('dragon-fireball-launch', this.dragon);
        // Every view supplies its own mouth anchor in the untrimmed 512 px canvas.
        const suffix = playerPose(this.dragonFacing).suffix;
        const metadata = this.scene.cache.json.get(`dragon${suffix}-game`);
        const anchor = metadata?.game?.anchors?.find((a: { name: string }) => a.name === 'muzzle')
            ?? { x: 400, y: 222 };
        const mouthX = this.dragon.x + (anchor.x - 256) * (this.dragon.flipX ? -1 : 1) * this.DRAGON_SCALE;
        const mouthY = this.dragon.y + (anchor.y - 512 * 0.85) * this.DRAGON_SCALE;

        // Launch a 3-spread of incandescent fireballs
        const target=this.scene.network?.nearestTarget(this.dragon)??this.scene.playerController.player;
        const baseAngle = Phaser.Math.Angle.Between(mouthX, mouthY, target.x, target.y);
        const angles = [baseAngle - 0.22, baseAngle, baseAngle + 0.22];

        angles.forEach(angle => {
            const fb = this.dragonFireballs.create(mouthX, mouthY, 'bullet') as Phaser.Physics.Arcade.Sprite;
            if (fb) {
                fb.setActive(true).setVisible(true);
                fb.setDepth(1500);
                fb.setScale(3.5);
                fb.setTint(0xff5500);
                fb.setRotation(angle);
                const speed = 360;
                fb.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

                // Auto cleanup after 3 seconds
                this.scene.time.delayedCall(3000, () => {
                    if (fb.active) {
                        this.dragonFireballs.killAndHide(fb);
                        (fb.body as Phaser.Physics.Arcade.Body)?.setEnable(false);
                    }
                });
            }
        });
    };

    bulletHitDragon = (
        bulletObj: Phaser.Tilemaps.Tile | Phaser.GameObjects.GameObject,
        dragonObj: Phaser.Tilemaps.Tile | Phaser.GameObjects.GameObject
    ) => {
        if (this.scene.network?.isGuest) return;
        // Arcade normalizes group-vs-sprite collisions to (sprite, group member).
        // Identify the boss by identity and require actual bullet-pool membership.
        const dragon = this.dragon;
        if (!dragon || (bulletObj !== dragon && dragonObj !== dragon)) return;
        const bullet = (bulletObj === dragon ? dragonObj : bulletObj) as Phaser.Physics.Arcade.Sprite;
        if (!bullet.active || !dragon.active || this.isDragonDead
            || !this.scene.weapons.bullets.contains(bullet)) return;
        const killOwner = bullet.getData('owner') || 'local';
        const ownerGeneration = bullet.getData('ownerGeneration');
        this.scene.weapons.retireProjectile(bullet);

        this.scene.audio?.play('impact-dragon-scale', dragon, .4);
        this.scene.audio?.play('dragon-hurt', dragon, .5, 250);
        this.dragonHp -= 1;
        this.updateBossBar();

        dragon.setTint(0xffaaaa);
        this.scene.time.delayedCall(90, () => {
            if (this.dragon === dragon && dragon.active && !this.isDragonDead) dragon.clearTint();
        });

        if (this.dragonHp <= 0) {
            this.scene.audio?.play('dragon-die', dragon);
            this.scene.audio?.play('ui-boss-victory', undefined, .5);
            this.isDragonDead = true;
            this.clearDragonOverlap();
            dragon.clearTint();
            dragon.setVelocity(0, 0);
            (dragon.body as Phaser.Physics.Arcade.Body)?.setEnable(false);
            const deathKey = this.dragonAnimationKey('die');
            dragon.play(deathKey);
            dragon.setScale(this.DRAGON_SCALE);

            this.scene.cameras.main.shake(1600, 0.028);
            this.scene.cameras.main.flash(500, 255, 200, 50);

            if (this.scene.network?.resources)
                this.scene.network.resources.awardKills(100, killOwner, ownerGeneration);
            else this.scene.score += 100;
            this.scene.hud.updateHUD();

            this.scene.chat.addChatMessage('🏆 SYSTEM', 'The Ancient Crimson Dragon has been vanquished! (+100 Score)', '#ffd700');
            this.scene.hud.flashProximityAlert('🏆 VICTORY: Ancient Crimson Dragon Slain! (+100)', '#ffd700');

            if (this.bossBarContainer) {
                const defeatedBossBar = this.bossBarContainer;
                this.scene.tweens.add({
                    targets: defeatedBossBar,
                    alpha: 0,
                    duration: 1200,
                    onComplete: () => {
                        defeatedBossBar.destroy();
                        if (this.bossBarContainer === defeatedBossBar) this.bossBarContainer = null;
                    }
                });
            }

            dragon.once(`animationcomplete-${deathKey}`, () => {
                // Keep smoldering ash monument on ground
            });
        } else {
            const currentAnim = dragon.anims.currentAnim?.key;
            if (!currentAnim?.startsWith('dragon-attack') && !currentAnim?.startsWith('dragon-hurt')) {
                dragon.setVelocity(0, 0);
                const hurtKey = this.dragonAnimationKey('hurt');
                dragon.play(hurtKey);
                dragon.setScale(this.DRAGON_SCALE);
                dragon.once(`animationcomplete-${hurtKey}`, () => {
                    if (this.dragon === dragon && dragon.active && !this.isDragonDead && dragon.anims.currentAnim?.key === hurtKey) {
                        dragon.play(this.dragonAnimationKey('fly'), true);
                        dragon.setScale(this.DRAGON_SCALE);
                    }
                });
            }
        }
    };

    createBossBar = () => {
        if (this.bossBarContainer) {
            this.bossBarContainer.destroy();
        }

        this.bossBarContainer = this.scene.add.container((this.scene.scale?.width ?? GAME_WIDTH) / 2, 28).setScrollFactor(0).setDepth(15000);

        // Frame background
        const barBg = this.scene.add.rectangle(0, 0, 440, 26, 0x180808, 0.9);
        barBg.setStrokeStyle(2, 0xd4af37);

        // Fill bar
        this.bossBarFill = this.scene.add.rectangle(-216, 0, 432, 20, 0xd42200, 1).setOrigin(0, 0.5);

        // Title and HP text
        this.bossBarText = this.scene.add.text(0, 0, `🔥 ANCIENT CRIMSON DRAGON - ${this.dragonHp} / ${this.dragonMaxHp} HP`, {
            fontFamily: 'monospace',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.bossBarContainer.add([barBg, this.bossBarFill, this.bossBarText]);
        this.bossBarContainer.setAlpha(0);
        this.scene.tweens.add({
            targets: this.bossBarContainer,
            alpha: 1,
            duration: 400
        });
    };

    updateBossBar = () => {
        if (!this.bossBarFill || !this.bossBarText) return;
        const pct = Math.max(0, this.dragonHp / this.dragonMaxHp);
        this.scene.tweens.add({
            targets: this.bossBarFill,
            width: 432 * pct,
            duration: 120,
            ease: 'Quad.easeOut'
        });
        this.bossBarText.setText(`🔥 ANCIENT CRIMSON DRAGON - ${Math.max(0, this.dragonHp)} / ${this.dragonMaxHp} HP`);
    };

    reset() {
        // Phaser owns collider teardown during scene shutdown.
        this.dragonBulletOverlap = null;
        this.dragon = null;
        this.dragonFacing = 'e';
        this.dragonHp = 50;
        this.dragonMaxHp = 50;
        this.isDragonSpawned = false;
        this.isDragonDead = false;
        this.bossBarContainer = null;
        this.bossBarFill = null;
        this.bossBarText = null;
    }
}
