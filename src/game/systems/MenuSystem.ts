import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

export class MenuSystem {
    constructor(private readonly scene: GameScene) {}

    isMenuOpen: boolean = false;

    menuContainer: Phaser.GameObjects.Container;

    menuAutoSpawnBtn: Phaser.GameObjects.Sprite;

    menuAutoSpawnText: Phaser.GameObjects.Text;

    menuHeroBtnText: Phaser.GameObjects.Text;

    menuHeroIcon: Phaser.GameObjects.Sprite;

    createMenu = () => {
        this.menuContainer = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this.menuContainer.setDepth(30000);
        this.menuContainer.setVisible(false);

        // Fullscreen dark backdrop to dim game
        const backdrop = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);

        // Slate modal window with ornate bronze trim
        const panel = this.scene.add.rectangle(0, 0, 560, 460, 0x161822, 0.98);
        panel.setStrokeStyle(3, 0xb88832);

        // Header Banner plaque
        const headerBanner = this.scene.add.image(0, -195, 'menu', 'banner-header');
        headerBanner.setScale(2.5, 1.25);

        const headerTitle = this.scene.add.text(0, -195, 'MISSION INTEL & MENU', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffe599',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // --- SECTION 1: AUTO-SPAWN ROW ---
        const spawnerBox = this.scene.add.rectangle(0, -125, 500, 54, 0x202432, 0.9);
        spawnerBox.setStrokeStyle(1, 0x48526a);

        const spawnerIcon = this.scene.add.sprite(-215, -125, 'hud', 'icon-spawner').setScale(1.1);

        const spawnerTitle = this.scene.add.text(-185, -137, 'ALTAR AUTO-SPAWN (5s)', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });

        this.menuAutoSpawnText = this.scene.add.text(-185, -118, 'Status: ACTIVE (Spawning zombies every 5s)', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#77eebb'
        });

        this.menuAutoSpawnBtn = this.scene.add.sprite(180, -125, 'menu', this.scene.altars.isAutoSpawnEnabled ? 'toggle-on' : 'toggle-off').setScale(1.1, 0.95);
        this.menuAutoSpawnBtn.setScrollFactor(0);
        this.menuAutoSpawnBtn.setInteractive({ useHandCursor: true });
        this.menuAutoSpawnBtn.on('pointerdown', () => this.scene.altars.toggleAutoSpawn());
        this.menuAutoSpawnBtn.on('pointerover', () => this.menuAutoSpawnBtn.setScale(1.15, 1));
        this.menuAutoSpawnBtn.on('pointerout', () => this.menuAutoSpawnBtn.setScale(1.1, 0.95));

        const toggleBtnLabel = this.scene.add.text(170, -125, 'TOGGLE [P]', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        toggleBtnLabel.setScrollFactor(0);
        toggleBtnLabel.setInteractive({ useHandCursor: true });
        toggleBtnLabel.on('pointerdown', () => this.scene.altars.toggleAutoSpawn());

        // --- SECTION 2: HERO SWITCH ROW ---
        const heroBox = this.scene.add.rectangle(0, -60, 500, 54, 0x202432, 0.9);
        heroBox.setStrokeStyle(1, 0x48526a);

        this.menuHeroIcon = this.scene.add.sprite(-215, -60, 'hud', 'face-survivor').setScale(1.1);

        const heroSwitchBtn = this.scene.add.sprite(60, -60, 'menu', 'btn-normal').setScale(2.4, 1.1);
        heroSwitchBtn.setScrollFactor(0);
        heroSwitchBtn.setInteractive({ useHandCursor: true });
        heroSwitchBtn.on('pointerdown', () => this.scene.playerController.switchCharacter());
        heroSwitchBtn.on('pointerover', () => heroSwitchBtn.setFrame('btn-hover'));
        heroSwitchBtn.on('pointerout', () => heroSwitchBtn.setFrame('btn-normal'));

        this.menuHeroBtnText = this.scene.add.text(60, -60, 'SWITCH HERO [G]: Survivor', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.menuHeroBtnText.setScrollFactor(0);
        this.menuHeroBtnText.setInteractive({ useHandCursor: true });
        this.menuHeroBtnText.on('pointerdown', () => this.scene.playerController.switchCharacter());

        // --- SECTION 3: CONTROLS CHEAT SHEET ---
        const controlsBox = this.scene.add.rectangle(0, 45, 500, 115, 0x12141c, 0.95);
        controlsBox.setStrokeStyle(1, 0x363e52);

        const controlsHeader = this.scene.add.text(0, 0, 'FIELD CONTROLS REFERENCE', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffc844',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        const controlsContent = this.scene.add.text(-220, 16,
            '• [W][A][S][D] / Arrows  : Move Survivor Across Clearing\n' +
            '• [Left Click] / [Space] : Aim & Shoot High-Speed Bullets\n' +
            '• [R]                    : Tactical Reload (7-Bullet Magazine)\n' +
            '• [E] (at Altars/Vendor) : Summon Monsters or Open Shop\n' +
            '• [Q] or [1] / [2]       : Swap Weapon (Rifle / Shotgun)\n' +
            '• [G]                    : Instant Hero Swap (Survivor/Scholar)', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#cbd5e1',
            lineSpacing: 3
        });

        // --- SECTION 4: RESUME & RESTART ACTION BUTTONS ---
        const resumeBtn = this.scene.add.sprite(-110, 175, 'menu', 'btn-normal').setScale(1.8, 1.15);
        resumeBtn.setScrollFactor(0);
        resumeBtn.setInteractive({ useHandCursor: true });
        resumeBtn.on('pointerdown', () => this.toggleMenu());
        resumeBtn.on('pointerover', () => resumeBtn.setFrame('btn-hover'));
        resumeBtn.on('pointerout', () => resumeBtn.setFrame('btn-normal'));

        const resumeLabel = this.scene.add.text(-110, 175, 'RESUME [ESC]', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        resumeLabel.setScrollFactor(0);
        resumeLabel.setInteractive({ useHandCursor: true });
        resumeLabel.on('pointerdown', () => this.toggleMenu());

        const restartBtn = this.scene.add.sprite(110, 175, 'menu', 'btn-normal').setScale(1.8, 1.15);
        restartBtn.setScrollFactor(0);
        restartBtn.setInteractive({ useHandCursor: true });
        restartBtn.on('pointerdown', () => {
            this.toggleMenu();
            this.scene.scene.restart();
        });
        restartBtn.on('pointerover', () => restartBtn.setFrame('btn-hover'));
        restartBtn.on('pointerout', () => restartBtn.setFrame('btn-normal'));

        const restartLabel = this.scene.add.text(110, 175, 'RESTART [R]', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ff8888',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        restartLabel.setScrollFactor(0);
        restartLabel.setInteractive({ useHandCursor: true });
        restartLabel.on('pointerdown', () => {
            this.toggleMenu();
            this.scene.scene.restart();
        });

        this.menuContainer.add([
            backdrop, panel, headerBanner, headerTitle,
            spawnerBox, spawnerIcon, spawnerTitle, this.menuAutoSpawnText, this.menuAutoSpawnBtn, toggleBtnLabel,
            heroBox, this.menuHeroIcon, heroSwitchBtn, this.menuHeroBtnText,
            controlsBox, controlsHeader, controlsContent,
            resumeBtn, resumeLabel, restartBtn, restartLabel
        ]);

        // Ensure all container children adopt scrollFactor=0 for pixel-perfect hit-testing
        this.menuContainer.setScrollFactor(0, 0, true);
    };

    updateMenuElements = () => {
        if (!this.menuContainer) return;

        // Auto-spawn toggle
        if (this.menuAutoSpawnBtn) {
            this.menuAutoSpawnBtn.setFrame(this.scene.altars.isAutoSpawnEnabled ? 'toggle-on' : 'toggle-off');
        }
        if (this.menuAutoSpawnText) {
            this.menuAutoSpawnText.setText(
                this.scene.altars.isAutoSpawnEnabled
                    ? 'Status: ACTIVE (Spawning zombies every 5s)'
                    : 'Status: PAUSED (Manual summoning only via [E])'
            );
            this.menuAutoSpawnText.setColor(this.scene.altars.isAutoSpawnEnabled ? '#77eebb' : '#ffaa55');
        }

        // Hero selection
        const isPlayer = this.scene.playerController.currentCharacter === 'player';
        if (this.menuHeroIcon) {
            this.menuHeroIcon.setFrame(isPlayer ? 'face-survivor' : 'face-scholar');
        }
        if (this.menuHeroBtnText) {
            this.menuHeroBtnText.setText(`SWITCH HERO [G]: ${isPlayer ? 'Survivor' : 'Scholar'}`);
        }
    };

    toggleMenu = () => {
        if ((this.scene.inventory?.isOpen || this.scene.network?.blocked)) return;
        if (this.scene.playerController.isPlayerDead) return;

        this.scene.audio?.play('ui-menu-toggle');
        this.isMenuOpen = !this.isMenuOpen;
        this.menuContainer.setVisible(this.isMenuOpen);

        if (this.isMenuOpen) {
            if (!this.scene.network?.isConnected) this.scene.physics.pause();
            this.updateMenuElements();
        } else {
            this.scene.physics.resume();
        }
    };

    reset() {
        this.isMenuOpen = false;
    }
}
