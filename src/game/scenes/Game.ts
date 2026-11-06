import { AudioSystem } from '../systems/AudioSystem';
import { NetworkSystem } from '../systems/NetworkSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { LootSystem } from '../systems/LootSystem';
import { RitualSystem } from '../systems/RitualSystem';
import { Scene } from 'phaser';
import { MAP_HEIGHT, MAP_WIDTH, TOTAL_WORLD_HEIGHT, TOTAL_WORLD_WIDTH } from '../constants';
import { WorldSystem } from '../systems/WorldSystem';
import { AnimationsSystem } from '../systems/AnimationsSystem';
import { PlayerControllerSystem } from '../systems/PlayerControllerSystem';
import { WeaponsSystem } from '../systems/WeaponsSystem';
import { EnemiesSystem } from '../systems/EnemiesSystem';
import { AltarsSystem } from '../systems/AltarsSystem';
import { DeathScreenSystem } from '../systems/DeathScreenSystem';
import { HudSystem } from '../systems/HudSystem';
import { MenuSystem } from '../systems/MenuSystem';
import { ShopSystem } from '../systems/ShopSystem';
import { CollisionsSystem } from '../systems/CollisionsSystem';
import { ControlsSystem } from '../systems/ControlsSystem';
import { ChatSystem } from '../systems/ChatSystem';
import { BossSystem } from '../systems/BossSystem';
import { GameplaySystem } from '../systems/GameplaySystem';
import { WitchSystem } from '../systems/WitchSystem';
import { CompanionSystem } from '../systems/CompanionSystem';
import { CastleSystem } from '../systems/CastleSystem';
import { MobileControlsSystem } from '../systems/MobileControlsSystem';
import { ViewportSystem } from '../systems/ViewportSystem';
import { AimingSystem } from '../systems/AimingSystem';

export { ZOMBIE_VARIANTS, type ZombieVariantConfig } from '../systems/enemy-variants';

/** Composition root. Feature state and behavior live in systems; see docs/game-architecture.md. */
export class GameScene extends Scene {
    readonly audio = new AudioSystem(this);
    readonly world = new WorldSystem(this);
    readonly animations = new AnimationsSystem(this);
    readonly castle = new CastleSystem(this);
    readonly playerController = new PlayerControllerSystem(this);
    readonly weapons = new WeaponsSystem(this);
    readonly enemies = new EnemiesSystem(this);
    readonly altars = new AltarsSystem(this);
    readonly hud = new HudSystem(this);
    readonly deathScreen = new DeathScreenSystem(this);
    readonly menu = new MenuSystem(this);
    readonly shop = new ShopSystem(this);
    readonly collisions = new CollisionsSystem(this);
    readonly controls = new ControlsSystem(this);
    readonly mobileControls = new MobileControlsSystem(this);
    readonly viewport = new ViewportSystem(this);
    readonly aiming = new AimingSystem(this);
    readonly chat = new ChatSystem(this);
    readonly boss = new BossSystem(this);
    readonly gameplay = new GameplaySystem(this);
    readonly companion = new CompanionSystem(this);

    readonly witches = new WitchSystem(this);

    readonly network = new NetworkSystem(this);
    readonly inventory = new InventorySystem(this);
    readonly loot = new LootSystem(this);
    readonly ritual = new RitualSystem(this);

    score: number = 0;

    constructor() {
        super('Game');
    }

    create() {
        this.audio.reset();
        this.network.reset();
        this.score = 0;
        this.inventory.reset();
        this.loot.reset();
        this.ritual.reset();
        this.aiming.reset();
        this.viewport.reset();
        this.mobileControls.reset();
        this.witches.reset();
        this.castle.reset();
        this.playerController.reset();
        this.companion.reset();
        this.weapons.reset();
        this.altars.reset();
        this.menu.reset();
        this.hud.reset();
        this.boss.reset();
        this.chat.reset();
        this.shop.reset();

        this.animations.registerAnimations();
        this.world.createMap();
        this.world.createTrees();
        this.world.createGiantTrees();
        this.world.createRocks();
        this.world.createBushes();
        this.castle.create();
        this.altars.createAltar();
        this.shop.createVendor();
        this.playerController.createPlayer();
        this.companion.create();
        this.weapons.createBullets();
        this.enemies.createZombies();
        this.witches.create();
        this.ritual.create();
        this.collisions.setupCollisions();
        this.controls.setupInput();
        this.altars.setupAutoSpawner();
        this.hud.createHUD();
        this.deathScreen.create();
        this.shop.createShopMenu();
        this.chat.createChatUI();
        this.inventory.create();
        this.mobileControls.create();
        this.aiming.create();
        this.viewport.create();

        this.physics.world.setBounds(0, 0, TOTAL_WORLD_WIDTH, TOTAL_WORLD_HEIGHT);
        this.cameras.main.startFollow(this.playerController.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
        this.audio.create();
        this.network.create();
    }

    update(time: number, delta: number) {
        this.mobileControls.update();
        this.gameplay.update(time);
        this.network.updateHostSimulation(time);
        this.witches.update(time);
        this.castle.update(time);
        this.companion.update(delta);
        this.loot.update(delta);
        this.ritual.update(delta);
        this.network.update(time, delta);
        this.aiming.update();
        this.viewport.update();
        this.audio.update(time);
    }
}
