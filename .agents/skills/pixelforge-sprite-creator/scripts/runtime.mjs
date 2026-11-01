import {createRequire} from 'node:module';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
export function environment(root=process.cwd()){
 const require=createRequire(join(resolve(root),'package.json'));
 return {require,cli:join(require.resolve('@pixelforge/cli/package.json'),'..','dist','index.js')};
}
export async function modules(root=process.cwd()){
 const {require,cli}=environment(root),core=await import(pathToFileURL(require.resolve('@pixelforge/core')).href),exporter=require.resolve('@pixelforge/exporters'),sharpRequire=createRequire(exporter),sharp=(await import(pathToFileURL(sharpRequire.resolve('sharp')).href)).default;
 return {core,sharp,cli};
}
export function cliRun(cli,args){const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:120000,env:{...process.env,NODE_OPTIONS:''}});if(result.status!==0)throw new Error(result.stderr.trim()||result.error?.message||`CLI failed with status ${result.status}`);return result.stdout;}
export const json=async path=>JSON.parse(await readFile(path,'utf8'));
export function report(action){return Promise.resolve().then(action).then(result=>{console.log(JSON.stringify({ok:true,errors:[],warnings:[],artifacts:[],...result}));}).catch(error=>{console.error(JSON.stringify({ok:false,errors:[error.message],warnings:[],artifacts:[]}));process.exitCode=1;});}
export async function containedFile(root,file){if(typeof file!=='string'||!file||isAbsolute(file)||file.includes('\\')||file.split('/').some(p=>p==='..'||p==='.'||!p))throw new Error('Unsafe export asset path');const base=await realpath(root),path=await realpath(resolve(base,file)),rel=relative(base,path);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Asset escapes export directory');return path;}
