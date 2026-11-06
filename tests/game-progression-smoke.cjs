// Native desktop/touch progression, controlled enemy encounters and real exported assets.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/home/juda/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'});
 try{
 fs.mkdirSync('/tmp/pixelforge-progression-smoke',{recursive:true});
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:924,height:412}:{width:960,height:640},hasTouch:mobile,isMobile:mobile});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/src/main.ts*',r=>r.fulfill({contentType:'text/javascript',body:"import StartGame from '/src/game/main.ts';window.__testGame=StartGame('game-container');"}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8093');
  await page.waitForFunction(()=>window.__testGame?.scene.getScene('Game')?.inventory?.container);
  const tap=async(x,y)=>mobile?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  const objectTap=async(expr)=>{const p=await page.evaluate(expr=>{const s=window.__testGame.scene.getScene('Game');const o=Function('s',`return ${expr}`)(s);return {x:o.x,y:o.y};},expr);await tap(p.x,p.y);};
  await page.evaluate(mobile=>{
   const s=window.__testGame.scene.getScene('Game');s.altars.isAutoSpawnEnabled=false;s.mobileControls.usingTouch=mobile;s.cameras.main.setLerp(1,1);
   // Isolate encounters from procedural obstacles and autonomous damage.
   for(const g of [s.world.trees,s.world.giantTrees,s.world.rocks,s.world.bushes])for(const o of g.getChildren())if(o.body)o.body.enable=false;
   s.enemies.update=()=>{};s.witches.update=()=>{};
   window.__portal={x:s.castle.meadowPortal.x,y:s.castle.meadowPortal.y};
   s.playerController.player.setPosition(window.__portal.x,window.__portal.y);
  },mobile);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__testGame.scene.getScene('Game').castle.currentZone),'meadow');
  // Defeat actual pooled enemies through the shared damage callback; force successful random rolls.
  const kill=async(variant,n)=>page.evaluate(({variant,n})=>{
   const s=window.__testGame.scene.getScene('Game'),p=s.playerController.player;
   const random=Math.random;Math.random=()=>0.01;
   try{for(let i=0;i<n;i++){
    const enemy=s.enemies.zombies.get(p.x+70,p.y,variant,'idle-side-0');
    enemy.setTexture(variant,'idle-side-0').setActive(true).setVisible(true).setData({variant,hp:1,state:'idle',facing:'e'});
    enemy.body.enable=true;
    const bullet=s.weapons.bullets.get(p.x+70,p.y,'bullet');s.weapons.prepareProjectile(bullet,'bullet',0);
    s.enemies.bulletHitZombie(bullet,enemy);
   }}finally{Math.random=random;}
  },{variant,n});
  await kill('zombie',3);
  await page.waitForTimeout(100);
  const dropPoint=await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');const o=[...s.loot.pickups.keys()][0],c=s.cameras.main;return {x:c.width/2+(o.x-c.midPoint.x)*c.zoom,y:c.height/2+(o.y-c.midPoint.y)*c.zoom,ammo:s.weapons.currentAmmo};});
  await tap(dropPoint.x,dropPoint.y);
  assert.equal(await page.evaluate(()=>window.__testGame.scene.getScene('Game').inventory.counts.bone),3);
  assert.equal(await page.evaluate(()=>window.__testGame.scene.getScene('Game').weapons.currentAmmo),dropPoint.ammo);
  await kill('werewolf',2);await kill('witch',1);
  // Walk over the stacked drops.
  await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');for(const [o] of s.loot.pickups)s.playerController.player.setPosition(o.x,o.y);});
  await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.counts.eye===1);
  if(mobile)await objectTap('s.hud.backpackButton');else await page.keyboard.press('i');
  await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.isOpen);
  const before=await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');return {ammo:s.weapons.currentAmmo,blocked:s.mobileControls.blocked(),laser:s.aiming.graphics.visible,slots:s.inventory.slots.map(o=>({w:o.box.input.hitArea.width,h:o.box.input.hitArea.height})),w:s.inventory.actionButton.width,h:s.inventory.actionButton.height};});
  assert.equal(before.laser,false);assert.ok(before.slots.every(o=>o.w>=48&&o.h>=48));
  assert.equal(before.blocked,true);assert.ok(before.w>=48&&before.h>=48);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(100);await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space');await page.keyboard.press('b');
  assert.equal(await page.evaluate(()=>window.__testGame.scene.getScene('Game').weapons.currentAmmo),before.ammo);
  await page.screenshot({path:`/tmp/pixelforge-progression-smoke/${mobile?'mobile':'desktop'}-inventory.png`});
  await objectTap('s.inventory.actionButton');
  await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.hasPortalKey);
  await tap(4,4);await page.waitForFunction(()=>!window.__testGame.scene.getScene('Game').inventory.isOpen);
  await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.playerController.player.setPosition(window.__portal.x,window.__portal.y+35);});
  await page.waitForTimeout(200);
  if(mobile)await objectTap('s.mobileControls.centers.interact');else await page.keyboard.press('e');
  await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').castle.currentZone==='castle');
  await kill('drowner',1);
  await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');for(const [o] of s.loot.pickups)s.playerController.player.setPosition(o.x,o.y);});
  await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.counts.pearl===1);
  await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.castle.teleportCooldown=0;s.castle.teleportToMeadow();s.playerController.player.setPosition(s.ritual.altar.x,s.ritual.altar.y+35);});
  await kill('zombie-blue',1);await kill('werewolf-albino',1);await kill('witch-red',1);
  await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');for(const [o] of s.loot.pickups)s.playerController.player.setPosition(o.x,o.y);});
  await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.counts.eye===1);
  await page.waitForTimeout(200);
  if(mobile)await objectTap('s.mobileControls.centers.interact');else await page.keyboard.press('e');
  await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.mode==='offering'&&window.__testGame.scene.getScene('Game').inventory.isOpen);
  await page.screenshot({path:`/tmp/pixelforge-progression-smoke/${mobile?'mobile':'desktop'}-offering.png`});
  await objectTap('s.inventory.actionButton');
  await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').boss.dragon?.active);
  assert.equal(await page.evaluate(()=>{const c=window.__testGame.scene.getScene('Game').inventory.counts;return c.bone+c.fang+c.eye+c.pearl;}),0);
  await page.screenshot({path:`/tmp/pixelforge-progression-smoke/${mobile?'mobile':'desktop'}-dragon.png`});
  if(mobile){
   await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.boss.updateDragonBoss=()=>{};s.playerController.damagePlayer=()=>{};});
   for(const width of [480,390]){
    await page.setViewportSize({width,height:320});await page.waitForTimeout(250);
    await objectTap('s.hud.backpackButton');await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.isOpen);
    const layout=await page.evaluate(()=>{const i=window.__testGame.scene.getScene('Game').inventory;return {recipe:i.recipeText.getBounds().bottom,action:i.actionButton.getBounds().top,slots:i.slots.map(o=>({w:o.box.width,h:o.box.height}))};});
    assert.ok(layout.recipe<=layout.action);assert.ok(layout.slots.every(o=>o.w>=48&&o.h>=48));
    await page.screenshot({path:`/tmp/pixelforge-progression-smoke/mobile-short-${width}.png`});
    await objectTap('s.inventory.closeButton');await page.waitForFunction(()=>!window.__testGame.scene.getScene('Game').inventory.isOpen);
   }
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
   await objectTap('s.hud.backpackButton');await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.isOpen);
   await page.screenshot({path:'/tmp/pixelforge-progression-smoke/mobile-portrait.png'});
   await objectTap('s.inventory.closeButton');await page.waitForFunction(()=>!window.__testGame.scene.getScene('Game').inventory.isOpen);
  }
  for(let run=0;run<2;run++){
   await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.loot.spawn('bone',100,100);s.inventory.add('pearl');s.scene.restart();});
   await page.waitForTimeout(300);
   const state=await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');return {count:Object.values(s.inventory.counts).reduce((a,b)=>a+b,0),loot:s.loot.pickups.size,key:s.inventory.hasPortalKey,locked:!s.castle.portalUnlocked,ritual:s.ritual.remaining,cameras:s.cameras.cameras.length};});
   assert.deepEqual(state,{count:0,loot:0,key:false,locked:true,ritual:0,cameras:2});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Progression smoke passed: enemy drops, walkover, craft, portal, pearl, ritual, touch modal and two restarts on desktop/mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
