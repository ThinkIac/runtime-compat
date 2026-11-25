'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'runtime-compat-install-'));
try {
  const artifact = JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',temp],{cwd:root,encoding:'utf8'}))[0];
  fs.writeFileSync(path.join(temp,'package.json'),'{"private":true}');
  execFileSync('npm',['install','--omit=dev','--ignore-scripts','--no-audit','--no-fund',path.join(temp,artifact.filename)],{cwd:temp,stdio:'pipe',timeout:120000});
  execFileSync(process.execPath,['-e',`
    const assert=require('node:assert/strict');
    const Module=require('node:module');const original=Module._load;
    Module._load=function(name,...args){if(name==='express')throw Error('HTTP unexpectedly loaded');return original.call(this,name,...args)};
    const api=require('@thinkiac/module-runtime-compat');
    assert.equal(typeof api.createHost,'function');assert.equal(typeof api.validatePackageWiring,'function');
    assert.equal(typeof require('@thinkiac/module-runtime-compat/legacy-library.cjs').createLegacyLibrary,'function');
    const mapping=require('@thinkiac/module-runtime-compat/legacy-modules.json');assert.ok(mapping['modules/commands']);
    assert.equal(typeof require('@thinkiac/module-annotations').createScanners,'function');
    console.log('PASS: isolated production artifact, annotations dependency, legacy entry and lazy HTTP');
  `],{cwd:temp,env:{...process.env,NODE_PATH:''},stdio:'inherit'});
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
