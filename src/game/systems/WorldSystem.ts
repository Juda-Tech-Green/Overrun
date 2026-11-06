import { DRAGON_ALTAR } from '../progression';
import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { WITCH_ALTAR_X, WITCH_ALTAR_Y, MAP_HEIGHT, MAP_TILES_X, MAP_TILES_Y, MAP_WIDTH, PLAYER_SPAWN_X, PLAYER_SPAWN_Y, PORTAL_MEADOW_X, PORTAL_MEADOW_Y, VENDOR_X, VENDOR_Y, WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y, ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y } from '../constants';

export class WorldSystem {
    constructor(private readonly scene: GameScene) {}

    decorations: Phaser.GameObjects.Group;

    trees: Phaser.Physics.Arcade.StaticGroup;

    giantTrees: Phaser.Physics.Arcade.StaticGroup;

    rocks: Phaser.Physics.Arcade.StaticGroup;

    bushes: Phaser.Physics.Arcade.StaticGroup;

    treeLocations: Array<{ x: number, y: number }> = [];

    giantTreeLocations: Array<{ x: number, y: number }> = [];

    rockLocations: Array<{ x: number, y: number }> = [];

    bushLocations: Array<{ x: number, y: number }> = [];

    map: Phaser.Tilemaps.Tilemap;

    groundLayer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;

    createMap = () => {
        this.map = this.scene.make.tilemap({
            tileWidth: 16,
            tileHeight: 16,
            width: MAP_TILES_X,
            height: MAP_TILES_Y
        });
        const tileset = this.map.addTilesetImage('grass-tiles', 'grass-tiles', 16, 16, 0, 0, 0);
        this.groundLayer = this.map.createBlankLayer('ground', tileset!, 0, 0)!;

        this.decorations = this.scene.add.group();

        //  Fill the map with grass tiles and animated meadow decorations (120 x 80 tiles = 1920 x 1280 px)
        for (let y = 0; y < MAP_TILES_Y; y++) {
            for (let x = 0; x < MAP_TILES_X; x++) {
                const tileType = this.pickGrassTile(x, y);
                this.groundLayer.putTileAt(tileType, x, y);

                //  Scatter animated swaying grass and breeze flowers
                if (tileType === 1) // tufts
                {
                    const deco = this.scene.add.sprite(x * 16 + 8, y * 16 + 8, 'grass-tiles', 1);
                    deco.play('grass-sway');
                    deco.anims.setProgress(Math.random());
                    this.decorations.add(deco);
                }
                else if (tileType === 6) // flower-a
                {
                    const deco = this.scene.add.sprite(x * 16 + 8, y * 16 + 8, 'grass-tiles', 6);
                    deco.play('grass-breeze');
                    deco.anims.setProgress(Math.random());
                    this.decorations.add(deco);
                }
            }
        }
    };

    pickGrassTile = (x: number, y: number): number => {
        //  Border perimeter = dirt-edge (id 8)
        if (y === 0 || y === MAP_TILES_Y - 1 || x === 0 || x === MAP_TILES_X - 1) return 8;

        //  Clear area around North-West Zombie Altar (Corner 1: 260, 240 => tile x: 14..18, y: 13..17)
        if (x >= 13 && x <= 19 && y >= 12 && y <= 18) return 0; // plain ground

        //  Clear area around South-East Werewolf Altar (Corner 2: 1660, 1040 => tile x: 101..106, y: 62..67)
        if (x >= 101 && x <= 107 && y >= 62 && y <= 68) return 0; // plain ground

        //  Clear area around Player Spawn (Center: 960, 640 => tile x: 58..62, y: 38..42)
        if (x >= 57 && x <= 63 && y >= 37 && y <= 43) return 0; // plain ground

        if (Math.hypot(x * 16 - DRAGON_ALTAR.x, y * 16 - DRAGON_ALTAR.y) < 115) return 0;
        if (Math.hypot(x * 16 - WITCH_ALTAR_X, y * 16 - WITCH_ALTAR_Y) < 110) return 0;
        if (Math.hypot(x * 16 - PORTAL_MEADOW_X, y * 16 - PORTAL_MEADOW_Y) < 70) return 0; // plain ground for portal plaza

        //  Randomized grass variants
        const rand = Math.random();
        if (rand < 0.50) return 0;      // plain
        if (rand < 0.65) return 1;      // tufts (sway)
        if (rand < 0.75) return 4;      // pebbles
        if (rand < 0.85) return 5;      // clover
        if (rand < 0.92) return 6;      // flower-a (breeze)
        return 7;                       // flower-b
    };

    createTrees = () => {
        this.trees = this.scene.physics.add.staticGroup();
        this.treeLocations = [];

        //  3 distinct green tree variants with animations
        const variants = [
            { anim: 'trees-sway-emerald', frame: 'emerald-1', name: 'Emerald Oak' },
            { anim: 'trees-sway-olive', frame: 'olive-1', name: 'Golden Olive' },
            { anim: 'trees-sway-teal', frame: 'teal-1', name: 'Teal Spruce' }
        ];

        const targetCount = 72;
        let attempts = 0;

        while (this.treeLocations.length < targetCount && attempts < 1400) {
            attempts++;
            const x = Phaser.Math.Between(60, MAP_WIDTH - 60);
            const y = Phaser.Math.Between(90, MAP_HEIGHT - 90);

            // Leave the cauldron and side spawn lanes clear, including giant tree canopies.
            if (Math.hypot(x - DRAGON_ALTAR.x, y - DRAGON_ALTAR.y) < 150) continue;
            if (Phaser.Math.Distance.Between(x, y, WITCH_ALTAR_X, WITCH_ALTAR_Y) < 185) continue;

            // Avoid North-West Zombie Altar clearing (260, 240)
            if (Phaser.Math.Distance.Between(x, y, ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y) < 135) continue;

            // Avoid South-East Werewolf Altar clearing (1660, 1040)
            if (Phaser.Math.Distance.Between(x, y, WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y) < 135) continue;

            // Avoid South-West Vendor clearing (260, 1060)
            if (Phaser.Math.Distance.Between(x, y, VENDOR_X, VENDOR_Y) < 140) continue;

            // Avoid player initial spawn position (Center at 960, 640)
            if (Phaser.Math.Distance.Between(x, y, PLAYER_SPAWN_X, PLAYER_SPAWN_Y) < 100) continue;

            // Avoid North Portal clearing (960, 80)
            if (Phaser.Math.Distance.Between(x, y, PORTAL_MEADOW_X, PORTAL_MEADOW_Y) < 100) continue;

            // Maintain distance between tree trunks so paths stay open
            const tooClose = this.treeLocations.some(loc => Phaser.Math.Distance.Between(x, y, loc.x, loc.y) < 58);
            if (tooClose) continue;

            this.treeLocations.push({ x, y });

            // Cycle through the 3 green variants
            const variant = variants[this.treeLocations.length % 3];

            const tree = this.trees.create(x, y, 'trees', variant.frame) as Phaser.Physics.Arcade.Sprite;
            tree.setOrigin(0.5, 1);
            tree.play(variant.anim);
            tree.anims.setProgress(Math.random());
            tree.setDepth(y);

            // Circular collision body at trunk base (bottom-middle of 48x64 sprite)
            const body = tree.body as Phaser.Physics.Arcade.StaticBody;
            const radius = 8;
            body.setCircle(radius);
            body.setOffset(16, 48);
            body.reset();
        }
    };

    createGiantTrees = () => {
        this.giantTrees = this.scene.physics.add.staticGroup();
        this.giantTreeLocations = [];

        //  2 distinct giant tree variants (3x size of normal trees: 128x192px)
        const variants = [
            { anim: 'trees-giant-sway-green', frame: 'green-1', name: 'Ancient Emerald Oak' },
            { anim: 'trees-giant-sway-pink', frame: 'pink-1', name: 'Celestial Sakura Elder' }
        ];

        const targetCount = 18;
        let attempts = 0;

        while (this.giantTreeLocations.length < targetCount && attempts < 1400) {
            attempts++;
            const x = Phaser.Math.Between(90, MAP_WIDTH - 90);
            const y = Phaser.Math.Between(180, MAP_HEIGHT - 80);

            // Leave the cauldron and side spawn lanes clear, including giant tree canopies.
            if (Math.hypot(x - DRAGON_ALTAR.x, y - DRAGON_ALTAR.y) < 150) continue;
            if (Phaser.Math.Distance.Between(x, y, WITCH_ALTAR_X, WITCH_ALTAR_Y) < 185) continue;

            // Avoid North-West Zombie Altar clearing (260, 240)
            if (Phaser.Math.Distance.Between(x, y, ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y) < 170) continue;

            // Avoid South-East Werewolf Altar clearing (1660, 1040)
            if (Phaser.Math.Distance.Between(x, y, WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y) < 170) continue;

            // Avoid South-West Vendor clearing (260, 1060)
            if (Phaser.Math.Distance.Between(x, y, VENDOR_X, VENDOR_Y) < 160) continue;

            // Avoid player initial spawn position (Center at 960, 640)
            if (Phaser.Math.Distance.Between(x, y, PLAYER_SPAWN_X, PLAYER_SPAWN_Y) < 140) continue;

            // Avoid North Portal clearing (960, 80)
            if (Phaser.Math.Distance.Between(x, y, PORTAL_MEADOW_X, PORTAL_MEADOW_Y) < 120) continue;

            // Maintain distance between giant trees
            const tooCloseGiant = this.giantTreeLocations.some(loc => Phaser.Math.Distance.Between(x, y, loc.x, loc.y) < 130);
            if (tooCloseGiant) continue;

            // Maintain distance from existing regular tree trunks
            const tooCloseTree = this.treeLocations.some(loc => Phaser.Math.Distance.Between(x, y, loc.x, loc.y) < 75);
            if (tooCloseTree) continue;

            this.giantTreeLocations.push({ x, y });

            // Alternate between Green Ancient Oak and Pink Sakura Elder
            const variant = variants[this.giantTreeLocations.length % variants.length];

            const giantTree = this.giantTrees.create(x, y, 'trees-giant', variant.frame) as Phaser.Physics.Arcade.Sprite;
            giantTree.setOrigin(0.5, 1);
            giantTree.play(variant.anim);
            giantTree.anims.setProgress(Math.random());
            giantTree.setDepth(y);

            // Circular collision body at massive trunk base (centered around x=64, y=168)
            const body = giantTree.body as Phaser.Physics.Arcade.StaticBody;
            const radius = 14;
            body.setCircle(radius);
            body.setOffset(50, 154);
            body.reset();
        }
    };

    createRocks = () => {
        this.rocks = this.scene.physics.add.staticGroup();
        this.rockLocations = [];

        //  3 distinct rock variants: Terracotta, Gray, and Olive
        //  Each variant has 2 handcrafted shape models in the atlas
        const variants = [
            { name: 'Terracotta Sandstone', frame: 'terracotta-1', altFrame: 'terracotta-2' },
            { name: 'Granite Slate', frame: 'gray-1', altFrame: 'gray-2' },
            { name: 'Mossy Serpentine', frame: 'olive-1', altFrame: 'olive-2' }
        ];

        const targetCount = 60;
        let attempts = 0;

        while (this.rockLocations.length < targetCount && attempts < 1400) {
            attempts++;
            const x = Phaser.Math.Between(55, MAP_WIDTH - 55);
            const y = Phaser.Math.Between(80, MAP_HEIGHT - 80);

            // Leave the cauldron and side spawn lanes clear, including giant tree canopies.
            if (Math.hypot(x - DRAGON_ALTAR.x, y - DRAGON_ALTAR.y) < 150) continue;
            if (Phaser.Math.Distance.Between(x, y, WITCH_ALTAR_X, WITCH_ALTAR_Y) < 185) continue;

            // Avoid North-West Zombie Altar clearing (260, 240)
            if (Phaser.Math.Distance.Between(x, y, ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y) < 125) continue;

            // Avoid South-East Werewolf Altar clearing (1660, 1040)
            if (Phaser.Math.Distance.Between(x, y, WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y) < 125) continue;

            // Avoid South-West Vendor clearing (260, 1060)
            if (Phaser.Math.Distance.Between(x, y, VENDOR_X, VENDOR_Y) < 135) continue;

            // Avoid player initial spawn position (Center at 960, 640)
            if (Phaser.Math.Distance.Between(x, y, PLAYER_SPAWN_X, PLAYER_SPAWN_Y) < 95) continue;

            // Avoid North Portal clearing (960, 80)
            if (Phaser.Math.Distance.Between(x, y, PORTAL_MEADOW_X, PORTAL_MEADOW_Y) < 80) continue;

            // Maintain distance from existing tree trunks so paths stay open
            const nearTree = this.treeLocations.some(t => Phaser.Math.Distance.Between(x, y, t.x, t.y) < 48);
            if (nearTree) continue;

            // Maintain distance from giant trees
            const nearGiant = this.giantTreeLocations.some(g => Phaser.Math.Distance.Between(x, y, g.x, g.y) < 68);
            if (nearGiant) continue;

            // Maintain distance between rocks so paths stay open
            const nearRock = this.rockLocations.some(r => Phaser.Math.Distance.Between(x, y, r.x, r.y) < 44);
            if (nearRock) continue;

            this.rockLocations.push({ x, y });

            // Cycle through terracotta, gray, olive variants with alternating models
            const variant = variants[this.rockLocations.length % variants.length];
            const useAlt = (Math.floor(this.rockLocations.length / variants.length) % 2) === 1;
            const chosenFrame = useAlt ? variant.altFrame : variant.frame;

            const rock = this.rocks.create(x, y, 'rocks', chosenFrame) as Phaser.Physics.Arcade.Sprite;
            rock.setOrigin(0.5, 1);
            rock.setDepth(y);

            // Rock collision accommodation:
            // The rock sprite is 32x32 with origin (0.5, 1).
            // A static body in Phaser needs setSize/setOffset matching the rock's base footprint (20x11 at offset 6, 18),
            // followed by body.reset() to correctly recalculate and reposition the static body in Arcade physics!
            const body = rock.body as Phaser.Physics.Arcade.StaticBody;
            body.setSize(20, 11);
            body.setOffset(6, 18);
            body.reset();
        }
    };

    createBushes = () => {
        this.bushes = this.scene.physics.add.staticGroup();
        this.bushLocations = [];

        //  3 distinct animated bush variants:
        //  - Ruby Berry Bramble (sway-berry)
        //  - Golden Jasmine Bush (sway-flower)
        //  - Amethyst Heather Bush (sway-lavender)
        const variants = [
            { anim: 'bushes-sway-berry', frame: 'berry-1', name: 'Ruby Berry Bramble' },
            { anim: 'bushes-sway-flower', frame: 'flower-1', name: 'Golden Jasmine' },
            { anim: 'bushes-sway-lavender', frame: 'lavender-1', name: 'Amethyst Heather' }
        ];

        const targetCount = 72;
        let attempts = 0;

        while (this.bushLocations.length < targetCount && attempts < 1500) {
            attempts++;
            const x = Phaser.Math.Between(55, MAP_WIDTH - 55);
            const y = Phaser.Math.Between(80, MAP_HEIGHT - 80);

            // Leave the cauldron and side spawn lanes clear, including giant tree canopies.
            if (Math.hypot(x - DRAGON_ALTAR.x, y - DRAGON_ALTAR.y) < 150) continue;
            if (Phaser.Math.Distance.Between(x, y, WITCH_ALTAR_X, WITCH_ALTAR_Y) < 185) continue;

            // Avoid North-West Zombie Altar clearing (260, 240)
            if (Phaser.Math.Distance.Between(x, y, ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y) < 125) continue;

            // Avoid South-East Werewolf Altar clearing (1660, 1040)
            if (Phaser.Math.Distance.Between(x, y, WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y) < 125) continue;

            // Avoid South-West Vendor clearing (260, 1060)
            if (Phaser.Math.Distance.Between(x, y, VENDOR_X, VENDOR_Y) < 135) continue;

            // Avoid player initial spawn position (Center at 960, 640)
            if (Phaser.Math.Distance.Between(x, y, PLAYER_SPAWN_X, PLAYER_SPAWN_Y) < 95) continue;

            // Avoid North Portal clearing (960, 80)
            if (Phaser.Math.Distance.Between(x, y, PORTAL_MEADOW_X, PORTAL_MEADOW_Y) < 80) continue;

            // Maintain distance from existing tree trunks so paths stay open
            const nearTree = this.treeLocations.some(t => Phaser.Math.Distance.Between(x, y, t.x, t.y) < 46);
            if (nearTree) continue;

            // Maintain distance from giant trees
            const nearGiant = this.giantTreeLocations.some(g => Phaser.Math.Distance.Between(x, y, g.x, g.y) < 65);
            if (nearGiant) continue;

            // Maintain distance from existing rocks so paths stay open
            const nearRock = this.rockLocations.some(r => Phaser.Math.Distance.Between(x, y, r.x, r.y) < 40);
            if (nearRock) continue;

            // Maintain distance between bushes so clumps are natural and navigable
            const nearBush = this.bushLocations.some(b => Phaser.Math.Distance.Between(x, y, b.x, b.y) < 36);
            if (nearBush) continue;

            this.bushLocations.push({ x, y });

            // Cycle through the 3 variants evenly
            const variant = variants[this.bushLocations.length % variants.length];

            const bush = this.bushes.create(x, y, 'bushes', variant.frame) as Phaser.Physics.Arcade.Sprite;
            bush.setOrigin(0.5, 1);
            bush.play(variant.anim);
            bush.anims.setProgress(Math.random());
            bush.setDepth(y);

            // Bush collision accommodation:
            // Sized and offset matching base footprint (20x10 at offset 6, 19) with body.reset()!
            const body = bush.body as Phaser.Physics.Arcade.StaticBody;
            body.setSize(20, 10);
            body.setOffset(6, 19);
            body.reset();
        }
    };

    updateDepths = () => {
        //  Dynamic Y-Sorting Depth
        //  Entities with lower Y render behind; entities with higher Y render in front.
        this.scene.playerController.player.setDepth(this.scene.playerController.player.y);
        this.scene.altars.altar.setDepth(this.scene.altars.altar.y);
        this.scene.altars.wolfAltar.setDepth(this.scene.altars.wolfAltar.y);
        if (this.scene.shop.vendor) {
            this.scene.shop.vendor.setDepth(this.scene.shop.vendor.y);
        }
        if (this.scene.boss.dragon && this.scene.boss.dragon.active) {
            this.scene.boss.dragon.setDepth(this.scene.boss.dragon.y);
        }

        this.scene.enemies.zombies.getChildren().forEach((obj: Phaser.GameObjects.GameObject) => {
            const zombie = obj as Phaser.Physics.Arcade.Sprite;
            if (zombie.active) {
                zombie.setDepth(zombie.y);
            }
        });

    };
}
