import type { GameScene } from '../scenes/Game';
import { FIRST_AID_HEAL_AMOUNT, FIRST_AID_PRICE } from '../constants';

/** Host-owned personal guest balances. Local balances stay with the local player. */
export class NetworkResourcesSystem {
    constructor(private readonly scene: GameScene) {}

    guestKills = 0;
    guestMedkits = 0;
    generation = 0;

    reset = () => {
        this.generation++;
        this.guestKills = 0;
        this.guestMedkits = 0;
    };

    awardKills = (amount: number, owner: string = 'local', generation = this.generation) => {
        const s = this.scene;
        if (s.network.isGuest) return;
        if (owner === 'remote') {
            // An old guest's projectile/death callback must not reward a new guest.
            if (!s.network.isConnected || generation !== this.generation) return;
            this.guestKills += amount;
        } else {
            s.score += amount;
            s.hud.updateHUD();
            if (s.shop.isShopOpen) s.shop.updateShopElements();
        }
        s.network.sendWorld();
    };

    spendGuestKills = (cost: number) => {
        if (!this.scene.network.isHost || !this.scene.network.isConnected || this.guestKills < cost)
            return false;
        this.guestKills -= cost;
        return true;
    };

    buyGuestMedkit = () => {
        if (!this.spendGuestKills(FIRST_AID_PRICE)) return false;
        this.guestMedkits++;
        return true;
    };

    healGuest = () => {
        const n = this.scene.network, state = n.remoteState;
        if (!n.isHost || !n.isConnected || !state || state.hp <= 0 || state.hp >= 5 || this.guestMedkits <= 0)
            return false;
        this.guestMedkits--;
        state.hp = Math.min(5, state.hp + FIRST_AID_HEAL_AMOUNT);
        return true;
    };
}
