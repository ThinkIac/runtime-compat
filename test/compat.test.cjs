'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const old = require('./fixtures/index.cjs');
const fresh = require('../index.cjs');
function fixture(surfaces) {
  const calls = [], states = new Map(), listeners = [];
  const record = name => (...args) => { calls.push([name, ...args]); return name; };
  const container = {
    workspace: '/workspace', config: {storage:{bucket:'test'}}, authority: {enforce:record('enforce')},
    registry: {discover:()=>[{dir:'/workspace/a'},{dir:'/workspace/b/c'}],getPackage:record('getPackage'),snapshot:record('snapshot')},
    state(name) { if(!states.has(name))states.set(name,new Map());return states.get(name); },
    log:record('log'),getPackageScope:record('getScope'),createPackageScope:record('createScope'),disposePackageScope:record('disposeScope'),
    bus:{emit:record('emit'),pipeline:record('pipeline'),veto:record('veto'),removeOwner:record('removeOwner')}
  };
  for(const mode of ['on','once'])container.bus[mode]=(event,handler,options)=>{
    const listener={event,handler,options,mode,active:true};listeners.push(listener);
    return ()=>{listener.active=false;};
  };
  const kernel={
    authority:{currentAuthority:record('currentAuthority'),runAsPackage:record('runAsPackage'),runAsSystem:record('runAsSystem')},
    context:{createRuntimeContext:record('createContext')},debug:{appendLog:record('appendLog'),getErrors:record('getErrors')},
    isolation:{getIsolatedRunner:()=>surfaces ? {surfaces,invoke:record('invoke')} : null},
    scan:{resolveAgentFolder:record('resolveAgentFolder'),registerGeneric:async(folder,parser,kind,transform)=>{
      calls.push(['scan',folder,kind]);return [];
    }},
    lifecycle:{'../kernel/package-contract':{normalizePackageContract:pkg=>({name:pkg.folder})}},
    ports:{'stabilizer/isolation':{requestReboot:record('requestReboot'),recoverIsolatedPackage:record('recover')}}
  };
  for(const name of ['http','ws','tools'])container.state('external-api').set(name,{
    createServer:record('createServer'),getPackageMount:record('getPackageMount'),getHub:record('getHub'),loadMcpTools:record('loadMcpTools')});
  return {container,kernel,calls,listeners,subscriptions:new Set()};
}
function shape(value) {
  if(typeof value==='function')return 'function';
  if(!value || typeof value!=='object')return typeof value;
  return Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(value)).map(([key,d])=>[key,d.get ? 'getter' : shape(d.value)]));
}
test('host has identical ports, frozen boundaries and lazy Express getter',()=>{
  const a=fixture(),b=fixture();const x=old.createHost(a.container,a.kernel,a.subscriptions),y=fresh.createHost(b.container,b.kernel,b.subscriptions);
  assert.deepEqual(shape(y),shape(x));
  for(const obj of [y,y.http,y.tools,y.authority,y.registry,y.ws,y.commands,y.storage,y.process,y.repo,y.scopes])assert.ok(Object.isFrozen(obj));
  assert.equal(typeof Object.getOwnPropertyDescriptor(y.http,'express').get,'function');
});
test('host port calls preserve forwarding, return values and side effects',async()=>{
  async function run(api){
    const f=fixture(),h=api.createHost(f.container,f.kernel,f.subscriptions),work=()=>{};
    const results=[h.workspace(),h.config(),h.applicationRoot(),h.dataDir(),h.kernelPrimitives()===f.kernel.lifecycle,
      h.http.setApp('app'),h.http.app(),h.http.setServer('server'),h.http.server(),h.http.getPackageMount(),h.http.getErrors(),h.http.packageSnapshot(),
      h.http.isolatedRunner('a'),h.http.createContext('a'),h.http.routeMountPath('a','route'),h.http.routeMountPath('a','/route'),h.http.recordOfflineRoutes('a',[]),h.http.runAsPackage('a',work),
      h.ws.getHub(),h.tools.authority()===f.container.authority,h.tools.requestReboot(null,{why:'test'}),h.tools.runAsPackage(null,'a',work),h.tools.runAsSystem(null,work),h.tools.isolatedRunner(null,'a'),
      h.commands.createContext('a'),h.storage.config(),h.storage.workspace(),h.process.getScope('a'),h.process.createScope('a',2),h.process.disposeScope('a','test'),h.process.supervisor(),h.process.recoverIsolatedPackage('a'),
      h.repo.container()===f.container,h.repo.isBranchInstance(),h.scopes.get('a'),h.scopes.create('a',2),h.scopes.dispose('a','test'),h.scopes.removeOwner('a'),
      h.registry.getPackage('a'),h.registry.discover(),h.loadTools('/workspace'),h.emit('x',1,2),h.pipeline('x',1,2),h.veto('x',1,2),h.log('text'),h.appendLog('text'),h.currentAuthority(),h.createContext('a')];
    await h.http.scanRoutes('/workspace');await h.tools.scan('a');await h.scanHooks('/workspace');await h.commands.scan('/workspace/b/c');
    f.container.state('external-api').delete('ws');assert.throws(()=>h.ws.getHub(),/external capability unavailable: ws/);
    // Replace fixture-specific references with stable values for comparison.
    return JSON.parse(JSON.stringify({results,calls:f.calls},(k,v)=>v===f.container?'CONTAINER':v===f.container.authority?'AUTHORITY':typeof v==='function'?'FUNCTION':v));
  }
  assert.deepEqual(await run(fresh),await run(old));
});
test('on/once pass options and unsubscribe removes tracked subscriptions',()=>{
  for(const api of [old,fresh]){const f=fixture(),h=api.createHost(f.container,f.kernel,f.subscriptions),handler=()=>{},options={owner:'a'};
    const off=h.on('x',handler,options),once=h.once('ready',handler,options);
    assert.equal(f.subscriptions.size,2);assert.deepEqual(f.listeners.map(x=>[x.event,x.mode,x.handler===handler,x.options===options]),[['x','on',true,true],['ready','once',true,true]]);
    off();once();assert.equal(f.subscriptions.size,0);assert.ok(f.listeners.every(x=>!x.active));
  }
});
test('validation preserves isolated tool/hook contracts and authority checks',async()=>{
  async function run(api){const f=fixture({tools:[{id:'t1',name:'read',parameters:{type:'object',properties:{},required:[]}}],hooks:[{id:'h1',event:'ready'}]});
    const result=await api.validatePackageWiring(f.container,f.kernel,{folder:'a',isolated:true});return {result,calls:f.calls};}
  assert.deepEqual(await run(fresh),await run(old));
});
test('validation rejects malformed tools, absent isolation and denied authority',async()=>{
  for(const api of [old,fresh]){
    for(const parameters of [null,{type:'string'},{type:'object',properties:{},required:'bad'}]){
      const f=fixture({tools:[{name:'bad',parameters}],hooks:[]});await assert.rejects(api.validatePackageWiring(f.container,f.kernel,{folder:'a'}),TypeError);
    }
    const f=fixture();await assert.rejects(api.validatePackageWiring(f.container,f.kernel,{folder:'a',isolated:true}),/no running runner/);
    const denied=fixture({tools:[{name:'read',parameters:{type:'object',properties:{}}}],hooks:[]});denied.container.authority.enforce=()=>{throw new Error('denied')};
    await assert.rejects(api.validatePackageWiring(denied.container,denied.kernel,{folder:'a'}),/denied/);
    assert.deepEqual(await api.validatePackageWiring(f.container,f.kernel,{folder:'a'}),{contract:{name:'a'},tools:0,hooks:0});
  }
});
for(const [label,library] of [['old',require('./fixtures/legacy-library.cjs')],['type',require('../legacy-library.cjs')]]){
  test(label+': legacy import mapping, cycles, cache, kernel ports, retries and undeclared dependencies',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'compat-library-'));
    try{
      fs.mkdirSync(path.join(dir,'compat'));
      const write=(name,body)=>{const file=path.join(dir,'compat',name);fs.writeFileSync(file,'module.exports = (require,module,exports,__dirname,__filename,host) => {'+body+'};');delete require.cache[file];};
      write('commands.cjs',"exports.name='commands';exports.hooks=require('./hooks');exports.port=require('../kernel/port');exports.path=require('node:path').basename(__filename);");
      write('hooks.cjs',"exports.commands=require('./commands');");
      const port={ok:true},kernel={scan:{},ports:{'kernel/port':port}},resolve=()=>dir;
      const load=library.createLegacyLibrary(kernel,resolve);
      assert.equal(library.createLegacyLibrary(kernel,()=>{throw Error('wrong')}),load);
      const commands=load('modules/commands');assert.equal(commands.hooks.commands,commands);assert.equal(commands.port,port);assert.equal(commands.path,'commands.cjs');assert.equal(load('modules/commands'),commands);
      assert.throws(()=>load('missing'),/Unknown legacy capability import/);
      write('http.cjs',"require('./not-declared');");assert.throws(()=>load('modules/http'),/Undeclared legacy capability dependency/);
      write('http.cjs',"module.exports = {recovered:true};");assert.deepEqual(load('modules/http'),{recovered:true});
      assert.notEqual(library.createLegacyLibrary({scan:{},ports:{}},resolve),load);
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  });
}
