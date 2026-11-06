import type { GameScene } from '../scenes/Game';

export class AnimationsSystem {
    constructor(private readonly scene: GameScene) {}

    registerAnimations = () => {
        //  Player animations from loaded JSON
        const playerAnim = this.scene.cache.json.get('player-anim');
        if (playerAnim?.animations) {
            for (const anim of playerAnim.animations) {
                if (!this.scene.anims.exists(`player-${anim.name}`)) {
                    this.scene.anims.create({
                        key: `player-${anim.name}`,
                        frames: anim.frames.map((f: any) => ({ key: 'player', frame: f.frameId, duration: f.durationMs })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 100),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        //  Heroine animations from loaded JSON
        const heroineAnim = this.scene.cache.json.get('heroine-anim');
        if (heroineAnim?.animations) {
            for (const anim of heroineAnim.animations) {
                if (!this.scene.anims.exists(`heroine-${anim.name}`)) {
                    this.scene.anims.create({
                        key: `heroine-${anim.name}`,
                        frames: anim.frames.map((f: any) => ({ key: 'heroine', frame: f.frameId, duration: f.durationMs })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 100),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        const companionAnimations = this.scene.cache.json.get('companion-dog-anim');
        for (const animation of companionAnimations?.animations ?? []) {
            const key = `companion-dog-${animation.name}`;
            if (!this.scene.anims.exists(key)) {
                this.scene.anims.create({
                    key,
                    frames: animation.frames.map((frame: { frameId: string; durationMs: number }) => ({
                        key: 'companion-dog', frame: frame.frameId, duration: frame.durationMs
                    })),
                    frameRate: 10,
                    repeat: animation.loop ? -1 : 0
                });
            }
        }

        //  All Zombie, Beast, Witch and Drowner variants animations
        const zombieVariants = [
            { key: 'zombie', animKey: 'zombie-anim' },
            { key: 'zombie-female', animKey: 'zombie-female-anim' },
            { key: 'zombie-skeleton', animKey: 'zombie-skeleton-anim' },
            { key: 'zombie-blue', animKey: 'zombie-blue-anim' },
            { key: 'werewolf', animKey: 'werewolf-anim' },
            { key: 'werewolf-albino', animKey: 'werewolf-albino-anim' },
            { key: 'drowner', animKey: 'drowner-anim' },
            { key: 'altar-drowner', animKey: 'altar-drowner-anim' },
            { key: 'witch', animKey: 'witch-anim' },
            { key: 'witch-red', animKey: 'witch-red-anim' },
            { key: 'altar-witch', animKey: 'altar-witch-anim' },
            { key: 'witch-potion', animKey: 'witch-potion-anim' },
            { key: 'witch-potion-red', animKey: 'witch-potion-red-anim' }
        ];

        for (const variant of zombieVariants) {
            const variantAnim = this.scene.cache.json.get(variant.animKey);
            if (variantAnim?.animations) {
                for (const anim of variantAnim.animations) {
                    const fullKey = `${variant.key}-${anim.name}`;
                    if (!this.scene.anims.exists(fullKey)) {
                        this.scene.anims.create({
                            key: fullKey,
                            frames: anim.frames.map((f: any) => ({ key: variant.key, frame: f.frameId, duration: f.durationMs })),
                            frameRate: 1000 / (anim.frames[0]?.durationMs ?? 100),
                            repeat: anim.loop ? -1 : 0
                        });
                    }
                }
            }
        }

        //  Altar animations from loaded JSON (Necromantic Stone)
        const altarAnim = this.scene.cache.json.get('altar-anim');
        if (altarAnim?.animations) {
            for (const anim of altarAnim.animations) {
                if (!this.scene.anims.exists(`altar-${anim.name}`)) {
                    this.scene.anims.create({
                        key: `altar-${anim.name}`,
                        frames: anim.frames.map((f: any) => ({ key: 'altar', frame: f.frameId })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 150),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        //  Wolf Altar animations from loaded JSON (Blood Moon Totem)
        const wolfAltarAnim = this.scene.cache.json.get('altar-wolf-anim');
        if (wolfAltarAnim?.animations) {
            for (const anim of wolfAltarAnim.animations) {
                if (!this.scene.anims.exists(`altar-wolf-${anim.name}`)) {
                    this.scene.anims.create({
                        key: `altar-wolf-${anim.name}`,
                        frames: anim.frames.map((f: any) => ({ key: 'altar-wolf', frame: f.frameId })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 150),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        //  Drowner Altar animations from loaded JSON (Sunken Prison Cistern)
        const drownerAltarAnim = this.scene.cache.json.get('altar-drowner-anim');
        if (drownerAltarAnim?.animations) {
            for (const anim of drownerAltarAnim.animations) {
                if (!this.scene.anims.exists(`altar-drowner-${anim.name}`)) {
                    this.scene.anims.create({
                        key: `altar-drowner-${anim.name}`,
                        frames: anim.frames.map((f: any) => ({ key: 'altar-drowner', frame: f.frameId, duration: f.durationMs })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 150),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        // Directional dragon bundles use stable actor keys, independent texture keys.
        for (const suffix of ['', '-front', '-front45', '-back', '-back45']) {
            const texture = `dragon${suffix}`;
            const metadata = this.scene.cache.json.get(`${texture}-anim`);
            for (const animation of metadata?.animations ?? []) {
                const key = `dragon-${animation.name}${suffix}`;
                if (!this.scene.anims.exists(key)) {
                    this.scene.anims.create({
                        key,
                        frames: animation.frames.map((frame: { frameId: string; durationMs: number }) => ({
                            key: texture, frame: frame.frameId, duration: frame.durationMs
                        })),
                        frameRate: 12.5,
                        repeat: animation.loop ? -1 : 0
                    });
                }
            }
        }

        //  Bullet animation
        if (!this.scene.anims.exists('bullet-fly')) {
            this.scene.anims.create({
                key: 'bullet-fly',
                frames: this.scene.anims.generateFrameNumbers('bullet', { start: 0, end: 1 }),
                frameRate: 10,
                repeat: -1
            });
        }

        //  Grass sway/breeze animations
        if (!this.scene.anims.exists('grass-sway')) {
            this.scene.anims.create({
                key: 'grass-sway',
                frames: [
                    { key: 'grass-tiles', frame: 1 },
                    { key: 'grass-tiles', frame: 2 },
                    { key: 'grass-tiles', frame: 1 },
                    { key: 'grass-tiles', frame: 3 }
                ],
                frameRate: 4,
                repeat: -1
            });
        }

        if (!this.scene.anims.exists('grass-breeze')) {
            this.scene.anims.create({
                key: 'grass-breeze',
                frames: [
                    { key: 'grass-tiles', frame: 6 },
                    { key: 'grass-tiles', frame: 7 }
                ],
                frameRate: 2.5,
                repeat: -1
            });
        }

        //  Tree animations from loaded JSON (3 green variants)
        const treesAnim = this.scene.cache.json.get('trees-anim');
        if (treesAnim?.animations) {
            for (const anim of treesAnim.animations) {
                if (!this.scene.anims.exists(`trees-${anim.name}`)) {
                    this.scene.anims.create({
                        key: `trees-${anim.name}`,
                        frames: anim.frames.map((f: any) => ({ key: 'trees', frame: f.frameId })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 260),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        //  Giant Tree animations from loaded JSON (2 massive 128x192 variants: Ancient Emerald Oak & Celestial Sakura Elder)
        const giantTreesAnim = this.scene.cache.json.get('trees-giant-anim');
        if (giantTreesAnim?.animations) {
            for (const anim of giantTreesAnim.animations) {
                if (!this.scene.anims.exists(`trees-giant-${anim.name}`)) {
                    this.scene.anims.create({
                        key: `trees-giant-${anim.name}`,
                        frames: anim.frames.map((f: any) => ({ key: 'trees-giant', frame: f.frameId })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 270),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        //  Rock animations from loaded JSON (3 variants: terracotta, gray, olive)
        const rocksAnim = this.scene.cache.json.get('rocks-anim');
        if (rocksAnim?.animations) {
            for (const anim of rocksAnim.animations) {
                if (!this.scene.anims.exists(`rocks-${anim.name}`)) {
                    this.scene.anims.create({
                        key: `rocks-${anim.name}`,
                        frames: anim.frames.map((f: any) => ({ key: 'rocks', frame: f.frameId })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 500),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        //  Bush animations from loaded JSON (3 animated variants: berry, flower, lavender)
        const bushesAnim = this.scene.cache.json.get('bushes-anim');
        if (bushesAnim?.animations) {
            for (const anim of bushesAnim.animations) {
                if (!this.scene.anims.exists(`bushes-${anim.name}`)) {
                    this.scene.anims.create({
                        key: `bushes-${anim.name}`,
                        frames: anim.frames.map((f: any) => ({ key: 'bushes', frame: f.frameId })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 260),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        //  Vendor animations from loaded JSON
        const vendorAnim = this.scene.cache.json.get('vendor-anim');
        if (vendorAnim?.animations) {
            for (const anim of vendorAnim.animations) {
                if (!this.scene.anims.exists(anim.name)) {
                    this.scene.anims.create({
                        key: anim.name,
                        frames: anim.frames.map((f: any) => ({ key: 'vendor', frame: f.frameId })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 360),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        //  Healing FX animations from loaded JSON
        const healFxAnim = this.scene.cache.json.get('heal-fx-anim');
        if (healFxAnim?.animations) {
            for (const anim of healFxAnim.animations) {
                const fullKey = `heal-fx-${anim.name}`;
                if (!this.scene.anims.exists(fullKey)) {
                    this.scene.anims.create({
                        key: fullKey,
                        frames: anim.frames.map((f: any) => ({ key: 'heal-fx', frame: f.frameId, duration: f.durationMs })),
                        frameRate: 1000 / (anim.frames[0]?.durationMs ?? 80),
                        repeat: anim.loop ? -1 : 0
                    });
                }
            }
        }

        //  Portal and Castle Prison animations from loaded JSON
        const castleBundles = [
            'items', 'altar-dragon', 'portal',
            'prison-floor',
            'prison-wall',
            'prison-bars',
            'prison-puddle',
            'prison-torch',
            'prison-chains',
            'prison-straw',
            'prison-door'
        ];

        for (const bundleKey of castleBundles) {
            const bundleAnim = this.scene.cache.json.get(`${bundleKey}-anim`);
            if (bundleAnim?.animations) {
                for (const anim of bundleAnim.animations) {
                    const fullKey = `${bundleKey}-${anim.name}`;
                    if (!this.scene.anims.exists(fullKey)) {
                        this.scene.anims.create({
                            key: fullKey,
                            frames: anim.frames.map((f: any) => ({ key: bundleKey, frame: f.frameId, duration: f.durationMs })),
                            frameRate: 1000 / (anim.frames[0]?.durationMs ?? 100),
                            repeat: anim.loop ? -1 : 0
                        });
                    }
                }
            }
        }
    };
}
