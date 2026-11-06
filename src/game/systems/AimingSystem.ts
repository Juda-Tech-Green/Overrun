import type * as Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';
import { rayBodyDistance } from '../aim-ray';
import { SHOTGUN_SPREAD_DEG } from '../constants';

type Target = Phaser.Physics.Arcade.Sprite;

/** World-space preview using the same muzzle and central trajectory as shooting. */
export class AimingSystem {
    constructor(private readonly scene: GameScene) {}
    private graphics: Phaser.GameObjects.Graphics | null = null;
    endpoint: { x: number; y: number; hit: boolean } | null = null;

    reset() { this.graphics = null; this.endpoint = null; }

    create = () => {
        this.graphics = this.scene.add.graphics().setDepth(1490);
    };

    private trace = (x: number, y: number, angle: number, range: number, targets: Target[]) => {
        const dx = Math.cos(angle), dy = Math.sin(angle);
        let distance = range, hit = false;
        for (const target of targets) {
            const body = target.body;
            if (!target.active || !body?.enable || target.getData('state') === 'dead') continue;
            const candidate = rayBodyDistance(x, y, dx, dy, body, distance);
            if (candidate !== null && candidate <= distance) { distance = candidate; hit = true; }
        }
        return { x: x + dx * distance, y: y + dy * distance, hit };
    };

    update = () => {
        const graphics = this.graphics;
        if (!graphics) return;
        graphics.clear();
        this.endpoint = null;
        if (this.scene.playerController.isPlayerDead || this.scene.menu.isMenuOpen ||
            this.scene.shop.isShopOpen || this.scene.chat.isChatOpen || (this.scene.inventory?.isOpen || this.scene.network?.blocked)) {
            graphics.setVisible(false);
            return;
        }
        graphics.setVisible(true);
        const aim = this.scene.controls.aimPointer();
        const ray = this.scene.weapons.shotTrajectory(aim.worldX, aim.worldY);
        const world = this.scene.world;
        const groups = [world.trees, world.giantTrees, world.rocks, world.bushes,
            this.scene.castle.solidObstacles, this.scene.enemies.zombies];
        const targets = groups.flatMap(group => group?.getChildren() ?? []) as Target[];
        for (const target of [this.scene.altars.altar, this.scene.altars.wolfAltar, this.scene.altars.drownerAltar,
            this.scene.shop.vendor, this.scene.witches.altar, this.scene.ritual?.altar]) if (target) targets.push(target);
        if (this.scene.boss.dragon?.active && !this.scene.boss.isDragonDead) targets.push(this.scene.boss.dragon);
        this.endpoint = this.trace(ray.x, ray.y, ray.angle, ray.range, targets);
        // Shotgun edges show its spread; the bright laser remains its central aim.
        if (this.scene.weapons.activeWeapon === 'shotgun') {
            graphics.lineStyle(1, 0xff5555, 0.16);
            for (const side of [-1, 1]) {
                const end = this.trace(ray.x, ray.y, ray.angle + side * SHOTGUN_SPREAD_DEG * Math.PI / 360, ray.range, targets);
                graphics.lineBetween(ray.x, ray.y, end.x, end.y);
            }
        }
        graphics.lineStyle(5, 0xff313d, 0.12).lineBetween(ray.x, ray.y, this.endpoint.x, this.endpoint.y);
        graphics.lineStyle(1, 0xff6168, 0.85).lineBetween(ray.x, ray.y, this.endpoint.x, this.endpoint.y);
        if (this.endpoint.hit) {
            graphics.fillStyle(0xff313d, 0.25).fillCircle(this.endpoint.x, this.endpoint.y, 6);
            graphics.fillStyle(0xffd9d9, 1).fillCircle(this.endpoint.x, this.endpoint.y, 2);
        }
    };
}
