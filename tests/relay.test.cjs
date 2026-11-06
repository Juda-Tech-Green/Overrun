const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=import('../netlify/functions/ice-servers.mjs');
const request=(options={})=>new Request('https://overrun.example/.netlify/functions/ice-servers',options);
function environment(t,host,key){
 for(const [name,value] of [['METERED_TURN_HOST',host],['METERED_TURN_API_KEY',key]]){
  const original=process.env[name];
  if(value===undefined)delete process.env[name];else process.env[name]=value;
  t.after(()=>{if(original===undefined)delete process.env[name];else process.env[name]=original;});
 }
}
test('relay endpoint is optional and rejects cross-origin or non-GET requests',async t=>{
 environment(t);const {default:serve}=await handler;
 const fetch=t.mock.method(globalThis,'fetch',()=>{throw new Error('Unexpected provider request');});
 assert.deepEqual(await (await serve(request())).json(),{iceServers:[]});
 assert.equal((await serve(request({method:'POST'}))).status,405);
 assert.equal((await serve(request({headers:{origin:'https://another.example'}}))).status,403);
 assert.equal(fetch.mock.calls.length,0);
});
test('relay endpoint validates provider host and incomplete configuration',async t=>{
 environment(t,'example.com/internal','fake-key');const {default:serve}=await handler;
 const fetch=t.mock.method(globalThis,'fetch',()=>{throw new Error('Unexpected provider request');});
 assert.equal((await serve(request())).status,503);
 process.env.METERED_TURN_HOST='game.metered.live';delete process.env.METERED_TURN_API_KEY;
 assert.equal((await serve(request())).status,503);assert.equal(fetch.mock.calls.length,0);
});
test('relay endpoint returns only ICE credentials and never the provider API key',async t=>{
 environment(t,'game.metered.live','server-only-test-key');const {default:serve,config}=await handler;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url.origin,'https://game.metered.live');assert.equal(url.searchParams.get('apiKey'),'server-only-test-key');
  assert.equal(options.redirect,'error');
  return Response.json([{urls:'turns:relay.example:443?transport=tcp',username:'player',credential:'webrtc-credential',apiKey:'should-be-removed'}]);
 });
 const response=await serve(request({headers:{origin:'https://overrun.example'}}));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const body=await response.text();assert.ok(!body.includes('server-only-test-key'));assert.ok(!body.includes('apiKey'));
 assert.equal(JSON.parse(body).iceServers[0].credential,'webrtc-credential');assert.equal(config.rateLimit.windowLimit,30);
});
test('provider errors and malformed responses fail without leaking details',async t=>{
 environment(t,'game.metered.live','server-only-test-key');const {default:serve}=await handler;
 const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new Error('secret=server-only-test-key');});
 let response=await serve(request());assert.equal(response.status,503);assert.ok(!(await response.text()).includes('server-only-test-key'));
 for(const body of [[{urls:'https://bad.example'}],[{urls:'stun:only.example'}],[],[{urls:'turn:relay.example',credential:{bad:true}}]]){
  fetch.mock.mockImplementation(async()=>Response.json(body));response=await serve(request());assert.equal(response.status,503);
 }
});
