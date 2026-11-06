import { deathCauseForEnemy } from '../death-causes';
import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { facingFromVector, playerPose, type PlayerFacing } from '../player-facing';
import { WEREWOLF_VARIANTS, UNDEAD_VARIANTS } from './enemy-variants';

export class EnemiesSystem {
    constructor(private readonly scene: GameScene) {}

    zombies: Phaser.Physics.Arcade.Group;

    faceEnemy = (enemy: Phaser.Physics.Arcade.Sprite) => {
        const target=this.scene.network?.nearestTarget(enemy)??this.scene.playerController.player;
        const facing = facingFromVector(
            target.x - enemy.x,
            target.y - enemy.y,
            (enemy.getData('facing') as PlayerFacing) || 'e'
        );
        enemy.setData('facing', facing);
        enemy.setFlipX(playerPose(facing).flip);
    };

    enemyAnimationKey = (enemy: Phaser.Physics.Arcade.Sprite, action: 'idle' | 'walk' | 'attack' | 'hurt' | 'die') => {
        const variant = (enemy.getData('variant') as string) || 'zombie';
        const facing = (enemy.getData('facing') as PlayerFacing) || 'e';
        return `${variant}-${action}${playerPose(facing).suffix}`;
    };

    createZombies = () => {
        this.zombies = this.scene.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            maxSize: 40,
            runChildUpdate: true
        });
    };

    summonZombieAtAltar = () => {
        if(this.scene.network?.isGuest)return;
        const isSummoning = this.scene.altars.isAltarSummoning || (this.scene.altars.altar.anims.isPlaying && this.scene.altars.altar.anims.currentAnim?.key === 'altar-summon');
        if (isSummoning) return;
        this.scene.audio?.play('altar-summon-burst', this.scene.altars.altar);
        this.scene.altars.isAltarSummoning = true;

        // Play altar summon energy burst animation from start
        this.scene.altars.altar.play('altar-summon', true);

        // Climax burst: emerge zombie at peak energy discharge (around 240ms)
        this.scene.time.delayedCall(240, () => {
            if(this.scene.network?.isGuest)return;
            if (this.scene.playerController.isPlayerDead && !this.scene.network?.isConnected) return;

            // Camera subtle rumble at the moment of emergence
            this.scene.cameras.main.shake(200, 0.008);

            // Spawn zombie right in front of the altar
            const spawnX = this.scene.altars.altar.x + Phaser.Math.Between(-25, 25);
            const spawnY = this.scene.altars.altar.y + 20;

            // Randomly select one of the 4 undead zombie variants (green, female, skeleton, blue)
            const variantConfig = Phaser.Utils.Array.GetRandom(UNDEAD_VARIANTS);

            const zombie = this.zombies.get(spawnX, spawnY, variantConfig.key, 'frame-0') as Phaser.Physics.Arcade.Sprite;
            if (zombie) {
                zombie.setActive(true).setVisible(true);
                zombie.setTexture(variantConfig.key, 'frame-0');
                (zombie.body as Phaser.Physics.Arcade.Body)?.setEnable(true);
                zombie.setScale(1);
                zombie.setOrigin(0.5, 1);
                zombie.body?.setSize(24, 48);
                zombie.body?.setOffset(12, 14);

                zombie.setData('variant', variantConfig.key);
                zombie.setData('variantName', variantConfig.name);
                zombie.setData('speed', variantConfig.speed);
                zombie.setData('hp', variantConfig.hp);
                zombie.setData('maxHp', variantConfig.hp);
                zombie.setData('state', 'chase');
                zombie.setData('attackCooldown', 0);
                this.scene.audio?.enemy(zombie, 'spawn');
                this.faceEnemy(zombie);
                zombie.play(this.enemyAnimationKey(zombie, 'walk'));

                // Emergence rise and variant-specific magical surge tint
                zombie.setAlpha(0.2);
                zombie.setTint(variantConfig.tintColor);
                this.scene.tweens.add({
                    targets: zombie,
                    alpha: 1,
                    duration: 250,
                    ease: 'Power1'
                });

                this.scene.time.delayedCall(350, () => {
                    if (zombie.active) zombie.clearTint();
                });
            }
        });

        // Clean return to active or idle when the summon animation finishes
        this.scene.altars.altar.once('animationcomplete-altar-summon', () => {
            this.scene.altars.isAltarSummoning = false;
            this.scene.altars.altar.play(this.scene.altars.isPlayerNearAltar ? 'altar-active' : 'altar-idle');
        });
    };

    summonWerewolfAtWolfAltar = () => {
        if(this.scene.network?.isGuest)return;
        const isSummoning = this.scene.altars.isWolfAltarSummoning || (this.scene.altars.wolfAltar.anims.isPlaying && this.scene.altars.wolfAltar.anims.currentAnim?.key === 'altar-wolf-summon');
        if (isSummoning) return;
        this.scene.audio?.play('altar-summon-burst', this.scene.altars.wolfAltar);
        this.scene.altars.isWolfAltarSummoning = true;

        // Play wolf altar summon burst animation from start
        this.scene.altars.wolfAltar.play('altar-wolf-summon', true);

        // Climax burst: emerge werewolf at peak energy discharge (around 240ms)
        this.scene.time.delayedCall(240, () => {
            if(this.scene.network?.isGuest)return;
            if (this.scene.playerController.isPlayerDead && !this.scene.network?.isConnected) return;

            // Camera ferocious rumble at the moment of werewolf howl emergence
            this.scene.cameras.main.shake(220, 0.012);

            // Spawn werewolf right in front of the wolf altar (220, 260)
            const spawnX = this.scene.altars.wolfAltar.x + Phaser.Math.Between(-20, 20);
            const spawnY = this.scene.altars.wolfAltar.y + 20;

            const wolfConfig = Phaser.Utils.Array.GetRandom(WEREWOLF_VARIANTS);

            const werewolf = this.zombies.get(spawnX, spawnY, wolfConfig.key, 'frame-0') as Phaser.Physics.Arcade.Sprite;
            if (werewolf) {
                werewolf.setActive(true).setVisible(true);
                werewolf.setTexture(wolfConfig.key, 'frame-0');
                (werewolf.body as Phaser.Physics.Arcade.Body)?.setEnable(true);
                werewolf.setScale(1);
                werewolf.setOrigin(0.5, 1);
                werewolf.body?.setSize(24, 48);
                werewolf.body?.setOffset(12, 14);

                werewolf.setData('variant', wolfConfig.key);
                werewolf.setData('variantName', wolfConfig.name);
                werewolf.setData('speed', wolfConfig.speed);
                werewolf.setData('hp', wolfConfig.hp);
                werewolf.setData('maxHp', wolfConfig.hp);
                werewolf.setData('state', 'chase');
                werewolf.setData('attackCooldown', 0);
                this.scene.audio?.enemy(werewolf, 'spawn');
                this.faceEnemy(werewolf);
                werewolf.play(this.enemyAnimationKey(werewolf, 'walk'));

                // Emergence rise and variant-specific surge tint
                werewolf.setAlpha(0.2);
                werewolf.setTint(wolfConfig.tintColor);
                this.scene.tweens.add({
                    targets: werewolf,
                    alpha: 1,
                    duration: 250,
                    ease: 'Power1'
                });

                this.scene.time.delayedCall(350, () => {
                    if (werewolf.active) werewolf.clearTint();
                });
            }
        });

        // Clean return to active or idle when the summon animation finishes
        this.scene.altars.wolfAltar.once('animationcomplete-altar-wolf-summon', () => {
            this.scene.altars.isWolfAltarSummoning = false;
            this.scene.altars.wolfAltar.play(this.scene.altars.isPlayerNearWolfAltar ? 'altar-wolf-active' : 'altar-wolf-idle');
        });
    };

    summonDrownerAtAltar = () => {
        if(this.scene.network?.isGuest || this.scene.altars.isDrownerAltarSummoning)return;
        const altar=this.scene.altars.drownerAltar;
        this.scene.audio?.play('altar-summon-burst', altar);
        this.scene.altars.isDrownerAltarSummoning=true;altar.play('altar-drowner-summon');
        this.scene.time.delayedCall(240,()=>{
            if(this.scene.network?.isGuest || this.scene.playerController.isPlayerDead && !this.scene.network?.isConnected)return;
            const enemy=this.zombies.get(altar.x+Phaser.Math.Between(-20,20),altar.y+30,'drowner','idle-side-0') as Phaser.Physics.Arcade.Sprite;
            if(!enemy)return;
            enemy.anims.stop();enemy.setTexture('drowner','idle-side-0').setActive(true).setVisible(true).setScale(1).setOrigin(0.5,1).setAlpha(0.2).setTint(0x55ddcc);
            (enemy.body as Phaser.Physics.Arcade.Body).setEnable(true);enemy.setVelocity(0,0);enemy.body?.setSize(24,36).setOffset(12,20);
            enemy.setData({variant:'drowner',variantName:'Brine Drowner',speed:85,hp:3,maxHp:3,state:'chase',attackCooldown:0});
            this.scene.audio?.enemy(enemy, 'spawn');
            this.faceEnemy(enemy);enemy.play(this.enemyAnimationKey(enemy,'walk'));
            this.scene.tweens.add({targets:enemy,alpha:1,duration:250});
            this.scene.time.delayedCall(350,()=>{if(enemy.active)enemy.clearTint();});
        });
        altar.once('animationcomplete-altar-drowner-summon',()=>{
            this.scene.altars.isDrownerAltarSummoning=false;
            altar.play(this.scene.altars.isPlayerNearDrownerAltar?'altar-drowner-active':'altar-drowner-idle');
        });
    };
    bulletHitZombie = (
        bulletObj: Phaser.Tilemaps.Tile | Phaser.GameObjects.GameObject,
        zombieObj: Phaser.Tilemaps.Tile | Phaser.GameObjects.GameObject
    ) => {
        const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
        if(this.scene.network?.isGuest){this.scene.weapons.retireProjectile(bullet);return;}
        const zombie = zombieObj as Phaser.Physics.Arcade.Sprite;

        if (!bullet.active || !zombie.active) return;
        const killOwner = bullet.getData('owner') || 'local';
        const ownerGeneration = bullet.getData('ownerGeneration');
        this.scene.weapons.retireProjectile(bullet);

        const state = zombie.getData('state');
        if (state === 'dead') return;

        this.scene.audio?.play(zombie.getData('variant') === 'zombie-skeleton' ? 'impact-bone' : 'impact-flesh', zombie, .4);
        const hp = (zombie.getData('hp') ?? 3) - 1;
        zombie.setData('hp', hp);

        zombie.setTint(0xff3333);
        this.scene.time.delayedCall(120, () => { if (zombie.active) zombie.clearTint(); });

        if (hp <= 0) {
            this.scene.audio?.enemy(zombie, 'die');
            zombie.setData('state', 'dead');
            this.scene.loot?.onEnemyDefeated(zombie.getData('variant') || zombie.texture.key,zombie.x,zombie.y);
            zombie.setVelocity(0, 0);
            (zombie.body as Phaser.Physics.Arcade.Body)?.setEnable(false);
            const deathKey = this.enemyAnimationKey(zombie, 'die');
            const variant = (zombie.getData('variant') as string) || '';
            const isWerewolf = variant.startsWith('werewolf') || zombie.texture.key.startsWith('werewolf');
            const killValue = isWerewolf ? 2 : 1;

            zombie.play(deathKey);
            zombie.once(`animationcomplete-${deathKey}`, () => {
                if (zombie.active) {
                    const deadX = zombie.x;
                    const deadY = zombie.y;
                    this.zombies.killAndHide(zombie);
                    if (this.scene.network?.resources)
                        this.scene.network.resources.awardKills(killValue, killOwner, ownerGeneration);
                    else this.scene.score += killValue;
                    this.scene.hud.updateHUD();
                    if (this.scene.shop.isShopOpen) {
                        this.scene.shop.updateShopElements();
                    }
                    if (this.scene.hud.skullSprite) {
                        this.scene.tweens.killTweensOf(this.scene.hud.skullSprite);
                        this.scene.hud.skullSprite.setScale(isWerewolf ? 1.5 : 1.35);
                        this.scene.tweens.add({
                            targets: this.scene.hud.skullSprite,
                            scale: 1.1,
                            duration: 160,
                            ease: 'Back.easeOut'
                        });
                    }

                    if (isWerewolf) {
                        const killPopup = this.scene.add.text(deadX, deadY - 36, '+2 KILLS', {
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            color: '#ff4444',
                            stroke: '#000000',
                            strokeThickness: 3
                        }).setOrigin(0.5).setDepth(15000);

                        this.scene.tweens.add({
                            targets: killPopup,
                            y: deadY - 64,
                            alpha: 0,
                            duration: 800,
                            ease: 'Power2',
                            onComplete: () => killPopup.destroy()
                        });
                    }
                }
            });
        }
        else {
            this.scene.audio?.enemy(zombie, 'hurt');
            zombie.setData('state', 'hurt');
            zombie.setVelocity(0, 0);
            const hurtKey = this.enemyAnimationKey(zombie, 'hurt');
            zombie.play(hurtKey);
            zombie.once(`animationcomplete-${hurtKey}`, () => {
                if (zombie.active && zombie.getData('state') === 'hurt') {
                    zombie.setData('state', 'chase');
                }
            });
        }
    };

    update = (time: number) => {
        if(this.scene.network?.isGuest)return;
        //  Zombie AI & Combat Loop
        this.zombies.getChildren().forEach((obj: Phaser.GameObjects.GameObject) => {
            const zombie = obj as Phaser.Physics.Arcade.Sprite;
            if (!zombie.active) return;

            const state = zombie.getData('state') ?? 'chase';
            if (state === 'dead' || state === 'hurt' || state === 'attack') return;

            const variant = zombie.getData('variant');
            if (variant === 'witch' || variant === 'witch-red') {
                this.scene.witches.updateEnemy(zombie, time);
                return;
            }

            const target=this.scene.network?.nearestTarget(zombie)??this.scene.playerController.player;
            const speed = (zombie.getData('speed') as number) || 85;

            const dist = Phaser.Math.Distance.Between(zombie.x, zombie.y, target.x, target.y);
            const attackCooldown = zombie.getData('attackCooldown') ?? 0;

            if (dist < 42 && time > attackCooldown) {
                //  Initiate attack
                this.scene.audio?.enemy(zombie, 'attack');
                zombie.setData('state', 'attack');
                zombie.setVelocity(0, 0);
                this.faceEnemy(zombie);
                const attackKey = this.enemyAnimationKey(zombie, 'attack');
                zombie.play(attackKey);

                // Hit when the directional windup ends and the lunge frame starts.
                const impactDelay = this.scene.anims.get(attackKey)?.frames[0]?.duration || 180;
                this.scene.time.delayedCall(impactDelay, () => {
                    if (zombie.active && zombie.getData('state') === 'attack') {
                        const currentDist = Phaser.Math.Distance.Between(zombie.x, zombie.y, target.x, target.y);
                        if (currentDist < 52) {
                            if(this.scene.network)this.scene.network.damageTarget(target,1,deathCauseForEnemy(zombie.getData('variant') || 'zombie'));
                            else this.scene.playerController.damagePlayer(1, deathCauseForEnemy(zombie.getData('variant') || 'zombie'));
                        }
                    }
                });

                zombie.once(`animationcomplete-${attackKey}`, () => {
                    if (zombie.active && zombie.getData('state') === 'attack') {
                        zombie.setData('state', 'chase');
                        zombie.setData('attackCooldown', this.scene.time.now + 500);
                    }
                });
            }
            else if (state === 'chase') {
                this.scene.physics.moveToObject(zombie, target, speed);
                this.faceEnemy(zombie);
                zombie.anims.play(this.enemyAnimationKey(zombie, 'walk'), true);
            }
        });

    };
}
