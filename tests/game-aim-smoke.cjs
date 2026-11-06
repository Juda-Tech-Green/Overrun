// Real rendering/Arcade integration of the laser and mobile-only aid HUD.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/home/juda/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'});
 try{
  fs.mkdirSync('/tmp/pixelforge-aim-smoke',{recursive:true});
  for(const mobile of [false,true]){
   const page=await browser.newPage({viewport:{width:960,height:640},hasTouch:mobile,isMobile:mobile});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/src/main.ts*',r=>r.fulfill({contentType:'text/javascript',body:"import StartGame from '/src/game/main.ts';window.__testGame=StartGame('game-container');"}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080');
   await page.waitForFunction(()=>window.__testGame?.scene.getScene('Game')?.aiming?.graphics,null,{timeout:60000});
   await page.waitForTimeout(100);
   const target=await page.evaluate(mobile=>{
    const s=window.__testGame.scene.getScene('Game');
    // Remove random scenery from the controlled firing lane; preserve normal colliders.
    for(const group of [s.world.trees,s.world.giantTrees,s.world.rocks,s.world.bushes,s.enemies.zombies])
     for(const object of group.getChildren())if(object.body)object.body.enable=false;
    const p=s.playerController.player;
    const wall=s.world.rocks.create(p.x+180,p.y-33,'weapons','shotgun-pellet').setDisplaySize(24,120).setDepth(1400).refreshBody();
    window.__aimWall=wall;window.__retired=[];
    const retire=s.weapons.retireProjectile;
    s.weapons.retireProjectile=bullet=>{if(bullet.active)window.__retired.push({right:bullet.body.right,x:bullet.x});retire(bullet);};
    s.mobileControls.usingTouch=mobile;s.mobileControls.aim={x:1,y:0};
    const camera=s.cameras.main;
    return {x:camera.width/2+(p.x+100-camera.midPoint.x)*camera.zoom,
        y:camera.height/2+(p.y-33-camera.midPoint.y)*camera.zoom};
   },mobile);
   if(!mobile)await page.mouse.move(target.x,target.y);
   await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').aiming.endpoint?.hit);
   for(const weapon of ['rifle','shotgun']){
    const value=await page.evaluate(weapon=>{
     const s=window.__testGame.scene.getScene('Game');s.weapons.hasShotgun=true;s.weapons.setWeapon(weapon);s.aiming.update();
     const target=s.controls.aimPointer(),ray=s.weapons.shotTrajectory(target.worldX,target.worldY);
     return {end:s.aiming.endpoint,ray,wall:window.__aimWall.body.left,zoom:s.cameras.main.zoom,uiZoom:s.viewport.uiCamera.zoom,
      cursor:s.input.manager.defaultCursor,
      aid:[s.hud.medkitPlate,s.hud.medkitIcon,s.hud.medkitLabelText,s.hud.medkitCountText].map(o=>o.visible),aidButton:s.mobileControls.bases.heal.visible};
    },weapon);
    assert.equal(value.end.hit,true);assert.ok(Math.abs(value.end.x-value.wall)<0.01);
    assert.equal(value.zoom,2);assert.equal(value.uiZoom,1);
    if(!mobile)assert.ok(value.cursor.includes('pointer.png'));
    assert.ok(Math.abs(value.end.y-value.ray.y)<0.1,'East laser starts at muzzle height and ends on the wall face');
    assert.ok(value.aid.every(v=>v===!mobile));if(mobile)assert.equal(value.aidButton,true);
    await page.screenshot({path:`/tmp/pixelforge-aim-smoke/${mobile?'mobile':'desktop'}-${weapon}.png`});
   }
   // Fire through the ordinary input path and confirm the existing wall collider retires it.
   await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');s.weapons.setWeapon('rifle');s.weapons.fireDelay=0;});
   if(mobile){
    const c=await page.context().newCDPSession(page);
    const point=await page.evaluate(()=>{const p=window.__testGame.scene.getScene('Game').mobileControls.centers.fire;return {id:1,x:p.x,y:p.y};});
    await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else await page.mouse.click(target.x,target.y);
   await page.waitForFunction(()=>window.__retired.length>0);
   const impact=await page.evaluate(()=>({bullet:window.__retired[0],wall:window.__aimWall.body.left}));
   assert.ok(Math.abs(impact.bullet.right-impact.wall)<30,'Bullet reaches the laser-predicted collision face');
   await page.evaluate(()=>{window.__aimWall.body.enable=false;});
   await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').aiming.endpoint?.hit===false);
   for(let run=0;run<2;run++){
    await page.evaluate(()=>window.__testGame.scene.getScene('Game').scene.restart());await page.waitForTimeout(150);
    await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').aiming.endpoint!==null);
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Aim smoke passed: desktop/mobile laser wall clipping, both weapons, actual bullet collision, aid HUD visibility and two restarts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
