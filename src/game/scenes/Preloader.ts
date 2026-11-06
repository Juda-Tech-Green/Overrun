import { AUDIO_BUNDLES } from '../audio-catalog';
import { loadPixelForgeAudio } from '@pixelforge/phaser';
import { Scene } from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  A simple progress bar: this is the outline of the bar.
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the
        //  left based on the % of progress.
        const bar = this.add.rectangle(GAME_WIDTH / 2 - 230, GAME_HEIGHT / 2, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the
        //  loading bar. With no files queued (yet), the bar simply stays empty
        //  and the scene advances immediately.
        this.load.on('progress', (progress: number) => {

            //  100% = 464px
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        this.load.setPath('');
        for (const bundle of AUDIO_BUNDLES) loadPixelForgeAudio(this, bundle);
        //  Grass tiles + map
        this.load.setPath('assets/grass');
        this.load.spritesheet('grass-tiles', 'tiles.png', { frameWidth: 16, frameHeight: 16 });
        this.load.tilemapTiledJSON('grass-map', 'map.json');

        //  Player atlas
        this.load.setPath('assets/player');
        this.load.atlas('player', 'player.png', 'player.atlas.json');
        this.load.json('player-anim', 'player.animations.json');
        this.load.json('player-game', 'player.game.json');

        //  Heroine (reference character) atlas
        this.load.setPath('assets/heroine');
        this.load.atlas('heroine', 'heroine.png', 'heroine.atlas.json');
        this.load.json('heroine-anim', 'heroine.animations.json');
        this.load.json('heroine-game', 'heroine.game.json');

        // Cosmetic companion: complete eight-direction idle/walk atlas.
        this.load.setPath('assets/companion-dog');
        this.load.atlas('companion-dog', 'companion-dog.png', 'companion-dog.atlas.json');
        this.load.json('companion-dog-anim', 'companion-dog.animations.json');
        this.load.json('companion-dog-game', 'companion-dog.game.json');

        //  Bullet spritesheet
        this.load.setPath('assets/bullet');
        this.load.spritesheet('bullet', 'bullet.png', { frameWidth: 8, frameHeight: 3, endFrame: 1 });

        // Enemy bundles include side, front, back and 45-degree animation frames.
        //  Zombie atlas (classic)
        this.load.setPath('assets/zombie');
        this.load.atlas('zombie', 'zombie.png', 'zombie.atlas.json');
        this.load.json('zombie-anim', 'zombie.animations.json');
        this.load.json('zombie-game', 'zombie.game.json');

        //  Female Zombie atlas
        this.load.setPath('assets/zombie-female');
        this.load.atlas('zombie-female', 'zombie-female.png', 'zombie-female.atlas.json');
        this.load.json('zombie-female-anim', 'zombie-female.animations.json');
        this.load.json('zombie-female-game', 'zombie-female.game.json');

        //  Skeleton Zombie atlas
        this.load.setPath('assets/zombie-skeleton');
        this.load.atlas('zombie-skeleton', 'zombie-skeleton.png', 'zombie-skeleton.atlas.json');
        this.load.json('zombie-skeleton-anim', 'zombie-skeleton.animations.json');
        this.load.json('zombie-skeleton-game', 'zombie-skeleton.game.json');

        // Blue zombie atlas includes the animated electric halo in every direction/action.
        this.load.setPath('assets/zombie-blue');
        this.load.atlas('zombie-blue', 'zombie-blue.png', 'zombie-blue.atlas.json');
        this.load.json('zombie-blue-anim', 'zombie-blue.animations.json');
        this.load.json('zombie-blue-game', 'zombie-blue.game.json');

        //  Werewolf atlas
        this.load.setPath('assets/werewolf');
        this.load.atlas('werewolf', 'werewolf.png', 'werewolf.atlas.json');
        this.load.json('werewolf-anim', 'werewolf.animations.json');
        this.load.json('werewolf-game', 'werewolf.game.json');

        //  Albino Werewolf atlas (separate variant)
        this.load.setPath('assets/werewolf-albino');
        this.load.atlas('werewolf-albino', 'werewolf-albino.png', 'werewolf-albino.atlas.json');
        this.load.json('werewolf-albino-anim', 'werewolf-albino.animations.json');
        this.load.json('werewolf-albino-game', 'werewolf-albino.game.json');

        //  Altar atlas (Necromantic Stone)
        this.load.setPath('assets/altar');
        this.load.atlas('altar', 'altar.png', 'altar.atlas.json');
        this.load.json('altar-anim', 'altar.animations.json');
        this.load.json('altar-game', 'altar.game.json');

        //  Wolf Altar atlas (Blood Moon Totem)
        this.load.setPath('assets/altar-wolf');
        this.load.atlas('altar-wolf', 'altar-wolf.png', 'altar-wolf.atlas.json');
        this.load.json('altar-wolf-anim', 'altar-wolf.animations.json');
        this.load.json('altar-wolf-game', 'altar-wolf.game.json');

        //  Trees atlas (3 green variants with sway animations)
        this.load.setPath('assets/trees');
        this.load.atlas('trees', 'trees.png', 'trees.atlas.json');
        this.load.json('trees-anim', 'trees.animations.json');
        this.load.json('trees-game', 'trees.game.json');

        //  Giant Trees atlas (2 massive 128x192 variants: Ancient Emerald Oak & Celestial Sakura Elder)
        this.load.setPath('assets/trees-giant');
        this.load.atlas('trees-giant', 'trees-giant.png', 'trees-giant.atlas.json');
        this.load.json('trees-giant-anim', 'trees-giant.animations.json');
        this.load.json('trees-giant-game', 'trees-giant.game.json');

        //  Rocks atlas (3 variants: terracotta, gray, olive)
        this.load.setPath('assets/rocks');
        this.load.atlas('rocks', 'rocks.png', 'rocks.atlas.json');
        this.load.json('rocks-anim', 'rocks.animations.json');
        this.load.json('rocks-game', 'rocks.game.json');

        //  Bushes atlas (3 animated variants: ruby berry, golden flower, amethyst lavender)
        this.load.setPath('assets/bushes');
        this.load.atlas('bushes', 'bushes.png', 'bushes.atlas.json');
        this.load.json('bushes-anim', 'bushes.animations.json');
        this.load.json('bushes-game', 'bushes.game.json');

        //  HUD atlas (portraits, hearts, skulls, icons)
        this.load.setPath('assets/hud');
        this.load.atlas('hud', 'hud.png', 'hud.atlas.json');
        this.load.json('hud-game', 'hud.game.json');

        this.load.setPath('assets/mobile-controls');
        this.load.atlas('mobile-controls', 'mobile-controls.png', 'mobile-controls.atlas.json');
        this.load.json('mobile-controls-game', 'mobile-controls.game.json');

        //  Menu atlas (buttons, hover states, toggles, banner)
        this.load.setPath('assets/menu');
        this.load.atlas('menu', 'menu.png', 'menu.atlas.json');
        this.load.json('menu-game', 'menu.game.json');

        //  Dragon atlas (Ancient Crimson Dragon Boss - 512x512)
        this.load.setPath('assets/dragon');
        this.load.atlas('dragon', 'dragon.png', 'dragon.atlas.json');
        this.load.json('dragon-anim', 'dragon.animations.json');
        this.load.json('dragon-game', 'dragon.game.json');
        for (const view of ['front', 'front45', 'back', 'back45']) {
            const key = `dragon-${view}`;
            this.load.setPath(`assets/${key}`);
            this.load.atlas(key, `${key}.png`, `${key}.atlas.json`);
            this.load.json(`${key}-anim`, `${key}.animations.json`);
            this.load.json(`${key}-game`, `${key}.game.json`);
        }


        //  Vendor NPC atlas (48x64 Arms Dealer with idle animations)
        this.load.setPath('assets/vendor');
        this.load.atlas('vendor', 'vendor.png', 'vendor.atlas.json');
        this.load.json('vendor-anim', 'vendor.animations.json');
        this.load.json('vendor-game', 'vendor.game.json');

        //  Weapons atlas (Shotgun item & pellets)
        this.load.setPath('assets/weapons');
        this.load.atlas('weapons', 'weapons.png', 'weapons.atlas.json');
        this.load.json('weapons-game', 'weapons.game.json');

        // Authored witch views, cauldron altar and hostile potion animation bundle.
        for (const key of ['witch', 'witch-red', 'altar-witch', 'witch-potion', 'witch-potion-red']) {
            this.load.setPath(`assets/${key}`);
            this.load.atlas(key, `${key}.png`, `${key}.atlas.json`);
            this.load.json(`${key}-anim`, `${key}.animations.json`);
            this.load.json(`${key}-game`, `${key}.game.json`);
        }

        // Four static enemy-specific game-over layouts; text is rendered live.
        this.load.setPath('assets/death-screen');
        this.load.atlas('death-screen', 'death-screen.png', 'death-screen.atlas.json');
        this.load.json('death-screen-game', 'death-screen.game.json');

        //  Healing FX atlas (animated healing cross & particles)
        this.load.setPath('assets/heal-fx');
        this.load.atlas('heal-fx', 'heal-fx.png', 'heal-fx.atlas.json');
        this.load.json('heal-fx-anim', 'heal-fx.animations.json');
        this.load.json('heal-fx-game', 'heal-fx.game.json');

        // Portal and Castle Prison animated tileset bundles
        for (const key of ['portal', 'prison-floor', 'prison-wall', 'prison-bars', 'prison-puddle', 'prison-torch', 'prison-chains', 'prison-straw', 'prison-door']) {
            this.load.setPath(`assets/${key}`);
            this.load.atlas(key, `${key}.png`, `${key}.atlas.json`);
            this.load.json(`${key}-anim`, `${key}.animations.json`);
            this.load.json(`${key}-game`, `${key}.game.json`);
        }

        for (const key of ['items', 'altar-dragon', 'drowner', 'altar-drowner']) {
            this.load.setPath(`assets/${key}`);
            this.load.atlas(key, `${key}.png`, `${key}.atlas.json`);
            this.load.json(`${key}-anim`, `${key}.animations.json`);
            this.load.json(`${key}-game`, `${key}.game.json`);
        }
        this.load.setPath('assets/portal/progression');
        this.load.atlas('portal-progress', 'portal-progress.png', 'portal-progress.atlas.json');
        this.load.setPath('assets/audio');
        this.load.audio('dragon-roar', 'dragon-roar.wav');
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global
        //  objects here that the rest of the game can use, such as defining
        //  global animations.

        //  Move to the main game scene. You could also swap this for a Scene
        //  Transition, such as a camera fade.
        this.scene.start('Game');
    }
}
