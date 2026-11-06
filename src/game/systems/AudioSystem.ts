import type * as Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';
import type { SoundKey } from '../audio-catalog';

type Point = { x: number; y: number };
type Sprite = Phaser.Physics.Arcade.Sprite;
const ENEMY_VOICES: Record<string, string> = {
    zombie: 'zombie', 'zombie-female': 'banshee', 'zombie-skeleton': 'skeleton',
    'zombie-blue': 'ghoul', werewolf: 'werewolf', 'werewolf-albino': 'werewolf-albino',
    drowner: 'drowner', witch: 'witch', 'witch-red': 'witch'
};

/** Owns presentation audio only; never advances gameplay or consumes RNG. */
export class AudioSystem {
    constructor(private readonly scene: GameScene) {}
    private active = new Set<Phaser.Sound.BaseSound>();
    private loops = new Map<SoundKey, Phaser.Sound.BaseSound>();
    private next = new Map<string, number>();
    private nearAltars = new Set<object>();
    private enabled = false;
    private scanAt = 0;
    private lastPosition: Point | null = null;
    private stepDistance = 0;

    reset = () => {
        this.shutdown();
        this.next.clear(); this.nearAltars.clear(); this.scanAt = 0;
        this.lastPosition = null; this.stepDistance = 0;
    };
    create = () => {
        this.enabled = true;
        this.scene.input.on('gameobjectover', this.hover);
        this.scene.input.on('gameobjectdown', this.click);
        this.scene.events.once('shutdown', this.shutdown);
    };
    private hover = (_pointer: unknown, object: Phaser.GameObjects.GameObject) => {
        if (object.input?.cursor === 'pointer') this.play('ui-button-hover', undefined, .3, 65);
    };
    private click = (_pointer: unknown, object: Phaser.GameObjects.GameObject) => {
        if (object.input?.cursor === 'pointer') this.play('ui-button-click', undefined, .45, 45);
    };
    shutdown = () => {
        this.enabled = false;
        this.scene.input?.off('gameobjectover', this.hover);
        this.scene.input?.off('gameobjectdown', this.click);
        this.scene.events?.off('shutdown', this.shutdown);
        for (const sound of this.active) sound.destroy();
        this.active.clear(); this.loops.clear();
    };
    private attenuation = (at?: Point) => {
        const player = this.scene.playerController.player;
        return at && player ? Math.max(0, 1 - Math.hypot(at.x-player.x, at.y-player.y)/650) ** 2 : 1;
    };
    play = (key: SoundKey, at?: Point, volume = .6, cooldown = 65) => {
        if (!this.enabled || this.scene.sound.locked || !this.scene.cache.audio.exists(key)) return false;
        const now = this.scene.time.now;
        const gain = volume * this.attenuation(at);
        if (gain < .005 || now < (this.next.get(key) ?? -Infinity) || this.active.size >= 24) return false;
        this.next.set(key, now + cooldown);
        const sound = this.scene.sound.add(key, { volume: gain });
        this.active.add(sound);
        sound.once('complete', () => { this.active.delete(sound); sound.destroy(); });
        if (!sound.play()) { this.active.delete(sound); sound.destroy(); return false; }
        return true;
    };
    private loop = (key: SoundKey, volume: number) => {
        const old = this.loops.get(key);
        if (!this.enabled || this.scene.sound.locked || volume <= .005) {
            if (old) { old.destroy(); this.active.delete(old); this.loops.delete(key); }
            return;
        }
        if (old) { (old as Phaser.Sound.WebAudioSound).setVolume(volume); return; }
        if (!this.scene.cache.audio.exists(key)) return;
        const sound = this.scene.sound.add(key, { loop: true, volume });
        if (sound.play()) { this.loops.set(key, sound); this.active.add(sound); }
        else sound.destroy();
    };
    enemy = (enemy: Sprite, action: 'spawn' | 'attack' | 'hurt' | 'die') => {
        const prefix = ENEMY_VOICES[enemy.getData('variant') || enemy.texture.key];
        if (!prefix) return;
        const key = prefix === 'witch' && action === 'spawn' ? 'witch-cackle-spawn'
            : prefix === 'witch' && action === 'attack' ? 'witch-potion-throw' : `${prefix}-${action}`;
        this.play(key as SoundKey, enemy);
    };
    impact = (obstacle: Sprite, at: Point) => {
        const texture = obstacle.texture?.key || '';
        const key = texture.includes('bars') || texture.includes('chains') ? 'impact-metal-bars'
            : texture.includes('rock') ? 'impact-rock'
            : texture.includes('tree') || texture.includes('bush') ? 'impact-wood' : 'impact-castle-stone';
        this.play(key, at, .45);
    };
    update = (time: number) => {
        const s = this.scene, p = s.playerController.player;
        if (!p) return;
        const blocked = s.playerController.isPlayerDead || s.menu.isMenuOpen || s.shop.isShopOpen ||
            s.chat.isChatOpen || s.inventory.isOpen || s.network.blocked;
        this.loop('laser-aim-hum', !blocked && s.aiming.endpoint ? .035 : 0);
        if (blocked) {
            this.loop('altar-idle-hum', 0); this.loop('cauldron-bubble-loop', 0);
            this.lastPosition = null; this.stepDistance = 0;
            return;
        }
        if (this.lastPosition) {
            const distance = Math.hypot(p.x-this.lastPosition.x,p.y-this.lastPosition.y);
            if (distance < 32) this.stepDistance += distance; // Ignore teleports.
        }
        this.lastPosition = {x:p.x,y:p.y};
        if (this.stepDistance >= 38) {
            this.stepDistance %= 38;
            const water = s.castle.decorations?.getChildren().some(o => {
                const tile = o as Phaser.GameObjects.Sprite;
                return tile.texture.key === 'prison-puddle' && p.x >= tile.x && p.x < tile.x+32 && p.y >= tile.y && p.y < tile.y+32;
            });
            this.play(water ? 'player-step-water' : s.castle.currentZone === 'castle' ? 'player-step-stone' : 'player-step-grass', p, .45, 180);
        }
        if (time < this.scanAt) return;
        this.scanAt = time + 180;
        if (s.playerController.playerHealth === 1) this.play('player-heartbeat-low', undefined, .5, 950);
        if (s.companion.dog?.active) this.play('dog-bark', s.companion.dog, .25, 16000);
        let altarGain = 0;
        for (const altar of [s.altars.altar,s.altars.wolfAltar,s.altars.drownerAltar,s.ritual.altar]) {
            if (!altar) continue;
            const near = Math.hypot(p.x-altar.x,p.y-altar.y) < 65;
            if (near && !this.nearAltars.has(altar)) this.play('altar-active-glow', altar, .4, 300);
            if (near) this.nearAltars.add(altar); else this.nearAltars.delete(altar);
            if (Math.hypot(p.x-altar.x,p.y-altar.y)<180) altarGain=Math.max(altarGain,this.attenuation(altar)*.12);
        }
        this.loop('altar-idle-hum',altarGain);
        const cauldron=s.witches.altar;
        this.loop('cauldron-bubble-loop',cauldron && Math.hypot(p.x-cauldron.x,p.y-cauldron.y)<180 ? this.attenuation(cauldron)*.15 : 0);
        for (const obj of s.enemies.zombies.getChildren()) {
            const enemy=obj as Sprite;
            if (!enemy.active || enemy.getData('state')==='dead') continue;
            const v=enemy.getData('variant');
            if (v==='zombie-blue') this.play('ghoul-electric-spark',enemy,.35,1400);
            if (v?.startsWith('werewolf') && Math.hypot(enemy.body?.velocity.x??0,enemy.body?.velocity.y??0)>10)
                this.play('werewolf-step',enemy,.4,340);
        }
        const dragon=s.boss.dragon;
        if (dragon?.active && !s.boss.isDragonDead && dragon.anims.currentAnim?.key.startsWith('dragon-fly'))
            this.play('dragon-wing-flap',dragon,.5,720);
        const scenery: Record<string, [SoundKey,number]> = {
            'prison-torch':['scenery-torch-crackle',1800], 'prison-wall':['scenery-prison-drip',3300],
            'prison-chains':['scenery-chains-sway',2400], 'prison-bars':['scenery-bars-rattle',3000]
        };
        for (const group of [s.castle.decorations,s.castle.solidObstacles]) for (const obj of group?.getChildren() ?? []) {
            const tile=obj as Sprite, cue=scenery[tile.texture.key];
            if (cue && Math.hypot(p.x-tile.x,p.y-tile.y)<180) this.play(cue[0],tile,.22,cue[1]);
        }
        const movers=[p,...s.enemies.zombies.getChildren().filter(o=>o.active && o.getData('state')!=='dead')] as Sprite[];
        for (const obj of s.world.bushes.getChildren()) {
            const bush=obj as Sprite;
            if (this.attenuation(bush)>.1 && movers.some(m=>Math.hypot(m.body?.velocity.x??0,m.body?.velocity.y??0)>10 && Math.hypot(m.x-bush.x,m.y-bush.y)<48))
                this.play('scenery-bush-rustle',bush,.3,500);
        }
    };
}
