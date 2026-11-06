import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { GAME_WIDTH, RIFLE_MAX_AMMO, SHOTGUN_MAX_AMMO } from '../constants';

export class HudSystem {
    constructor(private readonly scene: GameScene) {}

    proximityNoticeText?: Phaser.GameObjects.Text;

    hudContainer: Phaser.GameObjects.Container;

    heroPortrait: Phaser.GameObjects.Sprite;

    heroNameText: Phaser.GameObjects.Text;

    heartSprites: Phaser.GameObjects.Sprite[] = [];

    skullSprite: Phaser.GameObjects.Sprite;

    defeatedScoreText: Phaser.GameObjects.Text;

    menuBtn: Phaser.GameObjects.Sprite;
    menuLabel: Phaser.GameObjects.Text;

    ammoPlate: Phaser.GameObjects.Rectangle;

    ammoIcon: Phaser.GameObjects.Sprite;

    ammoLabelText: Phaser.GameObjects.Text;

    ammoCountText: Phaser.GameObjects.Text;

    bulletPipSprites: Phaser.GameObjects.Sprite[] = [];

    backpackButton: Phaser.GameObjects.Rectangle;
    backpackIcon: Phaser.GameObjects.Image;

    medkitPlate: Phaser.GameObjects.Rectangle;

    medkitIcon: Phaser.GameObjects.Sprite;

    medkitLabelText: Phaser.GameObjects.Text;

    medkitCountText: Phaser.GameObjects.Text;

    setMedkitBarVisible = (visible: boolean) => {
        for (const item of [this.medkitPlate, this.medkitIcon, this.medkitLabelText, this.medkitCountText]) {
            item.setVisible(visible);
        }
        if (this.medkitIcon.input) this.medkitIcon.input.enabled = visible;
    };

    createHUD = () => {
        this.hudContainer = this.scene.add.container(0, 0);
        this.hudContainer.setScrollFactor(0);
        this.hudContainer.setDepth(10000);

        // 1. Hero, HP & Kills Section (Top Left)
        const heroPlate = this.scene.add.rectangle(148, 36, 268, 50, 0x14141a, 0.88);
        heroPlate.setStrokeStyle(2, 0x5a503c);

        // Hero Portrait (Interactive: Click to switch hero)
        this.heroPortrait = this.scene.add.sprite(38, 36, 'hud', 'face-survivor');
        this.heroPortrait.setScale(1.2);
        this.heroPortrait.setInteractive({ useHandCursor: true });
        this.heroPortrait.on('pointerdown', () => this.scene.playerController.switchCharacter());
        this.heroPortrait.on('pointerover', () => this.heroPortrait.setScale(1.3));
        this.heroPortrait.on('pointerout', () => this.heroPortrait.setScale(1.2));

        // Hero Name Label
        this.heroNameText = this.scene.add.text(66, 18, 'SURVIVOR [G]', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffdd88',
            stroke: '#000000',
            strokeThickness: 3
        });

        // Pixel-art HP Hearts
        this.heartSprites = [];
        for (let i = 0; i < this.scene.playerController.maxHealth; i++) {
            const heart = this.scene.add.sprite(76 + i * 21, 43, 'hud', 'heart-full');
            heart.setScale(0.8);
            this.heartSprites.push(heart);
        }

        // Defeated Kills Section (Within Player HUD, to the right just after the hearts)
        this.skullSprite = this.scene.add.sprite(198, 36, 'hud', 'skull');
        this.skullSprite.setScale(1.05);

        const defeatedLabel = this.scene.add.text(216, 18, 'KILLS', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#a0aab8',
            stroke: '#000000',
            strokeThickness: 2
        });

        this.defeatedScoreText = this.scene.add.text(216, 31, `${this.scene.score}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });

        this.hudContainer.add([
            heroPlate,
            this.heroPortrait,
            this.heroNameText,
            ...this.heartSprites,
            this.skullSprite,
            defeatedLabel,
            this.defeatedScoreText
        ]);

        // 2. Ammo & Reload Section (Below Player HUD)
        this.ammoPlate = this.scene.add.rectangle(148, 88, 268, 44, 0x14141a, 0.88);
        this.ammoPlate.setStrokeStyle(2, 0x5a503c);

        // Ammo / Reload Icon (Interactive: Click to reload)
        this.ammoIcon = this.scene.add.sprite(38, 88, 'hud', 'icon-rifle');
        this.ammoIcon.setScale(1.15);
        this.ammoIcon.setInteractive({ useHandCursor: true });
        this.ammoIcon.on('pointerdown', () => this.scene.weapons.startReload());
        this.ammoIcon.on('pointerover', () => this.ammoIcon.setScale(1.25));
        this.ammoIcon.on('pointerout', () => this.ammoIcon.setScale(1.15));

        this.ammoLabelText = this.scene.add.text(66, 73, 'AMMO [R]', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#a0aab8',
            stroke: '#000000',
            strokeThickness: 2
        });

        this.ammoCountText = this.scene.add.text(224, 73, `${this.scene.weapons.currentAmmo}/${this.scene.weapons.maxAmmo}`, {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffd56b',
            stroke: '#000000',
            strokeThickness: 2
        });

        this.bulletPipSprites = [];
        for (let i = 0; i < this.scene.weapons.maxAmmo; i++) {
            const pip = this.scene.add.sprite(68 + i * 18, 96, 'hud', 'bullet-pip-full');
            pip.setScale(0.75);
            this.bulletPipSprites.push(pip);
        }

        this.hudContainer.add([
            this.ammoPlate,
            this.ammoIcon,
            this.ammoLabelText,
            this.ammoCountText,
            ...this.bulletPipSprites
        ]);

        // 3. First-Aid Kit Section (Below Ammo HUD)
        this.medkitPlate = this.scene.add.rectangle(148, 134, 268, 38, 0x14141a, 0.88);
        this.medkitPlate.setStrokeStyle(2, 0x2e5c3e);

        this.medkitIcon = this.scene.add.sprite(38, 134, 'hud', 'icon-medkit');
        this.medkitIcon.setScale(1.05);
        this.medkitIcon.setInteractive({ useHandCursor: true });
        this.medkitIcon.on('pointerdown', () => this.scene.playerController.useMedkit());
        this.medkitIcon.on('pointerover', () => this.medkitIcon.setScale(1.15));
        this.medkitIcon.on('pointerout', () => this.medkitIcon.setScale(1.05));

        this.medkitLabelText = this.scene.add.text(66, 126, 'FIRST-AID [B]', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#86efac',
            stroke: '#000000',
            strokeThickness: 2
        });

        this.medkitCountText = this.scene.add.text(224, 124, `x${this.scene.playerController.medkits}`, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#86efac',
            stroke: '#000000',
            strokeThickness: 2
        });

        this.hudContainer.add([
            this.medkitPlate,
            this.medkitIcon,
            this.medkitLabelText,
            this.medkitCountText
        ]);

        // 3. Menu Toggle Button (Top Right)
        this.menuBtn = this.scene.add.sprite(GAME_WIDTH - 38, 36, 'hud', 'icon-menu');
        this.menuBtn.setScale(1.15);
        this.menuBtn.setInteractive({ useHandCursor: true });
        this.menuBtn.on('pointerdown', () => this.scene.menu.toggleMenu());
        this.menuBtn.on('pointerover', () => this.menuBtn.setScale(1.25));
        this.menuBtn.on('pointerout', () => this.menuBtn.setScale(1.15));

        const menuLabel = this.menuLabel = this.scene.add.text(GAME_WIDTH - 38, 54, 'MENU [ESC]', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#aaddff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0);

        this.backpackButton=this.scene.add.rectangle(GAME_WIDTH-100,36,48,48,0x23313d).setStrokeStyle(1,0x8aab9a).setScrollFactor(0).setInteractive({useHandCursor:true});
        this.backpackIcon=this.scene.add.image(GAME_WIDTH-100,36,'items','icon-backpack').setScrollFactor(0);
        this.backpackButton.on('pointerdown',(_p:unknown,_x:unknown,_y:unknown,e:Phaser.Types.Input.EventData)=>{e.stopPropagation();this.scene.inventory.toggle();});
        this.hudContainer.add([this.menuBtn, menuLabel,this.backpackButton,this.backpackIcon]);
        // Input hit-testing uses each child's scroll factor, not its container's.
        this.hudContainer.setScrollFactor(0, 0, true);
        // Phaser 4's bulk setter skips inherited component defaults. Set input
        // targets explicitly so camera scrolling cannot offset their hit areas.
        for (const button of [this.menuBtn, this.heroPortrait, this.ammoIcon, this.medkitIcon]) button.setScrollFactor(0);

        // 4. In-Game Menu / Pause Modal
        this.scene.menu.createMenu();

        this.updateHUD();
    };

    updateHUD = () => {
        if (!this.heroPortrait) return;

        // Update portrait frame & hero name
        const isPlayer = this.scene.playerController.currentCharacter === 'player';
        this.heroPortrait.setFrame(isPlayer ? 'face-survivor' : 'face-scholar');
        this.heroNameText.setText(isPlayer ? 'SURVIVOR [G]' : 'SCHOLAR [G]');

        // Update hearts
        for (let i = 0; i < this.scene.playerController.maxHealth; i++) {
            const heart = this.heartSprites[i];
            if (heart) {
                heart.setFrame(i < this.scene.playerController.playerHealth ? 'heart-full' : 'heart-empty');
            }
        }

        // Update defeated score
        if (this.defeatedScoreText) {
            this.defeatedScoreText.setText(`${this.scene.score}`);
        }

        // Update ammo & reload state
        if (this.ammoIcon && this.ammoLabelText && this.ammoCountText) {
            const isShotgun = this.scene.weapons.activeWeapon === 'shotgun';
            const curAmmo = isShotgun ? this.scene.weapons.shotgunAmmo : this.scene.weapons.rifleAmmo;
            const curMaxAmmo = isShotgun ? SHOTGUN_MAX_AMMO : RIFLE_MAX_AMMO;

            if (this.scene.weapons.isReloading) {
                this.ammoIcon.setFrame('icon-reload');
                this.ammoLabelText.setText('RELOADING...');
                this.ammoLabelText.setColor('#ffbb44');
                this.ammoCountText.setText('RELOAD');
                this.ammoCountText.setColor('#ffbb44');
            } else {
                if (isShotgun) {
                    this.ammoIcon.setFrame('icon-shotgun');
                    this.ammoLabelText.setText('SHOTGUN [Q]');
                    this.ammoLabelText.setColor('#ff9955');
                } else {
                    this.ammoIcon.setFrame('icon-rifle');
                    this.ammoLabelText.setText(this.scene.weapons.hasShotgun ? 'RIFLE [Q]' : 'AMMO [R]');
                    this.ammoLabelText.setColor('#a0aab8');
                }
                this.ammoCountText.setText(`${curAmmo}/${curMaxAmmo}`);
                this.ammoCountText.setColor(curAmmo <= (isShotgun ? 1 : 2) ? '#ff5555' : '#ffd56b');
            }

            for (let i = 0; i < RIFLE_MAX_AMMO; i++) {
                const pip = this.bulletPipSprites[i];
                if (pip) {
                    if (i < curMaxAmmo) {
                        pip.setVisible(true);
                        if (isShotgun) {
                            pip.setFrame(i < curAmmo ? 'shell-pip-full' : 'shell-pip-empty');
                        } else {
                            pip.setFrame(i < curAmmo ? 'bullet-pip-full' : 'bullet-pip-empty');
                        }
                    } else {
                        pip.setVisible(false);
                    }
                }
            }
        }

        // Update First-Aid Kit counter
        if (this.medkitCountText && this.medkitLabelText) {
            const medkits = this.scene.playerController.medkits;
            this.medkitCountText.setText(`x${medkits}`);
            if (medkits > 0) {
                this.medkitCountText.setColor('#86efac');
                this.medkitLabelText.setColor('#86efac');
                this.medkitLabelText.setText('FIRST-AID [B]');
            } else {
                this.medkitCountText.setColor('#94a3b8');
                this.medkitLabelText.setColor('#94a3b8');
                this.medkitLabelText.setText('FIRST-AID [EMPTY]');
            }
        }

        // Update menu & shop status if initialized
        this.scene.menu.updateMenuElements();
        this.scene.shop.updateShopElements();
    };

    flashProximityAlert = (message: string, color: string = '#ffcc00') => {
        // Destroy any previous text to avoid stale canvas references after scene restart
        if (this.proximityNoticeText) {
            this.scene.tweens.killTweensOf(this.proximityNoticeText);
            this.proximityNoticeText.destroy();
            this.proximityNoticeText = undefined;
        }

        this.proximityNoticeText = this.scene.add.text((this.scene.scale?.width ?? GAME_WIDTH) / 2, 85, message, {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: color,
            stroke: '#000000',
            strokeThickness: 3,
            backgroundColor: '#000000cc',
            padding: { x: 14, y: 6 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(15000).setAlpha(1);

        this.scene.tweens.add({
            targets: this.proximityNoticeText,
            alpha: 0,
            delay: 1800,
            duration: 600,
            ease: 'Power1'
        });
    };

    reset() {
        this.heartSprites = [];
        this.bulletPipSprites = [];
        this.proximityNoticeText = undefined;
    }
}
