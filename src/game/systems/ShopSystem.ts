import { interactionPressed, INTERACTION_RANGE } from '../interaction';
import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { FIRST_AID_PRICE, GAME_HEIGHT, GAME_WIDTH, SHOTGUN_PRICE, VENDOR_X, VENDOR_Y } from '../constants';

export class ShopSystem {
    constructor(private readonly scene: GameScene) {}

    vendor: Phaser.Physics.Arcade.Sprite;

    vendorPromptSprite: Phaser.GameObjects.Sprite;

    vendorPromptText: Phaser.GameObjects.Text;

    isPlayerNearVendor: boolean = false;

    isShopOpen: boolean = false;

    shopContainer?: Phaser.GameObjects.Container;

    shopBuyBtn: Phaser.GameObjects.Sprite;

    shopBuyBtnText: Phaser.GameObjects.Text;

    shopMedkitBuyBtn: Phaser.GameObjects.Sprite;

    shopMedkitBuyBtnText: Phaser.GameObjects.Text;

    shopKillsText: Phaser.GameObjects.Text;

    createVendor = () => {
        // 3. Position South-West corner Vendor (Arms Dealer Outpost) at (VENDOR_X, VENDOR_Y)
        this.vendor = this.scene.physics.add.sprite(VENDOR_X, VENDOR_Y, 'vendor', 'idle-1');
        this.vendor.setOrigin(0.5, 1);
        this.vendor.setImmovable(true);
        const body = this.vendor.body as Phaser.Physics.Arcade.Body;
        body.setSize(32, 20);
        body.setOffset(8, 44);
        this.vendor.play('vendor-idle');
        this.vendor.setDepth(VENDOR_Y);

        // Floating personalized HUD prompt badge over the vendor
        this.vendorPromptSprite = this.scene.add.sprite(VENDOR_X, VENDOR_Y - 84, 'hud', 'prompt-vendor-buy');
        this.vendorPromptSprite.setScale(1.5);
        this.vendorPromptSprite.setOrigin(0.5, 0.5);
        this.vendorPromptSprite.setVisible(false);
        this.vendorPromptSprite.setDepth(2000);

        // Floating interact prompt text over the vendor
        this.vendorPromptText = this.scene.add.text(VENDOR_X, VENDOR_Y - 50, 'Press [E] to Browse Shop', {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 3,
            backgroundColor: '#000000aa',
            padding: { x: 8, y: 4 }
        });
        this.vendorPromptText.setOrigin(0.5);
        this.vendorPromptText.setVisible(false);
        this.vendorPromptText.setDepth(2000);

        // Floating hover animation for the vendor prompt badge
        this.scene.tweens.add({
            targets: this.vendorPromptSprite,
            y: '-=6',
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Allow clicking directly on the vendor or its prompt to open shop
        this.vendor.setInteractive({ useHandCursor: true });
        this.vendor.on('pointerdown', () => {
            if (!this.isShopOpen && !this.scene.menu.isMenuOpen && this.isPlayerNearVendor) {
                this.toggleShop();
            }
        });
        this.vendorPromptSprite.setInteractive({ useHandCursor: true });
        this.vendorPromptSprite.on('pointerdown', () => {
            if (!this.isShopOpen && !this.scene.menu.isMenuOpen) {
                this.toggleShop();
            }
        });
        this.vendorPromptText.setInteractive({ useHandCursor: true });
        this.vendorPromptText.on('pointerdown', () => {
            if (!this.isShopOpen && !this.scene.menu.isMenuOpen) {
                this.toggleShop();
            }
        });
    };

    createShopMenu = () => {
        this.shopContainer = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this.shopContainer.setDepth(30000);
        this.shopContainer.setVisible(false);

        // Fullscreen dark backdrop to dim game
        const backdrop = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);

        // Slate modal window with ornate gold trim
        const panel = this.scene.add.rectangle(0, 0, 580, 480, 0x141620, 0.98);
        panel.setStrokeStyle(3, 0xb88832);

        // Header Banner plaque using PixelForge 'shop-banner'
        const headerBanner = this.scene.add.image(0, -200, 'menu', 'shop-banner');
        headerBanner.setScale(3.2, 1.3);

        const headerTitle = this.scene.add.text(0, -200, 'BLACK MARKET ARMORY', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffe599',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        const subtitle = this.scene.add.text(0, -162, 'Arms Dealer Outpost • Exchange Monster Trophies for Gear', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#94a3b8'
        }).setOrigin(0.5);

        // Player Kills / Currency row
        const killsPlate = this.scene.add.rectangle(0, -135, 520, 32, 0x1e2433, 0.9);
        killsPlate.setStrokeStyle(1, 0x475569);

        const skullIcon = this.scene.add.sprite(-230, -135, 'hud', 'skull').setScale(0.9);
        this.shopKillsText = this.scene.add.text(-210, -141, `YOUR KILLS: ${this.scene.score}`, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 2
        });

        // ----------------------------------------------------
        // CARD 1 (LEFT): Heavy Trench Shotgun
        // ----------------------------------------------------
        const shotgunCard = this.scene.add.image(-135, 10, 'menu', 'item-card-frame');
        shotgunCard.setScale(2.6, 4.3);

        const shotgunTitle = this.scene.add.text(-135, -78, 'HEAVY SHOTGUN', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffe599',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        const shotgunSprite = this.scene.add.image(-135, -42, 'weapons', 'shotgun-item');
        shotgunSprite.setScale(2.2);

        const shotgunDesc = this.scene.add.text(-242, -12,
            '• 12-gauge pump action\n' +
            '• 5-pellet buckshot cone\n' +
            '• High close-range power\n' +
            '• Slot: [2] / [Q]\n' +
            '• Price: 10 Kills', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#cbd5e1',
            lineSpacing: 3
        });

        this.shopBuyBtn = this.scene.add.sprite(-135, 84, 'menu', 'btn-buy-normal').setScale(1.9, 1.15);
        this.shopBuyBtn.setScrollFactor(0);
        this.shopBuyBtn.setInteractive({ useHandCursor: true });
        this.shopBuyBtn.on('pointerdown', () => this.buyShotgun());
        this.shopBuyBtn.on('pointerover', () => {
            if (this.scene.weapons.hasShotgun || this.scene.score >= SHOTGUN_PRICE) {
                this.shopBuyBtn.setFrame('btn-buy-hover');
            }
        });
        this.shopBuyBtn.on('pointerout', () => this.updateShopElements());

        this.shopBuyBtnText = this.scene.add.text(-135, 84, `BUY [${SHOTGUN_PRICE} KILLS]`, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        this.shopBuyBtnText.setScrollFactor(0);
        this.shopBuyBtnText.setInteractive({ useHandCursor: true });
        this.shopBuyBtnText.on('pointerdown', () => this.buyShotgun());

        // ----------------------------------------------------
        // CARD 2 (RIGHT): Military First-Aid Kit
        // ----------------------------------------------------
        const medkitCard = this.scene.add.image(135, 10, 'menu', 'item-card-frame');
        medkitCard.setScale(2.6, 4.3);

        const medkitTitle = this.scene.add.text(135, -78, 'FIRST-AID KIT', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#86efac',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        const medkitSprite = this.scene.add.image(135, -42, 'weapons', 'medkit-item');
        medkitSprite.setScale(2.0);

        const medkitDesc = this.scene.add.text(28, -12,
            '• Field trauma medical kit\n' +
            '• Restores +2 HP instantly\n' +
            '• Portable & stackable\n' +
            '• Consume with Key [B]\n' +
            '• Price: 2 Kills', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#cbd5e1',
            lineSpacing: 3
        });

        this.shopMedkitBuyBtn = this.scene.add.sprite(135, 84, 'menu', 'btn-buy-normal').setScale(1.9, 1.15);
        this.shopMedkitBuyBtn.setScrollFactor(0);
        this.shopMedkitBuyBtn.setInteractive({ useHandCursor: true });
        this.shopMedkitBuyBtn.on('pointerdown', () => this.buyFirstAidKit());
        this.shopMedkitBuyBtn.on('pointerover', () => {
            if (this.scene.score >= FIRST_AID_PRICE) {
                this.shopMedkitBuyBtn.setFrame('btn-buy-hover');
            }
        });
        this.shopMedkitBuyBtn.on('pointerout', () => this.updateShopElements());

        this.shopMedkitBuyBtnText = this.scene.add.text(135, 84, `BUY [${FIRST_AID_PRICE} KILLS]`, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        this.shopMedkitBuyBtnText.setScrollFactor(0);
        this.shopMedkitBuyBtnText.setInteractive({ useHandCursor: true });
        this.shopMedkitBuyBtnText.on('pointerdown', () => this.buyFirstAidKit());

        // Close / Resume Button
        const closeBtn = this.scene.add.sprite(0, 175, 'menu', 'btn-normal').setScale(2.2, 1.15);
        closeBtn.setScrollFactor(0);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.toggleShop());
        closeBtn.on('pointerover', () => closeBtn.setFrame('btn-hover'));
        closeBtn.on('pointerout', () => closeBtn.setFrame('btn-normal'));

        const closeLabel = this.scene.add.text(0, 175, 'CLOSE SHOP [ESC / E]', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        closeLabel.setScrollFactor(0);
        closeLabel.setInteractive({ useHandCursor: true });
        closeLabel.on('pointerdown', () => this.toggleShop());

        this.shopContainer.add([
            backdrop, panel, headerBanner, headerTitle, subtitle,
            killsPlate, skullIcon, this.shopKillsText,
            shotgunCard, shotgunTitle, shotgunSprite, shotgunDesc, this.shopBuyBtn, this.shopBuyBtnText,
            medkitCard, medkitTitle, medkitSprite, medkitDesc, this.shopMedkitBuyBtn, this.shopMedkitBuyBtnText,
            closeBtn, closeLabel
        ]);

        // Ensure all shop container children adopt scrollFactor=0 for pixel-perfect hit-testing
        this.shopContainer.setScrollFactor(0, 0, true);
    };

    updateShopElements = () => {
        if (!this.shopContainer) return;
        if (this.shopKillsText) {
            this.shopKillsText.setText(`YOUR KILLS: ${this.scene.score}`);
        }
        if (this.shopBuyBtn && this.shopBuyBtnText) {
            if (this.scene.weapons.hasShotgun) {
                this.shopBuyBtn.setFrame('btn-buy-normal');
                this.shopBuyBtnText.setText('EQUIPPED [OWNED]');
                this.shopBuyBtnText.setColor('#86efac');
            } else if (this.scene.score >= SHOTGUN_PRICE) {
                this.shopBuyBtn.setFrame('btn-buy-normal');
                this.shopBuyBtnText.setText(`BUY [${SHOTGUN_PRICE} KILLS]`);
                this.shopBuyBtnText.setColor('#ffffff');
            } else {
                this.shopBuyBtn.setFrame('btn-buy-disabled');
                this.shopBuyBtnText.setText(`NEED ${SHOTGUN_PRICE} KILLS`);
                this.shopBuyBtnText.setColor('#fca5a5');
            }
        }
        if (this.shopMedkitBuyBtn && this.shopMedkitBuyBtnText) {
            const count = this.scene.playerController.medkits;
            if (this.scene.score >= FIRST_AID_PRICE) {
                this.shopMedkitBuyBtn.setFrame('btn-buy-normal');
                this.shopMedkitBuyBtnText.setText(`BUY [${FIRST_AID_PRICE} K] (x${count})`);
                this.shopMedkitBuyBtnText.setColor('#ffffff');
            } else {
                this.shopMedkitBuyBtn.setFrame('btn-buy-disabled');
                this.shopMedkitBuyBtnText.setText(`NEED ${FIRST_AID_PRICE} K (x${count})`);
                this.shopMedkitBuyBtnText.setColor('#fca5a5');
            }
        }
    };

    buyFirstAidKit = (remote = false) => {
        if (this.scene.network?.isGuest) { this.scene.network.requestAction('medkit'); return; }
        if (remote) return this.scene.network.resources.buyGuestMedkit();
        if (this.scene.score >= FIRST_AID_PRICE) {
            this.scene.score -= FIRST_AID_PRICE;
            this.scene.audio?.play('shop-buy-item');
            this.scene.playerController.medkits++;
            this.scene.hud.updateHUD();
            this.updateShopElements();
            this.scene.cameras.main.flash(180, 100, 255, 150);
            this.scene.hud.flashProximityAlert(`🩹 Purchased First-Aid Kit! (Stored: ${this.scene.playerController.medkits}) Press [B] to heal.`, '#66ff99');
        } else {
            this.scene.audio?.play('shop-denied');
            this.scene.hud.flashProximityAlert(`⚠️ Need ${FIRST_AID_PRICE} Kills to purchase First-Aid Kit!`, '#ff4444');
        }
    };

    buyShotgun = (remote = false) => {
        if (this.scene.network?.isGuest) {
            if (this.scene.weapons.hasShotgun) { this.scene.weapons.setWeapon('shotgun'); this.toggleShop(); }
            else this.scene.network.requestAction('shotgun');
            return;
        }
        if (this.scene.weapons.hasShotgun) {
            if (!remote) { this.scene.weapons.setWeapon('shotgun'); this.toggleShop(); }
            this.scene.hud.flashProximityAlert('Switched to Heavy Shotgun [Q]', '#ffd700');
            return;
        }

        const canBuy = remote
            ? this.scene.network.resources.spendGuestKills(SHOTGUN_PRICE)
            : this.scene.score >= SHOTGUN_PRICE;
        if (canBuy) {
            if (!remote) this.scene.score -= SHOTGUN_PRICE;
            this.scene.audio?.play('shop-buy-shotgun');
            this.scene.weapons.hasShotgun = true;
            if (!remote) this.scene.weapons.setWeapon('shotgun');
            this.scene.hud.updateHUD();
            this.updateShopElements();
            this.scene.cameras.main.flash(250, 255, 215, 0);
            if (!remote) this.toggleShop();
            this.scene.hud.flashProximityAlert('🔥 Shotgun Acquired! Press [Q] to swap weapons.', '#ffbb00');
        } else {
            this.scene.audio?.play('shop-denied');
            this.scene.hud.flashProximityAlert(`⚠️ Need ${SHOTGUN_PRICE} Kills to purchase! Defeat more monsters.`, '#ff4444');
        }
    };

    toggleShop = () => {
        if ((this.scene.inventory?.isOpen || this.scene.network?.blocked)) return;
        if (this.scene.playerController.isPlayerDead || !this.shopContainer) return;
        this.isShopOpen = !this.isShopOpen;
        this.shopContainer.setVisible(this.isShopOpen);
        if (this.isShopOpen) {
            this.updateShopElements();
            (this.scene.playerController.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        }
    };

    updateProximity = () => {
        //  3. South-West Vendor Stall (Corner 3)
        if (this.vendor) {
            const distToVendor = Phaser.Math.Distance.Between(this.scene.playerController.player.x, this.scene.playerController.player.y, this.vendor.x, this.vendor.y);
            const nearVendor = distToVendor < INTERACTION_RANGE.vendor;

            if (nearVendor !== this.isPlayerNearVendor) {
                if (nearVendor) this.scene.audio?.play('shop-greet', this.vendor, .4, 3000);
                this.isPlayerNearVendor = nearVendor;
                if (this.vendorPromptSprite) this.vendorPromptSprite.setVisible(nearVendor);
                if (this.vendorPromptText) this.vendorPromptText.setVisible(nearVendor);
            }

            // Press [E] to browse shop
            if (nearVendor && interactionPressed(this.scene, 'vendor')) {
                this.toggleShop();
            }
        }

    };

    reset() {
        // HUD refresh runs before the new shop is built; discard the destroyed container.
        this.shopContainer = undefined;
        this.isPlayerNearVendor = false;
        this.isShopOpen = false;
    }
}
