import type { GameScene } from '../scenes/Game';

/** Accessible DOM room controls, including a real mobile keyboard input. */
export class CoopRoomSystem {
    constructor(private readonly scene: GameScene) {}
    isOpen = false;
    private root: HTMLDivElement | null = null;
    private dialog: HTMLDialogElement | null = null;
    private status: HTMLParagraphElement | null = null;
    private code: HTMLOutputElement | null = null;
    private indicator: HTMLParagraphElement | null = null;
    private input: HTMLInputElement | null = null;
    private style: HTMLStyleElement | null = null;
    create = () => {
        this.style = document.createElement('style');
        this.style.textContent = `.coop-hud{position:fixed;right:12px;top:72px;z-index:5;font:12px monospace;color:#d9ead6;text-align:right;pointer-events:none}.coop-hud button{pointer-events:auto}.coop-hud p{max-width:245px;margin:5px 0;text-shadow:1px 1px #000}.coop-room button,.coop-hud button{min-height:48px;min-width:48px;border:1px solid #8dad98;background:#27443b;color:#f3f2dd;font:14px monospace;padding:10px 14px;cursor:pointer;touch-action:manipulation}.coop-room button:focus-visible,.coop-room input:focus-visible{outline:3px solid #f5d789;outline-offset:2px}.coop-room{box-sizing:border-box;width:min(500px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;background:#151e27;color:#e5ead8;border:2px solid #8dad98;padding:20px;font:14px monospace}.coop-room::backdrop{background:#060a12d9}.coop-room h2{font-size:20px;margin:0 0 16px}.coop-room p{line-height:1.5;overflow-wrap:anywhere}.coop-room .coop-close{position:sticky;top:0;float:right;z-index:1}.coop-room output{display:block;font-size:30px;letter-spacing:5px;color:#ffe09a;margin:12px 0}.coop-room input{box-sizing:border-box;min-height:48px;min-width:0;width:100%;background:#080f18;color:#fff;border:1px solid #8dad98;padding:10px;font:20px monospace;text-transform:uppercase}.coop-room .coop-row{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}.coop-room form{margin-top:20px}.coop-room label{display:block;margin-bottom:8px}@media(max-width:419px){.coop-hud{top:148px}.coop-hud p{max-width:180px}}`;
        document.head.append(this.style);
        this.root = document.createElement('div');
        this.root.className = 'coop-hud';
        const toggle = this.button('CO-OP', this.open);
        toggle.id = 'coop-toggle';
        this.indicator = document.createElement('p');
        this.indicator.setAttribute('role', 'status');
        this.root.append(toggle, this.indicator);
        document.body.append(this.root);
        this.dialog = document.createElement('dialog');
        this.dialog.className = 'coop-room';
        this.dialog.setAttribute('aria-labelledby', 'coop-title');
        const title = document.createElement('h2');
        title.id = 'coop-title';
        title.textContent = 'Multiplayer Co-Op';
        const description = document.createElement('p');
        description.textContent =
            'Private room · 2 players · Shared loot and crafting. The desktop host keeps the world running.';
        this.status = document.createElement('p');
        this.status.setAttribute('role', 'status');
        this.code = document.createElement('output');
        this.code.setAttribute('aria-label', 'Room code');
        const row = document.createElement('div');
        row.className = 'coop-row';
        row.append(
            this.button('Host Game', () => void this.scene.network.host()),
            this.button('Copy Invite Link', () => void this.copyInvite()),
        );
        const form = document.createElement('form');
        const label = document.createElement('label');
        label.textContent = 'Join with room code';
        label.htmlFor = 'coop-code';
        this.input = document.createElement('input');
        this.input.id = 'coop-code';
        this.input.name = 'room';
        this.input.maxLength = 12;
        this.input.autocomplete = 'off';
        this.input.spellcheck = false;
        this.input.setAttribute('autocapitalize', 'characters');
        this.input.placeholder = 'ABC234';
        const join = this.button('Join', () => {});
        join.type = 'submit';
        form.append(label, this.input, join);
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            void this.scene.network.join(this.input!.value);
        });
        const bottom = document.createElement('div');
        bottom.className = 'coop-row';
        bottom.append(
            this.button('Leave Room', () => this.scene.network.leave()),
            this.button('Close', this.close),
        );
        const note = document.createElement('p');
        note.textContent =
            'Friendly fire is off. Restart resets the connection; invite links rejoin. Use the same HTTPS invite on mobile; keep the host tab open.';
        const close = this.button('X', this.close);
        close.className = 'coop-close';
        close.setAttribute('aria-label', 'Close co-op room');
        this.dialog.append(close, title, description, this.status, this.code, row, form, bottom, note);
        document.body.append(this.dialog);
        this.dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            this.close();
        });
        this.dialog.addEventListener('click', (event) => {
            if (event.target === this.dialog) {
                const r = this.dialog!.getBoundingClientRect();
                if (
                    event.clientX < r.left ||
                    event.clientX > r.right ||
                    event.clientY < r.top ||
                    event.clientY > r.bottom
                )
                    this.close();
            }
        });
        window.addEventListener('keydown', this.keydown, true);
        this.scene.events.once('shutdown', this.destroy);
        this.refresh();
    };
    private button = (label: string, action: () => void) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', action);
        return b;
    };
    private keydown = (event: KeyboardEvent) => {
        if (!this.isOpen) return;
        event.stopImmediatePropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
        }
    };
    open = () => {
        if (this.scene.inventory.isOpen) this.scene.inventory.close();
        if (this.scene.menu.isMenuOpen) this.scene.menu.toggleMenu();
        if (this.scene.shop.isShopOpen) this.scene.shop.toggleShop();
        if (this.scene.chat.isChatOpen) this.scene.chat.closeChat();
        this.scene.mobileControls.releaseAll();
        this.scene.input.keyboard?.resetKeys();
        this.scene.playerController.player.setVelocity(0, 0);
        this.isOpen = true;
        this.dialog?.showModal();
        this.refresh();
    };
    close = () => {
        this.isOpen = false;
        this.dialog?.close();
        this.scene.input.keyboard?.resetKeys();
    };
    refresh = () => {
        const n = this.scene.network;
        if (this.status) this.status.textContent = n.status;
        if (this.code) this.code.textContent = n.roomCode || '—';
        if (this.indicator)
            this.indicator.textContent = n.isConnected
                ? `● Co-op: Connected (${n.isHost ? 'Host' : 'Guest'})`
                : n.isMultiplayer
                  ? `◌ ${n.status}`
                  : 'Co-op: Solo';
    };
    private copyInvite = async () => {
        if (!this.scene.network.roomCode) {
            this.status!.textContent = 'Host a game first to create an invite.';
            return;
        }
        try {
            await navigator.clipboard.writeText(this.scene.network.inviteLink());
            this.status!.textContent = 'Invite copied. Send it to Player 2.';
        } catch {
            this.status!.textContent = `Copy this link: ${this.scene.network.inviteLink()}`;
        }
    };
    destroy = () => {
        window.removeEventListener('keydown', this.keydown, true);
        this.dialog?.remove();
        this.root?.remove();
        this.style?.remove();
        this.dialog = null;
        this.root = null;
        this.style = null;
        this.isOpen = false;
    };
}
