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
        //  Load your game assets here, then uncomment the lines below once you
        //  have files in public/assets:

        // this.load.setPath('assets/sprites');
        // this.load.image('player', 'player.png');
        // this.load.spritesheet('explosion', 'explosion.png', { frameWidth: 32, frameHeight: 32 });
        // this.load.audio('shoot', 'assets/audio/shoot.ogg');
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
