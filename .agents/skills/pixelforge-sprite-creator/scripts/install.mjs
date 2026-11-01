import {cp,mkdir,readFile,writeFile,readdir,lstat,realpath,rm} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const name='pixelforge-sprite-creator',source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=data=>createHash('sha256').update(data).digest('hex');
function inside(root,path){const rel=relative(root,path);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('Unsafe skill file path');return path;}
async function files(root,base=root){const out=[];for(const e of await readdir(base,{withFileTypes:true})){const path=join(base,e.name);if((await lstat(path)).isSymbolicLink())throw new Error(`Symbolic links are not accepted: ${path}`);if(e.isDirectory())out.push(...await files(root,path));else if(e.isFile()&&e.name!=='.pixelforge-install.json')out.push(relative(root,path).split('\\').join('/'));}return out.sort();}
async function receipt(dir){if((await lstat(join(dir,'.pixelforge-install.json'))).isSymbolicLink())throw new Error('Installation receipt cannot be a symlink');return JSON.parse(await readFile(join(dir,'.pixelforge-install.json'),'utf8'));}
async function safeFile(root,path){if(typeof path!=='string'||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Unsafe receipt path');const result=inside(root,resolve(root,path));let current=dirname(result);while(current!==root){try{if((await lstat(current)).isSymbolicLink())throw new Error('Symlink in installed path');}catch(e){if(e.code!=='ENOENT')throw e;}current=dirname(current);}try{if((await lstat(result)).isSymbolicLink())throw new Error('Symlink in installed file');}catch(e){if(e.code!=='ENOENT')throw e;}return result;}
export async function manageSkill(action,target,{force=false}={}){
 if(!target)throw new Error('Provide --target with an explicit skills directory');
 const requested=resolve(target);await mkdir(requested,{recursive:true});const parent=await realpath(requested),dest=inside(parent,join(parent,name));
 if(dest===source||source.startsWith(dest+'/'))throw new Error('Cannot install over the canonical source skill');
 let exists=false;try{exists=true;if((await lstat(dest)).isSymbolicLink())throw new Error('Skill destination cannot be a symlink');}catch(e){if(e.code!=='ENOENT')throw e;exists=false;}
 if(action==='install'){
  const paths=await files(source);if(!paths.includes('SKILL.md'))throw new Error('Source skill is missing SKILL.md');
  const data=await Promise.all(paths.map(async path=>({path,bytes:await readFile(join(source,path))})));
  if(exists&&!force)throw new Error('Skill already exists; use --force to update');
  if(exists){let old;try{old=await receipt(dest);}catch{throw new Error('Existing destination has no valid installation receipt; preserve it and choose another destination');}
   for(const path of Object.keys(old.files??{}))await safeFile(dest,path);
   for(const path of paths){try{await lstat(await safeFile(dest,path));if(!Object.hasOwn(old.files,path))throw new Error(`Update would overwrite unrelated file: ${path}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
   for(const path of Object.keys(old.files))if(!paths.includes(path))await rm(await safeFile(dest,path),{force:true});
  }
  await mkdir(dest,{recursive:true});const written={};for(const item of data){const path=await safeFile(dest,item.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,item.bytes);written[item.path]=hash(item.bytes);}
  await writeFile(join(dest,'.pixelforge-install.json'),JSON.stringify({version:1,skill:name,files:written},null,2)+'\n');return {ok:true,path:dest,files:Object.keys(written)};
 }
 if(!exists)throw new Error('Skill is not installed');const record=await receipt(dest);if(record.skill!==name||record.version!==1)throw new Error('Invalid installation receipt');
 const paths=Object.keys(record.files??{});if(!paths.length)throw new Error('Empty installation receipt');
 for(const path of paths){const full=await safeFile(dest,path);if(!force||action==='verify'){const bytes=await readFile(full);if(hash(bytes)!==record.files[path])throw new Error(`Installed file changed: ${path}`);}}
 if(action==='verify')return {ok:true,path:dest,files:paths};
 if(action!=='uninstall')throw new Error('Action must be install, verify or uninstall');
 for(const path of paths)await rm(await safeFile(dest,path),{force:true});await rm(join(dest,'.pixelforge-install.json'));return {ok:true,path:dest,removed:paths};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2),action=args.shift();const index=args.indexOf('--target');if(index<0)throw new Error('Usage: node install.mjs install|verify|uninstall --target SKILLS_DIRECTORY [--force]');console.log(JSON.stringify(await manageSkill(action,args[index+1],{force:args.includes('--force')})));}catch(error){console.error(JSON.stringify({ok:false,errors:[error.message]}));process.exitCode=1;}
}
