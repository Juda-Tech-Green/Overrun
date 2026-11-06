import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';

(window as any).Phaser = Phaser;

import { Boot } from './scenes/Boot';
import { GameScene } from './scenes/Game';
import { Preloader } from './scenes/Preloader';

import { BACKGROUND_COLOR, GAME_HEIGHT, GAME_TITLE, GAME_WIDTH } from './constants';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    title: GAME_TITLE,
    type: AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: BACKGROUND_COLOR,
    //  Crisp pixels, no anti-aliasing — remove if your art isn't pixel art.
    pixelArt: true,
    input: { activePointers: 3 },
    scale: {
        mode: Phaser.Scale.RESIZE,
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
    const game = new Game({ ...config, parent });
    const container = document.getElementById(parent);
    // Measure after layout settles, including mobile orientation changes.
    if (container && typeof ResizeObserver !== 'undefined') {
        const fit = () => {
            if (!game.isBooted) return;
            game.scale.getParentBounds();
            game.scale.refresh();
        };
        const observer = new ResizeObserver(fit);
        observer.observe(container);
        game.events.once('ready', fit);
        game.events.once('destroy', () => observer.disconnect());
    }
    return game;

}

export default StartGame;
