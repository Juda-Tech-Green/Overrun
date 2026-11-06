import type { GameScene } from '../scenes/Game';
import * as Phaser from 'phaser';
import { GAME_HEIGHT } from '../constants';

export class ChatSystem {
    constructor(private readonly scene: GameScene) {}

    isChatOpen: boolean = false;

    chatInputText: string = '';

    chatMessages: Array<{ sender: string; text: string; color: string }> = [];

    chatContainer: Phaser.GameObjects.Container;

    chatLogText: Phaser.GameObjects.Text;

    chatInputDisplay: Phaser.GameObjects.Text;

    chatCursorBlinkEvent: Phaser.Time.TimerEvent | null = null;

    chatCursorVisible: boolean = true;

    createChatUI = () => {
        this.chatMessages = [
            { sender: 'System', text: 'Welcome! Press [Enter] to Chat.', color: '#a0aab8' },
            { sender: 'System', text: 'Craft a Portal Key [I], claim a Pearl, then offer at the northern Dragon Altar.', color: '#ffd56b' }
        ];

        this.chatContainer = this.scene.add.container(18, GAME_HEIGHT - 175).setScrollFactor(0).setDepth(20000);
        this.chatContainer.setVisible(false).setAlpha(0);

        // Glassmorphism background panel
        const chatBg = this.scene.add.rectangle(0, 0, 380, 160, 0x0c0b16, 0.85).setOrigin(0);
        chatBg.setStrokeStyle(1, 0x3d3056);

        // Header / Help indicator
        const chatHeader = this.scene.add.text(12, 8, '💬 CHAT  •  [Enter] Send  •  [ESC] Exit  •  /help', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#a0aab8',
            stroke: '#000000',
            strokeThickness: 2
        });

        // Chat log display (multi-line)
        this.chatLogText = this.scene.add.text(12, 28, '', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            wordWrap: { width: 355 }
        });

        // Input bar background
        const inputBg = this.scene.add.rectangle(12, 126, 356, 24, 0x161224, 0.95).setOrigin(0);
        inputBg.setStrokeStyle(1, 0x5a4a75);

        // Input text display
        this.chatInputDisplay = this.scene.add.text(18, 131, 'Press [Enter] to type...', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#8e84a8',
            stroke: '#000000',
            strokeThickness: 2
        });

        this.chatContainer.add([chatBg, chatHeader, this.chatLogText, inputBg, this.chatInputDisplay]);

        this.renderChatLog();

        // Cursor blink timer
        this.chatCursorBlinkEvent = this.scene.time.addEvent({
            delay: 450,
            callback: () => {
                this.chatCursorVisible = !this.chatCursorVisible;
                if (this.isChatOpen) {
                    this.updateChatInputDisplay();
                }
            },
            loop: true
        });
    };

    renderChatLog = () => {
        if (!this.chatLogText) return;
        const visibleMsgs = this.chatMessages.slice(-5);
        const text = visibleMsgs.map(m => `[${m.sender}]: ${m.text}`).join('\n');
        this.chatLogText.setText(text);
    };

    openChat = () => {
        if ((this.scene.inventory?.isOpen || this.scene.network?.blocked)) return;
        if (this.scene.playerController.isPlayerDead || this.scene.menu.isMenuOpen) return;
        this.isChatOpen = true;
        this.chatInputText = '';
        this.chatContainer.setVisible(true).setAlpha(1);
        this.updateChatInputDisplay();
    };

    closeChat = () => {
        this.isChatOpen = false;
        this.chatInputText = '';
        this.chatContainer.setVisible(false).setAlpha(0);
        this.chatInputDisplay.setText('Press [Enter] to type...').setColor('#8e84a8');
    };

    updateChatInputDisplay = () => {
        if (!this.isChatOpen) return;
        const cursor = this.chatCursorVisible ? '_' : ' ';
        if (this.chatInputText.length === 0) {
            this.chatInputDisplay.setText(`> ${cursor}`).setColor('#ffd56b');
        } else {
            this.chatInputDisplay.setText(`> ${this.chatInputText}${cursor}`).setColor('#ffffff');
        }
    };

    submitChat = () => {
        const text = this.chatInputText.trim();
        if (!text) {
            this.closeChat();
            return;
        }

        const lower = text.toLowerCase();

        if (lower === '/dragon' || lower.startsWith('/dragon ')) {
            this.addChatMessage('Player', text, '#88ccff');
            this.addChatMessage('System', 'Dragon Altar (1440,260): offer one Bone, Fang, Eye and Pearl [E].', '#ffd56b');
        } else if (lower === '/help') {
            this.addChatMessage('Player', text, '#88ccff');
            this.addChatMessage('System', 'Available Commands:', '#ffd56b');
            this.addChatMessage('System', '• /dragon : Dragon Altar directions', '#ff5533');
            this.addChatMessage('System', '• /heal   : Fully restore player HP', '#44ff88');
            this.addChatMessage('System', '• /clear  : Clear chat window', '#a0aab8');
        } else if (lower === '/heal') {
            this.addChatMessage('Player', text, '#88ccff');
            this.scene.playerController.playerHealth = this.scene.playerController.maxHealth;
            this.scene.hud.updateHUD();
            this.addChatMessage('System', 'Player health fully restored!', '#44ff88');
        } else if (lower === '/clear') {
            this.chatMessages = [];
            this.renderChatLog();
        } else if (text.startsWith('/')) {
            this.addChatMessage('Player', text, '#88ccff');
            this.addChatMessage('System', `Unknown command "${text}". Type /help for commands.`, '#ff8888');
        } else {
            this.addChatMessage('Player', text, '#88ccff');
        }

        this.closeChat();
    };

    addChatMessage = (sender: string, text: string, color: string = '#ffffff') => {
        this.scene.audio?.play('ui-chat-message', undefined, .3);
        this.chatMessages.push({ sender, text, color });
        if (this.chatMessages.length > 25) {
            this.chatMessages.shift();
        }
        this.renderChatLog();
    };

    reset() {
        this.isChatOpen = false;
        this.chatInputText = '';
    }
}
