import { Scene } from 'phaser';

import { FIRE_RATE, GAME_HEIGHT, GAME_WIDTH, PLAYER_SPEED } from '../constants';

export class GameScene extends Scene
{
    player: Phaser.Physics.Arcade.Image;

    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    wasd: Record<'up' | 'left' | 'down' | 'right', Phaser.Input.Keyboard.Key>;

    fireDelay: number = 0;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        //  Player. The temporary 'ship' texture is generated in the Boot Scene.
        //  Replace with your loaded sprite once you have art, e.g.:
        //  this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'player');
        this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ship');
        this.player.setCollideWorldBounds(true);

        //  TODO: bullets — create a Phaser.Physics.Arcade.Group as a pool and
        //  fire from `this.player` with BULLET_SPEED, respecting FIRE_RATE.

        //  TODO: enemies — add a spawn system (waves) and check collisions
        //  between bullets/enemies and enemies/player via `this.physics.add.overlap`.

        //  Input: arrow keys plus WASD. The Keyboard plugin is enabled by
        //  default, so assert non-null for the type checker.
        const keyboard = this.input.keyboard!;

        const keys = Phaser.Input.Keyboard.KeyCodes;

        this.cursors = keyboard.createCursorKeys();
        this.wasd = {
            up: keyboard.addKey(keys.W),
            left: keyboard.addKey(keys.A),
            down: keyboard.addKey(keys.S),
            right: keyboard.addKey(keys.D)
        };
    }

    update (time: number)
    {
        //  Movement (WASD + arrow keys). TODO: replace with your own controls.
        const left = this.cursors.left.isDown || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up = this.cursors.up.isDown || this.wasd.up.isDown;
        const down = this.cursors.down.isDown || this.wasd.down.isDown;

        this.player.setVelocity(
            (right ? 1 : 0) * PLAYER_SPEED - (left ? 1 : 0) * PLAYER_SPEED,
            (down ? 1 : 0) * PLAYER_SPEED - (up ? 1 : 0) * PLAYER_SPEED
        );

        //  Face the direction of travel (sprite art faces right by default).
        if (left !== right)
        {
            this.player.setFlipX(left);
        }

        //  Firing (space bar), respecting the fire rate cooldown.
        if (this.cursors.space.isDown && time > this.fireDelay)
        {
            //  TODO: spawn a bullet from the pool moving at BULLET_SPEED here.
            this.fireDelay = time + FIRE_RATE;
        }
    }
}
