import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseSound,renderSound,audioManifestSchema,applyAudioOperations} from '@pixelforge/audio-core';
import {encodeWav} from '@pixelforge/audio-exporters';
const bundles=JSON.parse(fs.readFileSync('public/assets/audio/sfx/index.json'));
let peak=0;
for(const bundle of bundles){
 const m=audioManifestSchema.parse(bundle.manifest),a=m.assets[0];
 const source=`src/game/assets-src/audio/${a.key}`;
 const p=parseSound(JSON.parse(fs.readFileSync(`${source}.sound.json`)));
 const operations=JSON.parse(fs.readFileSync(`${source}.operations.json`));
 assert.deepEqual(applyAudioOperations(p,operations),p);
 const {pcm,metrics}=renderSound(p);
 assert.ok(!metrics.silent && metrics.clippedSamples===0 && metrics.peak<1);
 assert.equal(pcm[0],0);assert.ok(Math.abs(pcm.at(-1))<.001);
 const wav=fs.readFileSync(`public/${bundle.baseURL}/${a.file}`);
 assert.deepEqual(Buffer.from(encodeWav(pcm,p.sampleRate)),wav,`${a.key} reproducible PCM16 bytes`);
 assert.deepEqual(parseSound(JSON.parse(fs.readFileSync(`public/${bundle.baseURL}/${a.source}`))),p);
 peak=Math.max(peak,metrics.peak);
}
console.log(JSON.stringify({sounds:bundles.length,schema:'1.0',runtime:'0.6.0',reproducible:true,clippedSamples:0,peak}));
