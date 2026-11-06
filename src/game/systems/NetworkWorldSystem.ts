import type * as Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';
import type { EntityState, StaticWorld, SceneryState, WorldState } from '../network-protocol';
import { smoothFactor } from '../network-protocol';

/** Host snapshot capture and guest replicas. Never executes guest AI or reward callbacks. */
export class NetworkWorldSystem {
    constructor(private readonly scene: GameScene) {}
    private ids = new WeakMap<object, string>();
    private nextId = 0;
    private ritualActive = false;
    private replicas = new Map<string, Phaser.Physics.Arcade.Sprite>();
    private targets = new Map<string, EntityState>();
    private dropReplicas = new Map<string, Phaser.GameObjects.Sprite>();
    id = (object: object) => {
        let id = this.ids.get(object);
        if (!id) {
            id = `n${++this.nextId}`;
            this.ids.set(object, id);
        }
        return id;
    };
    reset = () => {
        for (const sprite of this.replicas.values()) sprite.destroy();
        this.replicas.clear();
        this.targets.clear();
        this.dropReplicas.clear();
        this.ids = new WeakMap();
        this.nextId = 0;
        this.ritualActive = false;
    };
    private entity = (o: Phaser.GameObjects.Sprite): EntityState => ({
        id: this.id(o),
        type: o.texture.key,
        x: o.x,
        y: o.y,
        hp: o.getData('hp') ?? 0,
        anim: o.anims.currentAnim?.key ?? '',
        flipX: o.flipX,
        rotation: o.rotation,
        tint: o.tintTopLeft,
        frame: o.frame.name,
        scaleX: o.scaleX,
        scaleY: o.scaleY,
        state: o.getData('state') ?? '',
    });
    staticWorld = (): StaticWorld => {
        const scenery: SceneryState[] = [];
        for (const group of ['trees', 'giantTrees', 'rocks', 'bushes'] as const) {
            for (const object of this.scene.world[group].getChildren()) {
                const o = object as Phaser.Physics.Arcade.Sprite,
                    b = o.body as Phaser.Physics.Arcade.StaticBody;
                scenery.push({
                    group,
                    type: o.texture.key,
                    frame: o.frame.name,
                    x: o.x,
                    y: o.y,
                    scaleX: o.scaleX,
                    scaleY: o.scaleY,
                    originX: o.originX,
                    originY: o.originY,
                    w: b.width,
                    h: b.height,
                    ox: b.offset.x,
                    oy: b.offset.y,
                    circle: b.isCircle,
                    radius: b.radius,
                    anim: o.anims.currentAnim?.key ?? '',
                });
            }
        }
        const tiles = this.scene.world.groundLayer.layer.data.map((row) => row.map((t) => t.index));
        return { scenery, tiles };
    };
    applyStatic = (world: StaticWorld) => {
        for (const key of ['trees', 'giantTrees', 'rocks', 'bushes'] as const)
            this.scene.world[key].clear(true, true);
        this.scene.world.decorations.clear(true, true);
        world.tiles.forEach((row, y) =>
            row.forEach((tile, x) => {
                this.scene.world.groundLayer.putTileAt(tile, x, y);
                if (tile === 1 || tile === 6) {
                    const deco = this.scene.add.sprite(x * 16 + 8, y * 16 + 8, 'grass-tiles', tile);
                    deco.play(tile === 1 ? 'grass-sway' : 'grass-breeze');
                    this.scene.world.decorations.add(deco);
                }
            }),
        );
        for (const state of world.scenery) {
            if (!this.scene.textures.exists(state.type)) continue;
            const o = this.scene.world[state.group].create(
                state.x,
                state.y,
                state.type,
                state.frame,
            ) as Phaser.Physics.Arcade.Sprite;
            o.setScale(state.scaleX, state.scaleY)
                .setOrigin(state.originX, state.originY)
                .setDepth(state.y)
                .refreshBody();
            const b = o.body as Phaser.Physics.Arcade.StaticBody;
            if (state.circle) b.setCircle(state.radius, state.ox, state.oy);
            else b.setSize(state.w, state.h).setOffset(state.ox, state.oy);
            if (this.scene.anims.exists(state.anim)) o.play(state.anim);
        }
    };
    snapshot = (): WorldState => {
        const s = this.scene;
        const enemies = s.enemies.zombies
            .getChildren()
            .filter((o) => o.active)
            .map((o) => this.entity(o as Phaser.GameObjects.Sprite));
        const boss = s.boss.dragon?.active
            ? {
                  ...this.entity(s.boss.dragon),
                  hp: s.boss.dragonHp,
                  state: s.boss.isDragonDead ? 'dead' : 'alive',
              }
            : null;
        const hazards = [
            ...(s.witches.potions?.getChildren() ?? []),
            ...(s.boss.dragonFireballs?.getChildren() ?? []),
        ]
            .filter((o) => o.active)
            .map((o) => this.entity(o as Phaser.GameObjects.Sprite));
        const altars = [
            s.altars.altar,
            s.altars.wolfAltar,
            s.altars.drownerAltar,
            s.witches.altar,
            s.ritual.altar,
        ]
            .filter((o) => !!o)
            .map((o) => this.entity(o!));
        const drops = [...s.loot.pickups].map(([o, p]) => ({
            id: this.id(o),
            item: p.id,
            x: o.x,
            y: o.y,
            amount: p.amount,
        }));
        return {
            enemies,
            boss,
            hazards,
            altars,
            drops,
            inventory: { ...s.inventory.counts },
            portalUnlocked: s.castle.portalUnlocked,
            score: s.network.resources.guestKills,
            autoSpawnEnabled: s.altars.isAutoSpawnEnabled,
            medkits: s.network.resources.guestMedkits,
            hasShotgun: s.weapons.hasShotgun,
            ritual: s.ritual.remaining,
            guest: s.network.remoteState!,
            guestAmmo: { ...s.network.remoteAmmo },
        };
    };
    apply = (world: WorldState) => {
        const s = this.scene;
        const all = [...world.enemies, ...world.hazards, ...(world.boss ? [world.boss] : [])];
        const incoming = new Set(all.map((o) => o.id));
        for (const [id, o] of this.replicas)
            if (!incoming.has(id)) {
                o.destroy();
                this.replicas.delete(id);
                this.targets.delete(id);
            }
        for (const state of all) {
            if (!s.textures.exists(state.type)) continue;
            const previous = this.targets.get(state.id);
            let o = this.replicas.get(state.id);
            if (!o) {
                o = s.physics.add
                    .sprite(state.x, state.y, state.type, state.frame)
                    .setOrigin(0.5, 1)
                    .setImmovable(true);
                (o.body as Phaser.Physics.Arcade.Body).moves = false;
                this.replicas.set(state.id, o);
                if (world.enemies.includes(state)) s.enemies.zombies.add(o);
                if (world.boss === state) {
                    o.setOrigin(0.5, 0.85).setSize(340, 360).setOffset(86, 90);
                    s.boss.dragon = o;
                }
            }
            o.setScale(state.scaleX, state.scaleY)
                .setRotation(state.rotation)
                .setTint(state.tint)
                .setFlipX(state.flipX)
                .setData({ hp: state.hp, state: state.state, variant: state.type });
            // Snapshot edges produce presentation once, never on every network update.
            if (world.enemies.includes(state)) {
                if (!previous || previous.type !== state.type || (previous.state === 'dead' && state.state !== 'dead')) s.audio?.enemy(o, 'spawn');
                else if (state.state !== previous.state && ['attack','hurt','dead'].includes(state.state))
                    s.audio?.enemy(o, state.state === 'dead' ? 'die' : state.state as 'attack' | 'hurt');
            } else if (world.boss === state) {
                if (!previous) s.audio?.play('dragon-summon-roar', o);
                else if (state.state === 'dead' && previous.state !== 'dead') {
                    s.audio?.play('dragon-die', o); s.audio?.play('ui-boss-victory');
                } else if (state.hp < previous.hp) s.audio?.play('dragon-hurt', o, .5, 250);
                if (state.anim.includes('attack') && !previous?.anim.includes('attack')) s.audio?.play('dragon-fireball-charge', o);
            } else if (!previous) {
                s.audio?.play(state.type.startsWith('witch-potion') ? 'witch-potion-throw' : 'dragon-fireball-launch', o);
            }
            if (s.anims.exists(state.anim)) o.play(state.anim, true);
            else o.setTexture(state.type, state.frame);
            this.targets.set(state.id, state);
        }
        s.boss.isDragonSpawned = !!world.boss;
        s.boss.isDragonDead = world.boss?.state === 'dead';
        if (world.boss) {
            s.boss.dragonHp = world.boss.hp;
            if (!s.boss.bossBarContainer) s.boss.createBossBar();
            s.boss.updateBossBar();
        } else {
            s.boss.dragon = null;
            s.boss.bossBarContainer?.destroy();
            s.boss.bossBarContainer = null;
        }
        const altarSprites = [
            s.altars.altar,
            s.altars.wolfAltar,
            s.altars.drownerAltar,
            s.witches.altar,
            s.ritual.altar,
        ];
        world.altars.forEach((state, i) => {
            if (altarSprites[i] && s.anims.exists(state.anim)) altarSprites[i]!.play(state.anim, true);
        });
        const dropIds = new Set(world.drops.map((d) => d.id));
        for (const [id, o] of this.dropReplicas)
            if (!dropIds.has(id)) {
                s.loot.pickups.delete(o);
                o.destroy();
                this.dropReplicas.delete(id);
            }
        for (const d of world.drops) {
            let o = this.dropReplicas.get(d.id);
            if (!o) {
                o = s.loot.spawn(d.item, d.x, d.y + 8);
                o.setData('networkId', d.id);
                this.dropReplicas.set(d.id, o);
            }
            o.setPosition(d.x, d.y);
            const pickup = s.loot.pickups.get(o);
            if (pickup) pickup.amount = d.amount;
        }
        if (world.ritual > 0 && !this.ritualActive) {
            s.ritual.presentAwakening();
            if (s.inventory.isOpen && s.inventory.mode === 'offering') s.inventory.close();
        }
        this.ritualActive = world.ritual > 0;
        for (const id of ['bone','fang','eye','pearl'] as const)
            if (world.inventory[id] > s.inventory.counts[id]) s.audio?.play(`loot-pickup-${id}`);
        if (world.inventory['portal-key'] > s.inventory.counts['portal-key']) s.audio?.play('crafting-forge-key');
        if (world.medkits > s.playerController.medkits) s.audio?.play('shop-buy-item');
        s.inventory.counts = { ...world.inventory };
        s.inventory.hasPortalKey = world.inventory['portal-key'] > 0;
        s.inventory.refresh();
        s.altars.isAutoSpawnEnabled = world.autoSpawnEnabled;
        s.menu.updateMenuElements();
        s.score = world.score;
        s.playerController.medkits = world.medkits;
        const newShotgun = !s.weapons.hasShotgun && world.hasShotgun;
        s.weapons.hasShotgun = world.hasShotgun;
        if (newShotgun) {
            s.audio?.play('shop-buy-shotgun');
            s.weapons.setWeapon('shotgun');
            if (s.shop.isShopOpen) s.shop.toggleShop();
        }
        s.castle.setPortalUnlocked(world.portalUnlocked);
        s.hud.updateHUD();
        s.network.applyGuestAuthority(world.guest, world.guestAmmo);
        s.hud.updateHUD();
    };
    interpolate = (delta: number) => {
        const alpha = smoothFactor(delta);
        for (const [id, state] of this.targets) {
            const o = this.replicas.get(id);
            if (!o) continue;
            const far = Math.hypot(state.x - o.x, state.y - o.y) > 250;
            o.setPosition(
                far ? state.x : o.x + (state.x - o.x) * alpha,
                far ? state.y : o.y + (state.y - o.y) * alpha,
            ).setDepth(o.y);
        }
    };
}
