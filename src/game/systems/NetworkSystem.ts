import type { Peer, DataConnection } from 'peerjs';
import type * as Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';
import type { DeathCause } from '../death-causes';
import { CoopRoomSystem } from './CoopRoomSystem';
import { NetworkWorldSystem } from './NetworkWorldSystem';
import { NetworkActionsSystem } from './NetworkActionsSystem';
import { NetworkResourcesSystem } from './NetworkResourcesSystem';
import {
    isPacket,
    makeRoomCode,
    normalizeRoomCode,
    validRoomCode,
    PEER_PREFIX,
    smoothFactor,
} from '../network-protocol';
import type {
    OutgoingPacket,
    Packet,
    PlayerState,
    Skin,
    Weapon,
    Zone,
    CoopAction,
} from '../network-protocol';
import {
    PLAYER_SPEED,
    TOTAL_WORLD_WIDTH,
    TOTAL_WORLD_HEIGHT,
    FIRE_RATE,
    SHOTGUN_FIRE_RATE,
} from '../constants';
import { playerAnimation, playerPose } from '../player-facing';
import { interactionContext, interactionPressed } from '../interaction';

/** Two-seat transport/session owner. AI, world replication and UI stay in their owning modules. */
export class NetworkSystem {
    constructor(private readonly scene: GameScene) {
        this.panel = new CoopRoomSystem(scene);
        this.world = new NetworkWorldSystem(scene);
        this.actions = new NetworkActionsSystem(scene);
        this.resources = new NetworkResourcesSystem(scene);
    }
    readonly panel: CoopRoomSystem;
    readonly world: NetworkWorldSystem;
    readonly actions: NetworkActionsSystem;
    readonly resources: NetworkResourcesSystem;
    isMultiplayer = false;
    isHost = true;
    isConnected = false;
    roomCode = '';
    status = 'Solo game';
    seed = 0;
    peer: Peer | null = null;
    connection: DataConnection | null = null;
    remotePlayer: Phaser.Physics.Arcade.Sprite | null = null;
    remoteState: PlayerState | null = null;
    remoteAmmo = { rifle: 7, shotgun: 4 };
    private remoteColliders: Phaser.Physics.Arcade.Collider[] = [];
    private healthBar: Phaser.GameObjects.Text | null = null;
    private generation = 0;
    private sequence = 0;
    private received = -1;
    private receivedStates = new Map<string, number>();
    private receivedEvents = new Set<string>();
    private playerAt = 0;
    private worldAt = 0;
    private remoteUpdateAt = 0;
    private remoteShotAt = 0;
    private remoteHurtAt = 0;
    private reloadUntil = 0;
    private reloadWeapon: Weapon = 'rifle';
    private connectTimeout: ReturnType<typeof setTimeout> | null = null;
    private actionAt = new Map<string, number>();
    private localSkin: Skin = 'player';
    private initialized = false;
    get isGuest() {
        return this.isMultiplayer && !this.isHost;
    }
    get blocked() {
        return this.panel.isOpen || (this.isGuest && !this.initialized);
    }
    localBlocked = () =>
        this.blocked ||
        this.scene.menu.isMenuOpen ||
        this.scene.inventory.isOpen ||
        this.scene.shop.isShopOpen ||
        this.scene.chat.isChatOpen;
    createPeer = async (id?: string): Promise<Peer> => {
        const { Peer } = await import('peerjs');
        return id ? new Peer(id) : new Peer();
    };
    create = () => {
        this.seed = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
        this.panel.create();
        this.scene.events.once('shutdown', this.reset);
        const room = new URL(window.location.href).searchParams.get('room');
        if (room) {
            this.panel.open();
            void this.join(room);
        }
    };
    private clearTimeout = () => {
        if (this.connectTimeout) clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
    };
    private disposeTransport = () => {
        this.generation++;
        this.clearTimeout();
        const peer = this.peer,
            conn = this.connection;
        this.peer = null;
        this.connection = null;
        this.isConnected = false;
        conn?.removeAllListeners();
        conn?.close();
        peer?.removeAllListeners();
        peer?.destroy();
        this.clearRemoteColliders();
        this.remotePlayer?.destroy();
        this.healthBar?.destroy();
        this.remotePlayer = null;
        this.healthBar = null;
        this.remoteState = null;
        this.resources.reset();
    };
    reset = () => {
        this.disposeTransport();
        this.panel.destroy();
        this.world.reset();
        this.isMultiplayer = false;
        this.isHost = true;
        this.roomCode = '';
        this.status = 'Solo game';
        this.sequence = 0;
        this.received = -1;
        this.receivedStates.clear();
        this.receivedEvents.clear();
        this.playerAt = 0;
        this.worldAt = 0;
        this.remoteUpdateAt = 0;
        this.remoteShotAt = 0;
        this.remoteHurtAt = 0;
        this.reloadUntil = 0;
        this.remoteAmmo = { rifle: 7, shotgun: 4 };
        this.actionAt.clear();
        this.initialized = false;
    };
    inviteLink = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('room', this.roomCode);
        return url.toString();
    };
    private setStatus = (value: string) => {
        this.status = value;
        this.panel.refresh();
    };
    host = async () => {
        if (this.isGuest) {
            this.setStatus('Leave the guest room before hosting a new game.');
            return;
        }
        this.disposeTransport();
        this.isMultiplayer = true;
        this.isHost = true;
        this.initialized = true;
        this.roomCode = makeRoomCode(crypto.getRandomValues(new Uint8Array(6)));
        this.setStatus('Creating room…');
        const generation = this.generation;
        try {
            const peer = await this.createPeer(PEER_PREFIX + this.roomCode);
            if (generation !== this.generation) {
                peer.destroy();
                return;
            }
            this.peer = peer;
            peer.on('open', () => {
                if (this.peer === peer) this.setStatus('Waiting for Player 2…');
            });
            peer.on('connection', (conn) => {
                if (this.peer !== peer) {
                    conn.close();
                    return;
                }
                if (this.connection) {
                    conn.on('open', () => {
                        conn.send({ v: 1, seq: 0, type: 'ROOM_FULL' });
                        conn.close();
                    });
                    return;
                }
                this.attach(conn);
            });
            peer.on('error', (error) => {
                if (this.peer === peer) this.failure(`Room error: ${error.type}. Try hosting again.`);
            });
            peer.on('disconnected', () => {
                if (this.peer === peer)
                    this.setStatus('Signaling disconnected. Leave and host again to invite.');
            });
        } catch (error) {
            if (generation === this.generation) this.failure(`Unable to create room: ${String(error)}`);
        }
    };
    join = async (input: string) => {
        if (this.isConnected) {
            this.setStatus('Leave the current room before joining another.');
            return;
        }
        const code = normalizeRoomCode(input);
        if (!validRoomCode(code)) {
            this.setStatus('Enter a valid 5–12 character room code.');
            return;
        }
        this.disposeTransport();
        this.isMultiplayer = true;
        this.isHost = false;
        this.initialized = false;
        this.roomCode = code;
        this.setStatus('Connecting to host…');
        const generation = this.generation;
        this.connectTimeout = setTimeout(() => {
            if (generation === this.generation)
                this.failure('Connection timed out. Check the code and keep the host tab open.');
        }, 20000);
        try {
            const peer = await this.createPeer();
            if (generation !== this.generation) {
                peer.destroy();
                return;
            }
            this.peer = peer;
            peer.on('open', () => {
                if (this.peer === peer)
                    this.attach(
                        peer.connect(PEER_PREFIX + code, {
                            serialization: 'binary',
                            reliable: true,
                            metadata: { protocol: 1 },
                        }),
                    );
            });
            peer.on('error', (error) => {
                if (this.peer === peer)
                    this.failure(`Could not join: ${error.type}. Check the code or network.`);
            });
        } catch (error) {
            if (generation === this.generation) this.failure(`Unable to join: ${String(error)}`);
        }
    };
    private failure = (message: string) => {
        const wasGuest = this.isGuest;
        this.disposeTransport();
        // Keep an uninitialized guest frozen until Leave or another Join. No orphan guest simulation.
        this.isMultiplayer = wasGuest;
        this.isHost = !wasGuest;
        this.initialized = false;
        this.setStatus(message);
    };
    leave = () => {
        const guest = this.isGuest;
        this.disposeTransport();
        this.isMultiplayer = false;
        this.isHost = true;
        this.roomCode = '';
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        history.replaceState(null, '', url);
        if (guest) {
            this.scene.scene.restart();
            return;
        }
        this.scene.physics.resume();
        this.setStatus('Solo game');
        this.panel.close();
    };
    private attach = (conn: DataConnection) => {
        if (this.isHost) {
            this.clearTimeout();
            this.connectTimeout = setTimeout(() => {
                if (this.connection === conn && !conn.open) {
                    conn.removeAllListeners();
                    conn.close();
                    this.connection = null;
                    this.setStatus('Handshake timed out. Waiting for Player 2…');
                }
            }, 20000);
        }
        this.connection = conn;
        this.received = -1;
        this.receivedStates.clear();
        this.receivedEvents.clear();
        conn.on('open', () => {
            if (this.connection !== conn) return;
            this.scene.audio?.play('ui-coop-connect');
            this.isConnected = true;
            if(this.isHost)this.clearTimeout();
            this.scene.physics.resume();
            if (this.isHost) {
                this.localSkin = this.scene.playerController.currentCharacter;
                const skin: Skin = this.localSkin === 'player' ? 'heroine' : 'player';
                this.remoteAmmo = { rifle: 7, shotgun: 4 };
                this.resources.reset();
                this.remoteHurtAt = 0;
                this.remoteShotAt = 0;
                this.reloadUntil = 0;
                this.remoteState = {
                    ...this.localPlayer(),
                    x: this.scene.playerController.player.x + 40,
                    hp: 5,
                    skin,
                    blocked: false,
                    anim: playerAnimation(skin, 'idle', 'e'),
                };
                this.spawnRemote();
                this.send({
                    type: 'ROOM_INIT',
                    seed: this.seed,
                    difficulty: 'normal',
                    skins: { host: this.localSkin, guest: skin },
                    player: this.localPlayer(),
                    world: this.world.snapshot(),
                    staticWorld: this.world.staticWorld(),
                });
            }
            if (this.connection !== conn) return;
            this.setStatus(`Connected (${this.isHost ? 'Host' : 'Guest'})`);
            if (this.isHost) this.panel.close();
        });
        conn.on('data', (data) => {
            if (this.connection === conn) this.receive(data);
        });
        conn.on('close', () => {
            if (this.connection !== conn) return;
            this.connection = null;
            this.isConnected = false;
            this.clearRemoteColliders();
            this.remotePlayer?.destroy();
            this.remotePlayer = null;
            this.healthBar?.destroy();
            this.healthBar = null;
            if (this.isHost) {
                this.remoteState = null;
                this.resources.reset();
                this.setStatus('Player 2 left. Waiting for a new guest…');
            } else {
                this.initialized = false;
                this.setStatus('Host disconnected. Leave Room to return to solo.');
                this.panel.open();
            }
        });
        conn.on('error', () => {
            if (this.connection === conn) this.failure('Data connection failed. Leave or try joining again.');
        });
    };
    send = (packet: OutgoingPacket) => {
        if (!this.connection?.open) return;
        const channel = this.connection.dataChannel;
        if (
            channel?.bufferedAmount > 262144 &&
            (packet.type === 'PLAYER_UPDATE' || packet.type === 'WORLD_SNAPSHOT')
        )
            return;
        this.connection.send({ ...packet, v: 1, seq: ++this.sequence });
    };
    sendWorld = () => {
        if (this.isHost && this.isConnected && this.remoteState)
            this.send({ type: 'WORLD_SNAPSHOT', world: this.world.snapshot() });
    };
    requestAction = (action: CoopAction, id?: string, weapon?: Weapon) => {
        if (!this.isGuest || !this.isConnected || !this.initialized) return false;
        const now = this.scene.time.now,
            key = `${action}:${id ?? ''}`;
        if (now < (this.actionAt.get(key) ?? 0)) return true;
        this.actionAt.set(key, now + 150);
        this.send({
            type: 'INTERACT_EVENT',
            action,
            ...(id === undefined ? {} : { id }),
            ...(weapon === undefined ? {} : { weapon }),
        });
        return true;
    };
    private receive = (data: unknown) => {
        if (!isPacket(data)) return;
        if (this.isGuest && !this.initialized && data.type !== 'ROOM_INIT' && data.type !== 'ROOM_FULL')
            return;
        if (data.type === 'SHOOT_EVENT' || data.type === 'INTERACT_EVENT') {
            const id = `${data.type}:${data.seq}`;
            if (this.receivedEvents.has(id)) return;
            this.receivedEvents.add(id);
            if (this.receivedEvents.size > 256)
                this.receivedEvents.delete(this.receivedEvents.values().next().value!);
        } else {
            if (data.seq <= (this.receivedStates.get(data.type) ?? -1)) return;
            this.receivedStates.set(data.type, data.seq);
        }
        this.received = Math.max(this.received, data.seq);
        if (data.type === 'ROOM_FULL') {
            this.failure('This room already has two players.');
            return;
        }
        if (this.isHost) {
            if (data.type === 'PLAYER_UPDATE') this.acceptPlayer(data.player);
            else if (data.type === 'SHOOT_EVENT') this.acceptShot(data);
            else if (data.type === 'INTERACT_EVENT') this.actions.apply(data);
            return;
        }
        if (data.type === 'ROOM_INIT') {
            this.clearTimeout();
            this.initialized = true;
            this.seed = data.seed;
            this.localSkin = data.skins.guest;
            const c = this.scene.playerController;
            c.currentCharacter = this.localSkin;
            c.player.setTexture(this.localSkin, 'frame-0');
            this.scene.boss.dragon?.destroy();
            this.scene.boss.dragon = null;
            this.scene.boss.bossBarContainer?.destroy();
            this.scene.boss.bossBarContainer = null;
            this.scene.altars.autoSpawnTimer.paused = true;
            this.scene.weapons.bullets.clear(true, true);
            this.scene.boss.dragonFireballs.clear(true, true);
            this.scene.enemies.zombies.clear(true, true);
            this.scene.witches.potions.clear(true, true);
            this.scene.loot.reset();
            this.world.reset();
            this.world.applyStatic(data.staticWorld);
            this.scene.castle.setNetworkPosition(
                data.world.guest.x,
                data.world.guest.y,
                data.world.guest.zone,
            );
            this.remoteState = data.player;
            this.spawnRemote();
            this.world.apply(data.world);
            this.panel.close();
            this.scene.hud.updateHUD();
        } else if (this.initialized && data.type === 'PLAYER_UPDATE') this.remoteState = data.player;
        else if (this.initialized && data.type === 'WORLD_SNAPSHOT') this.world.apply(data.world);
        else if (this.initialized && data.type === 'SHOOT_EVENT')
            this.scene.weapons.fireReplicated(
                data.weapon,
                data.x,
                data.y,
                data.targetX,
                data.targetY,
                'remote',
            );
    };
    private localPlayer = (): PlayerState => {
        const s = this.scene,
            c = s.playerController,
            p = c.player,
            aim = s.controls.aimPointer();
        return {
            x: p.x,
            y: p.y,
            vx: p.body?.velocity.x ?? 0,
            vy: p.body?.velocity.y ?? 0,
            facing: c.playerFacing,
            anim: p.anims.currentAnim?.key ?? '',
            hp: c.playerHealth,
            isFiring:
                s.mobileControls.firing ||
                Boolean(s.controls.cursors.space.isDown) ||
                Boolean(s.input.mousePointer?.leftButtonDown()),
            currentWeapon: s.weapons.activeWeapon,
            skin: c.currentCharacter,
            zone: s.castle.currentZone,
            targetX: aim.worldX,
            targetY: aim.worldY,
            blocked: this.localBlocked() || c.isPlayerDead,
        };
    };
    private clearRemoteColliders = () => {
        for (const c of this.remoteColliders) if (c.world) c.destroy();
        this.remoteColliders = [];
    };
    private spawnRemote = () => {
        const state = this.remoteState;
        if (!state) return;
        this.clearRemoteColliders();
        this.remotePlayer?.destroy();
        this.healthBar?.destroy();
        this.remotePlayer = this.scene.physics.add
            .sprite(state.x, state.y, state.skin, 'frame-0')
            .setOrigin(0.5, 1)
            .setImmovable(true);
        this.remotePlayer.setSize(20, 20).setOffset(14, 22);
        (this.remotePlayer.body as Phaser.Physics.Arcade.Body).moves = false;
        this.healthBar = this.scene.add
            .text(state.x, state.y - 68, '', {
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#a7f3d0',
                stroke: '#071015',
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(2000);
        if (this.isHost) {
            this.remoteColliders.push(
                this.scene.physics.add.overlap(this.remotePlayer, this.scene.witches.potions, (_p, potion) =>
                    this.scene.witches.impact(potion as Phaser.Physics.Arcade.Sprite),
                ),
            );
            this.remoteColliders.push(
                this.scene.physics.add.overlap(
                    this.remotePlayer,
                    this.scene.boss.dragonFireballs,
                    (_p, object) => {
                        const fb = object as Phaser.Physics.Arcade.Sprite;
                        if (!fb.active) return;
                        this.scene.boss.dragonFireballs.killAndHide(fb);
                        (fb.body as Phaser.Physics.Arcade.Body).setEnable(false);
                        if (this.remotePlayer) this.damageTarget(this.remotePlayer, 1, 'dragon');
                    },
                ),
            );
        }
    };
    private acceptPlayer = (state: PlayerState) => {
        const current = this.remoteState,
            p = this.remotePlayer;
        if (!current || !p) return;
        const elapsed = Math.max(1, Math.min(250, this.scene.time.now - this.remoteUpdateAt));
        this.remoteUpdateAt = this.scene.time.now;
        if (state.zone === current.zone && current.hp > 0) {
            const dx = state.x - p.x,
                dy = state.y - p.y,
                d = Math.hypot(dx, dy),
                max = ((PLAYER_SPEED * elapsed) / 1000) * 1.6 + 10;
            if (
                d <= max &&
                state.x >= 0 &&
                state.y >= 0 &&
                state.x <= TOTAL_WORLD_WIDTH &&
                state.y <= TOTAL_WORLD_HEIGHT
            ) {
                p.setPosition(state.x, state.y);
                current.x = state.x;
                current.y = state.y;
            }
        }
        const hp = current.hp,
            skin = current.skin,
            zone = current.zone,
            x = current.x,
            y = current.y;
        this.remoteState = {
            ...state,
            hp,
            skin,
            zone,
            x,
            y,
            anim: state.anim.replace(/^(player|heroine)/, skin),
        };
    };
    private acceptShot = (packet: Extract<Packet, { type: 'SHOOT_EVENT' }>) => {
        const state = this.remoteState,
            p = this.remotePlayer,
            now = this.scene.time.now;
        if (
            !state ||
            !p ||
            state.hp <= 0 ||
            state.blocked ||
            now < this.remoteShotAt ||
            now < this.reloadUntil ||
            (packet.weapon === 'shotgun' && !this.scene.weapons.hasShotgun) ||
            this.remoteAmmo[packet.weapon] <= 0
        )
            return;
        this.remoteShotAt = now + (packet.weapon === 'shotgun' ? SHOTGUN_FIRE_RATE : FIRE_RATE) - 15;
        this.remoteAmmo[packet.weapon]--;
        // Position is host-owned; never trust the origin supplied by the guest.
        this.scene.weapons.fireReplicated(packet.weapon, p.x, p.y, packet.targetX, packet.targetY, 'remote');
    };
    shot = (weapon: Weapon, x: number, y: number, targetX: number, targetY: number) => {
        if (this.isConnected) this.send({ type: 'SHOOT_EVENT', weapon, x, y, targetX, targetY });
    };
    reloadRemote = (weapon: Weapon) => {
        if (this.reloadUntil > this.scene.time.now) return;
        this.reloadWeapon = weapon;
        this.reloadUntil = this.scene.time.now + 1000;
    };
    teleportGuest = (x: number, y: number, zone: Zone) => {
        if (this.remoteState && this.remotePlayer) {
            Object.assign(this.remoteState, { x, y, zone });
            this.remotePlayer.setPosition(x, y);
        }
    };
    applyGuestAuthority = (state: PlayerState, ammo: { rifle: number; shotgun: number }) => {
        const s = this.scene,
            c = s.playerController;
        if (
            s.castle.currentZone !== state.zone ||
            Math.hypot(c.player.x - state.x, c.player.y - state.y) > 90
        )
            s.castle.setNetworkPosition(state.x, state.y, state.zone);
        if (c.playerHealth !== state.hp) {
            if (state.hp > c.playerHealth) s.audio?.play('heal-use');
            else {
                s.audio?.play(c.currentCharacter === 'heroine' ? 'player-hurt-female' : 'player-hurt-male');
                s.audio?.play('dog-whimper-alert', s.companion?.dog, .35, 1800);
                if (state.hp <= 0) s.audio?.play('player-die');
            }
            c.playerHealth = state.hp;
            s.hud.updateHUD();
            if (state.hp <= 0 && !c.isPlayerDead) {
                c.isPlayerDead = true;
                c.player.setVelocity(0, 0).play(c.playerAnimationKey('die'));
                s.deathScreen.show('zombie');
            }
        }
        if (!s.weapons.isReloading) {
            s.weapons.rifleAmmo = ammo.rifle;
            s.weapons.shotgunAmmo = ammo.shotgun;
            s.weapons.currentAmmo = ammo[s.weapons.activeWeapon];
        }
    };
    nearestTarget = (origin: { x: number; y: number }) => {
        const local = this.scene.playerController.player;
        if (
            !this.isHost ||
            !this.isConnected ||
            !this.remotePlayer ||
            !this.remoteState ||
            this.remoteState.hp <= 0 ||
            this.remoteState.blocked
        )
            return local;
        if (this.scene.playerController.isPlayerDead || this.localBlocked()) return this.remotePlayer;
        return Math.hypot(origin.x - local.x, origin.y - local.y) <=
            Math.hypot(origin.x - this.remotePlayer.x, origin.y - this.remotePlayer.y)
            ? local
            : this.remotePlayer;
    };
    damageTarget = (target: Phaser.Physics.Arcade.Sprite, amount: number, cause: DeathCause) => {
        if (target !== this.remotePlayer) {
            this.scene.playerController.damagePlayer(amount, cause);
            return;
        }
        if (
            !this.isHost ||
            !this.remoteState ||
            this.remoteState.hp <= 0 ||
            this.remoteState.blocked ||
            this.scene.time.now < this.remoteHurtAt
        )
            return;
        this.remoteHurtAt = this.scene.time.now + 500;
        this.remoteState.hp = Math.max(0, this.remoteState.hp - amount);
        this.sendWorld();
    };
    guestInteraction = () => {
        const context = interactionContext(this.scene);
        if (!context || !interactionPressed(this.scene, context.id)) return;
        if (context.id === 'vendor') this.scene.shop.toggleShop();
        else if (context.id === 'dragon') this.scene.inventory.open('offering');
        else this.requestAction(context.id);
    };
    updateHostSimulation = (time: number) => {
        if (!this.isConnected || !this.isHost) return;
        if (this.localBlocked() || this.scene.playerController.isPlayerDead) {
            this.scene.enemies.update(time);
            if (this.scene.boss.isDragonSpawned && !this.scene.boss.isDragonDead)
                this.scene.boss.updateDragonBoss(time);
        }
        const p = this.remotePlayer,
            state = this.remoteState;
        if (!p || !state || state.hp <= 0 || state.blocked) return;
        const a = this.scene.altars;
        for (const [altar, interval, key, spawn] of [
            [a.altar, 3800, 'lastZombieProximitySpawnTime', this.scene.enemies.summonZombieAtAltar],
            [a.wolfAltar, 4200, 'lastWolfProximitySpawnTime', this.scene.enemies.summonWerewolfAtWolfAltar],
            [a.drownerAltar, 4000, 'lastDrownerProximitySpawnTime', this.scene.enemies.summonDrownerAtAltar],
        ] as const) {
            if (
                Math.hypot(p.x - altar.x, p.y - altar.y) < 260 &&
                time > a[key] + interval &&
                this.scene.enemies.zombies.countActive(true) < 25
            ) {
                a[key] = time;
                spawn();
            }
        }
        if (
            this.scene.witches.altar &&
            Math.hypot(p.x - this.scene.witches.altar.x, p.y - this.scene.witches.altar.y) < 260
        )
            this.scene.witches.summon();
    };
    update = (time: number, delta: number) => {
        if (this.remotePlayer && this.remoteState) {
            const p = this.remotePlayer,
                state = this.remoteState,
                a = this.isHost ? 1 : smoothFactor(delta);
            p.setPosition(p.x + (state.x - p.x) * a, p.y + (state.y - p.y) * a)
                .setDepth(p.y)
                .setFlipX(playerPose(state.facing).flip);
            if (this.scene.anims.exists(state.anim)) p.play(state.anim, true);
            this.healthBar?.setPosition(p.x, p.y - 68).setText(`${this.isHost ? 'P2' : 'P1'} ${state.hp}/5`);
        }
        if (this.isGuest) this.world.interpolate(delta);
        if (!this.isConnected) return;
        if (time >= this.playerAt) {
            this.playerAt = time + 1000 / 30;
            this.send({ type: 'PLAYER_UPDATE', player: this.localPlayer() });
        }
        if (this.isHost) {
            if (this.reloadUntil && time >= this.reloadUntil) {
                this.remoteAmmo[this.reloadWeapon] = this.reloadWeapon === 'rifle' ? 7 : 4;
                this.reloadUntil = 0;
            }
            if (time >= this.worldAt) {
                this.worldAt = time + 50;
                this.sendWorld();
            }
        }
    };
}
