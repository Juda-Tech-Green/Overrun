import type { GameScene } from '../scenes/Game';
import type * as Phaser from 'phaser';
import { facingVector } from '../player-facing';
import { interactionContext, type InteractionId } from '../interaction';

type Role = 'move' | 'aim' | 'fire' | 'heal' | 'interact';
const ROLES: Role[] = ['move', 'aim', 'fire', 'heal', 'interact'];
type Point = { x: number; y: number };

/** Camera-fixed twin sticks. Each role owns a separate pointer until release. */
export class MobileControlsSystem {
    constructor(private readonly scene: GameScene) {}

    usingTouch = false;
    movement: Point = { x: 0, y: 0 };
    aim: Point = { x: 1, y: 0 };
    firing = false;
    radius = 64;
    centers: Record<Role, Point> = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: { x: 0, y: 0 },
        heal: { x: 0, y: 0 }, interact: { x: 0, y: 0 } };
    private pendingInteraction: InteractionId | null = null;
    private pointers = new Map<Role, Phaser.Input.Pointer>();
    private root: Phaser.GameObjects.Container | null = null;
    private bases = {} as Record<Role, Phaser.GameObjects.Image>;
    private knobs = {} as Record<'move' | 'aim', Phaser.GameObjects.Image>;
    private labels = {} as Record<Role, Phaser.GameObjects.Text>;

    reset() {
        this.usingTouch = false;
        this.movement = { x: 0, y: 0 };
        this.aim = { x: 1, y: 0 };
        this.firing = false;
        this.pendingInteraction = null;
        this.pointers.clear();
        this.root = null;
        this.bases = {} as typeof this.bases;
        this.knobs = {} as typeof this.knobs;
        this.labels = {} as typeof this.labels;
    }

    blocked = () => this.scene.playerController.isPlayerDead || this.scene.menu.isMenuOpen ||
        this.scene.shop.isShopOpen || this.scene.chat.isChatOpen || (this.scene.inventory?.isOpen || this.scene.network?.blocked);

    create = () => {
        this.usingTouch = this.scene.sys.game.device.input.touch;
        this.aim = facingVector(this.scene.playerController.playerFacing);
        this.root = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(15000);
        for (const role of ROLES) {
            const base = this.scene.add.image(0, 0, 'mobile-controls', role === 'move' || role === 'aim' ? `${role}-base` : role);
            base.setScrollFactor(0).setInteractive();
            base.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
                this.claim(role, pointer);
            });
            this.bases[role] = base;
            this.root.add(base);
            if (role === 'move' || role === 'aim') {
                const knob = this.scene.add.image(0, 0, 'mobile-controls', `${role}-knob`);
                this.knobs[role] = knob;
                this.root.add(knob);
            }
            this.labels[role] = this.scene.add.text(0, 0, role.toUpperCase(), {
                fontFamily: 'monospace', fontSize: '14px', color: role === 'fire' ? '#ffd580' : '#c6d8c7',
                stroke: '#091017', strokeThickness: 4,
            }).setOrigin(0.5);
            this.root.add(this.labels[role]);
        }
        this.root.setScrollFactor(0, 0, true);
        this.layout();
        this.updateActions();
        this.root.setVisible(this.usingTouch && !this.blocked());
        this.scene.input.on('pointerdown', this.onTouchStart);
        this.scene.input.on('pointermove', this.onMove);
        this.scene.input.on('pointerup', this.onRelease);
        this.scene.input.on('pointerupoutside', this.onRelease);
        this.scene.input.on('gameout', this.releaseAll);
        this.scene.scale.on('resize', this.layout);
        this.scene.game.events.on('blur', this.releaseAll);
        this.scene.events.once('shutdown', this.shutdown);
    };

    layout = () => {
        this.releaseAll();
        const { width, height } = this.scene.scale;
        // Canvas coordinates follow the full viewport on resize/orientation changes.
        const size = Math.min(160, width * 0.22, height * 0.25);
        this.radius = size * 0.4;
        const edge = size * 0.7;
        const y = height - edge;
        this.centers = { move: { x: edge, y }, aim: { x: width - edge, y },
            fire: { x: width - edge, y: y - size * 1.12 },
            heal: { x: edge, y: y - size * 1.12 }, interact: { x: width / 2, y } };
        for (const role of ROLES) {
            const p = this.centers[role];
            this.bases[role].setPosition(p.x, p.y).setDisplaySize(size, size);
            this.labels[role].setPosition(p.x, p.y + size * 0.44);
            if (role === 'move' || role === 'aim') this.knobs[role].setPosition(p.x, p.y).setDisplaySize(size, size);
        }
    };

    /** First touch on a hybrid device reveals the controls, without firing into the world. */
    private onTouchStart = (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch || this.blocked()) return;
        this.usingTouch = true;
        this.root?.setVisible(true);
        for (const role of ROLES) {
            const c = this.centers[role];
            if (Math.hypot(pointer.x - c.x, pointer.y - c.y) <= this.radius * 1.25) {
                this.claim(role, pointer);
                break;
            }
        }
    };

    claim = (role: Role, pointer: Phaser.Input.Pointer) => {
        if (this.blocked() || this.pointers.has(role) || [...this.pointers.values()].some(p => p.id === pointer.id)) return;
        const context = interactionContext(this.scene);
        if (role === 'interact' && !context) return;
        this.usingTouch = true;
        this.pointers.set(role, pointer);
        if (role === 'fire') {
            this.firing = true;
            this.bases.fire.setFrame('fire-pressed');
            const aim = this.aimTarget();
            this.scene.weapons.requestFireAt(aim.worldX, aim.worldY);
        } else if (role === 'heal') {
            this.bases.heal.setFrame('heal-pressed');
            this.scene.playerController.useMedkit();
        } else if (role === 'interact') {
            this.bases.interact.setFrame('interact-pressed');
            this.pendingInteraction = context!.id;
        } else this.drag(role, pointer);
    };

    private drag = (role: 'move' | 'aim', pointer: Phaser.Input.Pointer) => {
        const c = this.centers[role];
        const dx = pointer.x - c.x, dy = pointer.y - c.y;
        const distance = Math.hypot(dx, dy);
        const strength = Math.min(distance / this.radius, 1);
        const x = distance ? dx / distance : 0, y = distance ? dy / distance : 0;
        this.knobs[role].setPosition(c.x + x * strength * this.radius, c.y + y * strength * this.radius);
        if (role === 'move') {
            const speed = Math.min(1, Math.max(0, (strength - 0.18) / 0.82));
            this.movement = { x: x * speed, y: y * speed };
        } else if (strength > 0.18) this.aim = { x, y };
    };

    onMove = (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch && this.pointers.size === 0) this.usingTouch = false;
        if (this.blocked()) { this.releaseAll(); return; }
        for (const role of ['move', 'aim'] as const) {
            if (this.pointers.get(role)?.id === pointer.id) this.drag(role, pointer);
        }
    };

    onRelease = (pointer: Phaser.Input.Pointer) => {
        for (const [role, owner] of this.pointers) {
            if (owner.id !== pointer.id) continue;
            this.pointers.delete(role);
            if (role === 'fire') {
                this.firing = false;
                this.bases.fire.setFrame('fire');
            } else if (role === 'heal' || role === 'interact') {
                this.bases[role].setFrame(role);
            } else {
                this.knobs[role].setPosition(this.centers[role].x, this.centers[role].y);
                if (role === 'move') this.movement = { x: 0, y: 0 };
            }
        }
    };

    releaseAll = () => {
        for (const pointer of [...this.pointers.values()]) this.onRelease(pointer);
        this.movement = { x: 0, y: 0 };
        this.firing = false;
        this.pendingInteraction = null;
    };

    consumeInteraction = (id: InteractionId) => {
        if (this.blocked() || this.pendingInteraction !== id) return false;
        this.pendingInteraction = null;
        return true;
    };

    private updateActions = () => {
        // Mobile hardware keeps only the dedicated AID button, even if a browser
        // emits a compatibility mouse event. Hybrid desktops follow input mode.
        const mobile = this.usingTouch || this.scene.sys.game.device.os?.desktop === false;
        this.scene.hud.setMedkitBarVisible?.(!mobile);
        const context = interactionContext(this.scene);
        if (this.pendingInteraction !== context?.id) this.pendingInteraction = null;
        this.bases.interact.setVisible(Boolean(context));
        this.labels.interact.setVisible(Boolean(context)).setText(context?.label ?? 'USE');
        const player = this.scene.playerController;
        this.labels.heal.setText(`AID (${player.medkits})`);
        this.bases.heal.setAlpha(player.medkits > 0 && player.playerHealth < player.maxHealth ? 1 : 0.5);
    };

    ownsPointer = (pointer: Phaser.Input.Pointer) => [...this.pointers.values()].some(p => p.id === pointer.id);

    aimTarget = () => {
        const player = this.scene.playerController.player;
        return { worldX: player.x + this.aim.x * 400, worldY: player.y - 33 + this.aim.y * 400 };
    };

    update = () => {
        const blocked = this.blocked();
        this.root?.setVisible(this.usingTouch && !blocked);
        if (blocked) this.releaseAll();
        this.updateActions();
        // Phaser marks canceled/outside touches up; also recover if a release event was lost.
        for (const pointer of [...this.pointers.values()]) if (!pointer.isDown) this.onRelease(pointer);
    };

    private shutdown = () => {
        // Display-list shutdown may already have destroyed the image textures.
        this.pointers.clear();
        this.movement = { x: 0, y: 0 };
        this.firing = false;
        this.pendingInteraction = null;
        this.scene.input.off('pointerdown', this.onTouchStart);
        this.scene.input.off('pointermove', this.onMove);
        this.scene.input.off('pointerup', this.onRelease);
        this.scene.input.off('pointerupoutside', this.onRelease);
        this.scene.input.off('gameout', this.releaseAll);
        this.scene.scale.off('resize', this.layout);
        this.scene.game.events.off('blur', this.releaseAll);
    };
}
