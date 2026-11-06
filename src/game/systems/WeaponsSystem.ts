import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { facingFromVector, playerPose } from '../player-facing';
import { FIRE_RATE, SHOTGUN_FIRE_RATE, TOTAL_WORLD_WIDTH, TOTAL_WORLD_HEIGHT, BULLET_SPEED, RIFLE_MAX_AMMO, SHOTGUN_MAX_AMMO, SHOTGUN_PELLETS, SHOTGUN_SPREAD_DEG } from '../constants';

export class WeaponsSystem {
    constructor(private readonly scene: GameScene) {}

    bullets: Phaser.Physics.Arcade.Group;

    hasShotgun: boolean = false;

    activeWeapon: 'rifle' | 'shotgun' = 'rifle';

    rifleAmmo: number = 7;

    shotgunAmmo: number = 4;

    currentAmmo: number = 7;

    maxAmmo: number = 7;

    isReloading: boolean = false;

    reloadDuration: number = 1000;

    reloadTimer: Phaser.Time.TimerEvent | null = null;

    reloadTween: Phaser.Tweens.Tween | null = null;

    fireDelay: number = 0;

    /** Restore all presentation/physics state when a pooled object changes weapon type. */
    prepareProjectile = (projectile: Phaser.Physics.Arcade.Sprite, texture: string, frame: string | number) => {
        projectile.anims.stop();
        projectile.setTexture(texture, frame).clearTint().setAlpha(1).setFlip(false, false);
        projectile.setActive(true).setVisible(true);
        projectile.setDepth(1500);
        (projectile.body as Phaser.Physics.Arcade.Body)?.setEnable(true);
        const generation = (projectile.getData('projectileGeneration') ?? 0) + 1;
        projectile.setData('projectileGeneration', generation);
        return generation;
    };

    retireProjectile = (projectile: Phaser.Physics.Arcade.Sprite) => {
        if (!this.bullets.contains(projectile)) return;
        projectile.anims.stop();
        projectile.setVelocity(0, 0);
        (projectile.body as Phaser.Physics.Arcade.Body)?.setEnable(false);
        this.bullets.killAndHide(projectile);
    };

    createBullets = () => {
        this.bullets = this.scene.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            maxSize: 80,
            runChildUpdate: true
        });
    };

    toggleWeapon = () => {
        if (!this.hasShotgun) {
            this.scene.hud.flashProximityAlert('Visit the Arms Dealer in the South-West to buy a Shotgun!', '#f59e0b');
            return;
        }
        this.setWeapon(this.activeWeapon === 'rifle' ? 'shotgun' : 'rifle');
    };

    setWeapon = (weapon: 'rifle' | 'shotgun') => {
        if (weapon === 'shotgun' && !this.hasShotgun) {
            this.scene.hud.flashProximityAlert('Visit the Arms Dealer in the South-West to buy a Shotgun!', '#f59e0b');
            return;
        }
        if (this.isReloading) {
            if (this.reloadTimer) this.reloadTimer.remove();
            if (this.reloadTween) this.reloadTween.stop();
            this.isReloading = false;
        }

        // Save current ammo in current weapon
        if (this.activeWeapon === 'shotgun') {
            this.shotgunAmmo = this.currentAmmo;
        } else {
            this.rifleAmmo = this.currentAmmo;
        }

        this.activeWeapon = weapon;
        if (weapon === 'shotgun') {
            this.maxAmmo = SHOTGUN_MAX_AMMO;
            this.currentAmmo = this.shotgunAmmo;
            this.scene.hud.flashProximityAlert('Equipped: Heavy Trench Shotgun [2]', '#ffdd44');
        } else {
            this.maxAmmo = RIFLE_MAX_AMMO;
            this.currentAmmo = this.rifleAmmo;
            this.scene.hud.flashProximityAlert('Equipped: Tactical Carbine Rifle [1]', '#aaddff');
        }
        this.scene.hud.updateHUD();

        // Immediately update player animation to match current weapon
        if (!this.scene.playerController.isPlayerDead && !this.isReloading) {
            const vx = this.scene.playerController.player.body?.velocity.x ?? 0;
            const vy = this.scene.playerController.player.body?.velocity.y ?? 0;
            const isMoving = vx !== 0 || vy !== 0;
            this.scene.playerController.player.play(this.scene.playerController.playerAnimationKey(isMoving ? 'walk' : 'idle'), true);
        }
    };

    startReload = () => {
        const curMaxAmmo = this.activeWeapon === 'shotgun' ? SHOTGUN_MAX_AMMO : RIFLE_MAX_AMMO;
        const curAmmo = this.activeWeapon === 'shotgun' ? this.shotgunAmmo : this.rifleAmmo;
        if (this.isReloading || this.scene.playerController.isPlayerDead || curAmmo >= curMaxAmmo) return;

        this.scene.network?.requestAction('reload', undefined, this.activeWeapon);
        this.scene.audio?.play(this.activeWeapon === 'shotgun' ? 'shotgun-reload' : 'rifle-reload');
        this.isReloading = true;
        this.scene.hud.updateHUD();

        // Play character reload animation
        if (!this.scene.playerController.isPlayerHurt) {
            const vx = this.scene.playerController.player.body?.velocity.x ?? 0;
            const vy = this.scene.playerController.player.body?.velocity.y ?? 0;
            const isMoving = vx !== 0 || vy !== 0;
            this.scene.playerController.player.play(
                this.scene.playerController.playerAnimationKey(isMoving ? 'reload-walk' : 'reload'),
                true
            );
        }

        // Spin reload icon on HUD
        if (this.reloadTween) this.reloadTween.stop();
        if (this.scene.hud.ammoIcon) {
            this.scene.hud.ammoIcon.setAngle(0);
            this.reloadTween = this.scene.tweens.add({
                targets: this.scene.hud.ammoIcon,
                angle: 360,
                duration: 500,
                repeat: 1,
                ease: 'Linear'
            });
        }

        // Floating reload prompt over player
        const reloadToast = this.scene.add.text(this.scene.playerController.player.x, this.scene.playerController.player.y - 45, 'RELOADING...', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffbb44',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: '#000000aa',
            padding: { x: 6, y: 2 }
        }).setOrigin(0.5).setDepth(2000);

        this.scene.tweens.add({
            targets: reloadToast,
            y: this.scene.playerController.player.y - 65,
            alpha: 0,
            duration: 800,
            onComplete: () => reloadToast.destroy()
        });

        if (this.reloadTimer) this.reloadTimer.destroy();
        this.reloadTimer = this.scene.time.delayedCall(this.reloadDuration, () => {
            if (!this.scene.playerController.isPlayerDead) {
                if (this.activeWeapon === 'shotgun') {
                    this.shotgunAmmo = SHOTGUN_MAX_AMMO;
                    this.currentAmmo = this.shotgunAmmo;
                } else {
                    this.rifleAmmo = RIFLE_MAX_AMMO;
                    this.currentAmmo = this.rifleAmmo;
                }
                this.isReloading = false;
                if (this.scene.hud.ammoIcon) this.scene.hud.ammoIcon.setAngle(0);
                this.scene.hud.updateHUD();
                if (!this.scene.playerController.isPlayerHurt) {
                    const vx = this.scene.playerController.player.body?.velocity.x ?? 0;
                    const vy = this.scene.playerController.player.body?.velocity.y ?? 0;
                    if (vx !== 0 || vy !== 0) {
                        this.scene.playerController.player.play(this.scene.playerController.playerAnimationKey('walk'), true);
                    } else {
                        this.scene.playerController.player.play(this.scene.playerController.playerAnimationKey('idle'), true);
                    }
                }
            }
        });
    };

    /** Shared by projectile emission and the laser; reading aim must not turn the player. */
    shotTrajectory = (targetX: number, targetY: number) => {
        const controller = this.scene.playerController;
        const facing = facingFromVector(targetX - controller.player.x,
            targetY - (controller.player.y - 33), controller.playerFacing);
        const muzzle = playerPose(facing).muzzle;
        const x = controller.player.x + muzzle.x, y = controller.player.y + muzzle.y;
        const angle = Math.atan2(targetY - y, targetX - x);
        return { x, y, angle, dx: Math.cos(angle), dy: Math.sin(angle),
            range: BULLET_SPEED * (this.activeWeapon === 'shotgun' ? 0.55 : 1.6) };
    };

    fireBulletAt = (targetX: number, targetY: number) => {
        if (this.scene.playerController.isPlayerDead) return;

        // Ammo & Reload management
        if (this.isReloading) return;

        const curAmmo = this.activeWeapon === 'shotgun' ? this.shotgunAmmo : this.rifleAmmo;
        if (curAmmo <= 0) {
            this.scene.audio?.play('rifle-empty');
            this.startReload();
            return;
        }

        if (this.activeWeapon === 'shotgun') {
            this.shotgunAmmo--;
            this.currentAmmo = this.shotgunAmmo;
        } else {
            this.rifleAmmo--;
            this.currentAmmo = this.rifleAmmo;
        }
        this.scene.hud.updateHUD();

        this.scene.playerController.facePlayer(targetX - this.scene.playerController.player.x, targetY - (this.scene.playerController.player.y - 33));
        const { x: muzzleX, y: muzzleY, angle: baseAngle } = this.shotTrajectory(targetX, targetY);

        this.emitProjectiles(this.activeWeapon, muzzleX, muzzleY, baseAngle, 'local');
        this.scene.network?.shot(this.activeWeapon, this.scene.playerController.player.x, this.scene.playerController.player.y, targetX, targetY);

        if (!this.scene.playerController.isPlayerHurt) {
            this.scene.playerController.player.play(this.scene.playerController.playerAnimationKey('shoot'), true);
        }

        // Trigger automatic tactical reload when magazine reaches 0
        const remaining = this.activeWeapon === 'shotgun' ? this.shotgunAmmo : this.rifleAmmo;
        if (remaining === 0) {
            this.scene.time.delayedCall(160, () => {
                if (!this.scene.playerController.isPlayerDead && !this.isReloading) {
                    const checkRemaining = this.activeWeapon === 'shotgun' ? this.shotgunAmmo : this.rifleAmmo;
                    if (checkRemaining === 0) {
                        this.startReload();
                    }
                }
            });
        }
    };

    fireReplicated = (weapon: 'rifle' | 'shotgun', x: number, y: number, targetX: number, targetY: number, owner: 'remote') => {
        const facing = facingFromVector(targetX-x, targetY-(y-33), 'e');
        const muzzle = playerPose(facing).muzzle;
        const muzzleX=x+muzzle.x,muzzleY=y+muzzle.y;
        this.emitProjectiles(weapon,muzzleX,muzzleY,Math.atan2(targetY-muzzleY,targetX-muzzleX),owner);
    };
    private emitProjectiles = (weapon: 'rifle' | 'shotgun', muzzleX: number, muzzleY: number, baseAngle: number, owner: 'local' | 'remote') => {
        const origin = { x: muzzleX, y: muzzleY };
        this.scene.audio?.play(weapon === 'shotgun' ? 'shotgun-fire' : 'rifle-fire', origin);
        this.scene.audio?.play('bullet-whiz', origin, .2);
        if (weapon === 'shotgun') this.scene.time.delayedCall(180, () => {
            if (!this.scene.playerController.isPlayerDead) this.scene.audio?.play('shotgun-pump', origin, .4);
        });
        if (weapon === 'shotgun') {
            // Shotgun blast: 5 buckshot pellets spread across 28 degrees with screen rumble
            this.scene.cameras.main.shake(120, 0.007);
            const spreadRad = Phaser.Math.DegToRad(SHOTGUN_SPREAD_DEG);
            const halfSpread = spreadRad / 2;
            const step = spreadRad / (SHOTGUN_PELLETS - 1);

            for (let i = 0; i < SHOTGUN_PELLETS; i++) {
                const pelletAngle = baseAngle - halfSpread + step * i + Phaser.Math.FloatBetween(-0.03, 0.03);
                const pellet = this.bullets.get(muzzleX, muzzleY, 'weapons', 'shotgun-pellet') as Phaser.Physics.Arcade.Sprite;
                if (!pellet) continue;

                const generation = this.prepareProjectile(pellet, 'weapons', 'shotgun-pellet');
                pellet.setData('owner', owner);
                pellet.setData('ownerGeneration', this.scene.network?.resources?.generation);
                pellet.setScale(1.5);
                pellet.setRotation(pelletAngle);

                const speed = BULLET_SPEED * Phaser.Math.FloatBetween(0.85, 1.15);
                pellet.setVelocity(Math.cos(pelletAngle) * speed, Math.sin(pelletAngle) * speed);
                pellet.body?.setSize(8, 8);

                this.scene.time.delayedCall(550, () => {
                    if (pellet.active && pellet.getData('projectileGeneration') === generation) this.retireProjectile(pellet);
                });
            }
        } else {
            // Standard Tactical Rifle: accurate high-velocity bullet
            const bullet = this.bullets.get(muzzleX, muzzleY, 'bullet', 0) as Phaser.Physics.Arcade.Sprite;
            if (bullet) {
                const generation = this.prepareProjectile(bullet, 'bullet', 0);
                bullet.setData('owner', owner);
                bullet.setData('ownerGeneration', this.scene.network?.resources?.generation);
                bullet.play('bullet-fly');
                bullet.setScale(3);
                bullet.setRotation(baseAngle);

                const vx = Math.cos(baseAngle) * BULLET_SPEED;
                const vy = Math.sin(baseAngle) * BULLET_SPEED;
                bullet.setVelocity(vx, vy);
                bullet.body?.setSize(8, 3);

                this.scene.time.delayedCall(1600, () => {
                    if (bullet.active && bullet.getData('projectileGeneration') === generation) this.retireProjectile(bullet);
                });
            }
        }

    };

    /** Mouse events and held inputs share one cooldown, including within a frame. */
    requestFireAt = (targetX: number, targetY: number, time = this.scene.time.now) => {
        if (this.scene.playerController.isPlayerDead || this.isReloading ||
            this.scene.menu.isMenuOpen || this.scene.shop.isShopOpen || this.scene.chat.isChatOpen || (this.scene.inventory?.isOpen || this.scene.network?.blocked) ||
            time < this.fireDelay) return;

        const currentFireRate = this.activeWeapon === 'shotgun' ? SHOTGUN_FIRE_RATE : FIRE_RATE;
        this.fireDelay = time + currentFireRate;
        this.fireBulletAt(targetX, targetY);
    };

    updateFiring = (time: number) => {
        const pointer = this.scene.input.mousePointer ?? this.scene.input.activePointer;
        // Only the left mouse button participates in continuous fire.
        const mouseFiring = !pointer.wasTouch && !this.scene.mobileControls?.ownsPointer(pointer) && pointer.leftButtonDown();
        if (mouseFiring || this.scene.controls.cursors.space.isDown || this.scene.mobileControls?.firing) {
            const aim = this.scene.controls.aimPointer(pointer);
            this.requestFireAt(aim.worldX, aim.worldY, time);
        }

    };

    cleanupBullets = () => {
        //  Clean up off-screen bullets across the expanded map
        this.bullets.getChildren().forEach((obj: Phaser.GameObjects.GameObject) => {
            const bullet = obj as Phaser.Physics.Arcade.Sprite;
            if (bullet.active && (bullet.x < -50 || bullet.x > TOTAL_WORLD_WIDTH + 50 || bullet.y < -50 || bullet.y > TOTAL_WORLD_HEIGHT + 50)) {
                this.retireProjectile(bullet);
            }
        });
    };

    reset() {
        this.fireDelay = 0;
        this.isReloading = false;
        this.reloadTimer = null;
        this.reloadTween = null;
        this.hasShotgun = false;
        this.activeWeapon = 'rifle';
        this.rifleAmmo = RIFLE_MAX_AMMO;
        this.shotgunAmmo = SHOTGUN_MAX_AMMO;
        this.currentAmmo = RIFLE_MAX_AMMO;
        this.maxAmmo = RIFLE_MAX_AMMO;
    }
}
