import { AUTO, Game } from 'phaser';

import { Boot } from './scenes/Boot';
import { GameScene } from './scenes/Game';
import { Preloader } from './scenes/Preloader';

import { BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH } from './constants';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: BACKGROUND_COLOR,
    //  Crisp pixels, no anti-aliasing — remove if your art isn't pixel art.
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            //  Top-down action: no gravity.
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [
        Boot,
        Preloader,
        GameScene
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
