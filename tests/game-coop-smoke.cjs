// Real default PeerJS Cloud signaling + WebRTC DataChannel, desktop host/mobile guest.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/home/juda/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'});
 const guestBrowser=process.env.COOP_GUEST_CHROMIUM_EXECUTABLE_PATH?await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.COOP_GUEST_CHROMIUM_EXECUTABLE_PATH}):browser;
 const errors=[];const root=process.env.GAME_URL||'http://127.0.0.1:8094';
 try{
  fs.mkdirSync('/tmp/pixelforge-coop-smoke',{recursive:true});
  const host=await browser.newPage({viewport:{width:960,height:640}});
  const prepare=async(page)=>{page.on('pageerror',e=>errors.push(e.message));await require('./browser-game.cjs').prepareGamePage(page);};
  const boot=async(page,url)=>{await prepare(page);await page.goto(url);await page.waitForFunction(()=>window.__testGame?.scene.getScene('Game')?.network?.panel,null,{timeout:90000});};
  await boot(host,root);
  await host.locator('#coop-toggle').click();await host.getByRole('button',{name:'Host Game',exact:true}).click();
  await host.waitForFunction(()=>window.__testGame.scene.getScene('Game').network.peer?.open,null,{timeout:30000});
  // A suspended/lost signaling socket must recover the same advertised room.
  const originalRoom=await host.evaluate(()=>window.__testGame.scene.getScene('Game').network.roomCode);
  await host.evaluate(()=>window.__testGame.scene.getScene('Game').network.peer.disconnect());
  assert.equal(await host.getByRole('button',{name:'Copy Invite Link',exact:true}).isEnabled(),false);
  assert.equal(await host.locator('.coop-room output').textContent(),'—');
  await host.waitForFunction(()=>window.__testGame.scene.getScene('Game').network.canInvite,null,{timeout:15000});
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').network.roomCode),originalRoom);
  await host.context().grantPermissions(['clipboard-read','clipboard-write']);
  const sizes=await host.locator('.coop-room button').evaluateAll(buttons=>buttons.map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})));
  assert.ok(sizes.every(s=>s.w>=48&&s.h>=48));
  await host.getByRole('button',{name:'Copy Invite Link',exact:true}).click();
  assert.ok((await host.evaluate(()=>navigator.clipboard.readText())).includes('?room='));
  await host.screenshot({path:'/tmp/pixelforge-coop-smoke/room-panel.png'});
  const room=await host.evaluate(()=>window.__testGame.scene.getScene('Game').network.roomCode);
  assert.match(room,/^[A-Z2-9]{6}$/);
  const guest=await guestBrowser.newPage({viewport:{width:924,height:412},hasTouch:true,isMobile:true});
  await boot(guest,`${root}/?room=${room}`);
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').network.remotePlayer,null,{timeout:40000});
  const state=page=>page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');return {connected:s.network.isConnected,host:s.network.isHost,skin:s.playerController.currentCharacter,remoteSkin:s.network.remoteState?.skin,p:{x:s.playerController.player.x,y:s.playerController.player.y},hp:s.playerController.playerHealth,enemyCount:s.enemies.zombies.countActive(true),drops:s.loot.pickups.size,inventory:{...s.inventory.counts},key:s.inventory.hasPortalKey,zone:s.castle.currentZone};});
  assert.equal((await state(host)).host,true);assert.equal((await state(guest)).host,false);
  assert.notEqual((await state(host)).skin,(await state(guest)).skin);
  // Initial static obstacles and tiles must agree, not just the moving entities.
  const geometry=page=>page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');const w=s.network.world.staticWorld();w.scenery=w.scenery.map(({frame,...geometry})=>geometry);return w;});
  assert.deepEqual(await geometry(guest),await geometry(host));
  for(const page of [host,guest])await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.cameras.main.setLerp(1,1);for(const key of ['trees','giantTrees','rocks','bushes'])for(const o of s.world[key].getChildren())if(o.body)o.body.enable=false;});
  const cdp=await guest.context().newCDPSession(guest);
  const touch=async(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const center=key=>guest.evaluate(key=>{const p=window.__testGame.scene.getScene('Game').mobileControls.centers[key];return {x:p.x,y:p.y};},key);
  const tapControl=async key=>{const p=await center(key);await guest.touchscreen.tap(p.x,p.y);};
  const move=await center('move'),before=(await state(guest)).p;
  await touch('touchStart',[{id:1,x:move.x,y:move.y}]);await touch('touchMove',[{id:1,x:move.x+30,y:move.y}]);await guest.waitForTimeout(350);await touch('touchEnd');
  await host.waitForFunction(x=>window.__testGame.scene.getScene('Game').network.remotePlayer.x>x+10,before.x);
  assert.ok((await state(guest)).p.x>before.x+10);
  const hx=(await state(host)).p.x;await host.keyboard.down('ArrowLeft');await host.waitForTimeout(250);await host.keyboard.up('ArrowLeft');
  await guest.waitForFunction(x=>window.__testGame.scene.getScene('Game').network.remotePlayer.x<x-10,hx);
  // Host's remote health, not a forged PLAYER_UPDATE hp, is authoritative.
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.network.damageTarget(s.network.remotePlayer,1,'witch');});
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').playerController.playerHealth===4);
  await guest.evaluate(()=>window.__testGame.scene.getScene('Game').playerController.damagePlayer(2,'dragon'));
  assert.equal((await state(guest)).hp,4);
  // A guest shot hits a real host enemy. Guest cannot spawn or independently reward enemies.
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game'),p=s.network.remotePlayer;
   s.enemies.update=()=>{};s.altars.isAutoSpawnEnabled=false;
   const e=s.enemies.zombies.get(p.x+78,p.y,'witch','idle-side-0');e.setTexture('witch','idle-side-0').setActive(true).setVisible(true).setOrigin(0.5,1).setData({variant:'witch',hp:1,state:'chase',facing:'e'});e.body.enable=true;e.body.setSize(30,50).setOffset(10,0);e.play('witch-idle');window.__coopEnemy=e;
  });
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').enemies.zombies.countActive(true)>0);
  await guest.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.enemies.summonZombieAtAltar();s.witches.spawn();s.boss.summonAncientDragon();s.mobileControls.aim={x:1,y:0};});
  assert.equal(await guest.evaluate(()=>!!window.__testGame.scene.getScene('Game').boss.dragon),false);
  await tapControl('fire');
  await host.waitForFunction(()=>window.__coopEnemy.getData('state')==='dead');
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').loot.pickups.size>0);
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').score===1);
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').score),0);
  // A host final hit credits the host alone; shared drops still synchronize.
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game'),p=s.playerController.player;
   const e=s.enemies.zombies.get(p.x+200,p.y,'zombie','frame-0');e.setTexture('zombie','frame-0').setActive(true).setVisible(true).setData({variant:'zombie',hp:1,state:'chase',facing:'e'});
   const b=s.weapons.bullets.get(p.x,p.y,'bullet',0);b.setActive(true).setData('owner','local');const random=Math.random;Math.random=()=>0.99;try{s.enemies.bulletHitZombie(b,e);}finally{Math.random=random;}
  });
  await host.waitForFunction(()=>window.__testGame.scene.getScene('Game').score===1);
  assert.equal(await guest.evaluate(()=>window.__testGame.scene.getScene('Game').score),1);

  const point=await guest.evaluate(()=>{const s=window.__testGame.scene.getScene('Game'),o=[...s.loot.pickups.keys()][0],c=s.cameras.main;return {x:c.width/2+(o.x-c.midPoint.x)*c.zoom,y:c.height/2+(o.y-c.midPoint.y)*c.zoom};});
  await guest.touchscreen.tap(point.x,point.y);
  await host.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.counts.eye===1);
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.counts.eye===1&&window.__testGame.scene.getScene('Game').loot.pickups.size===0);
  // Shared crafting is executed only by the host, through native mobile inventory UI.
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.inventory.add('bone',3);s.inventory.add('fang',2);});
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.counts.bone===3);
  const tapObject=async expr=>{const p=await guest.evaluate(expr=>{const s=window.__testGame.scene.getScene('Game');const o=Function('s',`return ${expr}`)(s);const m=o.getWorldTransformMatrix();return {x:m.tx,y:m.ty};},expr);await guest.touchscreen.tap(p.x,p.y);};
  await tapObject('s.hud.backpackButton');await tapObject('s.inventory.actionButton');
  await host.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.hasPortalKey);
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.hasPortalKey);
  await tapObject('s.inventory.closeButton');
  const teleport=async(x,y,zone)=>{await host.evaluate(({x,y,zone})=>{const n=window.__testGame.scene.getScene('Game').network;n.teleportGuest(x,y,zone);n.sendWorld();},{x,y,zone});await guest.waitForFunction(({x,y})=>{const p=window.__testGame.scene.getScene('Game').playerController.player;return Math.hypot(p.x-x,p.y-y)<5;},{x,y});await guest.waitForTimeout(100);};
  await teleport(960,115,'meadow');await tapControl('interact');
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').castle.currentZone==='castle');
  assert.equal((await state(host)).zone,'meadow');
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').castle.portalUnlocked),true);
  // Guest altar input reaches the host spawner, including in another zone.
  await teleport(2912,300,'castle');await tapControl('interact');
  await host.waitForFunction(()=>window.__testGame.scene.getScene('Game').enemies.zombies.getChildren().some(e=>e.active&&e.getData('variant')==='drowner'));
  // A guest purchase equips only the guest; both magazines/reloads and healing remain usable.
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.score=20;s.network.resources.guestKills=20;s.hud.updateHUD();});
  await teleport(260,1100,'meadow');await tapControl('interact');
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').shop.isShopOpen);
  await tapObject('s.shop.shopBuyBtn');
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').weapons.activeWeapon==='shotgun');
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').weapons.activeWeapon),'rifle');
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').shop.isShopOpen),false);
  await tapControl('fire');
  await host.waitForFunction(()=>window.__testGame.scene.getScene('Game').network.remoteAmmo.shotgun===3);
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').weapons.currentAmmo===3);
  await guest.keyboard.press('r',{delay:80});
  await host.waitForFunction(()=>window.__testGame.scene.getScene('Game').network.remoteAmmo.shotgun===4);
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').weapons.currentAmmo===4&&!window.__testGame.scene.getScene('Game').weapons.isReloading);
  // Personal purchases update only the buyer's balance/kit count and mobile label.
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').score),20);
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').score===10);
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.shop.buyFirstAidKit();});
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').playerController.medkits),1);
  await guest.waitForTimeout(150);
  assert.equal(await guest.evaluate(()=>window.__testGame.scene.getScene('Game').playerController.medkits),0);
  await tapControl('interact');
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').shop.isShopOpen);
  await tapObject('s.shop.shopMedkitBuyBtn');
  await guest.waitForFunction(()=>{const s=window.__testGame.scene.getScene('Game');return s.score===8&&s.playerController.medkits===1&&s.mobileControls.labels.heal.text==='AID (1)';});
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').score),18);
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').playerController.medkits),1);
  await guest.keyboard.press('Escape');
  await tapControl('heal');await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').playerController.playerHealth===5);
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').playerController.medkits===0);
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').playerController.medkits),1);
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.playerController.playerHealth=3;s.playerController.useMedkit();});
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').playerController.medkits),0);
  assert.equal(await guest.evaluate(()=>window.__testGame.scene.getScene('Game').playerController.medkits),0);
  // A host modal must not stop its guest's authoritative simulation/input stream.
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');window.__coopAiFrames=0;s.enemies.update=()=>window.__coopAiFrames++;});
  await host.keyboard.press('i');await host.waitForTimeout(150);
  assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').physics.world.isPaused),false);
  assert.ok(await host.evaluate(()=>window.__coopAiFrames>0));await host.keyboard.press('i');
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');for(const id of ['bone','fang','eye','pearl'])s.inventory.add(id);});
  await teleport(1440,295,'meadow');await tapControl('interact');
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').inventory.isOpen);
  await tapObject('s.inventory.actionButton');
  await host.waitForFunction(()=>window.__testGame.scene.getScene('Game').boss.dragon?.active);
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').boss.dragon?.active);
  assert.equal((await state(host)).inventory.pearl,0);assert.equal((await state(guest)).inventory.pearl,0);
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.boss.updateDragonBoss=()=>{};});
  await guest.waitForFunction(()=>!window.__testGame.scene.getScene('Game').inventory.isOpen);
  await host.screenshot({path:'/tmp/pixelforge-coop-smoke/host.png'});await guest.screenshot({path:'/tmp/pixelforge-coop-smoke/guest-mobile.png'});
  // Host shots are cosmetic on the guest and never damage the other player.
  const guestAmmo=await guest.evaluate(()=>window.__testGame.scene.getScene('Game').weapons.currentAmmo);
  const guestHp=(await state(guest)).hp;
  await host.evaluate(()=>{const s=window.__testGame.scene.getScene('Game'),p=s.network.remotePlayer;s.weapons.fireBulletAt(p.x,p.y-33);});
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').weapons.bullets.countActive(true)>0);
  assert.equal(await guest.evaluate(()=>window.__testGame.scene.getScene('Game').weapons.currentAmmo),guestAmmo);
  assert.equal((await state(guest)).hp,guestHp);
  // A third transport is rejected without taking over either of the two seats.
  const rejected=await guest.evaluate(async room=>{const p=await window.__testGame.scene.getScene('Game').network.createPeer();try{return await new Promise(resolve=>{const timeout=setTimeout(()=>resolve(false),10000);p.on('open',()=>{const c=p.connect('pixelforge-coop-v1-'+room,{serialization:'binary',reliable:true});c.on('data',d=>{if(d.type==='ROOM_FULL'){clearTimeout(timeout);resolve(true);}});});});}finally{p.destroy();}},room);
  assert.equal(rejected,true);assert.equal((await state(host)).connected,true);
  for(let run=0;run<2;run++){
   await guest.evaluate(()=>{window.__oldPeer=window.__testGame.scene.getScene('Game').network.peer;window.__testGame.scene.getScene('Game').scene.restart();});
   await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').network.remotePlayer&&window.__testGame.scene.getScene('Game').network.peer!==window.__oldPeer,null,{timeout:40000}).catch(async error=>{
    for(const [name,page] of [['host',host],['guest',guest]])console.error(name,await page.evaluate(()=>{
     const n=window.__testGame.scene.getScene('Game').network;
     return {status:n.status,connected:n.isConnected,peerOpen:n.peer?.open,signalingLost:n.peer?.disconnected,channelOpen:n.connection?.open,ice:n.connection?.peerConnection?.iceConnectionState};
    }));throw error;
   });
   await guest.waitForFunction(()=>{const s=window.__testGame.scene.getScene('Game');return s.score===0&&s.playerController.medkits===0;});
   assert.equal(await guest.evaluate(()=>window.__oldPeer.destroyed),true);assert.equal(await guest.locator('.coop-hud').count(),1);
  }
  await guest.locator('#coop-toggle').tap();await guest.getByRole('button',{name:'Leave Room',exact:true}).tap();
  await host.waitForFunction(()=>!window.__testGame.scene.getScene('Game').network.isConnected);
  await guest.waitForFunction(()=>!window.__testGame.scene.getScene('Game').network.isMultiplayer);
  // Manual code entry uses a real mobile DOM input as well as URL auto-join.
  await guest.locator('#coop-toggle').tap();await guest.locator('#coop-code').tap();await guest.keyboard.type(room);
  await guest.getByRole('button',{name:'Join',exact:true}).tap();
  await guest.waitForFunction(()=>window.__testGame.scene.getScene('Game').network.remotePlayer,null,{timeout:40000});
  assert.equal((await state(guest)).connected,true);
  await guest.locator('#coop-toggle').tap();await guest.getByRole('button',{name:'Leave Room',exact:true}).tap();
  await host.waitForFunction(()=>!window.__testGame.scene.getScene('Game').network.isConnected);
  await guest.close();
  for(let run=0;run<2;run++){
   await host.evaluate(()=>window.__testGame.scene.getScene('Game').scene.restart());await host.waitForTimeout(300);
   assert.equal(await host.locator('.coop-hud').count(),1);
   assert.equal(await host.evaluate(()=>window.__testGame.scene.getScene('Game').network.peer),null);
  }
  assert.deepEqual(errors,[]);console.log('Co-op smoke passed using real PeerJS Cloud/WebRTC: two skins, world geometry, bidirectional movement, guest combat/loot/craft/portal/altar, personal kills and first-aid purchases/healing, health authority, third-seat rejection, leave and restarts.');
 }finally{if(guestBrowser!==browser)await guestBrowser.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
