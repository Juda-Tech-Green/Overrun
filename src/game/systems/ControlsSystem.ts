import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';

export class ControlsSystem {
    constructor(private readonly scene: GameScene) {}

    weaponSwapKey: Phaser.Input.Keyboard.Key;

    weaponSlot1Key: Phaser.Input.Keyboard.Key;

    weaponSlot2Key: Phaser.Input.Keyboard.Key;

    cursors: Phaser.Types.Input.Keyboard.CursorKeys;

    wasd: Record<'up' | 'left' | 'down' | 'right', Phaser.Input.Keyboard.Key>;

    interactKey: Phaser.Input.Keyboard.Key;

    restartKey: Phaser.Input.Keyboard.Key;

    switchKey: Phaser.Input.Keyboard.Key;

    autoSpawnKey: Phaser.Input.Keyboard.Key;

    menuKey: Phaser.Input.Keyboard.Key;

    escKey: Phaser.Input.Keyboard.Key;

    reloadKey: Phaser.Input.Keyboard.Key;

    healKey: Phaser.Input.Keyboard.Key;
    inventoryKey: Phaser.Input.Keyboard.Key;

    /** Reproject every use: cached pointer world coordinates can lag camera scrolling. */
    aimPointer = (pointer = this.scene.input.mousePointer ?? this.scene.input.activePointer) => {
        if (this.scene.mobileControls?.usingTouch) return this.scene.mobileControls.aimTarget();
        pointer.updateWorldPoint(this.scene.cameras.main);
        return pointer;
    };

    setupInput = () => {
        const keyboard = this.scene.input.keyboard!;
        const keys = Phaser.Input.Keyboard.KeyCodes;

        this.cursors = keyboard.createCursorKeys();
        this.wasd = {
            up: keyboard.addKey(keys.W),
            left: keyboard.addKey(keys.A),
            down: keyboard.addKey(keys.S),
            right: keyboard.addKey(keys.D)
        };

        this.interactKey = keyboard.addKey(keys.E);
        this.restartKey = keyboard.addKey(keys.R);
        this.reloadKey = keyboard.addKey(keys.R);
        this.healKey = keyboard.addKey(keys.B);
        this.inventoryKey = keyboard.addKey(keys.I);
        this.switchKey = keyboard.addKey(keys.G);
        this.autoSpawnKey = keyboard.addKey(keys.P);
        this.menuKey = keyboard.addKey(keys.M);
        this.escKey = keyboard.addKey(keys.ESC);
        this.weaponSwapKey = keyboard.addKey(keys.Q);
        this.weaponSlot1Key = keyboard.addKey(keys.ONE);
        this.weaponSlot2Key = keyboard.addKey(keys.TWO);

        // Chat Toggle and Input Listeners
        this.scene.input.keyboard!.on('keydown-ENTER', () => {
            if (this.scene.playerController.isPlayerDead || this.scene.menu.isMenuOpen || this.scene.shop.isShopOpen || (this.scene.inventory?.isOpen || this.scene.network?.blocked)) return;
            if (this.scene.chat.isChatOpen) {
                this.scene.chat.submitChat();
            } else {
                this.scene.chat.openChat();
            }
        });

        // Dedicated ESC handler: closes shop or chat if open without opening pause menu; toggles menu if closed
        this.scene.input.keyboard!.on('keydown-ESC', () => {
            if (this.scene.playerController.isPlayerDead) return;
            if ((this.scene.inventory?.isOpen || this.scene.network?.blocked)) { this.scene.inventory.close(); return; }
            if (this.scene.shop.isShopOpen) {
                this.scene.shop.toggleShop();
                if (this.escKey) {
                    this.escKey.reset();
                }
                return;
            }
            if (this.scene.chat.isChatOpen) {
                this.scene.chat.closeChat();
                if (this.escKey) {
                    this.escKey.reset();
                }
                return;
            }
            this.scene.menu.toggleMenu();
            if (this.escKey) {
                this.escKey.reset();
            }
        });

        this.scene.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
            if (!this.scene.chat.isChatOpen) return;
            if (event.key === 'Enter' || event.key === 'Escape') return;

            if (event.key === 'Backspace') {
                this.scene.chat.chatInputText = this.scene.chat.chatInputText.slice(0, -1);
                this.scene.chat.updateChatInputDisplay();
            } else if (event.key.length === 1 && this.scene.chat.chatInputText.length < 45) {
                this.scene.chat.chatInputText += event.key;
                this.scene.chat.updateChatInputDisplay();
            }
        });

        // Left Click Shooting
        this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.wasTouch) return;
            if (this.scene.mobileControls) this.scene.mobileControls.usingTouch = false;
            if (this.scene.menu.isMenuOpen || this.scene.chat.isChatOpen || this.scene.shop.isShopOpen || (this.scene.inventory?.isOpen || this.scene.network?.blocked)) return;
            if (pointer.leftButtonDown()) {
                const aim = this.aimPointer(pointer);
                this.scene.weapons.requestFireAt(aim.worldX, aim.worldY);
            }
        });
    };
}
