import {modules,cliRun,json,report} from './runtime.mjs';
import {resolve} from 'node:path';
await report(async()=>{
 const file=process.argv[2];if(!file)throw new Error('Usage: node validate-project.mjs PROJECT.sprite.json');const {core,cli}=await modules();cliRun(cli,['validate',resolve(file)]);const p=core.fromDocument(await json(file)),warnings=[],bounds=[];
 const referenced=new Set(p.animations.flatMap(a=>a.frames.map(f=>f.frameId)));for(const f of p.frames)if(p.animations.length&&!referenced.has(f.id))warnings.push(`Source frame ${f.id} is not referenced by an animation (may be intentional)`);
 for(const f of p.frames){const r=core.renderFrame(p,f.id);let minX=p.width,minY=p.height,maxX=-1,maxY=-1,transparent=0;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){if(r.data[(y*p.width+x)*4+3]===0)transparent++;else{minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
  bounds.push({frameId:f.id,empty:maxX<0,bounds:maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1},transparentPixels:transparent});if(!transparent)warnings.push(`Frame ${f.id} has no fully transparent pixels`);
 }
 for(const a of p.animations){const bottoms=a.frames.map(f=>bounds.find(b=>b.frameId===f.frameId)?.bounds).filter(Boolean).map(b=>b.y+b.height);if(bottoms.length&&Math.max(...bottoms)-Math.min(...bottoms)>2)warnings.push(`Animation ${a.name} changes opaque baseline by more than2 pixels; inspect intentional motion versus drift`);}
 return {artifacts:[resolve(file)],warnings,frames:bounds};
});
