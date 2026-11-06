import type { DeathCause } from '../death-causes';
import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { facingFromVector, playerAnimation, playerPose, type PlayerAction, type PlayerFacing } from '../player-facing';
import { FIRST_AID_HEAL_AMOUNT, PLAYER_SPEED, PLAYER_SPAWN_X, PLAYER_SPAWN_Y } from '../constants';

export class PlayerControllerSystem {
    constructor(private readonly scene: GameScene) {}

    player: Phaser.Physics.Arcade.Sprite;

    playerHealth: number = 5;

    maxHealth: number = 5;

    medkits: number = 0;

    isPlayerDead: boolean = false;

    deathCause: DeathCause | null = null;

    isPlayerHurt: boolean = false;

    currentCharacter: 'player' | 'heroine' = 'player';

    playerFacing: PlayerFacing = 'e';

    playerAnimationKey = (action: PlayerAction) => {
        return playerAnimation(this.currentCharacter, action, this.playerFacing, this.scene.weapons.activeWeapon);
    };

    facePlayer = (x: number, y: number) => {
        this.playerFacing = facingFromVector(x, y, this.playerFacing);
        this.player.setFlipX(playerPose(this.playerFacing).flip);
    };

    createPlayer = () => {
        // Player spawns safely in the center of the expanded 1920x1280 meadow
        this.player = this.scene.physics.add.sprite(PLAYER_SPAWN_X, PLAYER_SPAWN_Y, 'player', 'frame-0');
        this.player.setCollideWorldBounds(true);
        this.player.setScale(1);
        this.player.setOrigin(0.5, 1);
        this.player.body?.setSize(20, 20);
        this.player.body?.setOffset(14, 22);
        this.player.play('player-idle');
    };

    switchCharacter = () => {
        if (this.scene.network?.isConnected) return;
        if (this.isPlayerDead) return;

        this.scene.audio?.play('character-switch');
        this.currentCharacter = this.currentCharacter === 'player' ? 'heroine' : 'player';

        // Update texture and ensure centered square collision body
        this.player.setTexture(this.currentCharacter, 'frame-0');
        this.player.body?.setSize(20, 20);
        this.player.body?.setOffset(14, 22);

        // Play appropriate animation for current movement state
        const vx = this.player.body?.velocity.x ?? 0;
        const vy = this.player.body?.velocity.y ?? 0;
        const isMoving = vx !== 0 || vy !== 0;

        if (this.isPlayerHurt) {
            this.player.play(this.playerAnimationKey('hurt'));
        }
        else if (this.scene.weapons.isReloading) {
            this.player.play(this.playerAnimationKey(isMoving ? 'reload-walk' : 'reload'), true);
        }
        else if (isMoving) {
            this.player.play(this.playerAnimationKey('walk'), true);
        }
        else {
            this.player.play(this.playerAnimationKey('idle'), true);
        }

        // Particle/glow switch effect
        this.player.setTint(this.currentCharacter === 'heroine' ? 0x88ffaa : 0x88ccff);
        this.scene.time.delayedCall(160, () => {
            if (!this.isPlayerDead && !this.isPlayerHurt) {
                this.player.clearTint();
            }
        });

        this.scene.hud.updateHUD();
    };

    damagePlayer = (amount: number = 1, cause: DeathCause = 'zombie') => {
        if (this.scene.network?.isGuest || this.scene.network?.blocked) return;
        if (this.scene.inventory?.isOpen) return;
        if (this.isPlayerDead || this.isPlayerHurt) return;

        this.scene.audio?.play(this.currentCharacter === 'heroine' ? 'player-hurt-female' : 'player-hurt-male');
        this.scene.audio?.play('dog-whimper-alert', this.scene.companion?.dog, .35, 1800);
        this.playerHealth -= amount;
        this.scene.hud.updateHUD();
        this.scene.cameras.main.shake(160, 0.015);
        this.player.setTint(0xff4444);

        // Flash/pulse damaged heart
        const hurtHeartIndex = Math.max(0, this.playerHealth);
        const hurtHeart = this.scene.hud.heartSprites[hurtHeartIndex];
        if (hurtHeart) {
            this.scene.tweens.add({
                targets: hurtHeart,
                scale: 1.25,
                duration: 120,
                yoyo: true,
                ease: 'Quad.easeInOut'
            });
        }

        if (this.playerHealth <= 0) {
            this.scene.audio?.play('player-die');
            this.isPlayerDead = true;
            this.deathCause = cause;
            this.scene.weapons.isReloading = false;
            if (this.scene.weapons.reloadTimer) this.scene.weapons.reloadTimer.destroy();
            if (this.scene.weapons.reloadTween) this.scene.weapons.reloadTween.stop();
            if (this.scene.hud.ammoIcon) this.scene.hud.ammoIcon.setAngle(0);
            this.player.setVelocity(0, 0);
            this.player.play(this.playerAnimationKey('die'));
            this.player.once(`animationcomplete-${this.playerAnimationKey('die')}`, () => {
                this.scene.deathScreen.show(cause);
            });
        }
        else {
            this.isPlayerHurt = true;
            this.player.play(this.playerAnimationKey('hurt'));
            this.scene.time.delayedCall(240, () => {
                if (!this.isPlayerDead) {
                    this.player.clearTint();
                    this.isPlayerHurt = false;
                    if (this.scene.weapons.isReloading) {
                        const vx = this.player.body?.velocity.x ?? 0;
                        const vy = this.player.body?.velocity.y ?? 0;
                        const isMoving = vx !== 0 || vy !== 0;
                        this.player.play(this.playerAnimationKey(isMoving ? 'reload-walk' : 'reload'), true);
                    }
                }
            });
        }
    };

    updateMovement = () => {
        //  Player Movement (AWSD & Arrows)
        const left = this.scene.controls.cursors.left.isDown || this.scene.controls.wasd.left.isDown;
        const right = this.scene.controls.cursors.right.isDown || this.scene.controls.wasd.right.isDown;
        const up = this.scene.controls.cursors.up.isDown || this.scene.controls.wasd.up.isDown;
        const down = this.scene.controls.cursors.down.isDown || this.scene.controls.wasd.down.isDown;

        const keyboardMoving = left || right || up || down;
        const stick = this.scene.mobileControls?.movement ?? { x: 0, y: 0 };
        const vx = (keyboardMoving ? (right ? 1 : 0) - (left ? 1 : 0) : stick.x) * PLAYER_SPEED;
        const vy = (keyboardMoving ? (down ? 1 : 0) - (up ? 1 : 0) : stick.y) * PLAYER_SPEED;
        this.player.setVelocity(vx, vy);

        // Movement and aim are independent; normalize strafing speed on diagonals.
        if (keyboardMoving && (vx !== 0 || vy !== 0)) {
            (this.player.body as Phaser.Physics.Arcade.Body).velocity.normalize().scale(PLAYER_SPEED);
        }
        if (!this.isPlayerHurt) {
            const pointer = this.scene.controls.aimPointer();
            this.facePlayer(pointer.worldX - this.player.x, pointer.worldY - (this.player.y - 33));

            // Turn during a shot without restarting its timeline every frame.
            const anims = this.player.anims;
            if (anims.isPlaying && anims.currentAnim?.key.includes('-shoot')) {
                const key = this.playerAnimationKey('shoot');
                if (anims.currentAnim.key !== key) {
                    const progress = anims.getProgress();
                    anims.play(key);
                    anims.setProgress(progress);
                }
            }
        }

        //  Player Animation State
        if (!this.isPlayerHurt) {
            if (this.scene.weapons.isReloading) {
                if (vx !== 0 || vy !== 0) {
                    this.player.anims.play(this.playerAnimationKey('reload-walk'), true);
                }
                else {
                    this.player.anims.play(this.playerAnimationKey('reload'), true);
                }
            }
            else {
                const isFiring = this.player.anims.currentAnim?.key.includes('-shoot') && this.player.anims.isPlaying;
                if (!isFiring) {
                    if (vx !== 0 || vy !== 0) {
                        this.player.anims.play(this.playerAnimationKey('walk'), true);
                    }
                    else {
                        this.player.anims.play(this.playerAnimationKey('idle'), true);
                    }
                }
            }
        }

    };

    useMedkit = () => {
        if (this.scene.network?.isGuest) return this.scene.network.requestAction('heal');
        if (this.scene.inventory?.isOpen) return false;
        if (this.isPlayerDead) return false;
        if (this.medkits <= 0) {
            this.scene.hud.flashProximityAlert('⚠️ No First-Aid Kits! Buy at Vendor [E] for 2 Kills.', '#ff6666');
            return false;
        }
        if (this.playerHealth >= this.maxHealth) {
            this.scene.hud.flashProximityAlert('❤️ Already at Maximum Health!', '#aaffaa');
            return false;
        }

        this.medkits--;
        const healed = Math.min(this.maxHealth - this.playerHealth, FIRST_AID_HEAL_AMOUNT);
        this.playerHealth += healed;

        this.playHealEffect();
        this.scene.hud.updateHUD();
        this.scene.hud.flashProximityAlert(`✨ Healed +${healed} HP! (${this.medkits} First-Aid Kits left)`, '#55ff88');
        return true;
    };

    playHealEffect = () => {
        this.scene.audio?.play('heal-use');
        // Vitality green tint pulse on player
        this.player.setTint(0x66ff88);
        this.scene.time.delayedCall(220, () => {
            if (!this.isPlayerDead && !this.isPlayerHurt) {
                this.player.clearTint();
            }
        });

        // Spawn animated healing effect directly over the player
        const fx = this.scene.add.sprite(this.player.x, this.player.y, 'heal-fx');
        fx.setOrigin(0.5, 1);
        fx.setDepth(this.player.depth + 100);
        fx.play('heal-fx-heal-play');

        // Dynamically track player position during the 510ms animation
        const followTimer = this.scene.time.addEvent({
            delay: 16,
            repeat: 35,
            callback: () => {
                if (fx && fx.active) {
                    fx.setPosition(this.player.x, this.player.y);
                    fx.setDepth(this.player.depth + 100);
                }
            }
        });

        fx.once('animationcomplete', () => {
            followTimer.destroy();
            fx.destroy();
        });
    };

    reset() {
        this.playerHealth = 5;
        this.medkits = 0;
        this.isPlayerDead = false;
        this.deathCause = null;
        this.isPlayerHurt = false;
        this.currentCharacter = 'player';
        this.playerFacing = 'e';
    }
}
