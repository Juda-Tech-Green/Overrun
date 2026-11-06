import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';

export class GameplaySystem {
    constructor(private readonly scene: GameScene) {}

    update = (time: number) => {
        if (this.scene.network?.blocked) { this.scene.playerController.player.setVelocity(0, 0); return; }
        if (this.scene.playerController.isPlayerDead) {
            if (this.scene.controls.cursors.space.isDown || this.scene.controls.reloadKey.isDown || this.scene.controls.restartKey.isDown) {
                this.scene.scene.restart();
            }
            return;
        }

        if (!this.scene.chat.isChatOpen && !this.scene.shop.isShopOpen && !this.scene.menu.isMenuOpen &&
            this.scene.controls.inventoryKey && Phaser.Input.Keyboard.JustDown(this.scene.controls.inventoryKey)) this.scene.inventory.toggle();
        if (this.scene.inventory?.isOpen) {
            this.scene.playerController.player.setVelocity(0, 0);
            return;
        }

        // When chat is open, suspend all player movement & gameplay actions
        if (this.scene.chat.isChatOpen) {
            this.scene.playerController.player.setVelocity(0, 0);
            return;
        }

        // When shop is open, handle shop shortcuts and suspend movement
        if (this.scene.shop.isShopOpen) {
            this.scene.playerController.player.setVelocity(0, 0);

            // [E] or [ESC] closes shop
            if (Phaser.Input.Keyboard.JustDown(this.scene.controls.interactKey)) {
                this.scene.shop.toggleShop();
                return;
            }

            // [Space] or [1] purchases / equips shotgun; [B] or [2] purchases first-aid kit
            const spaceDown = Phaser.Input.Keyboard.JustDown(this.scene.controls.cursors.space);
            const slot1Down = this.scene.controls.weaponSlot1Key ? Phaser.Input.Keyboard.JustDown(this.scene.controls.weaponSlot1Key) : false;
            const slot2Down = this.scene.controls.weaponSlot2Key ? Phaser.Input.Keyboard.JustDown(this.scene.controls.weaponSlot2Key) : false;
            const bDown = this.scene.controls.healKey ? Phaser.Input.Keyboard.JustDown(this.scene.controls.healKey) : false;

            if (spaceDown || slot1Down) {
                this.scene.shop.buyShotgun();
            } else if (bDown || slot2Down) {
                this.scene.shop.buyFirstAidKit();
            }
            return;
        }

        //  Toggle Menu [M] (ESC is handled solely by keydown-ESC to isolate closing chat from pausing)
        if (Phaser.Input.Keyboard.JustDown(this.scene.controls.menuKey)) {
            this.scene.menu.toggleMenu();
        }

        //  When menu is open, handle in-menu shortcuts and pause gameplay actions
        if (this.scene.menu.isMenuOpen) {
            if (Phaser.Input.Keyboard.JustDown(this.scene.controls.switchKey)) {
                this.scene.playerController.switchCharacter();
            }
            if (Phaser.Input.Keyboard.JustDown(this.scene.controls.autoSpawnKey)) {
                this.scene.altars.toggleAutoSpawn();
            }
            if (Phaser.Input.Keyboard.JustDown(this.scene.controls.restartKey)) {
                this.scene.menu.toggleMenu();
                this.scene.scene.restart();
            }
            return;
        }

        //  Tactical Reload [R]
        if (Phaser.Input.Keyboard.JustDown(this.scene.controls.reloadKey)) {
            this.scene.weapons.startReload();
        }

        //  Use First-Aid Kit [B]
        if (this.scene.controls.healKey && Phaser.Input.Keyboard.JustDown(this.scene.controls.healKey)) {
            this.scene.playerController.useMedkit();
        }

        //  Switch Character [G]
        if (Phaser.Input.Keyboard.JustDown(this.scene.controls.switchKey)) {
            this.scene.playerController.switchCharacter();
        }

        //  Toggle Auto-Spawn [P]
        if (Phaser.Input.Keyboard.JustDown(this.scene.controls.autoSpawnKey)) {
            this.scene.altars.toggleAutoSpawn();
        }

        //  Weapon Switching [Q] or [1] / [2]
        if (this.scene.controls.weaponSwapKey && Phaser.Input.Keyboard.JustDown(this.scene.controls.weaponSwapKey)) {
            this.scene.weapons.toggleWeapon();
        }
        if (this.scene.controls.weaponSlot1Key && Phaser.Input.Keyboard.JustDown(this.scene.controls.weaponSlot1Key)) {
            this.scene.weapons.setWeapon('rifle');
        }
        if (this.scene.controls.weaponSlot2Key && Phaser.Input.Keyboard.JustDown(this.scene.controls.weaponSlot2Key)) {
            this.scene.weapons.setWeapon('shotgun');
        }

        this.scene.playerController.updateMovement();
        this.scene.weapons.updateFiring(time);

        if (this.scene.network?.isGuest) {
            this.scene.altars.updateProximity(time);
            this.scene.network.guestInteraction();
            this.scene.shop.updateProximity();
            this.scene.world.updateDepths();
            this.scene.weapons.cleanupBullets();
            return;
        }
        this.scene.altars.updateProximity(time);

        this.scene.shop.updateProximity();

        this.scene.world.updateDepths();

        this.scene.enemies.update(time);

        //  Dragon Boss AI & Combat Loop
        if (this.scene.boss.isDragonSpawned && this.scene.boss.dragon && this.scene.boss.dragon.active && !this.scene.boss.isDragonDead) {
            this.scene.boss.updateDragonBoss(time);
        }

        this.scene.weapons.cleanupBullets();
    };
}
