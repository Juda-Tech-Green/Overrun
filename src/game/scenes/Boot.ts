import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        //  The Boot Scene is typically used to load in any assets you require
        //  for your Preloader, such as a game logo or a loading bar image.
        //  The smaller the file size, the better, as the Boot Scene itself
        //  has no preloader.

        // Example (once you have files in public/assets):
        // this.load.image('preloader-bar', 'assets/sprites/preloader-bar.png');
    }

    create ()
    {
        //  Placeholder ship texture, generated at runtime, so the game is
        //  playable before any art files exist. Delete this once you load a
        //  real sprite in the Preloader.
        const g = this.add.graphics();

        g.fillStyle(0x00ffcc, 1);
        g.fillRect(0, 0, 32, 32);

        g.generateTexture('ship', 32, 32);
        g.destroy();

        this.scene.start('Preloader');
    }
}
