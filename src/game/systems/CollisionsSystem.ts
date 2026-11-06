import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';

export class CollisionsSystem {
    constructor(private readonly scene: GameScene) {}

    setupCollisions = () => {
        // Player collides with solid altars
        this.scene.physics.add.collider(this.scene.playerController.player, this.scene.altars.altar);
        this.scene.physics.add.collider(this.scene.playerController.player, this.scene.altars.wolfAltar);
        if (this.scene.altars.drownerAltar) {
            this.scene.physics.add.collider(this.scene.playerController.player, this.scene.altars.drownerAltar);
            this.scene.physics.add.collider(this.scene.enemies.zombies, this.scene.altars.drownerAltar);
            this.scene.physics.add.collider(this.scene.weapons.bullets, this.scene.altars.drownerAltar, (bulletObj) => {
                const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                if (bullet.active) this.scene.weapons.retireProjectile(bullet);
            });
        }

        if (this.scene.altars.drownerAltar) {
            this.scene.physics.add.collider(this.scene.playerController.player, this.scene.altars.drownerAltar);
            this.scene.physics.add.collider(this.scene.enemies.zombies, this.scene.altars.drownerAltar);
            this.scene.physics.add.collider(this.scene.weapons.bullets, this.scene.altars.drownerAltar, bullet=>this.scene.weapons.retireProjectile(bullet as Phaser.Physics.Arcade.Sprite));
        }
        // Player & Zombies collide with solid tree trunks
        this.scene.physics.add.collider(this.scene.playerController.player, this.scene.world.trees);
        this.scene.physics.add.collider(this.scene.enemies.zombies, this.scene.world.trees);

        // Player & Zombies collide with solid giant tree trunks
        this.scene.physics.add.collider(this.scene.playerController.player, this.scene.world.giantTrees);
        this.scene.physics.add.collider(this.scene.enemies.zombies, this.scene.world.giantTrees);

        // Player & Zombies collide with solid rocks
        this.scene.physics.add.collider(this.scene.playerController.player, this.scene.world.rocks);
        this.scene.physics.add.collider(this.scene.enemies.zombies, this.scene.world.rocks);

        // Player & Zombies collide with solid bushes
        this.scene.physics.add.collider(this.scene.playerController.player, this.scene.world.bushes);
        this.scene.physics.add.collider(this.scene.enemies.zombies, this.scene.world.bushes);

        // Player & Zombies collide with Castle walls, bars and doors
        if (this.scene.castle?.solidObstacles) {
            this.scene.physics.add.collider(this.scene.playerController.player, this.scene.castle.solidObstacles);
            this.scene.physics.add.collider(this.scene.enemies.zombies, this.scene.castle.solidObstacles);
        }

        // Bullets stop upon hitting solid tree trunks
        this.scene.physics.add.collider(this.scene.weapons.bullets, this.scene.world.trees, (bulletObj, obstacleObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            if (bullet.active) {
                this.scene.audio?.impact(obstacleObj as Phaser.Physics.Arcade.Sprite, bullet);
                this.scene.weapons.retireProjectile(bullet);
            }
        });

        // Bullets stop upon hitting solid giant tree trunks
        this.scene.physics.add.collider(this.scene.weapons.bullets, this.scene.world.giantTrees, (bulletObj, obstacleObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            if (bullet.active) {
                this.scene.audio?.impact(obstacleObj as Phaser.Physics.Arcade.Sprite, bullet);
                this.scene.weapons.retireProjectile(bullet);
            }
        });

        // Bullets stop upon hitting solid rocks
        this.scene.physics.add.collider(this.scene.weapons.bullets, this.scene.world.rocks, (bulletObj, obstacleObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            if (bullet.active) {
                this.scene.audio?.impact(obstacleObj as Phaser.Physics.Arcade.Sprite, bullet);
                this.scene.weapons.retireProjectile(bullet);
            }
        });

        // Bullets stop upon hitting solid bushes
        this.scene.physics.add.collider(this.scene.weapons.bullets, this.scene.world.bushes, (bulletObj, obstacleObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            if (bullet.active) {
                this.scene.audio?.impact(obstacleObj as Phaser.Physics.Arcade.Sprite, bullet);
                this.scene.weapons.retireProjectile(bullet);
            }
        });

        // Bullets stop upon hitting Castle walls, bars and doors
        if (this.scene.castle?.solidObstacles) {
            this.scene.physics.add.collider(this.scene.weapons.bullets, this.scene.castle.solidObstacles, (bulletObj, obstacleObj) => {
                const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                if (bullet.active) {
                    this.scene.audio?.impact(obstacleObj as Phaser.Physics.Arcade.Sprite, bullet);
                    this.scene.weapons.retireProjectile(bullet);
                }
            });
        }

        // Bullets hit zombies
        this.scene.physics.add.overlap(
            this.scene.weapons.bullets,
            this.scene.enemies.zombies,
            this.scene.enemies.bulletHitZombie as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this.scene
        );

        // Dragon Fireballs physics group
        this.scene.boss.dragonFireballs = this.scene.physics.add.group();

        // Dragon Fireballs hit Player
        this.scene.physics.add.overlap(
            this.scene.playerController.player,
            this.scene.boss.dragonFireballs,
            (_playerObj, fireballObj) => {
                const fb = fireballObj as Phaser.Physics.Arcade.Sprite;
                if (fb.active) {
                    this.scene.audio?.play('dragon-fireball-impact', fb);
                    this.scene.boss.dragonFireballs.killAndHide(fb);
                    (fb.body as Phaser.Physics.Arcade.Body)?.setEnable(false);
                    this.scene.playerController.damagePlayer(1, 'dragon');
                }
            },
            undefined,
            this.scene
        );

        // Dragon Fireballs stopped by environment
        this.scene.physics.add.collider(this.scene.boss.dragonFireballs, this.scene.world.trees, (fb) => {
            if ((fb as Phaser.GameObjects.GameObject).active) {
                this.scene.audio?.play('dragon-fireball-impact', fb as Phaser.Physics.Arcade.Sprite);
                this.scene.boss.dragonFireballs.killAndHide(fb as Phaser.Physics.Arcade.Sprite);
                ((fb as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body)?.setEnable(false);
            }
        });
        this.scene.physics.add.collider(this.scene.boss.dragonFireballs, this.scene.world.giantTrees, (fb) => {
            if ((fb as Phaser.GameObjects.GameObject).active) {
                this.scene.audio?.play('dragon-fireball-impact', fb as Phaser.Physics.Arcade.Sprite);
                this.scene.boss.dragonFireballs.killAndHide(fb as Phaser.Physics.Arcade.Sprite);
                ((fb as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body)?.setEnable(false);
            }
        });
        this.scene.physics.add.collider(this.scene.boss.dragonFireballs, this.scene.world.rocks, (fb) => {
            if ((fb as Phaser.GameObjects.GameObject).active) {
                this.scene.audio?.play('dragon-fireball-impact', fb as Phaser.Physics.Arcade.Sprite);
                this.scene.boss.dragonFireballs.killAndHide(fb as Phaser.Physics.Arcade.Sprite);
                ((fb as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body)?.setEnable(false);
            }
        });

        // Vendor collisions
        if (this.scene.shop.vendor) {
            this.scene.physics.add.collider(this.scene.playerController.player, this.scene.shop.vendor);
            this.scene.physics.add.collider(this.scene.enemies.zombies, this.scene.shop.vendor);
            this.scene.physics.add.collider(this.scene.shop.vendor, this.scene.weapons.bullets, (_vendorObj, bulletObj) => {
                const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                if (bullet.active) {
                    this.scene.weapons.retireProjectile(bullet);
                }
            });
        }
    };
}
