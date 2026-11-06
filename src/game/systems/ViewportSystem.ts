import type * as Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';

/** Screen-space layout for the resizable canvas. World geometry stays unchanged. */
export class ViewportSystem {
    constructor(private readonly scene: GameScene) {}
    uiCamera: Phaser.Cameras.Scene2D.Camera | null = null;
    private cursorIsMobile: boolean | null = null;

    reset() { this.uiCamera = null; this.cursorIsMobile = null; }

    create = () => {
        const { width, height } = this.scene.scale;
        this.uiCamera = this.scene.cameras.add(0, 0, width, height, false, 'ui');
        this.layout();
        this.update();
        this.scene.scale.on('resize', this.layout);
        this.scene.events.once('shutdown', this.shutdown);
    };

    private modal = (container: Phaser.GameObjects.Container | undefined, designWidth: number, designHeight: number) => {
        if (!container) return;
        const { width, height } = this.scene.scale;
        const scale = Math.min(1, (width - 24) / designWidth, (height - 24) / designHeight);
        container.setPosition(width / 2, height / 2).setScale(scale);
        // All modal owners put their full-screen dimmer first, outside the panel artwork.
        const backdrop = container.list[0] as Phaser.GameObjects.Rectangle;
        backdrop.setSize(width / scale, height / scale);
        if (backdrop.input) {
            (backdrop.input.hitArea as Phaser.Geom.Rectangle).setSize(width / scale, height / scale);
        }
    };

    layout = () => {
        const { width, height } = this.scene.scale;
        this.uiCamera?.setSize(width, height);
        const hud = this.scene.hud;
        hud.menuBtn.setX(width - 38);
        const backpackX = width < 420 ? width - 38 : width - 100;
        const backpackY = width < 420 ? 108 : 36;
        hud.backpackButton?.setPosition(backpackX, backpackY);
        hud.backpackIcon?.setPosition(backpackX, backpackY);
        hud.menuLabel.setX(width - 38);
        hud.proximityNoticeText?.setX(width / 2);
        this.modal(this.scene.menu.menuContainer, 560, 460);
        this.modal(this.scene.shop.shopContainer, 580, 480);
        this.modal(this.scene.deathScreen.container, 640, 384);
        const chatScale = Math.min(1, (width - 36) / 380, (height - 36) / 160);
        this.scene.chat.chatContainer.setScale(chatScale).setPosition(18, height - 15 - 160 * chatScale);
        this.scene.boss.bossBarContainer?.setX(width / 2);
    };

    update = () => {
        const device = this.scene.sys.game.device;
        const mobile = device.os.desktop === false || device.input.touch;
        const worldCamera = this.scene.cameras.main;
        const zoom = 2;
        if (worldCamera.zoom !== zoom) worldCamera.setZoom(zoom);
        if (this.cursorIsMobile !== mobile) {
            this.scene.input.setDefaultCursor(mobile ? 'default' : 'url("assets/desktop-pointer/pointer.png") 16 16, crosshair');
            this.cursorIsMobile = mobile;
        }
        if (!this.uiCamera) return;
        // Camera filtering on display-list roots also applies to their children.
        // Classify dynamically created notices, boss bars, FX and pooled sprites.
        const mask = worldCamera.id | this.uiCamera.id;
        for (const object of this.scene.children.list) {
            const scroll = object as Phaser.GameObjects.GameObject & Partial<Phaser.GameObjects.Components.ScrollFactor>;
            const screenSpace = scroll.scrollFactorX === 0 && scroll.scrollFactorY === 0;
            object.cameraFilter = (object.cameraFilter & ~mask) | (screenSpace ? worldCamera.id : this.uiCamera.id);
        }
    };

    private shutdown = () => this.scene.scale.off('resize', this.layout);
}
