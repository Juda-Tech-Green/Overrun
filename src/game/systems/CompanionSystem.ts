import type { GameScene } from '../scenes/Game';
import type { GameObjects } from 'phaser';
import { MAP_HEIGHT, MAP_WIDTH } from '../constants';
import { facingFromVector, playerPose, type PlayerFacing } from '../player-facing';

type Point = { x: number; y: number };
const FOLLOW_DISTANCE = 56;
const STOP_DISTANCE = 4;
const MAX_TRAIL_POINTS = 256;

/** Cosmetic display objects only: no Arcade body, HP, combat group or target registration. */
export class CompanionSystem {
    constructor(private readonly scene: GameScene) {}

    dog: GameObjects.Sprite;
    shadow: GameObjects.Ellipse;
    facing: PlayerFacing = 'e';
    private trail: Point[] = [];

    reset = () => {
        this.trail = [];
        this.facing = 'e';
    };

    create = () => {
        const player = this.scene.playerController.player;
        const x = player.x - 50;
        const y = player.y + 16;
        this.shadow = this.scene.add.ellipse(x, y - 3, 30, 9, 0x15100b, 0.18);
        this.dog = this.scene.add.sprite(x, y, 'companion-dog', 'idle-side-0');
        this.dog.setOrigin(0.5, 1);
        this.dog.setData('cosmeticCompanion', true);
        this.trail = [{ x, y }, { x: player.x, y: player.y }];
        this.dog.play('companion-dog-idle');
        this.updateDepth();
    };

    private updateDepth = () => {
        this.dog.setDepth(this.dog.y);
        this.shadow.setPosition(this.dog.x, this.dog.y - 3).setDepth(this.dog.y - 0.1);
    };

    /** Follow the recent player path rather than orbiting the player's aim direction. */
    private followTarget = (player: Point): Point => {
        const last = this.trail[this.trail.length - 1];
        if (!last || Math.hypot(player.x - last.x, player.y - last.y) >= 6) {
            this.trail.push({ x: player.x, y: player.y });
            if (this.trail.length > MAX_TRAIL_POINTS) this.trail.shift();
        }
        let remaining = FOLLOW_DISTANCE;
        let end = player;
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const start = this.trail[i];
            const distance = Math.hypot(end.x - start.x, end.y - start.y);
            if (distance >= remaining && distance > 0) {
                return { x: end.x + (start.x - end.x) * remaining / distance,
                    y: end.y + (start.y - end.y) * remaining / distance };
            }
            remaining -= distance;
            end = start;
        }
        return end;
    };

    update = (delta: number) => {
        if (!this.dog?.active) return;
        const player = this.scene.playerController.player;
        const paused = this.scene.playerController.isPlayerDead || this.scene.menu.isMenuOpen
            || this.scene.shop.isShopOpen || this.scene.chat.isChatOpen || (this.scene.inventory?.isOpen || this.scene.network?.blocked);
        let moving = false;
        if (!paused) {
            const target = this.followTarget(player);
            const dx = target.x - this.dog.x;
            const dy = target.y - this.dog.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 640) {
                // Recover discreetly if a teleport leaves the companion far offscreen.
                this.dog.setPosition(target.x, target.y);
            } else if (distance > STOP_DISTANCE && delta > 0) {
                const speed = Math.min(420, Math.max(80, distance * 5));
                const step = Math.min(distance - STOP_DISTANCE, speed * Math.min(delta, 100) / 1000);
                this.dog.setPosition(this.dog.x + dx / distance * step, this.dog.y + dy / distance * step);
                this.facing = facingFromVector(dx, dy, this.facing);
                moving = step > 0;
            }
            const bounds = this.scene.physics?.world?.bounds ?? { x: 0, y: 0, right: MAP_WIDTH, bottom: MAP_HEIGHT };
            this.dog.setPosition(Math.max(bounds.x + 24, Math.min(bounds.right - 24, this.dog.x)),
                Math.max(bounds.y + 48, Math.min(bounds.bottom - 4, this.dog.y)));
        }
        const pose = playerPose(this.facing);
        this.dog.setFlipX(pose.flip);
        this.dog.play(`companion-dog-${moving ? 'walk' : 'idle'}${pose.suffix}`, true);
        this.updateDepth();
    };
}
