// Actual Phaser/Web Audio loading, playback, gameplay cues and restart lifecycle.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/home/juda/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox']});
 try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.route('**/src/main.ts*',r=>r.fulfill({contentType:'text/javascript',body:"import StartGame from '/src/game/main.ts'; window.__testGame=StartGame('game-container');"}));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080');
 await page.waitForFunction(()=>window.__testGame?.scene.getScene('Game')?.audio.enabled,null,{timeout:60000});
 await page.mouse.click(450,300);
 await page.waitForFunction(()=>!window.__testGame.sound.locked && window.__testGame.sound.context.state==='running');
 const result=await page.evaluate(async()=>{
  const s=window.__testGame.scene.getScene('Game');
  const {AUDIO_KEYS}=await import('/src/game/audio-catalog.ts');
  s.menu.isMenuOpen=true; // Quiet background while inspecting each decoded source.
  const report=[];
  for(const key of AUDIO_KEYS){
   const buffer=s.cache.audio.get(key),pcm=buffer.getChannelData(0);
   let peak=0;for(const v of pcm)peak=Math.max(peak,Math.abs(v));
   if(!Number.isFinite(peak)||peak<=0||peak>=1)throw Error(`Bad decoded audio ${key}`);
   const sound=s.sound.add(key,{volume:.1});
   const played=sound.play();report.push({key,played,duration:buffer.duration,peak});
   await new Promise(r=>setTimeout(r,20));sound.destroy();
  }
  // Verify real output graph energy, not just Sound.play's return value.
  const analyser=s.sound.context.createAnalyser();analyser.fftSize=2048;
  s.sound.masterVolumeNode.connect(analyser);
  s.audio.play('dragon-summon-roar',undefined,.1,0);
  await new Promise(r=>setTimeout(r,120));
  const values=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(values);
  const outputPeak=Math.max(...values.map(Math.abs));
  s.sound.masterVolumeNode.disconnect(analyser);analyser.disconnect();
  const cues=[];const play=s.audio.play;
  s.audio.play=(key,...args)=>{cues.push(key);return play(key,...args);};
  s.menu.isMenuOpen=false;
  s.weapons.fireBulletAt(s.playerController.player.x+100,s.playerController.player.y);
  s.weapons.startReload();s.playerController.switchCharacter();
  s.playerController.playerHealth=3;s.playerController.medkits=1;s.playerController.useMedkit();
  s.inventory.open();s.inventory.close();
  s.score=100;s.shop.buyShotgun();s.shop.buyFirstAidKit();
  for(const id of ['bone','fang','eye','pearl'])s.inventory.add(id,5);
  s.inventory.craftPortalKey();s.castle.setPortalUnlocked(true);s.castle.teleportToCastle();
  s.audio.play=play;
  return {report,outputPeak,cues};
 });
 assert.equal(result.report.length,103);assert.ok(result.report.every(r=>r.played));assert.ok(result.outputPeak>0);
 for(const key of ['rifle-fire','rifle-reload','character-switch','heal-use','inventory-open','inventory-close','shop-buy-shotgun','shop-buy-item','crafting-forge-key','portal-unlock-turn','portal-teleport'])assert.ok(result.cues.includes(key),key);
 for(let i=0;i<2;i++){
  await page.evaluate(()=>{
   const s=window.__testGame.scene.getScene('Game');s.audio.play('dragon-die',undefined,.1,0);window.__oldSounds=[...s.audio.active];s.scene.restart();
  });
  await page.waitForTimeout(400);
  const state=await page.evaluate(()=>{const s=window.__testGame.scene.getScene('Game');return {enabled:s.audio.enabled,oldDestroyed:window.__oldSounds.every(o=>!s.sound.sounds.includes(o)),listeners:s.input.listenerCount('gameobjectover'),count:s.sound.sounds.length};});
  assert.ok(state.enabled&&state.oldDestroyed);assert.equal(state.listeners,1);assert.ok(state.count<=5);
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({decoded:result.report.length,played:result.report.length,outputPeak:result.outputPeak,cues:result.cues,restarts:2,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
