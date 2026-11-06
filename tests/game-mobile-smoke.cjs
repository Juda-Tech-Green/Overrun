// Real Chromium touch events through Phaser's input manager (requires Playwright + Vite).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/home/juda/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome' });
    try {
        const page = await browser.newPage({ viewport: { width: 960, height: 640 }, hasTouch: true, isMobile: true });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/src/main.ts*', route => route.fulfill({ contentType: 'text/javascript',
            body: "import StartGame from '/src/game/main.ts'; window.__testGame = StartGame('game-container');" }));
        await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8080');
        await page.waitForFunction(() => window.__testGame?.scene.getScene('Game')?.mobileControls?.root, null, { timeout: 60000 });
        const client = await page.context().newCDPSession(page);
        const state = () => page.evaluate(() => {
            const s = window.__testGame.scene.getScene('Game'), m = s.mobileControls;
            return { x: s.playerController.player.x, y: s.playerController.player.y,
                facing: s.playerController.playerFacing, ammo: s.weapons.currentAmmo,
                move: m.movement, aim: m.aim, firing: m.firing, visible: m.root.visible,
                pointers: s.input.manager.pointers.length, owners: m.pointers.size };
        });
        async function point(role, id, dx=0, dy=0) {
            return page.evaluate(({role,id,dx,dy}) => {
                const game=window.__testGame, m=game.scene.getScene('Game').mobileControls;
                const r=game.canvas.getBoundingClientRect(), c=m.centers[role];
                return { id, x:r.left+(c.x+dx*m.radius)*r.width/game.scale.width,
                    y:r.top+(c.y+dy*m.radius)*r.height/game.scale.height };
            }, {role,id,dx,dy});
        }
        const send = (type, touchPoints) => client.send('Input.dispatchTouchEvent', { type, touchPoints });
        async function tapRole(role,id=7) {
            await send('touchStart',[await point(role,id)]);await send('touchEnd',[]);
        }
        async function tapMenuText(prefix) {
            const target=await page.evaluate(prefix=>{
                const s=window.__testGame.scene.getScene('Game');
                const text=s.menu.menuContainer.list.find(o=>typeof o.text==='string' && o.text.startsWith(prefix));
                const r=text.getBounds();return {id:7,x:r.centerX,y:r.centerY};
            },prefix);
            await send('touchStart',[target]);await send('touchEnd',[]);
        }
        assert.ok((await state()).pointers >= 4, 'Mouse plus three touch pointers must exist');
        assert.equal((await state()).visible,true);
        for (const weapon of ['rifle','shotgun']) {
            await page.evaluate(weapon => {
                const s=window.__testGame.scene.getScene('Game');
                // World scenery is randomized; isolate input/physics movement from obstacle placement.
                s.playerController.player.body.checkCollision.none=true;
                s.weapons.hasShotgun=true;s.weapons.setWeapon(weapon);s.weapons.fireDelay=0;
                s.weapons.rifleAmmo=7;s.weapons.shotgunAmmo=4;s.weapons.currentAmmo=weapon==='rifle'?7:4;
                window.__shots=[];
                if (!s.weapons.originalFireForTest) s.weapons.originalFireForTest=s.weapons.fireBulletAt;
                s.weapons.fireBulletAt=(x,y)=>{const before=s.weapons.currentAmmo;s.weapons.originalFireForTest(x,y);
                    window.__shots.push({before,after:s.weapons.currentAmmo,time:s.time.now,next:s.weapons.fireDelay});};
            },weapon);
            const initial=await state(), move=await point('move',1,1,0), aim=await point('aim',2,0,-1);
            await send('touchStart',[move]);
            await send('touchStart',[move,aim]);
            await page.waitForFunction(x=>window.__testGame.scene.getScene('Game').playerController.player.x>x, initial.x, {timeout:2000});
            const aiming=await state();
            assert.ok(aiming.x>initial.x,'Left stick must move the actual physics body');
            assert.equal(aiming.facing,'n','Right stick independently turns player north');
            assert.equal(aiming.ammo,initial.ammo,'Sticks must not fire');
            const fire=await point('fire',3);
            await send('touchStart',[move,aim,fire]);
            await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').mobileControls.firing);
            // Observe immediate fire before the next cooldown can expire.
            const fired=await state();
            const shots=await page.evaluate(()=>window.__shots);
            assert.ok(shots.length>=1);
            for(let i=0;i<shots.length;i++) {
                assert.equal(shots[i].after,shots[i].before-1,`${weapon}: each shot consumes one round`);
                if(i) assert.ok(shots[i].time>=shots[i-1].next, 'No duplicate within cooldown');
            }
            assert.equal(fired.owners,3);
            await send('touchEnd',[fire]);
            await page.waitForFunction(()=>!window.__testGame.scene.getScene('Game').mobileControls.firing, null, {timeout:2000})
                .catch(async error=>{console.error(await page.evaluate(()=>{
                    const s=window.__testGame.scene.getScene('Game');return {owners:[...s.mobileControls.pointers].map(([r,p])=>({role:r,id:p.id,identifier:p.identifier,down:p.isDown,event:p.event?.type})),
                        pointers:s.input.manager.pointers.map(p=>({id:p.id,identifier:p.identifier,down:p.isDown,event:p.event?.type}))};
                }));throw error;});
            assert.equal((await state()).firing,false);
            // Aim in another direction while moving, through native touchmove.
            aim.x-=60;aim.y+=60;
            await send('touchMove',[move,aim]);
            await page.waitForTimeout(60);
            assert.ok((await state()).aim.x<0);
            await send('touchEnd',[]);
            await page.waitForTimeout(60);
            assert.equal((await state()).owners,0);
            assert.equal((await state()).move.x,0);
        }
        // Cancellation must release all three controls rather than stick on.
        await send('touchStart',[await point('move',1,1,0),await point('aim',2,1,0),await point('fire',3)]);
        await send('touchCancel',[]);
        await page.waitForTimeout(50);
        assert.equal((await state()).owners,0);
        assert.equal((await state()).firing,false);
        for(let run=0;run<2;run++) {
            await send('touchStart',[await point('move',1,1,0),await point('fire',2)]);
            await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').mobileControls.firing);
            await page.evaluate(()=>window.__testGame.scene.getScene('Game').scene.restart());
            await page.waitForTimeout(150);
            await send('touchEnd',[]);
            const s=await state();assert.equal(s.owners,0);assert.equal(s.firing,false);assert.equal(s.move.x,0);
            const listeners=await page.evaluate(()=>{
                const s=window.__testGame.scene.getScene('Game');
                return { blur:s.game.events.listeners('blur').filter(f=>f===s.mobileControls.releaseAll).length,
                    move:s.input.listeners('pointermove').filter(f=>f===s.mobileControls.onMove).length };
            });
            assert.deepEqual(listeners,{blur:1,move:1});
        }
        const output=process.env.MOBILE_SCREENSHOT_DIR || '/tmp/pixelforge-mobile-smoke';
        fs.mkdirSync(output,{recursive:true});
        for(const [width,height,name] of [[924,412,'landscape'],[390,844,'portrait']]) {
            await page.setViewportSize({width,height});
            await page.waitForFunction(()=>{
                const r=window.__testGame.canvas.getBoundingClientRect();
                return Math.abs(r.width-innerWidth)<1 && Math.abs(r.height-innerHeight)<1 && Math.abs(r.x)<1 && Math.abs(r.y)<1;
            },null,{timeout:3000});
            const layout=await page.evaluate(()=>{
                const s=window.__testGame.scene.getScene('Game');
                return {width:s.scale.width,height:s.scale.height,buttonX:s.hud.menuBtn.x,menuScroll:s.hud.menuBtn.scrollFactorX,
                    worldZoom:s.cameras.main.zoom,uiZoom:s.viewport.uiCamera.zoom,cameras:s.cameras.cameras.length,
                    aid:[s.hud.medkitPlate,s.hud.medkitIcon,s.hud.medkitLabelText,s.hud.medkitCountText].map(o=>o.visible),
                    touchScroll:s.mobileControls.root.list.filter(o=>o.input).map(o=>o.scrollFactorX),
                    modals:[s.menu.menuContainer,s.shop.shopContainer,s.deathScreen.container].map(c=>{
                        const bounds=c.list[0].getBounds();return {x:c.x,y:c.y,backdrop:{width:bounds.width,height:bounds.height}};
                    })};
            });
            assert.equal(layout.width,width);assert.equal(layout.height,height);assert.equal(layout.buttonX,width-38);
            assert.equal(layout.worldZoom,2);assert.equal(layout.uiZoom,1);assert.equal(layout.cameras,2);
            assert.ok(layout.aid.every(v=>!v));
            assert.equal(layout.menuScroll,0);assert.ok(layout.touchScroll.every(v=>v===0));
            for(const modal of layout.modals){
                assert.equal(modal.x,width/2);assert.equal(modal.y,height/2);
                assert.ok(Math.abs(modal.backdrop.width-width)<1);assert.ok(Math.abs(modal.backdrop.height-height)<1);
            }
            // The menu remains touch-accessible at the new screen edge.
            await send('touchStart',[{id:5,x:width-38,y:36}]);await send('touchEnd',[]);
            await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').menu.isMenuOpen);
            const hero=await page.evaluate(()=>window.__testGame.scene.getScene('Game').playerController.currentCharacter);
            await tapMenuText('SWITCH HERO');
            await page.waitForFunction(hero=>window.__testGame.scene.getScene('Game').playerController.currentCharacter!==hero,hero);
            const auto=await page.evaluate(()=>window.__testGame.scene.getScene('Game').altars.isAutoSpawnEnabled);
            await tapMenuText('TOGGLE');
            await page.waitForFunction(auto=>window.__testGame.scene.getScene('Game').altars.isAutoSpawnEnabled!==auto,auto);
            await tapMenuText('RESUME');
            await page.waitForFunction(()=>!window.__testGame.scene.getScene('Game').menu.isMenuOpen);
            await page.waitForTimeout(60);
            await page.screenshot({path:`${output}/${name}.png`});
        }
        await page.evaluate(()=>{
            const s=window.__testGame.scene.getScene('Game');
            s.playerController.playerHealth=1;s.playerController.medkits=2;s.hud.updateHUD();
        });
        const aid=await point('heal',7);
        await send('touchStart',[aid]);
        await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').playerController.medkits===1);
        await page.waitForTimeout(200);
        assert.deepEqual(await page.evaluate(()=>{
            const p=window.__testGame.scene.getScene('Game').playerController;return {hp:p.playerHealth,kits:p.medkits};
        }),{hp:3,kits:1},'Holding first aid consumes one kit');
        await send('touchEnd',[]);
        // Move into vendor range, away from any randomized scenery collision.
        await page.evaluate(()=>{
            const s=window.__testGame.scene.getScene('Game');
            s.playerController.player.setPosition(s.shop.vendor.x+80,s.shop.vendor.y);
            s.playerController.player.body.checkCollision.none=true;
        });
        await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').mobileControls.bases.interact.visible);
        await page.screenshot({path:`${output}/vendor-action.png`});
        await tapRole('interact');
        await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').shop.isShopOpen);
        const close=await page.evaluate(()=>{
            const s=window.__testGame.scene.getScene('Game');
            const text=s.shop.shopContainer.list.find(o=>typeof o.text==='string' && o.text.includes('CLOSE'));
            const r=text.getBounds();return {id:7,x:r.centerX,y:r.centerY};
        });
        await send('touchStart',[close]);await send('touchEnd',[]);
        await page.waitForFunction(()=>!window.__testGame.scene.getScene('Game').shop.isShopOpen);
        await page.evaluate(()=>window.__testGame.scene.getScene('Game').playerController.player.setPosition(960,640));
        await page.waitForFunction(()=>!window.__testGame.scene.getScene('Game').mobileControls.bases.interact.visible);
        const move=await point('move',1,1,0),before=await state();
        await page.evaluate(()=>{window.__testGame.scene.getScene('Game').playerController.player.body.checkCollision.none=true;});
        await send('touchStart',[move]);
        await page.waitForFunction(x=>window.__testGame.scene.getScene('Game').playerController.player.x>x, before.x, {timeout:2000});
        assert.ok((await state()).x>before.x,'Full-screen portrait touch maps into game coordinates');
        await send('touchEnd',[]);
        assert.deepEqual(errors,[]);
        console.log('Mobile smoke passed: three-touch combat, fullscreen landscape/portrait, touch menu/hero/toggle/resume, first aid, contextual vendor action/close, cancel and two restarts.');
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
