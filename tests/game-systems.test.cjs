const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load gameplay modules without a DOM or renderer. Only Phaser's key-edge helper
// is needed by these tests; physics and rendering are covered by browser smoke QA.
const cache = new Map();
function load(file) {
    file = path.resolve(__dirname, '../src/game', file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(compiled, {
        exports,
        require: name => name === 'phaser'
            ? { Scene: class {}, Physics: { Arcade: { Sprite: class {} } }, Input: { Keyboard: { KeyCodes: {}, JustDown: key => Boolean(key?.justDown) } },
                Math: { Between: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a, Clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
                    DegToRad: v => v * Math.PI / 180, FloatBetween: (a, b) => (a + b) / 2,
                    Angle: { Between: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1) },
                    Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) } } }
            : name === '@pixelforge/phaser' ? { loadPixelForgeAudio(scene, {baseURL, manifest}) { for(const a of manifest.assets) scene.load.audio(a.key, `${baseURL}/${a.file}`); } }
            : load(path.resolve(path.dirname(file), `${name}.ts`)),
    }, { filename: file });
    return exports;
}
const { WeaponsSystem } = load('systems/WeaponsSystem.ts');
const { ControlsSystem } = load('systems/ControlsSystem.ts');
const { ShopSystem } = load('systems/ShopSystem.ts');
const { GameplaySystem } = load('systems/GameplaySystem.ts');
const { PlayerControllerSystem } = load('systems/PlayerControllerSystem.ts');
const { GAME_TITLE, SHOTGUN_PRICE, FIRST_AID_PRICE, FIRST_AID_HEAL_AMOUNT, RIFLE_MAX_AMMO, SHOTGUN_MAX_AMMO,
    FIRE_RATE, SHOTGUN_FIRE_RATE, SHOTGUN_PELLETS } = load('constants.ts');

function fixture() {
    const calls = [];
    const scene = {
        score: 0,
        hud: { updateHUD() {}, flashProximityAlert() {} },
        playerController: {
            medkits: 0,
            player: { body: { setVelocity() {}, velocity: { x: 0, y: 0 } }, play() {}, setVelocity() {} },
            playerAnimationKey: () => 'idle', updateMovement: () => calls.push('movement'),
        },
        controls: { cursors: { space: {} }, reloadKey: {}, restartKey: {} },
        cameras: { main: { flash() {} } },
        chat: {}, menu: {}, boss: {},
        altars: { updateProximity: () => calls.push('altars') },
        world: { updateDepths: () => calls.push('depth') },
        enemies: { update: () => calls.push('enemies') },
        scene: { restart: () => calls.push('restart') },
    };
    scene.weapons = new WeaponsSystem(scene);
    scene.shop = new ShopSystem(scene);
    scene.shop.shopContainer = { setVisible() {} };
    return { scene, calls };
}

test('game title is Overrun', () => {
    assert.equal(GAME_TITLE, 'Overrun');
});

test('weapon switching preserves independent magazines and cancels reload', () => {
    const { scene } = fixture();
    const w = scene.weapons;
    w.setWeapon('shotgun');
    assert.equal(w.activeWeapon, 'rifle');
    w.hasShotgun = true;
    w.currentAmmo = 2;
    let cancelled = 0;
    w.reloadTimer = { remove: () => cancelled++ };
    w.reloadTween = { stop: () => cancelled++ };
    w.isReloading = true;
    // Deliberately detach the callback: receiver binding must survive extraction.
    const equip = w.setWeapon;
    equip('shotgun');
    assert.equal(cancelled, 2);
    assert.equal(w.isReloading, false);
    assert.equal(w.rifleAmmo, 2);
    assert.equal(w.currentAmmo, SHOTGUN_MAX_AMMO);
    w.currentAmmo = 1;
    equip('rifle');
    assert.equal(w.shotgunAmmo, 1);
    assert.equal(w.currentAmmo, 2);
});

test('shop charges once, rejects insufficient funds, and equips owned weapons', () => {
    const { scene } = fixture();
    scene.score = SHOTGUN_PRICE - 1;
    scene.shop.buyShotgun();
    assert.equal(scene.weapons.hasShotgun, false);
    scene.score = SHOTGUN_PRICE + 3;
    scene.shop.isShopOpen = true;
    scene.shop.buyShotgun();
    assert.equal(scene.score, 3);
    assert.equal(scene.weapons.activeWeapon, 'shotgun');
    assert.equal(scene.shop.isShopOpen, false);
    scene.shop.buyShotgun();
    assert.equal(scene.score, 3);
});

test('restart resets weapon ownership, ammo and pending reload references', () => {
    const { scene } = fixture();
    Object.assign(scene.weapons, { hasShotgun: true, activeWeapon: 'shotgun', currentAmmo: 0, isReloading: true, fireDelay: 900 });
    scene.weapons.reset();
    assert.equal(scene.weapons.hasShotgun, false);
    assert.equal(scene.weapons.activeWeapon, 'rifle');
    assert.equal(scene.weapons.currentAmmo, RIFLE_MAX_AMMO);
    assert.equal(scene.weapons.isReloading, false);
    assert.equal(scene.weapons.reloadTimer, null);
    assert.equal(scene.weapons.fireDelay, 0);
});

test('frame orchestration preserves phase order and modal/death gates', () => {
    const { scene, calls } = fixture();
    scene.weapons.updateFiring = () => calls.push('fire');
    scene.weapons.cleanupBullets = () => calls.push('cleanup');
    scene.shop.updateProximity = () => calls.push('shop');
    const loop = new GameplaySystem(scene);
    loop.update(100);
    assert.deepEqual(calls, ['movement', 'fire', 'altars', 'shop', 'depth', 'enemies', 'cleanup']);
    calls.length = 0;
    scene.chat.isChatOpen = true;
    loop.update(200);
    assert.deepEqual(calls, []);
    scene.chat.isChatOpen = false;
    scene.menu.isMenuOpen = true;
    loop.update(300);
    assert.deepEqual(calls, []);
    scene.playerController.isPlayerDead = true;
    scene.controls.restartKey.isDown = true;
    loop.update(400);
    assert.deepEqual(calls, ['restart']);
});


test('shop reset prevents HUD refresh from touching destroyed shop text', () => {
    const { scene } = fixture();
    scene.shop.shopKillsText = { setText() { throw new Error('Destroyed text'); } };
    scene.shop.isShopOpen = true;
    scene.shop.reset();
    assert.equal(scene.shop.shopContainer, undefined);
    assert.equal(scene.shop.isShopOpen, false);
    assert.doesNotThrow(() => scene.shop.updateShopElements());
});

const { CompanionSystem } = load('systems/CompanionSystem.ts');
const { AnimationsSystem } = load('systems/AnimationsSystem.ts');

function companionFixture() {
    const objects = [];
    function object(x, y) {
        const sprite = {
            x, y, active: true, data: {},
            setOrigin() { return this; },
            setData(key, value) { this.data[key] = value; return this; },
            setPosition(x, y) { this.x = x; this.y = y; return this; },
            setDepth(depth) { this.depth = depth; return this; },
            setFlipX(flip) { this.flipX = flip; return this; },
            play(key) { this.animation = key; return this; },
        };
        objects.push(sprite);
        return sprite;
    }
    const scene = {
        playerController: { player: { x: 960, y: 640 }, isPlayerDead: false },
        menu: {}, shop: {}, chat: {},
        // No physics plugin: creating a physics object would fail this fixture.
        add: { sprite: object, ellipse: object },
    };
    const system = new CompanionSystem(scene);
    system.reset();
    system.create();
    return { scene, system, objects };
}

test('companion follows, settles behind the player and remains outside combat physics', () => {
    const { scene, system } = companionFixture();
    const start = system.dog.x;
    scene.playerController.player.x += 240;
    for (let i = 0; i < 180; i++) system.update(1000 / 60);
    assert.ok(system.dog.x > start + 150);
    assert.ok(system.dog.x < scene.playerController.player.x);
    assert.ok(Math.hypot(system.dog.x - scene.playerController.player.x,
        system.dog.y - scene.playerController.player.y) < 70);
    assert.match(system.dog.animation, /idle/);
    assert.equal(system.dog.body, undefined);
    assert.equal(system.dog.hp, undefined);
    assert.equal(system.dog.active, true);
    assert.equal(system.shadow.x, system.dog.x);
    assert.ok(system.shadow.depth < system.dog.depth);
    assert.equal(system.dog.depth, system.dog.y);
});

test('companion freezes safely for overlays/death and survives character switching', () => {
    const { scene, system } = companionFixture();
    const dog = system.dog;
    scene.playerController.player.x += 200;
    for (const [owner, flag] of [[scene.menu, 'isMenuOpen'], [scene.chat, 'isChatOpen'],
        [scene.shop, 'isShopOpen'], [scene.playerController, 'isPlayerDead']]) {
        owner[flag] = true;
        const { x, y } = dog;
        system.update(100);
        assert.equal(dog.x, x);
        assert.equal(dog.y, y);
        assert.equal(dog.active, true);
        assert.match(dog.animation, /idle/);
        owner[flag] = false;
    }
    scene.playerController.currentCharacter = 'heroine';
    system.update(100);
    assert.equal(system.dog, dog);
    assert.match(dog.animation, /walk/);
});

test('companion resets trail and facing across two scene restarts', () => {
    const { scene, system, objects } = companionFixture();
    for (let run = 0; run < 2; run++) {
        scene.playerController.player.x += 200;
        system.update(100);
        const previousDog = system.dog;
        // Phaser destroys display objects on shutdown; the system then reuses its instance.
        for (const item of objects) item.active = false;
        system.reset();
        scene.playerController.player = { x: 960, y: 640 };
        system.create();
        assert.notEqual(system.dog, previousDog);
        assert.equal(system.facing, 'e');
        assert.equal(system.trail.length, 2);
        assert.equal(system.dog.x, 910);
        assert.equal(system.dog.animation, 'companion-dog-idle');
        assert.equal(system.dog.active, true);
    }
});

test('companion trail is bounded and recovers from a distant teleport', () => {
    const { scene, system } = companionFixture();
    for (let i = 0; i < 600; i++) {
        scene.playerController.player.x = 960 + Math.sin(i / 30) * 180;
        scene.playerController.player.y = 640 + Math.cos(i / 30) * 180;
        system.update(16);
    }
    assert.ok(system.trail.length <= 256);
    system.dog.setPosition(10, 10);
    scene.playerController.player = { x: 1700, y: 1000 };
    system.update(16);
    assert.ok(Math.hypot(system.dog.x - 1700, system.dog.y - 1000) < 100);
    assert.equal(system.dog.active, true);
});

test('companion has registered idle/walk frames for every compass direction', () => {
    const root = path.resolve(__dirname, '..');
    const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    const bundle = json('public/assets/companion-dog/bundle.json');
    const animations = json(`public/assets/companion-dog/${bundle.animations}`);
    const atlas = json(`public/assets/companion-dog/${bundle.atlas}`);
    const game = json(`public/assets/companion-dog/${bundle.game}`);
    assert.equal(bundle.frameCount, 50);
    assert.equal(game.body, undefined);
    const registered = new Map();
    const scene = {
        cache: { json: { get: key => key === 'companion-dog-anim' ? animations : undefined } },
        anims: {
            exists: key => !key.startsWith('companion-dog-') || registered.has(key),
            create: config => registered.set(config.key, config),
        },
    };
    new AnimationsSystem(scene).registerAnimations();
    const { system } = companionFixture();
    const suffixes = { e: '', w: '', s: '-front', se: '-front45', sw: '-front45',
        n: '-back', ne: '-back45', nw: '-back45' };
    for (const [facing, suffix] of Object.entries(suffixes)) {
        system.facing = facing;
        system.update(0);
        assert.equal(system.dog.animation, `companion-dog-idle${suffix}`);
        assert.equal(system.dog.flipX, ['w', 'sw', 'nw'].includes(facing));
        for (const action of ['idle', 'walk']) {
            const key = `companion-dog-${action}${suffix}`;
            const animation = registered.get(key);
            assert.ok(animation, key);
            assert.equal(animation.repeat, -1);
            assert.equal(animation.frames.length, action === 'idle' ? 4 : 6);
            for (const frame of animation.frames) {
                assert.ok(atlas.frames[frame.frame], frame.frame);
                assert.equal(frame.key, 'companion-dog');
                assert.ok(frame.duration > 0);
            }
        }
    }
});


test('preloader requests the complete companion bundle with matching cache keys', () => {
    const { Preloader } = load('scenes/Preloader.ts');
    const preloader = new Preloader();
    let base = '';
    const loaded = new Map();
    function record(key, ...files) {
        loaded.set(key, files.filter(file => typeof file === 'string').map(file => path.resolve(__dirname, '../public', base, file)));
    }
    preloader.load = { audio() {},
        setPath(value) { base = value; },
        atlas: record, json: record, spritesheet: record, tilemapTiledJSON: record,
    };
    preloader.preload();
    for (const key of ['companion-dog', 'companion-dog-anim', 'companion-dog-game']) {
        assert.ok(loaded.has(key), key);
        for (const file of loaded.get(key)) assert.ok(fs.existsSync(file), file);
    }
});

const { BossSystem } = load('systems/BossSystem.ts');
function combatSprite(texture = 'bullet') {
    const events = new Map();
    const sprite = {
        active: true, visible: true, x: 400, y: 400, height: 512, texture, data: {}, plays: [],
        body: { enable: true, setEnable(value) { this.enable = value; } },
        anims: { currentAnim: null, isPlaying: false, stop() { this.currentAnim = null; this.isPlaying = false; } },
        play(key) { this.plays.push(key); this.anims.currentAnim = { key }; this.anims.isPlaying = true;
            this.texture = key.startsWith('dragon-') ? 'dragon' : this.texture; return this; },
        once(event, callback) { events.set(event, callback); return this; },
        complete(key) { this.anims.isPlaying = false; const event = `animationcomplete-${key}`;
            const callback = events.get(event); events.delete(event); callback?.(); },
        setActive(v) { this.active = v; return this; }, setVisible(v) { this.visible = v; return this; },
        setTexture(key, frame) { this.texture = key; this.frame = frame; return this; },
        setScale(v) { this.scale = v; this.displayHeight = this.height * v; return this; },
        setOrigin() { return this; }, setSize() { return this; }, setOffset() { return this; },
        setDepth(v) { this.depth = v; return this; }, setFlipX(v) { this.flipX = v; return this; },
        setFlip(x, y) { this.flipX = x; this.flipY = y; return this; },
        setTint(v) { this.tint = v; return this; }, clearTint() { this.tint = null; return this; },
        setAlpha(v) { this.alpha = v; return this; }, setRotation(v) { this.rotation = v; return this; },
        setVelocity(x, y) { this.velocity = { x, y }; return this; },
        getData(k) { return this.data[k]; }, setData(k, v) { this.data[k] = v; return this; },
        destroy() { this.active = false; },
    };
    sprite.body.setSize = () => {};
    return sprite;
}
function firingFixture(weapon) {
    const { scene, projectile } = bossFixture();
    const events = new Map();
    const pointer = { isDown: false, left: false, worldX: 700, worldY: 300,
        leftButtonDown() { return this.left; }, updateWorldPoint() { return this; } };
    scene.input = {
        activePointer: pointer,
        keyboard: { createCursorKeys: () => ({ space: { isDown: false } }), addKey: () => ({}), on() {} },
        on(event, callback) { events.set(event, callback); },
    };
    scene.controls = new ControlsSystem(scene);
    scene.controls.setupInput();
    scene.weapons.activeWeapon = weapon;
    scene.weapons.currentAmmo = weapon === 'shotgun' ? SHOTGUN_MAX_AMMO : RIFLE_MAX_AMMO;
    const emitted = [];
    scene.weapons.bullets.get = () => { const p = projectile(); emitted.push(p); return p; };
    return { scene, pointer, emitted, click: () => events.get('pointerdown')(pointer) };
}

for (const weapon of ['rifle', 'shotgun']) {
    const magazine = weapon === 'shotgun' ? SHOTGUN_MAX_AMMO : RIFLE_MAX_AMMO;
    const rate = weapon === 'shotgun' ? SHOTGUN_FIRE_RATE : FIRE_RATE;
    const pellets = weapon === 'shotgun' ? SHOTGUN_PELLETS : 1;

    test(`${weapon}: click event plus held mouse/Space consumes one round per cooldown`, () => {
        const { scene, pointer, emitted, click } = firingFixture(weapon);
        pointer.left = pointer.isDown = true;
        click();
        scene.controls.cursors.space.isDown = true;
        scene.weapons.updateFiring(scene.time.now);
        assert.equal(scene.weapons.currentAmmo, magazine - 1);
        assert.equal(emitted.length, pellets);

        scene.time.now += rate - 1;
        click();
        scene.weapons.updateFiring(scene.time.now);
        assert.equal(scene.weapons.currentAmmo, magazine - 1);
        scene.time.now++;
        scene.weapons.updateFiring(scene.time.now);
        assert.equal(scene.weapons.currentAmmo, magazine - 2);
        assert.equal(emitted.length, pellets * 2);
    });

    test(`${weapon}: Space and quick mouse taps each consume one round`, () => {
        for (const input of ['space', 'click']) {
            const { scene, pointer, emitted, click } = firingFixture(weapon);
            if (input === 'space') scene.controls.cursors.space.isDown = true;
            else {
                pointer.left = pointer.isDown = true;
                click();
                pointer.left = pointer.isDown = false;
            }
            scene.weapons.updateFiring(scene.time.now);
            assert.equal(scene.weapons.currentAmmo, magazine - 1);
            assert.equal(emitted.length, pellets);
        }
    });
}

test('firing ignores right clicks and blocks both input paths during overlays, reload and death', () => {
    const { scene, pointer, emitted, click } = firingFixture('rifle');
    pointer.isDown = true;
    click();
    scene.weapons.updateFiring(scene.time.now);
    assert.equal(emitted.length, 0);
    pointer.left = true;
    scene.controls.cursors.space.isDown = true;
    for (const [owner, flag] of [[scene.menu, 'isMenuOpen'], [scene.shop, 'isShopOpen'],
        [scene.chat, 'isChatOpen'], [scene.weapons, 'isReloading'], [scene.playerController, 'isPlayerDead']]) {
        owner[flag] = true;
        click();
        scene.weapons.updateFiring(scene.time.now);
        owner[flag] = false;
    }
    assert.equal(emitted.length, 0);
    assert.equal(scene.weapons.currentAmmo, RIFLE_MAX_AMMO);
    for (let restart = 0; restart < 2; restart++) {
        click();
        assert.equal(scene.weapons.currentAmmo, RIFLE_MAX_AMMO - 1);
        scene.weapons.reset();
        assert.equal(scene.weapons.fireDelay, 0);
    }
});

function bossFixture() {
    const { scene } = fixture();
    const timers = [], overlaps = [], tweens = [], projectiles = new Set();
    scene.playerController.player = { x: 300, y: 300, displayHeight: 64, flipX: false, play() {} };
    scene.playerController.playerFacing = 'e';
    scene.playerController.facePlayer = () => {};
    scene.chat.addChatMessage = () => {};
    scene.cameras.main.shake = () => {};
    scene.time = { now: 1000, delayedCall(ms, callback) { timers.push({ ms, callback }); } };
    scene.tweens = { add: config => tweens.push(config) };
    scene.physics = { add: {
        sprite(x, y) { const dragon = combatSprite('dragon'); dragon.x = x; dragon.y = y; return dragon; },
        overlap(first, second, callback) { const collider = { first, second, callback, world: {},
            destroy() { this.destroyed = true; this.world = null; } }; overlaps.push(collider); return collider; },
    } };
    scene.weapons.bullets = {
        contains: value => projectiles.has(value),
        killAndHide(value) { assert.ok(projectiles.has(value), 'Only bullets may be retired'); value.active = false; value.visible = false; },
    };
    const boss = new BossSystem(scene);
    scene.boss = boss;
    boss.createBossBar = () => {};
    boss.updateBossBar = () => {};
    boss.summonAncientDragon();
    return { scene, boss, timers, overlaps, tweens, projectile() { const p = combatSprite(); projectiles.add(p); return p; } };
}

test('dragon overlap resolves both callback orders and only animates the actual boss', () => {
    for (const reversed of [false, true]) {
        const { boss, projectile, overlaps } = bossFixture();
        const dragon = boss.dragon;
        assert.equal(dragon.displayHeight, 64 * 4);
        assert.equal(overlaps[0].first, dragon);
        const bullet = projectile();
        const callback = overlaps[0].callback;
        if (reversed) callback(bullet, dragon); else callback(dragon, bullet);
        assert.equal(boss.dragonHp, 49);
        assert.equal(dragon.anims.currentAnim.key, 'dragon-hurt');
        assert.equal(dragon.scale, 0.5);
        assert.equal(bullet.texture, 'bullet');
        assert.equal(bullet.active, false);
        assert.equal(bullet.body.enable, false);
        assert.equal(bullet.plays.length, 0);
        dragon.complete('dragon-hurt');
        assert.equal(dragon.anims.currentAnim.key, 'dragon-fly');
        assert.equal(dragon.displayHeight, 256);
        boss.bulletHitDragon(dragon, combatSprite());
        assert.equal(boss.dragonHp, 49, 'Foreign sprites cannot damage the boss');
    }
});

test('dragon death never converts bullets, rewards once and cannot be undone by hurt completion', () => {
    const { boss, scene, projectile, overlaps } = bossFixture();
    const dragon = boss.dragon;
    boss.bulletHitDragon(dragon, projectile());
    boss.dragonHp = 1;
    const lethalBullet = projectile();
    boss.bulletHitDragon(dragon, lethalBullet);
    assert.equal(boss.isDragonDead, true);
    assert.equal(dragon.anims.currentAnim.key, 'dragon-die');
    assert.equal(dragon.body.enable, false);
    assert.equal(dragon.scale, 0.5);
    assert.equal(lethalBullet.texture, 'bullet');
    assert.equal(lethalBullet.plays.length, 0);
    assert.equal(scene.score, 100);
    assert.equal(overlaps[0].destroyed, true);
    const laterBullet = projectile();
    boss.bulletHitDragon(dragon, laterBullet);
    assert.equal(laterBullet.active, true, 'Corpse no longer consumes bullets');
    assert.equal(scene.score, 100);
    dragon.complete('dragon-hurt');
    assert.equal(dragon.anims.currentAnim.key, 'dragon-die');
});

test('stale boss bar callbacks and old dragon hits cannot affect a replacement boss', () => {
    const { boss, projectile, tweens, overlaps } = bossFixture();
    const oldDragon = boss.dragon;
    let oldDestroyed = 0, newDestroyed = 0;
    boss.bossBarContainer = { destroy: () => oldDestroyed++ };
    boss.dragonHp = 1;
    boss.bulletHitDragon(oldDragon, projectile());
    const fade = tweens.find(t => t.onComplete);
    boss.summonAncientDragon();
    assert.equal(overlaps.length, 2);
    boss.bossBarContainer = { destroy: () => newDestroyed++ };
    fade.onComplete();
    assert.equal(oldDestroyed, 1); assert.equal(newDestroyed, 0);
    boss.bulletHitDragon(oldDragon, projectile());
    assert.equal(boss.dragonHp, 50);
    boss.reset(); boss.summonAncientDragon();
    assert.equal(boss.dragonHp, 50); assert.equal(boss.isDragonDead, false);
    boss.reset(); boss.summonAncientDragon();
    assert.equal(boss.dragon.displayHeight, 256);
});

test('pooled projectiles restore texture/physics and ignore earlier generation expiry timers', () => {
    const { scene, projectile, timers } = bossFixture();
    const bullet = projectile();
    bullet.height = 3;
    bullet.play('dragon-die'); bullet.body.enable = false;
    scene.weapons.bullets.get = () => bullet;
    scene.weapons.rifleAmmo = 7;
    scene.weapons.fireBulletAt(700, 300);
    assert.equal(bullet.texture, 'bullet');
    assert.equal(bullet.anims.currentAnim.key, 'bullet-fly');
    assert.equal(bullet.body.enable, true);
    const oldExpiry = timers.find(t => t.ms === 1600);
    scene.weapons.retireProjectile(bullet);
    scene.weapons.hasShotgun = true;
    scene.weapons.activeWeapon = 'shotgun';
    scene.weapons.shotgunAmmo = 4;
    scene.weapons.fireBulletAt(700, 300);
    assert.equal(bullet.texture, 'weapons');
    assert.equal(bullet.frame, 'shotgun-pellet');
    assert.equal(bullet.anims.isPlaying, false);
    oldExpiry.callback();
    assert.equal(bullet.active, true, 'An earlier rifle lifetime must not retire the reused pellet');
    assert.equal(bullet.body.enable, true);
});

test('dragon animation registration preserves every source duration and texture key', () => {
    const animations = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/assets/dragon/dragon.animations.json')));
    const registered = new Map();
    new AnimationsSystem({
        cache: { json: { get: key => key === 'dragon-anim' ? animations : undefined } },
        anims: { exists: key => !key.startsWith('dragon-'), create: config => registered.set(config.key, config) },
    }).registerAnimations();
    for (const source of animations.animations) {
        const animation = registered.get(`dragon-${source.name}`);
        assert.equal(animation.repeat, source.loop ? -1 : 0);
        assert.deepEqual(Array.from(animation.frames, f => f.duration), source.frames.map(f => f.durationMs));
        assert.ok(animation.frames.every(f => f.key === 'dragon'));
    }
});

test('dragon attack keeps the larger size and old attack effects cannot reach a new summon', () => {
    const { boss, timers, projectile } = bossFixture();
    const firstDragon = boss.dragon;
    boss.updateDragonBoss(5000);
    assert.equal(firstDragon.anims.currentAnim.key, 'dragon-attack');
    assert.equal(firstDragon.displayHeight, 256);
    const impact = timers.find(t => t.ms === 220);
    assert.ok(impact);
    boss.dragonHp = 1;
    boss.bulletHitDragon(firstDragon, projectile());
    boss.summonAncientDragon();
    boss.launchDragonFireballs = () => assert.fail('A stale attack cannot emit fireballs from a new dragon');
    impact.callback();
    firstDragon.complete('dragon-attack');
    assert.equal(boss.dragon.anims.currentAnim.key, 'dragon-idle');
});

test('projectile retirement refuses the dragon or any object outside the bullet pool', () => {
    const { scene, boss } = bossFixture();
    scene.weapons.retireProjectile(boss.dragon);
    assert.equal(boss.dragon.active, true);
    assert.equal(boss.dragon.body.enable, true);
    assert.equal(boss.dragon.texture, 'dragon');
});

test('shop purchases first-aid kits for 2 kills and rejects insufficient funds', () => {
    const { scene } = fixture();
    scene.score = FIRST_AID_PRICE - 1; // 1 kill
    scene.shop.buyFirstAidKit();
    assert.equal(scene.score, 1);
    assert.equal(scene.playerController.medkits, 0);

    scene.score = 5; // 5 kills
    scene.shop.buyFirstAidKit();
    assert.equal(scene.score, 3);
    assert.equal(scene.playerController.medkits, 1);

    scene.shop.buyFirstAidKit();
    assert.equal(scene.score, 1);
    assert.equal(scene.playerController.medkits, 2);

    // Insufficient for a 3rd purchase
    scene.shop.buyFirstAidKit();
    assert.equal(scene.score, 1);
    assert.equal(scene.playerController.medkits, 2);
});

test('using first-aid kit consumes kit and restores health, rejecting when full or empty', () => {
    let tintSet = 0;
    let fxSpawned = 0;
    const scene = {
        hud: { updateHUD() {}, flashProximityAlert() {} },
        weapons: { activeWeapon: 'rifle', isReloading: false },
        time: { delayedCall: (ms, cb) => cb(), addEvent: () => ({ destroy() {} }) },
        add: {
            sprite: () => {
                fxSpawned++;
                return {
                    setOrigin() {}, setDepth() {}, play() {},
                    setPosition() {}, once: (event, cb) => cb(), destroy() {}
                };
            }
        }
    };
    const playerCtrl = new PlayerControllerSystem(scene);
    playerCtrl.player = {
        x: 200, y: 300, depth: 50,
        setTint: () => { tintSet++; },
        clearTint: () => {}
    };

    // Full health: kit should not be consumed or wasted
    playerCtrl.medkits = 2;
    playerCtrl.playerHealth = 5;
    playerCtrl.maxHealth = 5;
    const fullUse = playerCtrl.useMedkit();
    assert.equal(fullUse, false);
    assert.equal(playerCtrl.medkits, 2);
    assert.equal(playerCtrl.playerHealth, 5);

    // Damaged: health 3/5, using kit should restore +2 HP to 5/5
    playerCtrl.playerHealth = 3;
    const healSuccess = playerCtrl.useMedkit();
    assert.equal(healSuccess, true);
    assert.equal(playerCtrl.playerHealth, 5);
    assert.equal(playerCtrl.medkits, 1);
    assert.ok(fxSpawned > 0, 'Healing FX sprite must be spawned');
    assert.ok(tintSet > 0, 'Player tint flash must be triggered');

    // Damaged: health 4/5, using kit heals up to max 5/5
    playerCtrl.playerHealth = 4;
    playerCtrl.useMedkit();
    assert.equal(playerCtrl.playerHealth, 5);
    assert.equal(playerCtrl.medkits, 0);

    // 0 medkits remaining: using kit rejected
    playerCtrl.playerHealth = 2;
    const emptyUse = playerCtrl.useMedkit();
    assert.equal(emptyUse, false);
    assert.equal(playerCtrl.playerHealth, 2);

    // Reset restores per-run defaults
    playerCtrl.reset();
    assert.equal(playerCtrl.medkits, 0);
    assert.equal(playerCtrl.playerHealth, 5);
});

test('preloader loads heal-fx bundle and animations are registered', () => {
    const { Preloader } = load('scenes/Preloader.ts');
    const preloader = new Preloader();
    let base = '';
    const loaded = new Map();
    function record(key, ...files) {
        loaded.set(key, files.filter(file => typeof file === 'string').map(file => path.resolve(__dirname, '../public', base, file)));
    }
    preloader.load = { audio() {},
        setPath(value) { base = value; },
        atlas: record, json: record, spritesheet: record, tilemapTiledJSON: record,
    };
    preloader.preload();
    assert.ok(loaded.has('heal-fx'), 'heal-fx atlas must be loaded');
    assert.ok(loaded.has('heal-fx-anim'), 'heal-fx animations JSON must be loaded');

    // Test AnimationSystem registration
    const healAnimations = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/assets/heal-fx/heal-fx.animations.json')));
    const registered = new Map();
    new AnimationsSystem({
        cache: { json: { get: key => key === 'heal-fx-anim' ? healAnimations : undefined } },
        anims: { exists: key => !key.startsWith('heal-fx-'), create: config => registered.set(config.key, config) },
    }).registerAnimations();

    const anim = registered.get('heal-fx-heal-play');
    assert.ok(anim, 'heal-fx-heal-play must be registered');
    assert.equal(anim.repeat, 0);
    assert.equal(anim.frames.length, 6);
    assert.ok(anim.frames.every(f => f.key === 'heal-fx'));
});


test('dragon follows every compass view and locks directional hurt/attack/death keys', () => {
    const cases = [['e',1,0,''],['se',1,1,'-front45'],['s',0,1,'-front'],['sw',-1,1,'-front45'],
        ['w',-1,0,''],['nw',-1,-1,'-back45'],['n',0,-1,'-back'],['ne',1,-1,'-back45']];
    for (const [facing,dx,dy,suffix] of cases) {
        const { boss, scene, projectile } = bossFixture();
        scene.physics.moveToObject = () => {};
        boss.dragon.x = 700; boss.dragon.y = 700;
        scene.playerController.player.x = 700 + dx * 300;
        scene.playerController.player.y = 700 + dy * 300;
        boss.updateDragonBoss(1500);
        assert.equal(boss.dragonFacing, facing);
        assert.equal(boss.dragon.anims.currentAnim.key, `dragon-fly${suffix}`);
        boss.bulletHitDragon(boss.dragon, projectile());
        assert.equal(boss.dragon.anims.currentAnim.key, `dragon-hurt${suffix}`);
        boss.dragon.complete(`dragon-hurt${suffix}`);
        assert.equal(boss.dragon.anims.currentAnim.key, `dragon-fly${suffix}`);
        boss.updateDragonBoss(5000);
        assert.equal(boss.dragon.anims.currentAnim.key, `dragon-attack${suffix}`);
        const locked = boss.dragonFacing;
        scene.playerController.player.x = 700 - dx * 300;
        scene.playerController.player.y = 700 - dy * 300;
        boss.updateDragonBoss(5100);
        assert.equal(boss.dragonFacing, locked);
        boss.dragonHp = 1;
        boss.bulletHitDragon(boss.dragon, projectile());
        assert.equal(boss.dragon.anims.currentAnim.key, `dragon-die${suffix}`);
        assert.equal(boss.dragon.displayHeight, 256);
    }
});

test('all dragon view bundles load, register and preserve uniform size and action duration', () => {
    const root = path.resolve(__dirname, '..');
    const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    const views = ['', '-front', '-front45', '-back', '-back45'];
    const cached = new Map(), registered = new Map();
    for (const suffix of views) {
        const key = `dragon${suffix}`;
        const bundle = json(`public/assets/${key}/bundle.json`);
        const metadata = json(`public/assets/${key}/${bundle.animations}`);
        const atlas = json(`public/assets/${key}/${bundle.atlas}`);
        const game = json(`public/assets/${key}/${bundle.game}`);
        assert.equal(bundle.frameCount, 27);
        assert.equal(metadata.animations.length, 5);
        assert.ok(game.game.anchors.find(a => a.name === 'muzzle'));
        for (const frame of Object.values(atlas.frames)) {
            assert.equal(frame.sourceSize.w, 512); assert.equal(frame.sourceSize.h * 0.5, 256);
        }
        cached.set(`${key}-anim`, metadata);
    }
    new AnimationsSystem({
        cache: { json: { get: key => cached.get(key) } },
        anims: { exists: key => !key.startsWith('dragon-') || registered.has(key),
            create: config => registered.set(config.key, config) },
    }).registerAnimations();
    const expected = {idle:[6,1040],fly:[8,640],attack:[6,880],hurt:[2,180],die:[5,1210]};
    for (const suffix of views) for (const [action,[count,total]] of Object.entries(expected)) {
        const animation = registered.get(`dragon-${action}${suffix}`);
        assert.ok(animation);
        assert.equal(animation.frames.length, count);
        assert.equal(animation.frames.reduce((n,f) => n + f.duration, 0), total);
        assert.ok(animation.frames.every(f => f.key === `dragon${suffix}`));
    }
    const { Preloader } = load('scenes/Preloader.ts');
    const preloader = new Preloader();
    let base = ''; const loaded = new Map();
    const record = (key,...files) => loaded.set(key,files.filter(f => typeof f === 'string').map(f => path.join(root,'public',base,f)));
    preloader.load = { audio() {},setPath(p){base=p;},atlas:record,json:record,spritesheet:record,tilemapTiledJSON:record};
    preloader.preload();
    for (const suffix of views) for (const key of [`dragon${suffix}`,`dragon${suffix}-anim`,`dragon${suffix}-game`]) {
        assert.ok(loaded.has(key),key);
        for (const file of loaded.get(key)) assert.ok(fs.existsSync(file),file);
    }
});

test('dragon fireballs originate at the correct mirrored mouth for every view', () => {
    const { boss, scene } = bossFixture();
    const { playerPose } = load('player-facing.ts');
    const positions = [];
    boss.dragonFireballs = {create(x,y){positions.push({x,y});return combatSprite();}};
    scene.cache = {json:{get(key){return JSON.parse(fs.readFileSync(path.resolve(__dirname,`../public/assets/${key.replace(/-game$/,'')}/${key.replace(/-game$/,'')}.game.json`)));}}};
    for (const facing of ['e','se','s','sw','w','nw','n','ne']) {
        boss.dragonFacing = facing;
        const pose = playerPose(facing);
        boss.dragon.setFlipX(pose.flip);
        positions.length = 0;
        boss.launchDragonFireballs();
        const game = scene.cache.json.get(`dragon${pose.suffix}-game`);
        const anchor = game.game.anchors.find(a => a.name === 'muzzle');
        assert.equal(positions.length,3);
        assert.equal(positions[0].x,boss.dragon.x+(anchor.x-256)*(pose.flip?-1:1)*0.5);
        assert.equal(positions[0].y,boss.dragon.y+(anchor.y-512*0.85)*0.5);
    }
});

test('hud displays icon-rifle for rifle and icon-shotgun for shotgun, with matching atlas frames', () => {
    const hudJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/game/assets-src/hud/hud.sprite.json'), 'utf8'));
    const atlasJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/assets/hud/hud.atlas.json'), 'utf8'));
    
    assert.ok(hudJson.frames.some(f => f.id === 'icon-rifle'), 'hud.sprite.json must contain icon-rifle');
    assert.ok(hudJson.frames.some(f => f.id === 'icon-shotgun'), 'hud.sprite.json must contain icon-shotgun');
    assert.ok(atlasJson.frames['icon-rifle'], 'character.atlas.json must contain icon-rifle');
    assert.ok(atlasJson.frames['icon-shotgun'], 'character.atlas.json must contain icon-shotgun');

    const { HudSystem } = load('systems/HudSystem.ts');
    let ammoIconRef = null;
    const mockSprite = (x, y) => {
        const sprite = {
            setScrollFactor(value) { this.scrollFactorX=value; return this; },
            setScale() { return this; },
            setInteractive() { return this; },
            on() { return this; },
            setFrame(f) { this.frame = f; return this; },
            setVisible() { return this; },
            destroy() {},
            frame: ''
        };
        if (x === 38 && y === 88) ammoIconRef = sprite;
        return sprite;
    };
    const mockText = () => ({
        setScrollFactor() { return this; },
        setText() { return this; },
        setColor() { return this; },
        setOrigin() { return this; },
        setInteractive() { return this; },
        on() { return this; },
        setVisible() { return this; },
        destroy() {}
    });
    const mockRect = () => ({
        setScrollFactor() { return this; },
        setStrokeStyle() { return this; },
        setOrigin() { return this; },
        setInteractive() { return this; },
        on() { return this; },
        setVisible() { return this; },
        destroy() {}
    });
    const mockContainer = () => ({
        setScrollFactor() { return this; },
        setDepth() { return this; },
        add() { return this; },
        setVisible() { return this; },
        destroy() {}
    });

    const scene = {
        score: 0,
        character: 'player',
        playerController: { playerHealth: 5, maxHealth: 5, medkits: 1, currentCharacter: 'player', switchCharacter() {} },
        weapons: {
            activeWeapon: 'rifle',
            rifleAmmo: 7,
            shotgunAmmo: 4,
            currentAmmo: 7,
            maxAmmo: 7,
            hasShotgun: true,
            isReloading: false
        },
        menu: { createMenu() {}, updateMenuElements() {} },
        shop: { updateShopElements() {} },
        add: {
            sprite: mockSprite,
            text: mockText,
            rectangle: mockRect,
            image: mockSprite,
            container: mockContainer
        }
    };

    const hud = new HudSystem(scene);
    hud.createHUD();
    hud.updateHUD();
    assert.equal(ammoIconRef.frame, 'icon-rifle', 'updateHUD must set icon-rifle when rifle is active');

    scene.weapons.activeWeapon = 'shotgun';
    hud.updateHUD();
    assert.equal(ammoIconRef.frame, 'icon-shotgun', 'updateHUD must set icon-shotgun when shotgun is active');

    // Verify Preloader loads existing hud atlas and game files
    const root = path.resolve(__dirname, '..');
    const { Preloader } = load('scenes/Preloader.ts');
    const preloader = new Preloader();
    let base = '';
    const loaded = new Map();
    const record = (key, ...files) => loaded.set(key, files.filter(f => typeof f === 'string').map(f => path.join(root, 'public', base, f)));
    preloader.load = { audio() {}, setPath(p) { base = p; }, atlas: record, json: record, spritesheet: record, tilemapTiledJSON: record };
    preloader.preload();
    assert.ok(loaded.has('hud'), 'Preloader must queue hud atlas');
    for (const file of loaded.get('hud')) assert.ok(fs.existsSync(file), `HUD file must exist: ${file}`);
    assert.ok(loaded.has('hud-game'), 'Preloader must queue hud-game json');
    for (const file of loaded.get('hud-game')) assert.ok(fs.existsSync(file), `HUD game file must exist: ${file}`);
});

test('player and heroine walking reload animations for rifle and shotgun', () => {
    const { playerAnimation } = load('player-facing.ts');

    // 1. Verify playerAnimation keys for rifle
    assert.equal(playerAnimation('player', 'reload-walk', 'e', 'rifle'), 'player-reload-walk');
    assert.equal(playerAnimation('player', 'reload-walk', 's', 'rifle'), 'player-reload-walk-front');
    assert.equal(playerAnimation('player', 'reload-walk', 'se', 'rifle'), 'player-reload-walk-front45');
    assert.equal(playerAnimation('player', 'reload-walk', 'n', 'rifle'), 'player-reload-walk-back');
    assert.equal(playerAnimation('player', 'reload-walk', 'ne', 'rifle'), 'player-reload-walk-back45');

    assert.equal(playerAnimation('heroine', 'reload-walk', 'e', 'rifle'), 'heroine-reload-walk');
    assert.equal(playerAnimation('heroine', 'reload-walk', 's', 'rifle'), 'heroine-reload-walk-front');
    assert.equal(playerAnimation('heroine', 'reload-walk', 'se', 'rifle'), 'heroine-reload-walk-front45');
    assert.equal(playerAnimation('heroine', 'reload-walk', 'n', 'rifle'), 'heroine-reload-walk-back');
    assert.equal(playerAnimation('heroine', 'reload-walk', 'ne', 'rifle'), 'heroine-reload-walk-back45');

    // 2. Verify playerAnimation keys for shotgun
    assert.equal(playerAnimation('player', 'reload-walk', 'e', 'shotgun'), 'player-shotgun-reload-walk');
    assert.equal(playerAnimation('player', 'reload-walk', 's', 'shotgun'), 'player-shotgun-reload-walk-front');
    assert.equal(playerAnimation('player', 'reload-walk', 'se', 'shotgun'), 'player-shotgun-reload-walk-front45');
    assert.equal(playerAnimation('player', 'reload-walk', 'n', 'shotgun'), 'player-shotgun-reload-walk-back');
    assert.equal(playerAnimation('player', 'reload-walk', 'ne', 'shotgun'), 'player-shotgun-reload-walk-back45');

    assert.equal(playerAnimation('heroine', 'reload-walk', 'e', 'shotgun'), 'heroine-shotgun-reload-walk');
    assert.equal(playerAnimation('heroine', 'reload-walk', 's', 'shotgun'), 'heroine-shotgun-reload-walk-front');
    assert.equal(playerAnimation('heroine', 'reload-walk', 'se', 'shotgun'), 'heroine-shotgun-reload-walk-front45');
    assert.equal(playerAnimation('heroine', 'reload-walk', 'n', 'shotgun'), 'heroine-shotgun-reload-walk-back');
    assert.equal(playerAnimation('heroine', 'reload-walk', 'ne', 'shotgun'), 'heroine-shotgun-reload-walk-back45');

    // 3. Verify PlayerControllerSystem selects reload-walk when moving and reload when stationary
    let playedAnim = null;
    const mockSprite = {
        x: 0, y: 33,
        play: (key) => { playedAnim = key; },
        anims: {
            isPlaying: false,
            currentAnim: null,
            play: (key) => { playedAnim = key; }
        },
        body: {
            velocity: { x: 0, y: 0, normalize() { return this; }, scale() { return this; } },
            setSize() {},
            setOffset() {}
        },
        setVelocity(x, y) {
            mockSprite.body.velocity.x = x;
            mockSprite.body.velocity.y = y;
        },
        setFlipX() {},
        setTexture() {},
        setTint() {},
        clearTint() {}
    };

    const scene = {
        weapons: { isReloading: true, activeWeapon: 'rifle' },
        input: { activePointer: { isDown: false, worldX: 0, worldY: 0 } },
        controls: {
            aimPointer: () => ({ worldX: 100, worldY: 0 }),
            cursors: { left: { isDown: false }, right: { isDown: false }, up: { isDown: false }, down: { isDown: false } },
            wasd: { left: { isDown: false }, right: { isDown: false }, up: { isDown: false }, down: { isDown: false } }
        },
        hud: { updateHUD() {}, flashProximityAlert() {} }
    };

    const pc = new PlayerControllerSystem(scene);
    pc.player = mockSprite;

    // Stationary reload -> 'player-reload'
    pc.updateMovement();
    assert.equal(playedAnim, 'player-reload', 'Stationary reload should play static reload animation');

    // Moving reload -> 'player-reload-walk'
    scene.controls.wasd.right.isDown = true;
    pc.updateMovement();
    assert.equal(playedAnim, 'player-reload-walk', 'Moving reload should play walking reload animation');

    // Switch to shotgun while moving -> 'player-shotgun-reload-walk'
    scene.weapons.activeWeapon = 'shotgun';
    pc.updateMovement();
    assert.equal(playedAnim, 'player-shotgun-reload-walk', 'Moving shotgun reload should play shotgun-reload-walk');

    // Stop moving -> 'player-shotgun-reload'
    scene.controls.wasd.right.isDown = false;
    pc.updateMovement();
    assert.equal(playedAnim, 'player-shotgun-reload', 'Stopping movement while reloading should transition to static reload');

    // 4. Verify animations exist in exported player and heroine animations.json
    const root = path.resolve(__dirname, '..');
    const playerAnims = JSON.parse(fs.readFileSync(path.join(root, 'public/assets/player/player.animations.json'), 'utf8'));
    const heroineAnims = JSON.parse(fs.readFileSync(path.join(root, 'public/assets/heroine/heroine.animations.json'), 'utf8'));

    const expectedAnims = [
        'reload-walk',
        'reload-walk-front',
        'reload-walk-front45',
        'reload-walk-back',
        'reload-walk-back45',
        'shotgun-reload-walk',
        'shotgun-reload-walk-front',
        'shotgun-reload-walk-front45',
        'shotgun-reload-walk-back',
        'shotgun-reload-walk-back45'
    ];

    const playerAnimNames = new Set(playerAnims.animations.map(a => a.name));
    const heroineAnimNames = new Set(heroineAnims.animations.map(a => a.name));

    for (const name of expectedAnims) {
        assert.ok(playerAnimNames.has(name), `Player animations must contain ${name}`);
        assert.ok(heroineAnimNames.has(name), `Heroine animations must contain ${name}`);
    }
});



test('pointer facing supports eight directions, strafing, reload and camera scrolling', () => {
    const keys = Object.fromEntries(['left', 'right', 'up', 'down'].map(k => [k, { isDown: false }]));
    const camera = { scrollX: 100, scrollY: 50 };
    const pointer = { x: 0, y: 0, worldX: 0, worldY: 0, updateWorldPoint(cam) {
        this.worldX = this.x + cam.scrollX; this.worldY = this.y + cam.scrollY;
    } };
    const scene = { controls: { cursors: keys, wasd: keys }, cameras: { main: camera },
        input: { activePointer: pointer }, weapons: { activeWeapon: 'rifle', isReloading: false } };
    scene.controls.aimPointer = new ControlsSystem(scene).aimPointer;
    const controller = new PlayerControllerSystem(scene);
    const velocity = { x: 0, y: 0, normalize() { const d = Math.hypot(this.x, this.y); this.x /= d; this.y /= d; return this; },
        scale(v) { this.x *= v; this.y *= v; return this; } };
    const anims = { isPlaying: false, currentAnim: null, progress: 0.6,
        play(key) { this.currentAnim = { key }; return this; },
        getProgress() { return this.progress; }, setProgress(v) { this.progress = v; } };
    controller.player = { x: 500, y: 400, body: { velocity }, anims,
        setVelocity(x, y) { velocity.x = x; velocity.y = y; }, setFlipX(v) { this.flipX = v; } };
    for (const [facing, dx, dy] of [['e',1,0],['se',1,1],['s',0,1],['sw',-1,1],['w',-1,0],['nw',-1,-1],['n',0,-1],['ne',1,-1]]) {
        pointer.x = 500 + dx * 100 - camera.scrollX;
        pointer.y = 367 + dy * 100 - camera.scrollY;
        controller.updateMovement();
        assert.equal(controller.playerFacing, facing);
        assert.equal(velocity.x, 0);
    }
    pointer.x = 600 - camera.scrollX; pointer.y = 367 - camera.scrollY;
    keys.left.isDown = true;
    controller.updateMovement();
    assert.equal(controller.playerFacing, 'e');
    assert.ok(velocity.x < 0, 'Can move left while aiming right');
    scene.weapons.isReloading = true;
    controller.updateMovement();
    assert.equal(anims.currentAnim.key, 'player-reload-walk');
    keys.left.isDown = false;
    camera.scrollX -= 200; // Stationary screen pointer now lies west of the player.
    controller.updateMovement();
    assert.equal(controller.playerFacing, 'w');
    assert.equal(controller.player.flipX, true);
    scene.weapons.isReloading = false;
    anims.isPlaying = true; anims.currentAnim.key = 'player-shoot-front';
    controller.updateMovement();
    assert.equal(anims.currentAnim.key, 'player-shoot');
    assert.equal(anims.progress, 0.6);
    controller.isPlayerHurt = true;
    camera.scrollX += 200;
    controller.updateMovement();
    assert.equal(controller.playerFacing, 'w', 'Hurt pose remains locked');
});

test('Space and mouse shots use the same freshly projected pointer target', () => {
    for (const source of ['space', 'click', 'held']) {
        const { scene, pointer, click } = firingFixture('rifle');
        pointer.updateWorldPoint = () => { pointer.worldX = 543; pointer.worldY = 321; };
        const targets = [];
        scene.weapons.fireBulletAt = (x, y) => targets.push([x, y]);
        if (source === 'space') scene.controls.cursors.space.isDown = true;
        else pointer.left = true;
        if (source === 'click') click();
        else scene.weapons.updateFiring(scene.time.now);
        assert.deepEqual(targets, [[543, 321]]);
    }
});

const { WitchSystem } = load('systems/WitchSystem.ts');
const { EnemiesSystem } = load('systems/EnemiesSystem.ts');
const { WITCH_ALTAR_X, WITCH_ALTAR_Y, WITCH_TUNING, MAP_WIDTH, MAP_HEIGHT } = load('constants.ts');
function witchSprite(texture) {
    const s = combatSprite(texture);
    s.texture = typeof texture === 'string' ? { key: texture } : texture;
    s.eventNames = () => [];
    s.setTexture = function(key, frame) { this.texture = { key }; this.frame = frame; return this; };
    s.setData = function(key, value) { if (typeof key === 'object') Object.assign(this.data, key); else this.data[key] = value; return this; };
    s.body.setEnable = function(value) { this.enable = value; return this; };
    s.body.setSize = function(w, h) { this.width = w; this.height = h; return this; };
    s.body.setOffset = function(x, y) { this.offset = { x, y }; return this; };
    s.setImmovable = s.setCollideWorldBounds = s.removeAllListeners = function() { return this; };
    s.setAngularVelocity = function(value) { this.angularVelocity = value; return this; };
    s.anims.play = key => s.play(key);
    return s;
}
function witchFixture() {
    const timers = [], collisions = [], splashes = [], groups = [];
    let hits = 0;
    const group = () => {
        const items = [];
        const g = { items, getChildren: () => items, contains: obj => items.includes(obj),
            get(x, y, texture, frame) { const s = items.find(s => !s.active) || witchSprite(texture); if (!items.includes(s)) items.push(s); s.x = x; s.y = y; s.setTexture(texture, frame); return s; },
            killAndHide(s) { s.active = s.visible = false; }, countActive: () => items.filter(s => s.active).length };
        groups.push(g); return g;
    };
    const scene = {
        cache: { json: { get: (key = 'witch-game') => {
            const name = key.replace(/-game$/, '');
            return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../public/assets/${name}/${name}.game.json`)));
        } } },
        cameras: { main: { shake() {} } },
        score: 0, time: { now: 1000, delayedCall(ms, callback) { timers.push({ ms, callback }); } },
        playerController: { player: witchSprite('player'), isPlayerDead: false, damagePlayer: () => hits++ },
        menu: { isMenuOpen: false }, shop: { isShopOpen: false }, chat: { isChatOpen: false },
        controls: { interactKey: {} }, world: { trees: {}, giantTrees: {}, rocks: {}, bushes: {} },
        hud: { updateHUD() {} }, weapons: { bullets: {}, retireProjectile(s) { s.active = false; } },
        tweens: { killTweensOf() {}, add() {} },
        add: { text() { return { setOrigin() { return this; }, setDepth() { return this; }, setVisible(v) { this.visible = v; return this; }, setText(v) { this.text = v; return this; }, setY(v) { this.y = v; return this; } }; },
            sprite(x, y, key, frame) { const s = witchSprite(key); s.x = x; s.y = y; s.frame = frame; if (key === 'witch-potion' || key === 'witch-potion-red') splashes.push(s); return s; } },
        physics: { add: {
            sprite(x, y, key) { const s = witchSprite(key); s.x = x; s.y = y; return s; }, group,
            collider(a, b, cb) { collisions.push({ a, b, cb }); }, overlap(a, b, cb) { collisions.push({ a, b, cb }); } },
            moveToObject(s, target, speed) { const d = Math.hypot(target.x - s.x, target.y - s.y); s.setVelocity((target.x - s.x) / d * speed, (target.y - s.y) / d * speed); } },
    };
    scene.enemies = new EnemiesSystem(scene);
    scene.enemies.zombies = group();
    scene.witches = new WitchSystem(scene);
    scene.witches.create();
    const spawn = (forceVariant = 'witch') => {
        const w = scene.witches.spawn(forceVariant);
        if (w) { w.x = 500; w.y = 500; }
        return w;
    };
    return { scene, system: scene.witches, timers, collisions, splashes, spawn, hits: () => hits };
}

test('witch cauldron is bottom center, spawns on a cooldown, caps population and resets twice', () => {
    const { scene, system, timers } = witchFixture();
    const shakes = [];
    scene.cameras.main.shake = (...args) => shakes.push(args);
    assert.equal(system.altar.x, MAP_WIDTH / 2);
    assert.equal(system.altar.y, MAP_HEIGHT - 160);
    scene.playerController.player.x = WITCH_ALTAR_X;
    scene.playerController.player.y = WITCH_ALTAR_Y - 80;
    system.update(scene.time.now);
    assert.equal(system.isSummoning, true);
    assert.equal(shakes.length, 0, 'Shake waits for the emergence frame');
    timers.find(t => t.ms === 300).callback();
    assert.deepEqual(shakes, [[200, 0.008]]);
    assert.equal(scene.enemies.zombies.countActive(), 1);
    system.altar.complete('altar-witch-summon');
    system.summon();
    assert.equal(timers.filter(t => t.ms === 300).length, 1, 'Cooldown blocks summon spam');
    for (let i = 1; i < WITCH_TUNING.maxActive; i++) system.spawn();
    scene.time.now += WITCH_TUNING.spawnCooldown;
    system.summon();
    assert.equal(system.isSummoning, false, 'Active witch cap blocks further summons');
    for (let run = 0; run < 2; run++) {
        system.reset(); system.create();
        assert.equal(system.isSummoning, false);
        assert.equal(system.nextSpawnTime, 0);
        assert.equal(system.potions.getChildren().length, 0);
    }
});

test('witch AI chases, holds range, retreats facing the player and never uses melee', () => {
    const { scene, system, spawn } = witchFixture();
    const w = spawn(), p = scene.playerController.player;
    w.setData('attackCooldown', 99999); // Isolate range movement from casting.
    p.y = 500; p.x = 1000;
    scene.enemies.update(1000);
    assert.ok(w.velocity.x > 0);
    assert.equal(w.anims.currentAnim.key, 'witch-walk');
    p.x = 740;
    system.updateEnemy(w, 1100);
    assert.equal(w.velocity.x, 0);
    assert.equal(w.anims.currentAnim.key, 'witch-idle');
    p.x = 550;
    system.updateEnemy(w, 1200);
    assert.ok(w.velocity.x < 0);
    assert.equal(w.getData('facing'), 'e', 'Retreat must not turn away from the target');
    assert.equal(w.getData('state'), 'chase', 'No melee attack even within contact range');
    p.x = 500;
    system.updateEnemy(w, 1300);
    assert.ok(Number.isFinite(w.velocity.x) && w.velocity.x !== 0);
});

test('witch locks all eight throw directions, releases after windup and respects cooldown', () => {
    for (const [facing, dx, dy] of [['e',1,0],['se',1,1],['s',0,1],['sw',-1,1],['w',-1,0],['nw',-1,-1],['n',0,-1],['ne',1,-1]]) {
        const { scene, system, spawn, timers } = witchFixture();
        const w = spawn(), d = Math.hypot(dx, dy);
        scene.playerController.player.x = 500 + dx / d * 240;
        scene.playerController.player.y = 500 + dy / d * 240;
        w.setData('attackCooldown', 0);
        scene.enemies.update(2000);
        assert.equal(w.getData('facing'), facing);
        const key = scene.enemies.enemyAnimationKey(w, 'attack');
        assert.equal(w.anims.currentAnim.key, key);
        assert.equal(w.flipX, ['w','sw','nw'].includes(facing));
        assert.equal(system.potions.countActive(), 0);
        timers.find(t => t.ms === WITCH_TUNING.windup).callback();
        assert.equal(system.potions.countActive(), 1);
        const potion = system.potions.items[0];
        const pose = load('player-facing.ts').playerPose(facing);
        const anchor = scene.cache.json.get('witch-game').game.anchors.find(a => a.scope.animation === `attack${pose.suffix}`);
        assert.equal(potion.x, w.x + (anchor.x - 24) * (pose.flip ? -1 : 1));
        assert.equal(potion.y, w.y + anchor.y - 64);
        assert.ok(Math.abs(Math.hypot(potion.velocity.x, potion.velocity.y) - WITCH_TUNING.potionSpeed) < 0.001);
        w.complete(key);
        assert.equal(w.getData('state'), 'chase');
        system.updateEnemy(w, 2100);
        assert.equal(timers.length, 1, 'Throw cannot repeat before cooldown');
    }
});

test('hurt, death, overlays and pooled reuse cancel stale witch windups', () => {
    for (const cancel of ['hurt', 'dead', 'overlay', 'reused-as-zombie', 'new-cast']) {
        const { scene, system, spawn, timers } = witchFixture();
        const w = spawn();
        scene.playerController.player.x = 740; scene.playerController.player.y = 500;
        w.setData('attackCooldown', 0); system.updateEnemy(w, 2000);
        if (cancel === 'overlay') scene.chat.isChatOpen = true;
        else if (cancel === 'reused-as-zombie') w.setData('variant', 'zombie');
        else if (cancel === 'new-cast') w.setData('witchCast', 999);
        else w.setData('state', cancel);
        timers.find(t => t.ms === WITCH_TUNING.windup).callback();
        assert.equal(system.potions.countActive(), 0, cancel);
    }
});

test('witch potions splash once on impact, can be dodged, stop at scenery and retire on death', () => {
    const { scene, system, spawn, collisions, splashes, hits } = witchFixture();
    const w = spawn();
    scene.playerController.player.x = 700; scene.playerController.player.y = 500;
    system.throwPotion(w);
    const potion = system.potions.items[0];
    potion.x = 700; potion.y = 484;
    const playerOverlap = collisions.find(c => c.a === scene.playerController.player && c.b === system.potions);
    playerOverlap.cb(scene.playerController.player, potion);
    assert.equal(hits(), 1); assert.equal(potion.active, false); assert.equal(potion.body.enable, false);
    system.impact(potion); assert.equal(hits(), 1);
    splashes[0].complete('witch-potion-splash'); assert.equal(splashes[0].active, false);
    system.throwPotion(w);
    assert.equal(system.potions.items[0], potion, 'Reuse a retired bottle');
    assert.equal(potion.body.enable, true); assert.equal(potion.frame, 'fly-0');
    potion.x = 580; potion.y = 480; // Player has dodged outside splash radius.
    collisions.find(c => c.a === system.potions && c.b === scene.world.trees).cb(potion);
    assert.equal(hits(), 1);
    system.throwPotion(w);
    system.update(1000);
    scene.menu.isMenuOpen = true; system.update(1100);
    assert.equal(potion.velocity.x, 0);
    assert.ok(potion.getData('landsAt') > 1100);
    scene.menu.isMenuOpen = false;
    scene.playerController.isPlayerDead = true; system.update(1200);
    assert.equal(potion.active, false); assert.equal(hits(), 1);
});

test('witch receives bullet damage, directional hurt/death, and shared kill rewards', () => {
    const { scene, spawn } = witchFixture();
    const w = spawn();
    w.setData('hp', 2);
    scene.enemies.bulletHitZombie(witchSprite('bullet'), w);
    assert.equal(w.getData('hp'), 1); assert.equal(w.getData('state'), 'hurt');
    assert.match(w.anims.currentAnim.key, /^witch-hurt/);
    w.complete(w.anims.currentAnim.key);
    assert.equal(w.getData('state'), 'chase');
    scene.enemies.bulletHitZombie(witchSprite('bullet'), w);
    assert.equal(w.getData('state'), 'dead'); assert.equal(w.body.enable, false);
    assert.match(w.anims.currentAnim.key, /^witch-die/);
    w.complete(w.anims.currentAnim.key);
    assert.equal(scene.score, 1); assert.equal(w.active, false);
});

test('witch bundles load, all actions play in eight directions, and attack event matches windup', () => {
    const root = path.resolve(__dirname, '..'), cached = new Map(), registered = new Map();
    const json = file => JSON.parse(fs.readFileSync(path.join(root, file)));
    for (const name of ['witch', 'witch-red', 'altar-witch', 'witch-potion', 'witch-potion-red']) cached.set(`${name}-anim`, json(`public/assets/${name}/${name}.animations.json`));
    new AnimationsSystem({cache:{json:{get:key=>cached.get(key)}},anims:{exists:key=>!['witch-','witch-red-','altar-witch-','witch-potion-','witch-potion-red-'].some(prefix=>key.startsWith(prefix)) || registered.has(key),create:config=>registered.set(config.key,config)}}).registerAnimations();
    for (const witchKey of ['witch', 'witch-red']) {
        const atlas = json(`public/assets/${witchKey}/${witchKey}.atlas.json`), game = json(`public/assets/${witchKey}/${witchKey}.game.json`);
        for (const suffix of ['', '-front', '-front45', '-back', '-back45']) {
            for (const action of ['idle','walk','attack','hurt','die']) {
                const animation = registered.get(`${witchKey}-${action}${suffix}`);
                assert.ok(animation, `${witchKey}-${action}${suffix} must be registered`); assert.equal(animation.repeat, ['idle','walk'].includes(action) ? -1 : 0);
                for (const f of animation.frames) { assert.ok(atlas.frames[f.frame]); assert.ok(f.duration > 0); }
            }
            const attack = registered.get(`${witchKey}-attack${suffix}`);
            assert.equal(attack.frames.slice(0,2).reduce((n,f)=>n+f.duration,0), WITCH_TUNING.windup);
            assert.ok(game.game.events.find(e=>e.animation === `attack${suffix}` && e.index === 2 && e.name === 'throw-potion'));
        }
    }
    const { Preloader } = load('scenes/Preloader.ts');
    const preloader = new Preloader(); let base = ''; const loaded = new Map();
    const record = (key,...files) => loaded.set(key, files.filter(f=>typeof f === 'string').map(f=>path.join(root,'public',base,f)));
    preloader.load = { audio() {},setPath(p){base=p;},atlas:record,json:record,spritesheet:record,tilemapTiledJSON:record};
    preloader.preload();
    for(const name of ['witch','witch-red','altar-witch','witch-potion','witch-potion-red'])for(const key of [name,`${name}-anim`,`${name}-game`]) {
        assert.ok(loaded.has(key), key); for(const file of loaded.get(key)) assert.ok(fs.existsSync(file), file);
    }
});

test('witch-red variant spawns randomly, throws red potions, and splashes on impact', () => {
    const { scene, system, spawn, timers, splashes, hits } = witchFixture();

    // 1. Spawning randomly includes both witch and witch-red over multiple spawns
    const variants = new Set();
    for (let i = 0; i < 20; i++) {
        const w = scene.witches.spawn();
        if (w) {
            variants.add(w.getData('variant'));
            w.active = false; // retire for reuse
        }
    }
    assert.ok(variants.has('witch'), 'Random spawning should produce standard witch');
    assert.ok(variants.has('witch-red'), 'Random spawning should produce witch-red variant');

    // 2. witch-red uses witch-red texture and throws witch-potion-red
    const redWitch = spawn('witch-red');
    assert.equal(redWitch.texture.key, 'witch-red');
    assert.equal(redWitch.getData('variantName'), 'Scarlet Witch');

    // Initiate throw (player at 240px distance to south, facing 's')
    scene.playerController.player.x = 500;
    scene.playerController.player.y = 740;
    system.updateEnemy(redWitch, 2000);
    assert.equal(redWitch.getData('state'), 'attack');
    assert.equal(redWitch.anims.currentAnim.key, 'witch-red-attack-front');

    // Windup elapses -> launches red potion
    const windupTimer = timers.pop();
    assert.ok(windupTimer);
    windupTimer.callback();

    const redPotion = system.potions.getChildren().find(p => p.active && p.getData('potionKey') === 'witch-potion-red');
    assert.ok(redPotion, 'Witch-red must throw witch-potion-red');
    assert.equal(redPotion.texture.key, 'witch-potion-red');
    assert.equal(redPotion.anims.currentAnim.key, 'witch-potion-red-fly');

    // 3. Impact triggers witch-potion-red splash and deals damage
    scene.playerController.player.x = redPotion.x;
    scene.playerController.player.y = redPotion.y + 16;
    system.impact(redPotion);

    assert.equal(redPotion.active, false);
    assert.equal(splashes.length, 1);
    assert.equal(splashes[0].texture.key, 'witch-potion-red');
    assert.equal(splashes[0].anims.currentAnim.key, 'witch-potion-red-splash');
    assert.equal(hits(), 1);

    // 4. witch-red receives bullet damage and dies properly
    scene.enemies.bulletHitZombie(witchSprite('bullet'), redWitch);
    assert.match(redWitch.anims.currentAnim.key, /^witch-red-hurt/);
    redWitch.setData('hp', 1);
    scene.enemies.bulletHitZombie(witchSprite('bullet'), redWitch);
    assert.match(redWitch.anims.currentAnim.key, /^witch-red-die/);
    redWitch.complete(redWitch.anims.currentAnim.key);
    assert.equal(redWitch.active, false);
});

test('manual E summons between proximity waves while summon locks still prevent duplicates', () => {
    const { scene, system, timers } = witchFixture();
    scene.playerController.player.x = WITCH_ALTAR_X;
    scene.playerController.player.y = WITCH_ALTAR_Y - 70;
    scene.controls.interactKey.justDown = true;
    system.nextSpawnTime = scene.time.now + 5000;
    system.update(scene.time.now);
    assert.equal(system.isSummoning, true);
    system.update(scene.time.now);
    assert.equal(timers.length, 1);
});

test('scene composes witch lifecycle after the shared enemy pool and updates it across restarts', () => {
    const { GameScene } = load('scenes/Game.ts');
    const game = new GameScene(), calls = [];
    for (const name of ['audio','world','animations','playerController','weapons','enemies','altars','hud','deathScreen','menu','shop','collisions','controls','mobileControls','viewport','aiming','chat','boss','gameplay','companion','witches','castle','inventory','loot','ritual','network']) {
        const system = game[name];
        for (const key of Object.keys(system)) if (typeof system[key] === 'function') system[key] = () => calls.push(`${name}.${key}`);
        if (typeof system.reset === 'function') system.reset = () => calls.push(`${name}.reset`);
    }
    game.physics = { world: { setBounds() {} } };
    game.cameras = { main: { startFollow() {}, setBounds() {} } };
    for (let run = 0; run < 2; run++) {
        calls.length = 0; game.create(); game.update(1000, 16);
        assert.ok(calls.indexOf('enemies.createZombies') < calls.indexOf('witches.create'));
        assert.ok(calls.indexOf('witches.reset') < calls.indexOf('witches.create'));
        assert.ok(calls.indexOf('gameplay.update') < calls.indexOf('witches.update'));
        assert.ok(calls.indexOf('mobileControls.reset') < calls.indexOf('mobileControls.create'));
        assert.ok(calls.indexOf('chat.createChatUI') < calls.indexOf('mobileControls.create'));
        assert.ok(calls.indexOf('mobileControls.update') < calls.indexOf('gameplay.update'));
        assert.ok(calls.indexOf('aiming.reset') < calls.indexOf('aiming.create'));
        assert.ok(calls.indexOf('gameplay.update') < calls.indexOf('aiming.update'));
    }
});

test('witch altar HUD badge matches the existing E plaque and follows proximity/modal/restart state', () => {
    const source = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/game/assets-src/hud/hud.sprite.json')));
    const atlas = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/assets/hud/hud.atlas.json')));
    const witch = source.frames.find(f => f.id === 'prompt-altar-witch');
    const zombie = source.frames.find(f => f.id === 'prompt-altar-zombie');
    assert.ok(witch && atlas.frames['prompt-altar-witch']);
    assert.ok(atlas.frames['prompt-altar-zombie'] && atlas.frames['prompt-altar-wolf']);
    // Every layer of the original keycap and plaque base is preserved below the emblem.
    for (const layer of source.layers) {
        assert.deepEqual(witch.layers[layer.id].slice(20 * 32), zombie.layers[layer.id].slice(20 * 32));
    }
    const { scene, system } = witchFixture();
    assert.equal(system.proximityBadge.frame, 'prompt-altar-witch');
    assert.equal(system.proximityBadge.scale, 1.5);
    assert.equal(system.proximityBadge.y, WITCH_ALTAR_Y - 96);
    assert.equal(system.proximityBadge.visible, false);
    scene.playerController.player.x = WITCH_ALTAR_X;
    scene.playerController.player.y = WITCH_ALTAR_Y - 300;
    system.update(1000); assert.equal(system.proximityBadge.visible, false);
    scene.playerController.player.y = WITCH_ALTAR_Y - 200;
    system.update(1100); assert.equal(system.proximityBadge.visible, true);
    scene.playerController.player.y = WITCH_ALTAR_Y - 80;
    system.update(1200); assert.equal(system.proximityBadge.visible, true);
    scene.menu.isMenuOpen = true;
    system.update(1300); assert.equal(system.proximityBadge.visible, false);
    scene.menu.isMenuOpen = false;
    for (let run = 0; run < 2; run++) {
        system.reset(); system.create(); assert.equal(system.proximityBadge.visible, false);
        system.update(1400 + run * 100); assert.equal(system.proximityBadge.visible, true);
    }
});

test('all four altars create only floating HUD badges without overhead text', () => {
    const { AltarsSystem } = load('systems/AltarsSystem.ts');
    const { ZOMBIE_ALTAR_X, ZOMBIE_ALTAR_Y, WEREWOLF_ALTAR_X, WEREWOLF_ALTAR_Y, DROWNER_ALTAR_X, DROWNER_ALTAR_Y } = load('constants.ts');
    const { scene, system } = witchFixture();
    scene.add.text = () => assert.fail('Altars must not create text labels');
    system.reset(); system.create();
    const altars = new AltarsSystem(scene);
    altars.createAltar();
    assert.equal(altars.zombiePromptSprite.frame, 'prompt-altar-zombie');
    assert.equal(altars.wolfPromptSprite.frame, 'prompt-altar-wolf');
    assert.equal(altars.drownerPromptSprite.frame, 'prompt-altar-drowner');
    assert.equal(system.proximityBadge.frame, 'prompt-altar-witch');
    for (const [x,y,badge,others] of [
        [ZOMBIE_ALTAR_X,ZOMBIE_ALTAR_Y,altars.zombiePromptSprite,[altars.wolfPromptSprite, altars.drownerPromptSprite]],
        [WEREWOLF_ALTAR_X,WEREWOLF_ALTAR_Y,altars.wolfPromptSprite,[altars.zombiePromptSprite, altars.drownerPromptSprite]],
        [DROWNER_ALTAR_X,DROWNER_ALTAR_Y,altars.drownerPromptSprite,[altars.zombiePromptSprite, altars.wolfPromptSprite]]
    ]) {
        scene.playerController.player.x = x; scene.playerController.player.y = y;
        altars.updateProximity(0);
        assert.equal(badge.visible, true);
        for (const other of others) assert.equal(other.visible, false);
    }
});

const { DeathScreenSystem } = load('systems/DeathScreenSystem.ts');
const { DEATH_PRESENTATIONS, deathCauseForEnemy } = load('death-causes.ts');
function deathFixture() {
    const timers = [], nodes = [], restarts = [];
    const ui = values => {
        const n = { ...values, visible: true, children: [],
            setScrollFactor(v) { this.scrollFactor = v; return this; }, setDepth(v) { this.depth = v; return this; },
            setVisible(v) { this.visible = v; return this; }, setScale(v) { this.scale = v; return this; },
            setOrigin() { return this; }, setInteractive() { this.interactive = true; return this; }, setFrame(v) { this.frame = v; return this; },
            setText(v) { this.text = v; return this; }, setColor(v) { this.color = v; return this; },
            add(children) { this.children.push(...children); return this; } };
        nodes.push(n); return n;
    };
    const scene = {
        add: { container: (x,y) => ui({x,y}), rectangle: (x,y,width,height) => ui({x,y,width,height}),
            sprite: (x,y,key,frame) => Object.assign(witchSprite(key), ui({x,y,key,frame})),
            text: (x,y,text,style) => ui({x,y,text,style}) },
        hud: { heartSprites: [], updateHUD() {} }, weapons: { isReloading: false },
        cameras: { main: { shake() {} } }, tweens: { add() {} },
        time: { now: 1000, delayedCall(ms, callback) { timers.push({ms,callback}); } },
        menu: { isMenuOpen: false }, shop: { isShopOpen: false }, chat: { isChatOpen: false },
        scene: { restart: () => restarts.push(true) },
        controls: { cursors: {space:{}}, reloadKey:{}, restartKey:{} },
        anims: { get: () => ({frames:[{duration:180}]}) },
        physics: { moveToObject() {} }
    };
    scene.playerController = new PlayerControllerSystem(scene);
    scene.playerController.player = witchSprite('player');
    scene.playerController.player.x = 500; scene.playerController.player.y = 500;
    scene.deathScreen = new DeathScreenSystem(scene);
    scene.deathScreen.create();
    const finishDeath = () => scene.playerController.player.complete(scene.playerController.playerAnimationKey('die'));
    return {scene, screen:scene.deathScreen, controller:scene.playerController, timers, nodes, restarts, finishDeath};
}

test('fatal damage remembers the killer, waits for death animation, and ignores later damage', () => {
    const {controller,screen,timers,finishDeath} = deathFixture();
    controller.playerHealth = 2;
    controller.damagePlayer(1, 'zombie');
    assert.equal(controller.deathCause, null);
    controller.damagePlayer(1, 'dragon'); // Invulnerability rejects this hit and its attribution.
    assert.equal(controller.playerHealth, 1); assert.equal(controller.deathCause, null);
    timers.find(t=>t.ms===240).callback();
    controller.damagePlayer(1, 'werewolf');
    assert.equal(controller.deathCause, 'werewolf'); assert.equal(screen.container.visible, false);
    controller.damagePlayer(1, 'witch'); assert.equal(controller.deathCause, 'werewolf');
    finishDeath();
    assert.equal(screen.panel.frame, 'death-werewolf'); assert.equal(screen.container.visible, true);
    for(let run=0;run<2;run++) {
        controller.reset(); screen.create();
        assert.equal(controller.deathCause, null); assert.equal(screen.container.visible, false);
        controller.damagePlayer(5, 'dragon'); finishDeath();
        assert.equal(screen.panel.frame, 'death-dragon');
    }
});

test('zombie variants and both werewolves propagate their actual fatal melee cause', () => {
    for(const variant of ['zombie','zombie-female','zombie-skeleton','zombie-blue','werewolf','werewolf-albino']) {
        const {scene,controller,screen,timers,finishDeath} = deathFixture();
        controller.playerHealth = 1;
        const enemy = witchSprite(variant); enemy.x = 510; enemy.y = 500;
        enemy.setData({variant, state:'chase', attackCooldown:0, speed:85});
        const enemies = new EnemiesSystem(scene); enemies.zombies = { getChildren: () => [enemy] };
        enemies.update(2000); timers.find(t=>t.ms===180).callback(); finishDeath();
        const cause = variant.startsWith('werewolf') ? 'werewolf' : 'zombie';
        assert.equal(controller.deathCause, cause, variant);
        assert.equal(screen.panel.frame, DEATH_PRESENTATIONS[cause].frame);
    }
});

test('both witch potion colors propagate a witch fatal cause through the real impact handler', () => {
    for(const key of ['witch-potion','witch-potion-red']) {
        const {scene,controller,screen,finishDeath} = deathFixture(); controller.playerHealth = 1;
        const potion = witchSprite(key); potion.x = 500; potion.y = 484; potion.setData('potionKey',key);
        const witches = new WitchSystem(scene);
        witches.potions = {contains: p => p===potion, killAndHide(p) {p.active=false;}};
        witches.impact(potion); finishDeath();
        assert.equal(controller.deathCause, 'witch'); assert.equal(screen.panel.frame, 'death-witch');
    }
});

test('dragon contact and registered fireball collision both propagate the dragon fatal cause', () => {
    for(const attack of ['contact','fireball']) {
        const {scene,controller,screen,finishDeath} = deathFixture(); controller.playerHealth = 1;
        scene.boss = new BossSystem(scene);
        if(attack==='contact') {
            scene.boss.dragon = witchSprite('dragon'); scene.boss.dragon.x = 510; scene.boss.dragon.y = 500;
            scene.boss.dragonAttackCooldown = Infinity;
            scene.boss.updateDragonBoss(1000);
        } else {
            const overlaps=[];
            scene.altars={altar:{},wolfAltar:{}}; scene.world={trees:{},giantTrees:{},rocks:{},bushes:{}};
            scene.physics.add={collider() {},group:()=>({killAndHide(p){p.active=false;}}),overlap(a,b,callback){overlaps.push({a,b,callback});}};
            const {CollisionsSystem}=load('systems/CollisionsSystem.ts');
            scene.enemies={zombies:{},bulletHitZombie(){}};
            new CollisionsSystem(scene).setupCollisions();
            const fireball=witchSprite('bullet');
            overlaps.find(o=>o.a===controller.player&&o.b===scene.boss.dragonFireballs).callback(controller.player,fireball);
        }
        finishDeath(); assert.equal(controller.deathCause,'dragon',attack); assert.equal(screen.panel.frame,'death-dragon');
    }
});

test('all death layouts select their art/copy and retain camera-fixed placement and Space/R restart', () => {
    for(const cause of ['zombie','werewolf','witch','dragon'])for(const character of ['player','heroine']) {
        const {scene,controller,screen,nodes,restarts}=deathFixture(); controller.currentCharacter=character;
        screen.show(cause);
        assert.equal(screen.panel.frame,DEATH_PRESENTATIONS[cause].frame);
        assert.equal(screen.title.text,DEATH_PRESENTATIONS[cause].title);
        assert.match(screen.causeLabel.text,character==='heroine'?/^SCHOLAR DOWN/:/^SURVIVOR DOWN/);
        assert.equal(screen.title.color,DEATH_PRESENTATIONS[cause].color);
        assert.equal(screen.container.scrollFactor,0); assert.equal(screen.container.depth,40000);
        assert.equal(screen.container.children[0].interactive,true, 'Death overlay blocks clicks on underlying UI');
        assert.equal(screen.container.x,480); assert.equal(screen.container.y,320); assert.equal(screen.panel.scale,2);
        assert.ok(nodes.some(n=>n.text==='Press SPACE or R to Restart'));
        controller.isPlayerDead=true;
        const loop=new GameplaySystem(scene);
        scene.controls.cursors.space.isDown=true; loop.update(1000);
        scene.controls.cursors.space.isDown=false; scene.controls.restartKey.isDown=true; loop.update(1100);
        assert.equal(restarts.length,2);
    }
    assert.equal(deathCauseForEnemy('witch-red'),'witch');
    assert.equal(deathCauseForEnemy('werewolf-albino'),'werewolf');
});

test('preloader loads all four death layout sprites with source-sized frames and safe UI anchors', () => {
    const root=path.resolve(__dirname,'..'),json=file=>JSON.parse(fs.readFileSync(path.join(root,file)));
    const atlas=json('public/assets/death-screen/death-screen.atlas.json');
    const metadata=json('public/assets/death-screen/death-screen.game.json');
    assert.equal(metadata.width,320); assert.equal(metadata.height,192);
    for(const {frame} of Object.values(DEATH_PRESENTATIONS)) {
        assert.ok(atlas.frames[frame]); assert.equal(atlas.frames[frame].trimmed,false);
        assert.equal(atlas.frames[frame].sourceSize.w,320); assert.equal(atlas.frames[frame].sourceSize.h,192);
    }
    const {Preloader}=load('scenes/Preloader.ts');const preloader=new Preloader();let base='';const loaded=new Map();
    const record=(key,...files)=>loaded.set(key,files.filter(f=>typeof f==='string').map(f=>path.join(root,'public',base,f)));
    preloader.load={audio(){},setPath(p){base=p;},atlas:record,json:record,spritesheet:record,tilemapTiledJSON:record};preloader.preload();
    for(const key of ['death-screen','death-screen-game']) {assert.ok(loaded.has(key));for(const file of loaded.get(key))assert.ok(fs.existsSync(file));}
});

const { CastleSystem, CASTLE_BLUEPRINT } = load('systems/CastleSystem.ts');
const {
    PORTAL_MEADOW_X, PORTAL_MEADOW_Y,
    CASTLE_ORIGIN_X, CASTLE_ORIGIN_Y,
    CASTLE_WIDTH, CASTLE_HEIGHT,
    CASTLE_SPAWN_X, CASTLE_SPAWN_Y,
    PORTAL_CASTLE_X, PORTAL_CASTLE_Y
} = load('constants.ts');

function castleFixture() {
    const sprites = [], texts = [], staticItems = [], cameraBounds = [], flashes = [], alerts = [], messages = [];

    const mockSprite = (x, y, key, frame) => {
        const s = {
            x, y, key, frame, active: true, visible: true, depth: 0, originX: 0, originY: 0,
            setTexture(k,f) {this.key=k;this.frame=f;return this;},
            setFrame(f) {this.frame=f;return this;},
            setOrigin(ox, oy) { this.originX = ox; this.originY = oy; return this; },
            setDepth(d) { this.depth = d; return this; },
            setVisible(v) { this.visible = v; return this; },
            setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
            play(k) { this.anim = k; return this; },
            anims: { setProgress() {} },
            body: {
                setSize(w, h) { this.w = w; this.h = h; return this; },
                setOffset(ox, oy) { this.ox = ox; this.oy = oy; return this; },
                reset() { return this; }
            }
        };
        sprites.push(s);
        return s;
    };

    const mockText = (x, y, text) => {
        const t = {
            x, y, text, visible: false, depth: 0,
            setText(t) { this.text=t; return this; },
            setOrigin() { return this; },
            setDepth(d) { this.depth = d; return this; },
            setVisible(v) { this.visible = v; return this; }
        };
        texts.push(t);
        return t;
    };

    const staticGroup = () => ({
        create(x, y, key, frame) {
            const s = mockSprite(x, y, key, frame);
            staticItems.push(s);
            return s;
        },
        getChildren: () => staticItems
    });

    const plainGroup = () => {
        const items = [];
        return {
            add(item) { items.push(item); },
            getChildren: () => items
        };
    };

    const scene = {
        add: {
            sprite: mockSprite,
            text: mockText,
            group: plainGroup
        },
        physics: {
            add: {
                staticGroup
            },
            world: {
                bounds: { x: 0, y: 0, right: 3600, bottom: 1280 }
            }
        },
        cameras: {
            main: {
                setBounds(x, y, w, h) { cameraBounds.push({ x, y, w, h }); },
                flash(...args) { flashes.push(args); }
            }
        },
        time: { now: 1000 },
        playerController: {
            player: {
                x: 960, y: 640,
                setPosition(nx, ny) { this.x = nx; this.y = ny; }
            },
            isPlayerDead: false
        },
        companion: {
            dog: {
                x: 930, y: 640,
                setPosition(nx, ny) { this.x = nx; this.y = ny; }
            }
        },
        controls: {
            interactKey: {}
        },
        menu: { isMenuOpen: false },
        shop: { isShopOpen: false },
        chat: {
            isChatOpen: false,
            addChatMessage: (s, t) => messages.push({ s, t })
        },
        hud: {
            flashProximityAlert: (msg, color) => alerts.push({ msg, color })
        }
    };

    const system = new CastleSystem(scene);
    system.reset();
    system.create();

    return { scene, system, sprites, texts, staticItems, cameraBounds, flashes, alerts, messages };
}

test('castle prison tileset and portal bundles load in preloader and animations register', () => {
    const root = path.resolve(__dirname, '..');
    const json = file => JSON.parse(fs.readFileSync(path.join(root, file)));
    const bundles = [
        'portal', 'prison-floor', 'prison-wall', 'prison-bars',
        'prison-puddle', 'prison-torch', 'prison-chains', 'prison-straw', 'prison-door'
    ];

    const cached = new Map(), registered = new Map();
    for (const name of bundles) {
        cached.set(`${name}-anim`, json(`public/assets/${name}/${name}.animations.json`));
    }

    const scene = {
        cache: { json: { get: key => cached.get(key) } },
        anims: {
            exists: key => registered.has(key),
            create: config => registered.set(config.key, config),
            generateFrameNumbers: () => []
        }
    };
    new AnimationsSystem(scene).registerAnimations();

    for (const name of bundles) {
        const animJson = cached.get(`${name}-anim`);
        assert.ok(animJson?.animations?.length > 0, `${name} must define animations`);
        for (const anim of animJson.animations) {
            const key = `${name}-${anim.name}`;
            assert.ok(registered.has(key), `${key} must be registered`);
            const conf = registered.get(key);
            assert.equal(conf.repeat, anim.loop ? -1 : 0);
            assert.equal(conf.frames.length, anim.frames.length);
        }
    }

    const { Preloader } = load('scenes/Preloader.ts');
    const preloader = new Preloader();
    let base = '';
    const loaded = new Map();
    const record = (key, ...files) => loaded.set(key, files.filter(f => typeof f === 'string').map(f => path.join(root, 'public', base, f)));
    preloader.load = { audio() {}, setPath(p) { base = p; }, atlas: record, json: record, spritesheet: record, tilemapTiledJSON: record };
    preloader.preload();

    for (const name of bundles) {
        for (const key of [name, `${name}-anim`, `${name}-game`]) {
            assert.ok(loaded.has(key), `Preloader must load ${key}`);
            for (const file of loaded.get(key)) {
                assert.ok(fs.existsSync(file), `File ${file} must exist`);
            }
        }
    }
});

test('castle blueprint constructs full prison layout using all eight tiles', () => {
    const { system, staticItems } = castleFixture();
    assert.equal(CASTLE_BLUEPRINT.length, 24);
    for (const row of CASTLE_BLUEPRINT) assert.equal(row.length, 32);

    // Floor covers the entire 32x24 grid = 768 tiles
    assert.equal(system.floorTiles.getChildren().length, 32 * 24);

    // Solid obstacles contain walls, bars (2 per B slot), and doors
    const walls = staticItems.filter(s => s.key === 'prison-wall');
    const bars = staticItems.filter(s => s.key === 'prison-bars');
    const doors = staticItems.filter(s => s.key === 'prison-door');
    assert.ok(walls.length > 50, 'Castle must have solid stone walls');
    assert.ok(bars.length >= 10, 'Castle must have iron cell bars');
    assert.ok(doors.length >= 4, 'Castle must have wooden prison doors');

    // Decorations contain puddles, straw bedding, torches, and chains
    const decos = system.decorations.getChildren();
    const puddles = decos.filter(s => s.key === 'prison-puddle');
    const straw = decos.filter(s => s.key === 'prison-straw');
    const torches = decos.filter(s => s.key === 'prison-torch');
    const chains = decos.filter(s => s.key === 'prison-chains');
    assert.ok(puddles.length >= 4, 'Castle must feature water puddles');
    assert.ok(straw.length >= 6, 'Castle must feature straw bedding in cells');
    assert.ok(torches.length >= 6, 'Castle must feature wall torches');
    assert.ok(chains.length >= 4, 'Castle must feature wall chains');
});

test('meadow portal teleports player to castle and castle portal teleports back', () => {
    const { scene, system, cameraBounds, flashes, alerts } = castleFixture();
    const player = scene.playerController.player;

    // Initially in meadow zone
    assert.equal(system.currentZone, 'meadow');
    assert.equal(system.meadowPrompt.visible, false);

    // Step near Meadow portal (within 75px)
    player.x = PORTAL_MEADOW_X;
    player.y = PORTAL_MEADOW_Y + 40;
    system.update(1000);
    assert.equal(system.isNearMeadowPortal, true);
    assert.equal(system.meadowPrompt.visible, true);
    assert.equal(system.castlePrompt.visible, false);

    // A locked portal rejects walkover and direct entry, even with materials absent.
    player.y = PORTAL_MEADOW_Y;
    system.update(1100);system.teleportToCastle();
    assert.equal(system.currentZone,'meadow');
    scene.inventory={hasPortalKey:true,isOpen:false};
    scene.controls.interactKey.justDown=true;
    system.update(1100);
    scene.controls.interactKey.justDown=false;
    assert.equal(system.portalUnlocked,true);

    // Verifies teleportation to castle
    assert.equal(system.currentZone, 'castle');
    assert.equal(player.x, CASTLE_SPAWN_X);
    assert.equal(player.y, CASTLE_SPAWN_Y);
    assert.equal(scene.companion.dog.x, CASTLE_SPAWN_X - 30);
    const lastCamera = cameraBounds[cameraBounds.length - 1];
    assert.deepEqual(lastCamera, { x: CASTLE_ORIGIN_X, y: CASTLE_ORIGIN_Y, w: CASTLE_WIDTH, h: CASTLE_HEIGHT });
    assert.ok(flashes.length >= 1);
    assert.ok(alerts.some(a => a.msg.includes('Castle Prison')));

    // Now in castle zone, approach castle return portal
    player.x = PORTAL_CASTLE_X;
    player.y = PORTAL_CASTLE_Y + 40;
    scene.time.now = 3000; // Past cooldown
    system.update(3000);
    assert.equal(system.isNearCastlePortal, true);
    assert.equal(system.castlePrompt.visible, true);
    assert.equal(system.meadowPrompt.visible, false);

    // Step into castle portal
    player.y = PORTAL_CASTLE_Y;
    system.update(3100);

    // Verifies teleportation back to meadow
    assert.equal(system.currentZone, 'meadow');
    assert.equal(player.x, PORTAL_MEADOW_X);
    assert.equal(player.y, PORTAL_MEADOW_Y + 50);
    assert.equal(scene.companion.dog.x, PORTAL_MEADOW_X - 30);
    const returnCamera = cameraBounds[cameraBounds.length - 1];
    assert.deepEqual(returnCamera, { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT });
    assert.ok(alerts.some(a => a.msg.includes('Returned to Meadow')));

    // Modal and death suppression
    player.y = PORTAL_MEADOW_Y + 40;
    scene.time.now = 5000;
    scene.menu.isMenuOpen = true;
    system.update(5000);
    assert.equal(system.meadowPrompt.visible, false);
    scene.menu.isMenuOpen = false;

    scene.playerController.isPlayerDead = true;
    system.update(5100);
    assert.equal(system.meadowPrompt.visible, false);
    scene.playerController.isPlayerDead = false;

    // Scene restart preserves reset/create lifecycle
    for (let run = 0; run < 2; run++) {
        system.reset();
        system.create();
        assert.equal(system.currentZone, 'meadow');
        assert.equal(system.isNearMeadowPortal, false);
    }
});

test('bullets and shotgun pellets have depth >= 1500 to render above castle floors and scenery', () => {
    for (const weapon of ['rifle', 'shotgun']) {
        const { scene, click, emitted, pointer } = firingFixture(weapon);
        pointer.left = pointer.isDown = true;
        click();
        assert.ok(emitted.length > 0, `Firing ${weapon} must emit projectiles`);
        for (const projectile of emitted) {
            assert.ok(projectile.depth >= 1500, `Projectile depth ${projectile.depth} must be >= 1500 to render above castle floor depth`);
        }
    }
});

test('preloader loads drowner and altar-drowner bundles with matching cache keys', () => {
    const { Preloader } = load('scenes/Preloader.ts');
    const atlasCalls = [];
    const jsonCalls = [];
    let currentPath = '';
    const fakeScene = {
        load: { audio() {},
            on() {},
            setPath(path) { currentPath = path; },
            atlas(key, img, json) { atlasCalls.push({ key, img, json, path: currentPath }); },
            json(key, file) { jsonCalls.push({ key, file, path: currentPath }); },
            spritesheet() {},
            tilemapTiledJSON() {}
        },
        add: { rectangle() { return { setStrokeStyle() {} }; } }
    };
    const preloader = new Preloader();
    preloader.preload.call(fakeScene);


    assert.ok(atlasCalls.some(c => c.key === 'drowner' && c.path === 'assets/drowner'));
    assert.ok(jsonCalls.some(c => c.key === 'drowner-anim'));
    assert.ok(jsonCalls.some(c => c.key === 'drowner-game'));

    assert.ok(atlasCalls.some(c => c.key === 'altar-drowner' && c.path === 'assets/altar-drowner'));
    assert.ok(jsonCalls.some(c => c.key === 'altar-drowner-anim'));
    assert.ok(jsonCalls.some(c => c.key === 'altar-drowner-game'));
});

const { EventEmitter } = require('node:events');
const { MobileControlsSystem } = load('systems/MobileControlsSystem.ts');
function mobileFixture(weapon = 'rifle', touch = true) {
    const { scene, emitted } = firingFixture(weapon);
    function display(frame) {
        const object = new EventEmitter();
        Object.assign(object, { frame, visible: true, children: [], x: 0, y: 0,
            setText(text) { this.text=text; return this; }, setAlpha(alpha) { this.alpha=alpha; return this; },
            setScrollFactor(n) { this.scrollFactor = n; return this; },
            setDepth(n) { this.depth = n; return this; },
            setPosition(x,y) { this.x=x; this.y=y; return this; },
            setDisplaySize(w,h) { this.displayWidth=w; this.displayHeight=h; return this; },
            setInteractive() { this.interactive = true; return this; },
            setVisible(v) { this.visible=v; return this; }, setFrame(f) { this.frame=f; return this; },
            setOrigin() { return this; }, add(child) { this.children.push(child); return this; },
        });
        return object;
    }
    scene.add = { container: () => display(), image: (_x,_y,_key,frame) => display(frame), text: () => display() };
    const input = new EventEmitter();
    input.activePointer = scene.input.activePointer;
    input.mousePointer = scene.input.activePointer;
    input.keyboard = scene.input.keyboard;
    scene.input = input;
    scene.controls.setupInput();
    scene.sys = { game: { device: { input: { touch } } } };
    scene.scale = Object.assign(new EventEmitter(), { width: 960, height: 640 });
    scene.game = { events: new EventEmitter() };
    scene.events = new EventEmitter();
    const mobile = scene.mobileControls = new MobileControlsSystem(scene);
    mobile.create();
    const controls = mobile.root.children.filter(c => c.interactive);
    const roles = ['move','aim','fire','heal','interact'];
    function down(role, id, dx=0, dy=0) {
        const center=mobile.centers[role];
        const pointer={ id, wasTouch:true, isDown:true, x:center.x+dx, y:center.y+dy, leftButtonDown:()=>true };
        scene.input.activePointer=pointer;
        controls[roles.indexOf(role)].emit('pointerdown',pointer,0,0,{stopPropagation(){}});
        return pointer;
    }
    return { scene, mobile, controls, emitted, down };
}

test('mobile twin sticks own independent touches, clamp movement and retain aim on release', () => {
    const { scene, mobile, down } = mobileFixture();
    const move=down('move',1,mobile.radius*2,0);
    assert.equal(mobile.movement.x,1);
    assert.equal(mobile.movement.y,0);
    assert.ok(mobile.centers.move.x < mobile.centers.aim.x);
    assert.ok(mobile.centers.fire.y < mobile.centers.aim.y);
    const aim=down('aim',2,0,-mobile.radius);
    assert.equal(mobile.aim.x,0);
    assert.equal(mobile.aim.y,-1);
    assert.equal(mobile.movement.x,1);
    const stolen=down('move',3,-mobile.radius,0);
    assert.equal(mobile.movement.x,1,'Second finger cannot steal an occupied stick');
    scene.input.emit('pointerup',stolen);
    assert.equal(mobile.movement.x,1);
    scene.input.emit('pointerup',aim);
    assert.equal(mobile.aim.y,-1,'Release keeps the most recent aim');
    assert.equal(mobile.movement.x,1);
    move.x=mobile.centers.move.x+mobile.radius*0.1;
    scene.input.emit('pointermove',move);
    assert.equal(mobile.movement.x,0,'Thumb jitter inside the deadzone does not move');
    move.x=mobile.centers.move.x+mobile.radius*0.59;
    scene.input.emit('pointermove',move);
    assert.ok(Math.abs(mobile.movement.x-0.5)<1e-8,'Analog movement preserves partial strength');
    scene.input.emit('pointerupoutside',move);
    assert.equal(mobile.movement.x,0);
});

for(const weapon of ['rifle','shotgun']) test(`mobile ${weapon}: move + aim do not fire; third-finger fire uses one round and shared repeat`,()=>{
    const { scene,mobile,down,emitted,controls }=mobileFixture(weapon);
    const initial=scene.weapons.currentAmmo;
    const pellets=weapon==='shotgun'?SHOTGUN_PELLETS:1;
    const rate=weapon==='shotgun'?SHOTGUN_FIRE_RATE:FIRE_RATE;
    down('move',1,mobile.radius,0);
    down('aim',2,0,-mobile.radius);
    scene.weapons.updateFiring(scene.time.now);
    assert.equal(emitted.length,0,'Touches on either stick never shoot');
    const fire=down('fire',3);
    scene.controls.cursors.space.isDown=true;
    scene.weapons.updateFiring(scene.time.now);
    assert.equal(scene.weapons.currentAmmo,initial-1);
    assert.equal(emitted.length,pellets);
    assert.equal(controls[2].frame,'fire-pressed');
    assert.ok(emitted.every(p=>p.velocity.y<0),'Shots follow the aim stick, not the fire-button position');
    scene.time.now+=rate;
    scene.weapons.updateFiring(scene.time.now);
    assert.equal(scene.weapons.currentAmmo,initial-2);
    scene.controls.cursors.space.isDown=false;
    scene.input.emit('pointerupoutside',fire);
    assert.equal(controls[2].frame,'fire');
    scene.time.now+=rate;
    scene.weapons.updateFiring(scene.time.now);
    assert.equal(scene.weapons.currentAmmo,initial-2);
    assert.equal(mobile.movement.x,1,'Releasing fire does not release movement');
});

test('mobile movement strafes with independent eight-direction aim and tracks player world position',()=>{
    const { scene,mobile,down }=mobileFixture();
    const pc=scene.playerController=new PlayerControllerSystem(scene);
    const player=pc.player=combatSprite('player');
    player.body.velocity={x:0,y:0,normalize(){const d=Math.hypot(this.x,this.y);this.x/=d;this.y/=d;return this;},
        scale(n){this.x*=n;this.y*=n;return this;}};
    player.setVelocity=(x,y)=>{player.body.velocity.x=x;player.body.velocity.y=y;return player;};
    player.anims.play=key=>player.play(key);
    scene.controls.cursors={space:{isDown:false},left:{},right:{},up:{},down:{}};
    const keys=scene.controls.cursors;
    scene.controls.wasd=keys;
    const move=down('move',1,-mobile.radius*0.59,0);
    const aim=down('aim',2,mobile.radius,0);
    for(const [facing,x,y] of [['e',1,0],['se',1,1],['s',0,1],['sw',-1,1],['w',-1,0],['nw',-1,-1],['n',0,-1],['ne',1,-1]]){
        aim.x=mobile.centers.aim.x+x*mobile.radius;
        aim.y=mobile.centers.aim.y+y*mobile.radius;
        scene.input.emit('pointermove',aim);
        pc.updateMovement();
        assert.equal(pc.playerFacing,facing);
        assert.ok(Math.abs(player.body.velocity.x+150)<1e-8);
        assert.equal(player.body.velocity.y,0);
    }
    player.x+=1000;player.y+=500;
    const target=scene.controls.aimPointer();
    assert.ok(Math.abs(target.worldX-player.x-400/Math.sqrt(2))<1e-8);
    assert.ok(Math.abs(target.worldY-(player.y-33)+400/Math.sqrt(2))<1e-8);
    scene.input.emit('pointerup',move);
    pc.updateMovement();
    assert.equal(player.body.velocity.x,0);
    keys.right.isDown=true;keys.down.isDown=true;
    pc.updateMovement();
    assert.ok(Math.abs(Math.hypot(player.body.velocity.x,player.body.velocity.y)-300)<1e-8);
});

test('mobile overlays/death, canceled pointers, blur and resize clear held input; restarts remove listeners',()=>{
    const { scene,mobile,down }=mobileFixture();
    for(const [owner,key] of [[scene.menu,'isMenuOpen'],[scene.chat,'isChatOpen'],[scene.shop,'isShopOpen'],[scene.playerController,'isPlayerDead']]){
        down('move',1,mobile.radius,0);down('aim',2,mobile.radius,0);down('fire',3);
        owner[key]=true;mobile.update();
        assert.equal(mobile.movement.x,0);assert.equal(mobile.firing,false);assert.equal(mobile.root.visible,false);
        down('move',4,mobile.radius,0);assert.equal(mobile.movement.x,0);
        owner[key]=false;mobile.update();assert.equal(mobile.root.visible,true);
    }
    for(const event of ['blur','resize','gameout']){
        down('move',1,mobile.radius,0);down('fire',2);
        (event==='blur'?scene.game.events:event==='resize'?scene.scale:scene.input).emit(event);
        assert.equal(mobile.movement.x,0);assert.equal(mobile.firing,false);
    }
    const canceled=down('move',1,mobile.radius,0);
    canceled.isDown=false;mobile.update();assert.equal(mobile.movement.x,0);
    for(let run=0;run<2;run++){
        down('move',1,mobile.radius,0);down('fire',2);
        scene.events.emit('shutdown');
        assert.equal(scene.game.events.listenerCount('blur'),0);
        assert.equal(scene.scale.listenerCount('resize'),0);
        assert.equal(scene.input.listenerCount('pointermove'),0);
        mobile.reset();mobile.create();
        assert.equal(mobile.movement.x,0);assert.equal(mobile.firing,false);
        assert.equal(mobile.aim.x,1);
        assert.equal(scene.game.events.listenerCount('blur'),1);
        assert.equal(scene.input.listenerCount('pointermove'),1);
    }
});

test('desktop keeps mouse aiming; touch reveals mobile controls without a world shot',()=>{
    const { scene,mobile,emitted }=mobileFixture('rifle',false);
    assert.equal(mobile.root.visible,false);
    const pointer={id:4,wasTouch:true,isDown:true,x:500,y:200,leftButtonDown:()=>true};
    scene.input.emit('pointerdown',pointer);
    mobile.update();
    assert.equal(mobile.root.visible,true);
    assert.equal(emitted.length,0);
    scene.input.emit('pointermove',{id:0,wasTouch:false});mobile.update();
    assert.equal(mobile.root.visible,false);
    scene.input.mousePointer.updateWorldPoint=()=>{scene.input.mousePointer.worldX=123;scene.input.mousePointer.worldY=234;};
    assert.equal(scene.controls.aimPointer().worldX,123);
});

test('mobile PixelForge bundle contains all controls, is loaded, and fits representative viewports',()=>{
    const root=path.resolve(__dirname,'..');
    const atlas=JSON.parse(fs.readFileSync(path.join(root,'public/assets/mobile-controls/mobile-controls.atlas.json')));
    for(const id of ['move-base','move-knob','aim-base','aim-knob','fire','fire-pressed','heal','heal-pressed','interact','interact-pressed']){
        assert.ok(atlas.frames[id]);assert.equal(atlas.frames[id].sourceSize.w,64);
    }
    const { Preloader }=load('scenes/Preloader.ts');
    const preloader=new Preloader();let base='';const loaded=[];
    preloader.load={audio(){},setPath:p=>base=p,atlas:(key,...files)=>{if(key==='mobile-controls')loaded.push(...files.map(f=>path.join(root,'public',base,f)));},json(){},spritesheet(){},tilemapTiledJSON(){}};
    preloader.preload();assert.equal(loaded.length,2);for(const file of loaded)assert.ok(fs.existsSync(file));
    const { scene,mobile,controls }=mobileFixture();
    for(const [width,height] of [[960,640],[640,960],[1280,720]]){
        scene.scale.width=width;scene.scale.height=height;scene.scale.emit('resize');
        for(const control of controls){
            assert.ok(control.x-control.displayWidth/2>=0);assert.ok(control.x+control.displayWidth/2<=width);
            assert.ok(control.y-control.displayHeight/2>=0);assert.ok(control.y+control.displayHeight/2<=height);
        }
        assert.ok(mobile.centers.aim.y-mobile.centers.fire.y>controls[0].displayHeight);
    }
});

test('responsive viewport anchors UI, fits modal content and covers dimmers across resize/restart',()=>{
    const { ViewportSystem }=load('systems/ViewportSystem.ts');
    const object=()=>({x:0,y:0,scale:1,setX(x){this.x=x;return this;},
        setPosition(x,y){this.x=x;this.y=y;return this;},setScale(s){this.scale=s;return this;}});
    const modal=()=>{const c=object();c.list=[{setSize(w,h){this.width=w;this.height=h;},input:{hitArea:{setSize(w,h){this.width=w;this.height=h;}}}}];return c;};
    const scene={scale:Object.assign(new EventEmitter(),{width:960,height:640}),events:new EventEmitter(),
        hud:{menuBtn:object(),menuLabel:object(),proximityNoticeText:object()},menu:{menuContainer:modal()},
        shop:{shopContainer:modal()},deathScreen:{container:modal()},chat:{chatContainer:object()},boss:{bossBarContainer:object()}};
    scene.cameras={main:{id:1,zoom:1,setZoom(z){this.zoom=z;}},add:()=>({id:2,setSize(){}})};
    scene.sys={game:{device:{os:{desktop:true},input:{touch:false}}}};
    scene.input={setDefaultCursor(c){this.cursor=c;}};
    scene.children={list:[{scrollFactorX:0,scrollFactorY:0,cameraFilter:0},{scrollFactorX:1,scrollFactorY:1,cameraFilter:0}]};
    const system=new ViewportSystem(scene);
    for(let run=0;run<2;run++){
        system.reset();system.create();assert.equal(scene.scale.listenerCount('resize'),1);
        assert.equal(scene.cameras.main.zoom,2);
        assert.equal(scene.children.list[0].cameraFilter,1);assert.equal(scene.children.list[1].cameraFilter,2);
        assert.ok(scene.input.cursor.includes('pointer.png'));
        scene.sys.game.device.input.touch=true;system.update();assert.equal(scene.cameras.main.zoom,2);assert.equal(scene.input.cursor,'default');
        scene.sys.game.device.input.touch=false;system.update();assert.equal(scene.cameras.main.zoom,2);
        for(const [width,height] of [[924,412],[390,844],[1280,720]]){
            Object.assign(scene.scale,{width,height});scene.scale.emit('resize');
            assert.equal(scene.hud.menuBtn.x,width-38);assert.equal(scene.hud.menuLabel.x,width-38);
            for(const [container,w,h] of [[scene.menu.menuContainer,560,460],[scene.shop.shopContainer,580,480],[scene.deathScreen.container,640,384]]){
                assert.equal(container.x,width/2);assert.equal(container.y,height/2);
                assert.ok(w*container.scale<=width-24);assert.ok(h*container.scale<=height-24);
                const backdrop=container.list[0];
                assert.ok(Math.abs(backdrop.width*container.scale-width)<1e-8);
                assert.ok(Math.abs(backdrop.height*container.scale-height)<1e-8);
                assert.equal(backdrop.input.hitArea.width,backdrop.width);
            }
            assert.equal(scene.boss.bossBarContainer.x,width/2);
            assert.ok(scene.chat.chatContainer.y>=0);
        }
        scene.events.emit('shutdown');assert.equal(scene.scale.listenerCount('resize'),0);
    }
});

test('mobile first aid consumes one kit per tap, respects health/inventory/modal gates and never fires',()=>{
    const { scene,mobile,down,controls,emitted }=mobileFixture();
    const pc=scene.playerController=new PlayerControllerSystem(scene);
    pc.player={x:300,y:300};pc.playerHealth=3;pc.medkits=2;pc.playHealEffect=()=>{};
    const tap=down('heal',1);mobile.update();
    assert.equal(pc.playerHealth,5);assert.equal(pc.medkits,1);assert.equal(emitted.length,0);
    mobile.update();assert.equal(pc.medkits,1,'Holding the button does not heal repeatedly');
    assert.equal(controls[3].frame,'heal-pressed');
    scene.input.emit('pointerup',tap);assert.equal(controls[3].frame,'heal');
    scene.input.emit('pointerup',down('heal',1));assert.equal(pc.medkits,1,'Full health keeps the kit');
    pc.playerHealth=2;pc.medkits=0;
    scene.input.emit('pointerup',down('heal',1));assert.equal(pc.playerHealth,2);
    pc.medkits=1;scene.menu.isMenuOpen=true;
    down('heal',1);assert.equal(pc.medkits,1);
    scene.menu.isMenuOpen=false;
    assert.ok(mobile.centers.heal.y<mobile.centers.move.y);
    assert.equal(mobile.centers.heal.x,mobile.centers.move.x);
});

test('context button appears only at valid E targets, routes once, and clears stale/modal/restart requests',()=>{
    const { scene,mobile,down,controls }=mobileFixture();
    const { interactionContext,interactionPressed }=load('interaction.ts');
    scene.controls.interactKey={};
    scene.shop.vendor={x:100,y:100};
    scene.altars.altar={x:300,y:100};scene.altars.wolfAltar={x:500,y:100};scene.altars.drownerAltar={x:700,y:100};
    scene.witches={altar:{x:900,y:400}};
    const { PORTAL_MEADOW_X,PORTAL_MEADOW_Y,PORTAL_CASTLE_X,PORTAL_CASTLE_Y }=load('constants.ts');
    scene.castle={currentZone:'meadow',portalUnlocked:true};
    const cases=[['vendor',100,100,'SHOP'],['zombie',300,100,'SUMMON'],['wolf',500,100,'SUMMON'],
        ['drowner',700,100,'SUMMON'],['witch',900,400,'SUMMON'],['enter',PORTAL_MEADOW_X,PORTAL_MEADOW_Y-16,'ENTER'],
        ['return',PORTAL_CASTLE_X,PORTAL_CASTLE_Y-16,'RETURN']];
    for(const [id,x,y,label] of cases){
        scene.castle.currentZone=id==='return'?'castle':'meadow';
        Object.assign(scene.playerController.player,{x,y});mobile.update();
        assert.equal(interactionContext(scene).id,id);assert.equal(controls[4].visible,true);
        assert.equal(mobile.labels.interact.text,label);
        const tap=down('interact',1);scene.input.emit('pointerup',tap);
        assert.equal(interactionPressed(scene,id),true,'Quick tap survives release until gameplay consumes it');
        assert.equal(interactionPressed(scene,id),false,'One tap produces one E action');
    }
    Object.assign(scene.playerController.player,{x:100,y:100});mobile.update();
    down('interact',1);mobile.onRelease({id:1});
    Object.assign(scene.playerController.player,{x:1400,y:600});mobile.update();
    assert.equal(controls[4].visible,false);assert.equal(interactionPressed(scene,'vendor'),false);
    Object.assign(scene.playerController.player,{x:100,y:100});mobile.update();down('interact',1);
    scene.chat.isChatOpen=true;mobile.update();scene.chat.isChatOpen=false;
    assert.equal(interactionPressed(scene,'vendor'),false);
    assert.equal(mobile.centers.interact.x,scene.scale.width/2);
    scene.events.emit('shutdown');mobile.reset();assert.equal(mobile.consumeInteraction('vendor'),false);
});

test('mobile E button reaches the real vendor proximity handler and preserves keyboard E',()=>{
    const { scene,mobile,down }=mobileFixture();
    scene.shop.vendor={x:100,y:100};Object.assign(scene.playerController.player,{x:100,y:100});
    scene.controls.interactKey={};let opened=0;scene.shop.toggleShop=()=>opened++;
    mobile.update();const pointer=down('interact',1);mobile.onRelease(pointer);
    scene.shop.updateProximity();scene.shop.updateProximity();assert.equal(opened,1);
    scene.controls.interactKey.justDown=true;scene.shop.updateProximity();assert.equal(opened,2);
});

test('aim ray finds nearest rectangle/circle surfaces, including parallel rays and an origin inside a body',()=>{
    const {rayBodyDistance:hit}=load('aim-ray.ts');
    const box={left:10,right:20,top:-5,bottom:5};
    assert.equal(hit(0,0,1,0,box,100),10);
    assert.equal(hit(30,0,-1,0,box,100),10);
    assert.equal(hit(0,6,1,0,box,100),null);
    assert.equal(hit(0,0,-1,0,box,100),null);
    assert.equal(hit(12,0,0,1,box,100),0);
    assert.equal(hit(0,0,1,0,box,9),null);
    const circle={...box,isCircle:true,center:{x:15,y:0},halfWidth:5};
    assert.equal(hit(0,0,1,0,circle,100),10);
    assert.equal(hit(0,6,1,0,circle,100),null);
    assert.equal(hit(15,0,1,0,circle,100),0);
});

function aimingFixture(){
    const {scene,mobile}=mobileFixture();
    const {AimingSystem}=load('systems/AimingSystem.ts');
    const drawing={lines:[],dots:[],visible:true,setDepth(){return this;},clear(){this.lines=[];this.dots=[];return this;},
        setVisible(v){this.visible=v;return this;},lineStyle(){return this;},fillStyle(){return this;},
        lineBetween(x,y,tx,ty){this.lines.push({x,y,tx,ty});return this;},fillCircle(x,y,r){this.dots.push({x,y,r});return this;}};
    scene.add.graphics=()=>drawing;
    const scenery=[],enemies=[];
    scene.world.trees={getChildren:()=>scenery};
    scene.enemies.zombies={getChildren:()=>enemies};
    scene.castle={};scene.witches={};
    const aiming=new AimingSystem(scene);aiming.create();
    const body=(left,top,width,height,state)=>({active:true,body:{enable:true,left,right:left+width,top,bottom:top+height},getData:key=>key==='state'?state:undefined});
    return {scene,mobile,aiming,drawing,scenery,enemies,body};
}

test('laser follows shared muzzle/aim, clips to the closest live bullet target and shows shotgun spread',()=>{
    const {scene,mobile,aiming,drawing,scenery,enemies,body}=aimingFixture();
    mobile.aim={x:1,y:0}; // Player at (300,300), east muzzle (320,267).
    scenery.push(body(500,250,20,40));enemies.push(body(450,250,20,40));
    aiming.update();
    assert.equal(aiming.endpoint.x,450);assert.equal(aiming.endpoint.y,267);assert.equal(aiming.endpoint.hit,true);
    assert.equal(drawing.lines[0].x,320);assert.equal(drawing.lines[0].y,267);
    assert.equal(drawing.lines.length,2);assert.equal(drawing.dots.length,2);
    enemies[0].body.enable=false;aiming.update();assert.equal(aiming.endpoint.x,500);
    enemies[0].body.enable=true;enemies[0].getData=()=> 'dead';aiming.update();assert.equal(aiming.endpoint.x,500);
    scenery.length=0;aiming.update();assert.equal(aiming.endpoint.hit,false);assert.equal(drawing.dots.length,0);
    assert.equal(aiming.endpoint.x,320+scene.weapons.shotTrajectory(700,267).range);
    scene.weapons.activeWeapon='shotgun';aiming.update();assert.equal(drawing.lines.length,4);
    // Facing/projectile origin/angle agree across every direction without an ammo side effect.
    for(const [x,y] of [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]){
        const d=Math.hypot(x,y);mobile.aim={x:x/d,y:y/d};
        aiming.update();const target=mobile.aimTarget(),ray=scene.weapons.shotTrajectory(target.worldX,target.worldY);
        const line=drawing.lines.at(-1);
        assert.equal(line.x,ray.x);assert.equal(line.y,ray.y);
        assert.ok(Math.abs(Math.atan2(line.ty-line.y,line.tx-line.x)-ray.angle)<1e-8);
    }
    assert.equal(scene.weapons.currentAmmo,RIFLE_MAX_AMMO);
});

test('laser hides for modal/death gates and resets cleanly across two runs',()=>{
    const {scene,aiming,drawing}=aimingFixture();
    for(const [owner,key] of [[scene.menu,'isMenuOpen'],[scene.shop,'isShopOpen'],[scene.chat,'isChatOpen'],[scene.playerController,'isPlayerDead']]){
        owner[key]=true;aiming.update();assert.equal(drawing.visible,false);assert.equal(aiming.endpoint,null);
        owner[key]=false;aiming.update();assert.equal(drawing.visible,true);
    }
    for(let run=0;run<2;run++){aiming.reset();assert.equal(aiming.endpoint,null);aiming.create();aiming.update();assert.ok(aiming.endpoint);}
});

test('mobile hides all first-aid HUD fields/input, retains its AID button and restores the desktop strip',()=>{
    const {scene,mobile}=mobileFixture();const {HudSystem}=load('systems/HudSystem.ts');const hud=new HudSystem(scene);
    const items=Array.from({length:4},()=>({visible:true,setVisible(v){this.visible=v;return this;}}));
    [hud.medkitPlate,hud.medkitIcon,hud.medkitLabelText,hud.medkitCountText]=items;hud.medkitIcon.input={enabled:true};
    scene.hud.setMedkitBarVisible=hud.setMedkitBarVisible;
    mobile.update();assert.ok(items.every(i=>!i.visible));assert.equal(hud.medkitIcon.input.enabled,false);
    assert.equal(mobile.bases.heal.visible,true);
    scene.sys.game.device.os={desktop:true};mobile.usingTouch=false;mobile.update();
    assert.ok(items.every(i=>i.visible));assert.equal(hud.medkitIcon.input.enabled,true);
    scene.sys.game.device.os.desktop=false;mobile.update();assert.ok(items.every(i=>!i.visible));
});

const { InventorySystem }=load('systems/InventorySystem.ts');
const { RitualSystem }=load('systems/RitualSystem.ts');
const { LootSystem }=load('systems/LootSystem.ts');
const { enemyDrop, PORTAL_RECIPE, DRAGON_RECIPE }=load('progression.ts');

test('all faction drop probabilities have exact boundaries and guaranteed witch/drowner loot',()=>{
    for(const v of ['zombie','zombie-female','zombie-skeleton','zombie-blue']) {
        assert.equal(enemyDrop(v,0),'bone');assert.equal(enemyDrop(v,0.59999),'bone');assert.equal(enemyDrop(v,0.6),null);
    }
    for(const v of ['werewolf','werewolf-albino']) {assert.equal(enemyDrop(v,0.49999),'fang');assert.equal(enemyDrop(v,0.5),null);}
    for(const v of ['witch','witch-red'])assert.equal(enemyDrop(v,0.99999),'eye');
    assert.equal(enemyDrop('drowner',0.99999),'pearl');assert.equal(enemyDrop('dragon',0),null);
});
function progressionFixture(){
    const {scene}=fixture();let summoned=0,roars=0;
    scene.physics={pause(){},resume(){}};scene.mobileControls={releaseAll(){},consumeInteraction(){return false;}};
    scene.inventory=new InventorySystem(scene);scene.ritual=new RitualSystem(scene);
    scene.playerController.player.x=1440;scene.playerController.player.y=290;
    scene.boss={summonAncientDragon(){summoned++;},isDragonSpawned:false};
    scene.cameras.main.shake=()=>{};scene.sound={play(){roars++;}};scene.audio={play(key){if(key==='ritual-offering-chime')roars++;}};
    scene.ritual.altar={x:1440,y:260,play(){}};
    return {scene,summoned:()=>summoned,roars:()=>roars};
}
test('crafting is atomic, cannot duplicate keys, and resets items on every run',()=>{
    const {scene}=progressionFixture(),i=scene.inventory;
    i.add('bone',3);i.add('fang',2);assert.equal(i.craftPortalKey(),false);assert.equal(i.counts.bone,3);
    i.add('eye');i.add('pearl',2);assert.equal(i.craftPortalKey(),true);assert.equal(i.hasPortalKey,true);
    assert.equal(i.counts.bone,0);assert.equal(i.counts.fang,0);assert.equal(i.counts.eye,0);assert.equal(i.counts.pearl,2);
    i.add('bone',3);i.add('fang',2);i.add('eye');assert.equal(i.craftPortalKey(),false);assert.equal(i.counts.bone,3);
    for(let run=0;run<2;run++){i.open();assert.equal(i.isOpen,true);i.reset();assert.equal(i.isOpen,false);assert.equal(i.hasPortalKey,false);assert.ok(Object.values(i.counts).every(n=>n===0));}
});
test('dragon offering rechecks range, materials and boss; pauses ritual and summons exactly once',()=>{
    const {scene,summoned,roars}=progressionFixture(),r=scene.ritual,i=scene.inventory;
    assert.equal(r.offer(),false);
    for(const id of ['bone','fang','eye','pearl'])i.add(id,2);
    scene.playerController.player.x=2000;assert.equal(r.offer(),false);assert.equal(i.counts.bone,2);
    scene.playerController.player.x=1440;scene.boss.isDragonSpawned=true;assert.equal(r.offer(),false);
    scene.boss.isDragonSpawned=false;i.open('offering');assert.equal(r.offer(),true);assert.equal(i.isOpen,false);
    assert.equal(roars(),1);assert.equal(i.counts.bone,1);assert.equal(r.offer(),false);
    scene.menu.isMenuOpen=true;r.update(2000);assert.equal(summoned(),0);assert.equal(r.remaining,1000);
    scene.menu.isMenuOpen=false;r.update(1000);assert.equal(summoned(),1);r.update(1000);assert.equal(summoned(),1);
    r.reset();assert.equal(r.remaining,0);assert.equal(r.altar,null);
});
test('loot stacks, collects once, respects inventory gates and despawns on reset',()=>{
    const {scene}=progressionFixture();const sprites=[];
    const sprite=(x,y)=>{const o={x,y,active:true,setDepth(){return this;},setInteractive(){return this;},play(){return this;},on(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){this.active=false;}};sprites.push(o);return o;};
    scene.add={sprite,text:(x,y)=>({y,setOrigin(){return this;},setDepth(){return this;},destroy(){}})};
    scene.tweens={add(){}};const loot=new LootSystem(scene);
    const a=loot.spawn('bone',1440,290);assert.equal(loot.spawn('bone',1441,290),a);
    scene.inventory.isOpen=true;loot.update(16);assert.equal(loot.collect(a),false);
    scene.inventory.isOpen=false;loot.update(16);assert.equal(scene.inventory.counts.bone,2);assert.equal(loot.collect(a),false);
    const b=loot.spawn('pearl',100,100);loot.reset();assert.equal(b.active,false);assert.equal(loot.pickups.size,0);
});

const protocol=load('network-protocol.ts');
const {NetworkSystem}=load('systems/NetworkSystem.ts');
function coopPlayer(overrides={}){return {x:960,y:640,vx:0,vy:0,facing:'e',anim:'heroine-idle',hp:5,isFiring:false,currentWeapon:'rifle',skin:'heroine',zone:'meadow',targetX:1200,targetY:600,blocked:false,...overrides};}
function coopFixture(){
 const {scene}=fixture();scene.inventory={isOpen:false};scene.playerController.player={x:960,y:640,setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){}};
 scene.network=new NetworkSystem(scene);const n=scene.network;n.panel.destroy=()=>{};n.panel.refresh=()=>{};
 n.isMultiplayer=true;n.isConnected=true;n.remoteState=coopPlayer();n.remotePlayer={x:1000,y:640,setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){}};
 const sent=[];n.connection={open:true,dataChannel:{bufferedAmount:0},send:p=>sent.push(p),removeAllListeners(){},close(){}};
 scene.time={now:1000};return {scene,n,sent};
}
test('co-op protocol validates bounded packets, identifiers, skins and non-finite coordinates',()=>{
 assert.equal(protocol.makeRoomCode(new Uint8Array([0,1,2,3,4,5])),'ABCDEF');assert.equal(protocol.normalizeRoomCode(' wolf-42 '),'WOLF42');
 assert.equal(protocol.validRoomCode('ABC12'),true);assert.equal(protocol.validRoomCode('../bad'),false);
 const p={v:1,seq:1,type:'PLAYER_UPDATE',player:coopPlayer()};assert.equal(protocol.isPacket(p),true);
 for(const value of [NaN,Infinity,100001])assert.equal(protocol.isPacket({...p,player:coopPlayer({x:value})}),false);
 assert.equal(protocol.isPacket({...p,v:2}),false);assert.equal(protocol.isPacket({...p,seq:-1}),false);
 assert.equal(protocol.isPacket({...p,player:coopPlayer({anim:'a'.repeat(101)})}),false);
 assert.equal(protocol.isPacket({v:1,seq:2,type:'INTERACT_EVENT',action:'free-items'}),false);
});
test('host accepts bounded movement but never trusts guest health, skin or cross-zone teleports',()=>{
 const {n}=coopFixture();n.remoteUpdateAt=950;n.acceptPlayer(coopPlayer({x:1010,hp:99,skin:'player',anim:'player-walk'}));
 assert.equal(n.remoteState.hp,5);assert.equal(n.remoteState.skin,'heroine');assert.equal(n.remoteState.anim,'heroine-walk');assert.equal(n.remotePlayer.x,1010);
 n.acceptPlayer(coopPlayer({x:3000,zone:'castle'}));assert.equal(n.remoteState.zone,'meadow');assert.equal(n.remotePlayer.x,1010);
 n.acceptPlayer(coopPlayer({x:1800}));assert.equal(n.remotePlayer.x,1010);
});
test('guest shot validation uses host origin, cooldown, ammunition and purchase ownership',()=>{
 const {scene,n}=coopFixture();const emitted=[];scene.weapons.fireReplicated=(...args)=>emitted.push(args);
 const shot={v:1,seq:1,type:'SHOOT_EVENT',weapon:'rifle',x:0,y:0,targetX:1100,targetY:640};
 n.acceptShot(shot);assert.equal(emitted.length,1);assert.equal(emitted[0][1],1000);assert.equal(n.remoteAmmo.rifle,6);
 n.acceptShot(shot);assert.equal(emitted.length,1);
 scene.time.now=2000;n.acceptShot({...shot,weapon:'shotgun'});assert.equal(emitted.length,1);
 scene.weapons.hasShotgun=true;n.acceptShot({...shot,weapon:'shotgun'});assert.equal(emitted.length,2);assert.equal(n.remoteAmmo.shotgun,3);
 n.remoteState.blocked=true;scene.time.now=3000;n.acceptShot(shot);assert.equal(emitted.length,2);
});
test('replication deduplicates events without losing distinct requests behind newer state packets',()=>{
 const {n}=coopFixture();let applied=0;n.actions.apply=()=>applied++;
 n.receive({v:1,seq:4,type:'INTERACT_EVENT',action:'craft'});n.receive({v:1,seq:4,type:'INTERACT_EVENT',action:'craft'});n.receive({v:1,seq:3,type:'INTERACT_EVENT',action:'craft'});
 assert.equal(applied,2);assert.equal(n.received,4);
});
test('co-op remote damage targets living unblocked guest and invulnerability prevents duplicate hits',()=>{
 const {n,scene}=coopFixture();n.sendWorld=()=>{};
 assert.equal(n.nearestTarget({x:1010,y:640}),n.remotePlayer);
 n.damageTarget(n.remotePlayer,1,'witch');n.damageTarget(n.remotePlayer,1,'witch');assert.equal(n.remoteState.hp,4);
 scene.time.now=1600;n.remoteState.blocked=true;n.damageTarget(n.remotePlayer,1,'dragon');assert.equal(n.remoteState.hp,4);
 n.remoteState.blocked=false;n.remoteState.hp=0;assert.equal(n.nearestTarget({x:1010,y:640}),scene.playerController.player);
});
test('network reset closes external resources, clears replicas and is idempotent across two restarts',()=>{
 const {n}=coopFixture();let peers=0,connections=0;
 n.peer={removeAllListeners(){},destroy(){peers++;}};n.connection.close=()=>connections++;
 n.roomCode='WOLF42';n.reset();n.reset();assert.equal(peers,1);assert.equal(connections,1);assert.equal(n.isMultiplayer,false);assert.equal(n.isConnected,false);assert.equal(n.remotePlayer,null);assert.equal(n.roomCode,'');
});

 test('guest actions omit undefined fields so binary transport preserves optional packet validity',()=>{
 const {n,sent}=coopFixture();n.isHost=false;n.initialized=true;n.requestAction('loot','n7');
 assert.equal(Object.hasOwn(sent[0],'weapon'),false);assert.equal(protocol.isPacket(sent[0]),true);
 n.requestAction('craft');assert.equal(Object.hasOwn(sent[1],'id'),false);assert.equal(protocol.isPacket(sent[1]),true);
 });

 test('guest control phase and owning systems suppress independent simulation and rewards',()=>{
 const {scene,calls}=fixture();scene.network={isGuest:true,blocked:false,guestInteraction:()=>calls.push('interaction')};
 scene.inventory={isOpen:false};scene.shop.updateProximity=()=>calls.push('shop');scene.weapons.updateFiring=()=>calls.push('firing');scene.weapons.cleanupBullets=()=>calls.push('cleanup');
 new GameplaySystem(scene).update(1000);assert.deepEqual(calls,['movement','firing','altars','interaction','shop','depth','cleanup']);
 const {EnemiesSystem}=load('systems/EnemiesSystem.ts'),{BossSystem}=load('systems/BossSystem.ts'),{WitchSystem}=load('systems/WitchSystem.ts'),{AltarsSystem}=load('systems/AltarsSystem.ts');
 const enemies=new EnemiesSystem(scene);enemies.summonZombieAtAltar();enemies.summonWerewolfAtWolfAltar();enemies.summonDrownerAtAltar();enemies.update(1000);
 new BossSystem(scene).summonAncientDragon();new WitchSystem(scene).spawn();new AltarsSystem(scene).handleAutoSpawnTick();
 const loot=new LootSystem(scene);loot.onEnemyDefeated('witch',100,100);assert.equal(loot.pickups.size,0);
 });

 test('transport drops replaceable state under backpressure while retaining reliable actions',()=>{
 const {n,sent}=coopFixture();n.connection.dataChannel.bufferedAmount=300000;
 n.send({type:'PLAYER_UPDATE',player:coopPlayer()});assert.equal(sent.length,0);
 n.send({type:'INTERACT_EVENT',action:'craft'});assert.equal(sent.length,1);assert.equal(sent[0].type,'INTERACT_EVENT');
 });

test('co-op final-hit rewards belong to the shooter and survive projectile reuse without duplicate credit', () => {
    const { NetworkResourcesSystem } = load('systems/NetworkResourcesSystem.ts');
    for (const variant of ['witch', 'zombie', 'werewolf']) {
        const { scene, spawn } = witchFixture();
        scene.score = 7;
        scene.network = { isHost: true, isGuest: false, isConnected: true, sendWorld() {}, nearestTarget: () => scene.playerController.player };
        const resources = scene.network.resources = new NetworkResourcesSystem(scene);
        const enemy = spawn();
        enemy.setData('variant', variant).setData('hp', 2);
        const local = witchSprite('bullet').setData('owner', 'local');
        scene.enemies.bulletHitZombie(local, enemy);
        enemy.complete(enemy.anims.currentAnim.key);
        const remote = witchSprite('bullet').setData('owner', 'remote').setData('ownerGeneration', resources.generation);
        scene.enemies.bulletHitZombie(remote, enemy);
        const death = enemy.anims.currentAnim.key;
        remote.setData('owner', 'local'); // Pool reuse cannot change captured ownership.
        enemy.complete(death);
        enemy.complete(death);
        assert.equal(scene.score, 7);
        assert.equal(resources.guestKills, variant === 'werewolf' ? 2 : 1);
        const ownEnemy = spawn();
        ownEnemy.setData('hp', 1);
        scene.enemies.bulletHitZombie(witchSprite('bullet').setData('owner', 'local'), ownEnemy);
        ownEnemy.complete(ownEnemy.anims.currentAnim.key);
        assert.equal(scene.score, 8);
    }
});

test('co-op dragon reward credits only the final shooter once', () => {
    const { NetworkResourcesSystem } = load('systems/NetworkResourcesSystem.ts');
    const { scene, boss, projectile } = bossFixture();
    scene.network = { isHost: true, isGuest: false, isConnected: true, sendWorld() {}, nearestTarget: () => scene.playerController.player };
    const resources = scene.network.resources = new NetworkResourcesSystem(scene);
    boss.dragonHp = 1;
    boss.bulletHitDragon(projectile().setData('owner', 'remote').setData('ownerGeneration', resources.generation), boss.dragon);
    boss.bulletHitDragon(projectile(), boss.dragon);
    assert.equal(resources.guestKills, 100);
    assert.equal(scene.score, 0);
});

test('co-op purchases and healing use only the buyer\'s kills and kits', () => {
    const { scene, n } = coopFixture();
    n.sendWorld = () => {};
    scene.score = 20;
    scene.playerController.medkits = 2;
    scene.shop.vendor = { x: n.remotePlayer.x, y: n.remotePlayer.y };
    const action = action => n.actions.apply({ v: 1, seq: 1, type: 'INTERACT_EVENT', action });
    action('medkit'); // Guest may not spend the host's balance.
    assert.equal(n.resources.guestMedkits, 0);
    n.resources.guestKills = 4;
    action('medkit');
    assert.equal(n.resources.guestKills, 2);
    assert.equal(n.resources.guestMedkits, 1);
    assert.equal(scene.score, 20);
    assert.equal(scene.playerController.medkits, 2);
    n.remoteState.hp = 3;
    action('heal');
    assert.equal(n.remoteState.hp, 5);
    assert.equal(n.resources.guestMedkits, 0);
    assert.equal(scene.playerController.medkits, 2);
    n.remoteState.hp = 3;
    action('heal');
    assert.equal(n.remoteState.hp, 3, 'Guest cannot use the host\'s kits');
    scene.shop.buyFirstAidKit();
    assert.equal(scene.score, 18);
    assert.equal(scene.playerController.medkits, 3);
    assert.equal(n.resources.guestKills, 2);
    scene.shop.vendor.x += 1000;
    action('medkit');
    assert.equal(n.resources.guestKills, 2, 'Distance guard still applies');
    scene.shop.vendor.x -= 1000;
    n.resources.guestKills = 12;
    action('shotgun');
    assert.equal(n.resources.guestKills, 2);
    assert.equal(scene.score, 18);
});

test('co-op guest balances reset across two restarts and reject old-session rewards', () => {
    const { n, scene } = coopFixture();
    n.sendWorld = () => {};
    scene.score = 9;
    scene.playerController.medkits = 2;
    for (let run = 0; run < 2; run++) {
        n.resources.guestKills = 20;
        n.resources.guestMedkits = 3;
        const generation = n.resources.generation;
        n.reset();
        assert.equal(n.resources.guestKills, 0);
        assert.equal(n.resources.guestMedkits, 0);
        n.isConnected = true;
        n.resources.awardKills(1, 'remote', generation);
        assert.equal(n.resources.guestKills, 0);
        assert.equal(scene.score, 9);
        assert.equal(scene.playerController.medkits, 2);
    }
});

test('drowner and altar-drowner animations are registered with complete directional frames', () => {
    const { AnimationsSystem } = load('systems/AnimationsSystem.ts');
    const createdAnims = new Map();
    const drownerAnimData = JSON.parse(fs.readFileSync('public/assets/drowner/drowner.animations.json', 'utf8'));
    const altarDrownerAnimData = JSON.parse(fs.readFileSync('public/assets/altar-drowner/altar-drowner.animations.json', 'utf8'));

    const fakeScene = {
        cache: {
            json: {
                get(key) {
                    if (key === 'drowner-anim') return drownerAnimData;
                    if (key === 'altar-drowner-anim') return altarDrownerAnimData;
                    return null;
                }
            }
        },
        anims: {
            exists(k) { return createdAnims.has(k); },
            create(config) { createdAnims.set(config.key, config); },
            generateFrameNumbers() { return []; }
        }
    };

    const animSys = new AnimationsSystem(fakeScene);
    animSys.registerAnimations();

    assert.ok(createdAnims.has('drowner-idle'));
    assert.ok(createdAnims.has('drowner-walk'));
    assert.ok(createdAnims.has('drowner-attack'));
    assert.ok(createdAnims.has('drowner-die'));
    assert.ok(createdAnims.has('drowner-walk-front'));
    assert.ok(createdAnims.has('drowner-attack-back45'));

    assert.ok(createdAnims.has('altar-drowner-idle'));
    assert.ok(createdAnims.has('altar-drowner-active'));
    assert.ok(createdAnims.has('altar-drowner-summon'));
});

test('castle prison drowner altar has proximity badge, activates on danger zone and summons drowners on [E]', () => {
    const { AltarsSystem } = load('systems/AltarsSystem.ts');
    const { DROWNER_ALTAR_X, DROWNER_ALTAR_Y } = load('constants.ts');
    const { scene } = witchFixture();
    let alertText = '', alertColor = '';
    scene.hud.flashProximityAlert = (text, color) => { alertText = text; alertColor = color; };
    let summonedDrowners = 0;
    scene.enemies.summonDrownerAtAltar = () => { summonedDrowners++; };

    const altars = new AltarsSystem(scene);
    altars.createAltar();

    assert.equal(altars.drownerAltar.x, DROWNER_ALTAR_X);
    assert.equal(altars.drownerAltar.y, DROWNER_ALTAR_Y);
    assert.equal(altars.drownerPromptSprite.frame, 'prompt-altar-drowner');
    assert.equal(altars.drownerPromptSprite.visible, false);

    // Far from altar: badge remains hidden
    scene.playerController.player.x = DROWNER_ALTAR_X;
    scene.playerController.player.y = DROWNER_ALTAR_Y + 400;
    altars.updateProximity(0);
    assert.equal(altars.drownerPromptSprite.visible, false);

    // Approaching danger zone (< 260px): badge visible, active animation, proximity alert flashed
    scene.playerController.player.y = DROWNER_ALTAR_Y + 200;
    altars.updateProximity(5000);
    assert.equal(altars.drownerPromptSprite.visible, true);
    assert.equal(altars.drownerAltar.anims.currentAnim?.key, 'altar-drowner-active');
    assert.ok(alertText.includes('Prison Cistern'));
    assert.equal(summonedDrowners, 1);

    // Pressing [E] nearby summons emergency drowner
    scene.playerController.player.y = DROWNER_ALTAR_Y + 50;
    scene.controls.interactKey = { justDown: true };
    altars.updateProximity(5200);
    assert.equal(summonedDrowners, 2);

    // Moving far away restores idle animation and hides badge
    scene.playerController.player.y = DROWNER_ALTAR_Y + 500;
    altars.updateProximity(5400);
    assert.equal(altars.drownerPromptSprite.visible, false);
    assert.equal(altars.drownerAltar.anims.currentAnim?.key, 'altar-drowner-idle');

    // Reset clears state
    altars.reset();
    assert.equal(altars.isPlayerNearDrownerAltar, false);
    assert.equal(altars.isDrownerAltarSummoning, false);
});


const { AudioSystem } = load('systems/AudioSystem.ts');
function audioFixture() {
    const { EventEmitter } = require('node:events');
    const sounds=[];
    const scene={time:{now:1000},input:new EventEmitter(),events:new EventEmitter(),
        playerController:{player:{x:0,y:0}},cache:{audio:{exists:()=>true}},
        sound:{locked:false,add(key,config){
            const sound=new EventEmitter();Object.assign(sound,{key,config,destroyed:false,
                play(){return true;},setVolume(v){this.config.volume=v;},destroy(){this.destroyed=true;this.removeAllListeners();}});
            sounds.push(sound);return sound;
        }}};
    const audio=new AudioSystem(scene);audio.create();return {scene,audio,sounds};
}
test('audio gates locked/missing assets, attenuates distant cues and bounds overlap',()=>{
    const {scene,audio,sounds}=audioFixture();
    scene.sound.locked=true;assert.equal(audio.play('rifle-fire'),false);assert.equal(sounds.length,0);
    scene.sound.locked=false;scene.cache.audio.exists=()=>false;assert.equal(audio.play('rifle-fire'),false);
    scene.cache.audio.exists=()=>true;assert.equal(audio.play('rifle-fire',{x:900,y:0}),false);
    assert.equal(audio.play('rifle-fire',{x:325,y:0},.8),true);assert.equal(sounds[0].config.volume,.2);
    assert.equal(audio.play('rifle-fire'),false);scene.time.now+=70;assert.equal(audio.play('rifle-fire'),true);
    sounds[0].emit('complete');assert.equal(sounds[0].destroyed,true);
    for(let i=0;i<30;i++){scene.time.now+=70;audio.play('impact-flesh');}
    assert.equal(audio.active.size,24);audio.shutdown();assert.ok(sounds.every(s=>s.destroyed));
});
test('audio loops and pointer listeners are disposed across two restarts',()=>{
    const {scene,audio,sounds}=audioFixture();
    for(let i=0;i<2;i++){
        assert.equal(scene.input.listenerCount('gameobjectover'),1);
        audio.loop('laser-aim-hum',.03);audio.loop('laser-aim-hum',.02);
        assert.equal(audio.loops.size,1);assert.equal(audio.active.size,1);
        assert.equal(sounds.at(-1).config.volume,.02);
        scene.events.emit('shutdown');assert.equal(scene.input.listenerCount('gameobjectover'),0);
        assert.equal(audio.active.size,0);assert.equal(audio.loops.size,0);
        audio.reset();audio.create();
    }
});
test('all inventory sound keys have unique exported WAVs and valid measured levels',()=>{
    const root=path.resolve(__dirname,'..');
    const keys=[...fs.readFileSync(path.join(root,'src/game/assets-src/audio/sound-effects-list.md'),'utf8').matchAll(/^\| `([^`]+)`\s*\|/gm)].map(m=>m[1]);
    const metrics=JSON.parse(fs.readFileSync(path.join(root,'src/game/assets-src/audio/metrics.json')));
    assert.equal(keys.length,103);assert.equal(new Set(keys).size,keys.length);
    assert.deepEqual(metrics.map(m=>m.key),keys);
    const hashes=new Set();const {createHash}=require('node:crypto');
    for(const m of metrics){
        assert.ok(m.peak>0 && m.peak<1 && m.rms>0 && m.clippedSamples===0 && !m.silent,m.key);
        const wav=fs.readFileSync(path.join(root,`public/assets/audio/sfx/${m.key}/${m.key}.wav`));
        assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),44100);
        hashes.add(createHash('sha256').update(wav).digest('hex'));
    }
    assert.equal(hashes.size,keys.length);
});
