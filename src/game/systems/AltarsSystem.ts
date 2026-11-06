import { interactionPressed, INTERACTION_RANGE } from '../interaction';
import { WEREWOLF_VARIANTS } from './enemy-variants';
import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { DROWNER_ALTAR_X, DROWNER_ALTAR_Y, GAME_WIDTH, WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y, ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y } from '../constants';

export class AltarsSystem {
    constructor(private readonly scene: GameScene) {}

    altar: Phaser.Physics.Arcade.Sprite;

    zombiePromptSprite: Phaser.GameObjects.Sprite;

    isPlayerNearAltar: boolean = false;

    isAltarSummoning: boolean = false;

    wolfAltar: Phaser.Physics.Arcade.Sprite;

    wolfPromptSprite: Phaser.GameObjects.Sprite;

    isPlayerNearWolfAltar: boolean = false;

    isWolfAltarSummoning: boolean = false;

    drownerAltar: Phaser.Physics.Arcade.Sprite;

    drownerPromptSprite: Phaser.GameObjects.Sprite;

    isPlayerNearDrownerAltar: boolean = false;

    isDrownerAltarSummoning: boolean = false;

    autoSpawnCounter: number = 0;

    lastZombieProximitySpawnTime: number = 0;

    lastWolfProximitySpawnTime: number = 0;

    lastDrownerProximitySpawnTime: number = 0;

    isAutoSpawnEnabled: boolean = false;

    autoSpawnTimer: Phaser.Time.TimerEvent;

    autoSpawnInterval: number = 5000;

    createAltar = () => {
        // 1. Position North-West corner altar (Necromantic Stone) at (ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y)
        this.altar = this.scene.physics.add.sprite(ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y, 'altar', 'frame-0');
        this.altar.setScale(2);
        this.altar.setOrigin(0.5, 1);
        this.altar.setImmovable(true);
        this.altar.body?.setSize(24, 18);
        this.altar.play('altar-idle');

        // Floating personalized HUD prompt badge over the zombie altar (spawning message icon)
        this.zombiePromptSprite = this.scene.add.sprite(ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y - 96, 'hud', 'prompt-altar-zombie');
        this.zombiePromptSprite.setScale(1.5);
        this.zombiePromptSprite.setOrigin(0.5, 0.5);
        this.zombiePromptSprite.setVisible(false);
        this.zombiePromptSprite.setDepth(2000);

        // 2. Position South-East corner altar (Blood Moon Wolf Totem) at (WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y)
        this.wolfAltar = this.scene.physics.add.sprite(WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y, 'altar-wolf', 'frame-0');
        this.wolfAltar.setScale(2);
        this.wolfAltar.setOrigin(0.5, 1);
        this.wolfAltar.setImmovable(true);
        this.wolfAltar.body?.setSize(24, 18);
        this.wolfAltar.play('altar-wolf-idle');

        // Floating personalized HUD prompt badge over the werewolf altar (spawning message icon)
        this.wolfPromptSprite = this.scene.add.sprite(WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y - 96, 'hud', 'prompt-altar-wolf');
        this.wolfPromptSprite.setScale(1.5);
        this.wolfPromptSprite.setOrigin(0.5, 0.5);
        this.wolfPromptSprite.setVisible(false);
        this.wolfPromptSprite.setDepth(2000);

        // 3. Position Castle Prison Drowner Cistern Altar at (DROWNER_ALTAR_X, DROWNER_ALTAR_Y)
        this.drownerAltar = this.scene.physics.add.sprite(DROWNER_ALTAR_X, DROWNER_ALTAR_Y, 'altar-drowner', 'idle-0');
        this.drownerAltar.setScale(1.5);
        this.drownerAltar.setOrigin(0.5, 1);
        this.drownerAltar.setImmovable(true);
        this.drownerAltar.setDepth(DROWNER_ALTAR_Y);
        this.drownerAltar.body?.setSize(36, 24).setOffset(6, 22);
        this.drownerAltar.play('altar-drowner-idle');

        // Floating personalized HUD prompt badge over the drowner cistern (spawning message icon)
        this.drownerPromptSprite = this.scene.add.sprite(DROWNER_ALTAR_X, DROWNER_ALTAR_Y - 96, 'hud', 'prompt-altar-drowner');
        this.drownerPromptSprite.setScale(1.5);
        this.drownerPromptSprite.setOrigin(0.5, 0.5);
        this.drownerPromptSprite.setVisible(false);
        this.drownerPromptSprite.setDepth(2000);

        // Floating hover animation for all altar HUD prompt badges
        this.scene.tweens.add({
            targets: [this.zombiePromptSprite, this.wolfPromptSprite, this.drownerPromptSprite],
            y: '-=6',
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    };

    setupAutoSpawner = () => {
        this.autoSpawnTimer = this.scene.time.addEvent({
            delay: this.autoSpawnInterval,
            callback: this.handleAutoSpawnTick,
            callbackScope: this.scene,
            loop: true
        });
        // Paused by default as requested: proximity spawning is the primary mechanism now
        this.autoSpawnTimer.paused = !this.isAutoSpawnEnabled;
    };

    handleAutoSpawnTick = () => {
        if(this.scene.network?.isGuest || this.scene.network?.blocked)return;
        if ((this.scene.playerController.isPlayerDead && !this.scene.network?.isConnected) || !this.isAutoSpawnEnabled) return;

        // Cap maximum simultaneously active enemies to keep smooth performance
        const activeZombies = this.scene.enemies.zombies.countActive(true);
        if (activeZombies >= 25) return;

        this.autoSpawnCounter++;

        // When battlefield has few enemies (< 8), awaken both altars!
        if (activeZombies < 8) {
            this.scene.enemies.summonZombieAtAltar();
            this.scene.time.delayedCall(450, () => {
                if (!this.scene.playerController.isPlayerDead && this.isAutoSpawnEnabled) {
                    this.scene.enemies.summonWerewolfAtWolfAltar();
                }
            });
        } else if (this.autoSpawnCounter % 2 === 1) {
            this.scene.enemies.summonZombieAtAltar();
        } else {
            this.scene.enemies.summonWerewolfAtWolfAltar();
        }
    };

    toggleAutoSpawn = () => {
        if(this.scene.network?.isGuest){this.scene.hud.flashProximityAlert('Only the host controls automatic spawning.','#ffd56b');return;}
        this.scene.audio?.play('ui-autospawn-toggle');
        this.isAutoSpawnEnabled = !this.isAutoSpawnEnabled;
        if (this.autoSpawnTimer) {
            this.autoSpawnTimer.paused = !this.isAutoSpawnEnabled;
        }

        // Floating feedback banner on screen
        const statusText = this.isAutoSpawnEnabled ? 'AUTO-SPAWN: ACTIVE (5s)' : 'AUTO-SPAWN: PAUSED';
        const statusColor = this.isAutoSpawnEnabled ? '#55ff55' : '#ffaa55';

        const toast = this.scene.add.text((this.scene.scale?.width ?? GAME_WIDTH) / 2, 75, statusText, {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: statusColor,
            stroke: '#000000',
            strokeThickness: 3,
            backgroundColor: '#000000cc',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(15000);

        this.scene.tweens.add({
            targets: toast,
            y: 52,
            alpha: 0,
            duration: 1200,
            ease: 'Power2',
            onComplete: () => toast.destroy()
        });

        this.scene.hud.updateHUD();
    };

    updateProximity = (time: number) => {
        if(this.scene.network?.isGuest){
            const p=this.scene.playerController.player;
            for(const [altar,badge] of [[this.altar,this.zombiePromptSprite],[this.wolfAltar,this.wolfPromptSprite],[this.drownerAltar,this.drownerPromptSprite]] as const)
                badge.setVisible(Math.hypot(p.x-altar.x,p.y-altar.y)<260);
            return;
        }
        //  Proximity Detection & Territory Spawning Mechanics
        //  When the player gets "too close" (< 260px) to either corner shrine, the altar awakens and spawns monsters!
        const PROXIMITY_DANGER_RADIUS = 260;

        //  1. North-West Zombie Altar (Corner 1)
        const distToAltar = Phaser.Math.Distance.Between(this.scene.playerController.player.x, this.scene.playerController.player.y, this.altar.x, this.altar.y);
        const nearAltar = distToAltar < INTERACTION_RANGE.altar;
        const inZombieDangerZone = distToAltar < PROXIMITY_DANGER_RADIUS;

        if (nearAltar !== this.isPlayerNearAltar) {
            this.isPlayerNearAltar = nearAltar;
        }

        this.zombiePromptSprite.setVisible(inZombieDangerZone || nearAltar);

        // Proximity spawn when entering or lingering in the danger zone
        if (inZombieDangerZone) {
            if (!this.isAltarSummoning) {
                this.altar.play('altar-active', true);
            }

            if (time > this.lastZombieProximitySpawnTime + 3800 && !this.isAltarSummoning) {
                const activeUndead = this.scene.enemies.zombies.getChildren().filter(o => o.active).length;
                if (activeUndead < 18) {
                    this.lastZombieProximitySpawnTime = time;
                    this.scene.enemies.summonZombieAtAltar();
                    this.scene.hud.flashProximityAlert('⚠️ DANGER: Necromantic Territory Invaded!', '#ffcc00');
                }
            }
        }
        else {
            if (!this.isAltarSummoning && this.altar.anims.currentAnim?.key !== 'altar-idle') {
                this.altar.play('altar-idle');
            }
        }

        //  Press [E] at North-West Altar for direct emergency summon
        if (nearAltar && interactionPressed(this.scene, 'zombie')) {
            this.scene.enemies.summonZombieAtAltar();
        }

        //  2. South-East Wolf Altar (Corner 2)
        const distToWolfAltar = Phaser.Math.Distance.Between(this.scene.playerController.player.x, this.scene.playerController.player.y, this.wolfAltar.x, this.wolfAltar.y);
        const nearWolfAltar = distToWolfAltar < INTERACTION_RANGE.altar;
        const inWolfDangerZone = distToWolfAltar < PROXIMITY_DANGER_RADIUS;

        if (nearWolfAltar !== this.isPlayerNearWolfAltar) {
            this.isPlayerNearWolfAltar = nearWolfAltar;
        }

        this.wolfPromptSprite.setVisible(inWolfDangerZone || nearWolfAltar);

        // Proximity spawn when entering or lingering in the wolf danger zone
        if (inWolfDangerZone) {
            if (!this.isWolfAltarSummoning) {
                this.wolfAltar.play('altar-wolf-active', true);
            }

            if (time > this.lastWolfProximitySpawnTime + 4200 && !this.isWolfAltarSummoning) {
                const activeWerewolves = this.scene.enemies.zombies.getChildren().filter(o => o.active && WEREWOLF_VARIANTS.some(v => v.key === o.getData('variant'))).length;
                if (activeWerewolves < 8) {
                    this.lastWolfProximitySpawnTime = time;
                    this.scene.enemies.summonWerewolfAtWolfAltar();
                    this.scene.hud.flashProximityAlert('⚠️ DANGER: Blood Moon Totem Awakened!', '#ff4433');
                }
            }
        }
        else {
            if (!this.isWolfAltarSummoning && this.wolfAltar.anims.currentAnim?.key !== 'altar-wolf-idle') {
                this.wolfAltar.play('altar-wolf-idle');
            }
        }

        //  Press [E] at Wolf Altar for direct emergency summon
        if (nearWolfAltar && interactionPressed(this.scene, 'wolf')) {
            this.scene.enemies.summonWerewolfAtWolfAltar();
        }

        //  3. Castle Prison Drowner Cistern (North Vault)
        const distToDrownerAltar = Phaser.Math.Distance.Between(this.scene.playerController.player.x, this.scene.playerController.player.y, this.drownerAltar.x, this.drownerAltar.y);
        const nearDrownerAltar = distToDrownerAltar < INTERACTION_RANGE.altar;
        const inDrownerDangerZone = distToDrownerAltar < PROXIMITY_DANGER_RADIUS;

        if (nearDrownerAltar !== this.isPlayerNearDrownerAltar) {
            this.isPlayerNearDrownerAltar = nearDrownerAltar;
        }

        this.drownerPromptSprite.setVisible(inDrownerDangerZone || nearDrownerAltar);

        // Proximity spawn when entering or lingering in the drowner danger zone
        if (inDrownerDangerZone) {
            if (!this.isDrownerAltarSummoning) {
                this.drownerAltar.play('altar-drowner-active', true);
            }

            if (time > this.lastDrownerProximitySpawnTime + 4000 && !this.isDrownerAltarSummoning) {
                const activeDrowners = this.scene.enemies.zombies.getChildren().filter(o => o.active && o.getData('variant') === 'drowner').length;
                if (activeDrowners < 10) {
                    this.lastDrownerProximitySpawnTime = time;
                    this.scene.enemies.summonDrownerAtAltar();
                    this.scene.hud.flashProximityAlert('⚠️ DANGER: Sunken Prison Cistern Awakened!', '#33ddcc');
                }
            }
        }
        else {
            if (!this.isDrownerAltarSummoning && this.drownerAltar.anims.currentAnim?.key !== 'altar-drowner-idle') {
                this.drownerAltar.play('altar-drowner-idle');
            }
        }

        //  Press [E] at Drowner Altar for direct emergency summon
        if (nearDrownerAltar && interactionPressed(this.scene, 'drowner')) {
            this.scene.enemies.summonDrownerAtAltar();
        }
    };

    reset() {
        this.isPlayerNearAltar = false;
        this.isAltarSummoning = false;
        this.isPlayerNearWolfAltar = false;
        this.isWolfAltarSummoning = false;
        this.isPlayerNearDrownerAltar = false;
        this.isDrownerAltarSummoning = false;
        this.lastDrownerProximitySpawnTime = 0;
        this.autoSpawnCounter = 0;
    }
}
