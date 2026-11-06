// Optional integration test: requires Playwright and a running dev or production server.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/home/juda/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('console', message => { if (message.type() === 'error') console.error('Console:', message.text()); });
        page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.stack); });
        await require('./browser-game.cjs').prepareGamePage(page);
        await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8080');
        assert.equal(await page.title(), 'Overrun');
        await page.waitForFunction(() => window.__testGame?.scene.getScene('Game')?.chat.chatContainer, null, { timeout: 60000 }).catch(async error => { console.error(await page.evaluate(() => ({ game: Boolean(window.__testGame), scenes: window.__testGame?.scene.scenes.map(s => ({key:s.sys.settings.key, active:s.sys.settings.active, progress:s.load.progress})) }))); throw error; });
        assert.equal(await page.evaluate(() => window.__testGame.config.gameTitle), 'Overrun');
        const state = () => page.evaluate(() => {
            const s = window.__testGame.scene.getScene('Game');
            return { chat: s.chat.isChatOpen, menu: s.menu.isMenuOpen, ammo: s.weapons.currentAmmo, character: s.playerController.currentCharacter, x: s.playerController.player.x };
        });
        const initial = await state();
        await page.keyboard.down('d');
        await page.waitForTimeout(250);
        await page.keyboard.up('d');
        assert.ok((await state()).x > initial.x);
        await page.keyboard.press('g', { delay: 80 });
        await page.waitForTimeout(100);
        assert.equal((await state()).character, 'heroine');
        await page.keyboard.press('Enter', { delay: 80 });
        assert.equal((await state()).chat, true);
        await page.keyboard.type('/heal');
        await page.keyboard.press('Enter', { delay: 80 });
        assert.equal((await state()).chat, false);
        await page.keyboard.press('Escape', { delay: 80 });
        assert.equal((await state()).menu, true);
        await page.keyboard.press('Escape', { delay: 80 });
        assert.equal((await state()).menu, false);
        await page.evaluate(() => {
            const s = window.__testGame.scene.getScene('Game');
            s.weapons.fireBulletAt(s.playerController.player.x + 100, s.playerController.player.y - 33);
        });
        assert.equal((await state()).ammo, initial.ammo - 1);
        await page.keyboard.press('r', { delay: 80 });
        await page.waitForFunction(() => window.__testGame.scene.getScene('Game').weapons.currentAmmo === 7);
        assert.equal((await state()).ammo, initial.ammo);

        // Verify portal teleportation to castle and back
        await page.evaluate(() => {
            const s = window.__testGame.scene.getScene('Game');
            s.inventory.add('portal-key');
            s.castle.portalUnlocked=true;
            s.playerController.player.setPosition(960, 80);
            s.castle.teleportToCastle();
            s.castle.update(s.time.now);
        });
        assert.equal(await page.evaluate(() => window.__testGame.scene.getScene('Game').castle.currentZone), 'castle');
        await page.evaluate(() => {
            const s = window.__testGame.scene.getScene('Game');
            s.playerController.player.setPosition(s.castle.castlePortal.x, s.castle.castlePortal.y);
            s.time.now += 2000;
            s.castle.update(s.time.now);
        });
        assert.equal(await page.evaluate(() => window.__testGame.scene.getScene('Game').castle.currentZone), 'meadow');
        await page.evaluate(() => {
            const s = window.__testGame.scene.getScene('Game');
            s.score = 100;
            s.shop.toggleShop();
            s.shop.buyShotgun();
            if (!s.weapons.hasShotgun || s.weapons.activeWeapon !== 'shotgun') throw Error('Purchase failed');
            s.altars.isAutoSpawnEnabled = true;
            // Exercise a detached timer callback and both spawn animation callbacks.
            const tick = s.altars.handleAutoSpawnTick;
            tick();
            s.enemies.summonWerewolfAtWolfAltar();
        });
        await page.waitForTimeout(1800);
        assert.ok(await page.evaluate(() => window.__testGame.scene.getScene('Game').enemies.zombies.countActive(true) > 0));
        await page.keyboard.press('Enter', { delay: 80 });
        await page.keyboard.type('/dragon');
        await page.keyboard.press('Enter', { delay: 80 });
        await page.waitForTimeout(100);
        await page.evaluate(() => window.__testGame.scene.getScene('Game').boss.summonAncientDragon());
        assert.ok(await page.evaluate(() => window.__testGame.scene.getScene('Game').boss.dragon?.active));
        await page.evaluate(() => {
            const s = window.__testGame.scene.getScene('Game');
            const bullet = s.weapons.bullets.get(s.boss.dragon.x, s.boss.dragon.y, 'bullet');
            s.weapons.prepareProjectile(bullet, 'bullet', 0);
            // Actual physics overlap callback will use the bound boss receiver.
            bullet.body.reset(s.boss.dragon.x, s.boss.dragon.y - 30);
        });
        await page.waitForFunction(() => window.__testGame.scene.getScene('Game').boss.dragonHp < 50, null, { timeout: 5000 });
        for (let i = 0; i < 2; i++) {
            await page.evaluate(() => window.__testGame.scene.getScene('Game').scene.restart());
            await page.waitForTimeout(500);
            assert.equal((await state()).ammo, initial.ammo);
            await page.keyboard.press('Enter', { delay: 80 });
            assert.equal((await state()).chat, true, 'One Enter must open chat after restart');
            await page.keyboard.press('Escape', { delay: 80 });
            assert.equal((await state()).chat, false);
            assert.equal((await state()).menu, false);
        }
        assert.deepEqual(errors, []);
        console.log('Browser smoke passed: boot, movement, character, chat, menu, fire/reload, shop, spawning, boss overlap, two restarts.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
