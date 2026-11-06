import type * as Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { DEATH_PRESENTATIONS, type DeathCause } from '../death-causes';

/** Camera-fixed pixel-art layouts, selected by the fatal damage source. */
export class DeathScreenSystem {
    constructor(private readonly scene: GameScene) {}

    container: Phaser.GameObjects.Container;
    panel: Phaser.GameObjects.Sprite;
    title: Phaser.GameObjects.Text;
    causeLabel: Phaser.GameObjects.Text;

    create = () => {
        this.container = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2)
            .setScrollFactor(0).setDepth(40000).setVisible(false);
        const dimmer = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x06070c, 0.78).setScrollFactor(0).setInteractive();
        this.panel = this.scene.add.sprite(0, 0, 'death-screen', 'death-zombie').setScale(2);
        this.title = this.scene.add.text(0, 24, '', {
            fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold',
            color: '#ffffff', stroke: '#08090e', strokeThickness: 4
        }).setOrigin(0.5);
        this.causeLabel = this.scene.add.text(0, 72, '', {
            fontFamily: 'monospace', fontSize: '16px', color: '#d9dfd6',
            stroke: '#08090e', strokeThickness: 2
        }).setOrigin(0.5);
        const restart = this.scene.add.text(0, 136, 'Press SPACE or R to Restart', {
            fontFamily: 'monospace', fontSize: '16px', color: '#f3f2dd',
            stroke: '#08090e', strokeThickness: 2
        }).setOrigin(0.5);
        this.container.add([dimmer, this.panel, this.title, this.causeLabel, restart]);
        this.container.setScrollFactor(0, 0, true);
    };

    show = (cause: DeathCause) => {
        this.scene.audio?.play('ui-game-over-stinger');
        const presentation = DEATH_PRESENTATIONS[cause];
        const hero = this.scene.playerController.currentCharacter === 'heroine' ? 'SCHOLAR' : 'SURVIVOR';
        this.panel.setFrame(presentation.frame);
        this.title.setText(presentation.title).setColor(presentation.color);
        this.causeLabel.setText(`${hero} DOWN · ${presentation.killer}`);
        this.container.setVisible(true);
    };
}
