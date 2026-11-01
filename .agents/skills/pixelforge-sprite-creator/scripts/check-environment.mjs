import {environment,cliRun,report} from './runtime.mjs';
await report(()=>{const major=Number(process.versions.node.split('.')[0]);if(major<22)throw new Error('Use Node22.12+');const {cli}=environment();return {node:process.versions.node,cli,version:cliRun(cli,['--version']).trim(),warnings:[],artifacts:[]};});
