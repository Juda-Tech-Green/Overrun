import { interactionPressed, INTERACTION_RANGE } from '../interaction';
import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import {
    MAP_HEIGHT,
    MAP_WIDTH,
    PORTAL_MEADOW_X,
    PORTAL_MEADOW_Y,
    CASTLE_ORIGIN_X,
    CASTLE_ORIGIN_Y,
    CASTLE_TILES_X,
    CASTLE_TILES_Y,
    CASTLE_TILE_SIZE,
    CASTLE_WIDTH,
    CASTLE_HEIGHT,
    CASTLE_SPAWN_X,
    CASTLE_SPAWN_Y,
    PORTAL_CASTLE_X,
    PORTAL_CASTLE_Y
} from '../constants';

export const CASTLE_BLUEPRINT: string[] = [
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 0: Solid North Outer Wall
    'W......W...C..T..T..C...W......W', // 1: North Wing
    'W.S..P.W................W.P..S.W', // 2: Cell 1, North Vault, Cell 2
    'W......W...P........P...W......W', // 3
    'W.S....W................W....S.W', // 4
    'WWWBDBWWWWWW..T..T..WWWWWWWBDBWW', // 5: Cell 1 & 2 front with bars & doors
    'W..........W........W..........W', // 6: Upper corridor
    'W..........W........W..........W', // 7
    'WWWW.WWWWWWWW......WWWWWWWW.WWWW', // 8: Mid wing division
    'W......W...W........W...W......W', // 9: Mid cells (Cell 3 & 4)
    'W.S..P.B...T...P....T...B.P..S.W', // 10
    'W......D................D......W', // 11
    'W.S....B...T...P....T...B....S.W', // 12
    'WWWW.WWWWWWWW......WWWWWWWW.WWWW', // 13: South wing division
    'W......W...W........W...W......W', // 14: South cells (Cell 5 & 6)
    'W.P..S.B...T........T...B.S..P.W', // 15
    'W......D................D......W', // 16
    'W....S.B...T...P....T...B.S....W', // 17
    'WWWBDBWWWWWW..T..T..WWWWWWWBDBWW', // 18: Cell 5 & 6 front with bars & doors
    'W..............................W', // 19: Grand Courtyard
    'W...C......T........T......C...W', // 20: Torch-lit entrance hall
    'W......P................P......W', // 21
    'WWWWWWWWWWWWWW....WWWWWWWWWWWWWW', // 22: South Outer Wall with Gate
    'WWWWWWWWWWWWWW....WWWWWWWWWWWWWW', // 23
];

export class CastleSystem {
    constructor(private readonly scene: GameScene) {}

    meadowPortal: Phaser.GameObjects.Sprite | null = null;

    castlePortal: Phaser.GameObjects.Sprite | null = null;

    meadowPrompt: Phaser.GameObjects.Text | null = null;

    castlePrompt: Phaser.GameObjects.Text | null = null;

    solidObstacles: Phaser.Physics.Arcade.StaticGroup;

    floorTiles: Phaser.GameObjects.Group;

    decorations: Phaser.GameObjects.Group;

    portalUnlocked = false;
    meadowBadge: Phaser.GameObjects.Sprite | null = null;

    currentZone: 'meadow' | 'castle' = 'meadow';

    teleportCooldown: number = 0;

    isNearMeadowPortal: boolean = false;

    isNearCastlePortal: boolean = false;

    reset = () => {
        this.portalUnlocked=false;
        this.meadowBadge=null;
        this.currentZone = 'meadow';
        this.teleportCooldown = 0;
        this.isNearMeadowPortal = false;
        this.isNearCastlePortal = false;
        this.meadowPortal = null;
        this.castlePortal = null;
        this.meadowPrompt = null;
        this.castlePrompt = null;
    };

    create = () => {
        this.createMeadowPortal();
        this.buildCastle();
        this.createCastlePortal();
    };

    createMeadowPortal = () => {
        // Mystical teleporter archway at the top of Meadow
        this.meadowPortal = this.scene.add.sprite(PORTAL_MEADOW_X, PORTAL_MEADOW_Y, 'portal-progress', 'portal-locked');
        this.meadowPortal.setOrigin(0.5, 1);
        this.meadowPortal.setDepth(PORTAL_MEADOW_Y);
        this.meadowBadge=this.scene.add.sprite(PORTAL_MEADOW_X,PORTAL_MEADOW_Y-84,'portal-progress','prompt-portal-locked').setDepth(2000).setVisible(false);

        // Floating interaction prompt
        this.meadowPrompt = this.scene.add.text(PORTAL_MEADOW_X, PORTAL_MEADOW_Y - 56, 'Locked: Requires Portal Key', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#66ccff',
            stroke: '#0a0a1a',
            strokeThickness: 3
        });
        this.meadowPrompt.setOrigin(0.5, 0.5);
        this.meadowPrompt.setDepth(2000);
        this.meadowPrompt.setVisible(false);
    };

    createCastlePortal = () => {
        // Return teleporter archway inside the Castle South Gate
        this.castlePortal = this.scene.add.sprite(PORTAL_CASTLE_X, PORTAL_CASTLE_Y, 'portal', 'frame-0');
        this.castlePortal.setOrigin(0.5, 1);
        this.castlePortal.setDepth(PORTAL_CASTLE_Y);
        this.castlePortal.play('portal-idle');

        // Floating interaction prompt
        this.castlePrompt = this.scene.add.text(PORTAL_CASTLE_X, PORTAL_CASTLE_Y - 56, '🌿 [E] Return to Meadow', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#44ff88',
            stroke: '#0a0a1a',
            strokeThickness: 3
        });
        this.castlePrompt.setOrigin(0.5, 0.5);
        this.castlePrompt.setDepth(2000);
        this.castlePrompt.setVisible(false);
    };

    buildCastle = () => {
        this.solidObstacles = this.scene.physics.add.staticGroup();
        this.floorTiles = this.scene.add.group();
        this.decorations = this.scene.add.group();

        for (let row = 0; row < CASTLE_TILES_Y; row++) {
            const line = CASTLE_BLUEPRINT[row] || '';
            for (let col = 0; col < CASTLE_TILES_X; col++) {
                const char = line[col] || '.';
                const x = CASTLE_ORIGIN_X + col * CASTLE_TILE_SIZE;
                const y = CASTLE_ORIGIN_Y + row * CASTLE_TILE_SIZE;
                const stagger = ((col * 7 + row * 13) % 100) / 100;

                // 1. Every grid slot receives base prison-floor
                const floor = this.scene.add.sprite(x, y, 'prison-floor', 'frame-0');
                floor.setOrigin(0, 0);
                floor.setDepth(1);
                floor.play('prison-floor-idle');
                floor.anims.setProgress(stagger);
                this.floorTiles.add(floor);

                // 2. Feature elements based on blueprint char
                if (char === 'W') {
                    // Solid Stone Wall with seepage drips
                    const wall = this.solidObstacles.create(x, y, 'prison-wall', 'frame-0') as Phaser.Physics.Arcade.Sprite;
                    wall.setOrigin(0, 0);
                    wall.setDepth(y + CASTLE_TILE_SIZE);
                    wall.play('prison-wall-drip');
                    wall.anims.setProgress(stagger);
                    const body = wall.body as Phaser.Physics.Arcade.StaticBody;
                    body.setSize(CASTLE_TILE_SIZE, CASTLE_TILE_SIZE);
                    body.setOffset(0, 0);
                    body.reset();
                } else if (char === 'B') {
                    // Solid Iron Cell Bars (16x32 placed side by side to cover 32px slot)
                    for (const offset of [0, 16]) {
                        const bars = this.solidObstacles.create(x + offset, y, 'prison-bars', 'frame-0') as Phaser.Physics.Arcade.Sprite;
                        bars.setOrigin(0, 0);
                        bars.setDepth(y + CASTLE_TILE_SIZE);
                        bars.play('prison-bars-rattle');
                        bars.anims.setProgress(stagger);
                        const body = bars.body as Phaser.Physics.Arcade.StaticBody;
                        body.setSize(16, CASTLE_TILE_SIZE);
                        body.setOffset(0, 0);
                        body.reset();
                    }
                } else if (char === 'D') {
                    // Solid Heavy Wooden Prison Door
                    const door = this.solidObstacles.create(x, y, 'prison-door', 'frame-0') as Phaser.Physics.Arcade.Sprite;
                    door.setOrigin(0, 0);
                    door.setDepth(y + CASTLE_TILE_SIZE);
                    door.play('prison-door-idle');
                    door.anims.setProgress(stagger);
                    const body = door.body as Phaser.Physics.Arcade.StaticBody;
                    body.setSize(CASTLE_TILE_SIZE, CASTLE_TILE_SIZE);
                    body.setOffset(0, 0);
                    body.reset();
                } else if (char === 'P') {
                    // Stagnant Water Puddle with expanding ripples
                    const puddle = this.scene.add.sprite(x, y, 'prison-puddle', 'frame-0');
                    puddle.setOrigin(0, 0);
                    puddle.setDepth(2);
                    puddle.play('prison-puddle-ripple');
                    puddle.anims.setProgress(stagger);
                    this.decorations.add(puddle);
                } else if (char === 'S') {
                    // Straw Bedding Heap
                    const straw = this.scene.add.sprite(x, y, 'prison-straw', 'frame-0');
                    straw.setOrigin(0, 0);
                    straw.setDepth(2);
                    straw.play('prison-straw-settle');
                    straw.anims.setProgress(stagger);
                    this.decorations.add(straw);
                } else if (char === 'T') {
                    // Wall Mounted Flickering Torch
                    const torch = this.scene.add.sprite(x + 8, y, 'prison-torch', 'frame-0');
                    torch.setOrigin(0, 0);
                    torch.setDepth(y + CASTLE_TILE_SIZE + 2);
                    torch.play('prison-torch-flicker');
                    torch.anims.setProgress(stagger);
                    this.decorations.add(torch);
                } else if (char === 'C') {
                    // Swaying Hanging Iron Chains
                    const chains = this.scene.add.sprite(x + 8, y, 'prison-chains', 'frame-0');
                    chains.setOrigin(0, 0);
                    chains.setDepth(y + CASTLE_TILE_SIZE + 2);
                    chains.play('prison-chains-sway');
                    chains.anims.setProgress(stagger);
                    this.decorations.add(chains);
                }
            }
        }
    };

    setPortalUnlocked = (unlocked: boolean) => {
        if (this.portalUnlocked === unlocked) return;
        if (unlocked) this.scene.audio?.play('portal-unlock-turn');
        this.portalUnlocked = unlocked;
        if (unlocked) this.meadowPortal?.setTexture('portal', 'frame-0').play('portal-idle');
        else this.meadowPortal?.stop().setTexture('portal-progress', 'portal-locked');
    };
    setNetworkPosition = (x: number, y: number, zone: 'meadow' | 'castle') => {
        if (zone !== this.currentZone) this.scene.audio?.play('portal-teleport');
        this.currentZone = zone;
        this.scene.playerController.player.setPosition(x, y);
        if (zone === 'castle') this.scene.cameras.main.setBounds(CASTLE_ORIGIN_X, CASTLE_ORIGIN_Y, CASTLE_WIDTH, CASTLE_HEIGHT);
        else this.scene.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    };
    teleportToCastle = () => {
        if(this.scene.network?.isGuest)return;
        if (!this.portalUnlocked || this.scene.inventory?.isOpen) return;
        if (this.scene.playerController.isPlayerDead) return;
        const now = this.scene.time.now;
        if (now < this.teleportCooldown) return;
        this.scene.audio?.play('portal-teleport');
        this.teleportCooldown = now + 1200;

        this.currentZone = 'castle';
        this.scene.playerController.player.setPosition(CASTLE_SPAWN_X, CASTLE_SPAWN_Y);
        this.scene.cameras.main.setBounds(CASTLE_ORIGIN_X, CASTLE_ORIGIN_Y, CASTLE_WIDTH, CASTLE_HEIGHT);
        this.scene.cameras.main.flash(350, 60, 180, 240);

        if (this.scene.companion?.dog) {
            this.scene.companion.dog.setPosition(CASTLE_SPAWN_X - 30, CASTLE_SPAWN_Y);
        }

        this.scene.hud?.flashProximityAlert?.('🏰 Entered the Castle Prison', '#66ccff');
        this.scene.chat?.addChatMessage?.('System', 'You stepped through the arcane portal into the ancient Castle Prison...', '#66ccff');
    };

    teleportToMeadow = () => {
        if(this.scene.network?.isGuest)return;
        if (this.scene.playerController.isPlayerDead) return;
        const now = this.scene.time.now;
        if (now < this.teleportCooldown) return;
        this.scene.audio?.play('portal-teleport');
        this.teleportCooldown = now + 1200;

        this.currentZone = 'meadow';
        this.scene.playerController.player.setPosition(PORTAL_MEADOW_X, PORTAL_MEADOW_Y + 50);
        this.scene.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
        this.scene.cameras.main.flash(350, 80, 220, 140);

        if (this.scene.companion?.dog) {
            this.scene.companion.dog.setPosition(PORTAL_MEADOW_X - 30, PORTAL_MEADOW_Y + 50);
        }

        this.scene.hud?.flashProximityAlert?.('🌿 Returned to Meadow', '#44ff88');
        this.scene.chat?.addChatMessage?.('System', 'You returned safely to the Meadow.', '#44ff88');
    };

    update = (_time: number) => {
        if (this.scene.network?.blocked) return;
        this.meadowBadge?.setVisible(false);
        const player = this.scene.playerController.player;
        if (!player || this.scene.playerController.isPlayerDead) {
            this.meadowPrompt?.setVisible(false);
            this.castlePrompt?.setVisible(false);
            return;
        }

        const isModalOpen = this.scene.inventory?.isOpen || this.scene.menu.isMenuOpen || this.scene.shop.isShopOpen || this.scene.chat.isChatOpen;
        if (isModalOpen) {
            this.meadowPrompt?.setVisible(false);
            this.castlePrompt?.setVisible(false);
            return;
        }

        if (this.currentZone === 'meadow') {
            const distance = Phaser.Math.Distance.Between(player.x, player.y, PORTAL_MEADOW_X, PORTAL_MEADOW_Y - 16);
            this.isNearMeadowPortal = distance < INTERACTION_RANGE.portal;
            this.meadowPrompt?.setVisible(this.isNearMeadowPortal);
            this.meadowPrompt?.setText(this.portalUnlocked?'[E] Enter Flooded Realm':this.scene.inventory?.hasPortalKey?'[E] Unlock Flooded Realm':'Locked: Requires Portal Key');
            this.meadowBadge?.setFrame(this.portalUnlocked || this.scene.inventory?.hasPortalKey?'prompt-portal-enter':'prompt-portal-locked').setVisible(this.isNearMeadowPortal);
            this.castlePrompt?.setVisible(false);

            if(this.scene.network?.isGuest)return;
            if (this.isNearMeadowPortal && interactionPressed(this.scene, this.portalUnlocked?'enter':'portal')) {
                if (!this.portalUnlocked && this.scene.inventory?.hasPortalKey) {
                    this.setPortalUnlocked(true);
                    this.meadowPortal?.setTexture('portal','frame-0').play('portal-idle');
                }
                if(this.portalUnlocked)this.teleportToCastle();
                else { this.scene.audio?.play('portal-locked-rattle'); this.scene.hud.flashProximityAlert('Locked: Requires Portal Key','#ffe09a'); }
            }
        } else {
            const distance = Phaser.Math.Distance.Between(player.x, player.y, PORTAL_CASTLE_X, PORTAL_CASTLE_Y - 16);
            this.isNearCastlePortal = distance < INTERACTION_RANGE.portal;
            this.castlePrompt?.setVisible(this.isNearCastlePortal);
            this.meadowPrompt?.setVisible(false);

            if(this.scene.network?.isGuest)return;
            const pressedE = interactionPressed(this.scene, 'return');
            if (distance < 28 || (this.isNearCastlePortal && pressedE)) {
                this.teleportToMeadow();
            }
        }
    };
}
