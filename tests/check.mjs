import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const evidence=fs.readFileSync(new URL('../evidence-registry.js',import.meta.url),'utf8');
const model=fs.readFileSync(new URL('../model.js',import.meta.url),'utf8');
const ctx=vm.createContext({});
vm.runInContext(evidence+'\n'+model+'\n;globalThis.testInterface={ASSETS,SCENARIOS,EVIDENCE,derive,evaluateAsset,graphSeries};',ctx);
const {ASSETS,SCENARIOS,EVIDENCE,derive,evaluateAsset,graphSeries}=ctx.testInterface;
test('5 scenarios have 6 internally consistent assets',()=>{
 assert.equal(SCENARIOS.length,5);
 for(const scenario of SCENARIOS){
  const r=derive(scenario.id);
  assert.equal(r.assets.length,6);
  assert.equal(r.counts.danger+r.counts.watch+r.counts.unknown+r.counts.normal,6);
  for(const a of r.alerts){assert.notEqual(a.status,'normal');assert.ok(a.rule&&a.reason);}
  for(const a of r.assets)assert.ok(graphSeries(a,scenario.id).arr.length>0);
 }
});
test('incident scenarios differ and normal case has no alert',()=>{
 assert.equal(derive('normal').alerts.length,0);
 assert.equal(derive('brazil').assets.find(a=>a.id==='D301').values.power,0);
 assert.equal(derive('gure').assets.find(a=>a.id==='D301').values.supply,false);
 assert.equal(derive('sacheon').counts.danger,1);
 assert.equal(derive('nepal').assets.find(a=>a.id==='R01').status,'danger');
});
test('offline telemetry != measured zero',()=>{
 assert.equal(evaluateAsset({...ASSETS[0],values:{...ASSETS[0].values,online:false}}).status,'unknown');
});
test('all evidence entries expose scope and limits',()=>{
 assert.equal(EVIDENCE.length,11);
 for(const e of EVIDENCE){
  for(const k of ['id','category','claim','title','publisher','year','applies_to','product_implication','limitations','scope'])assert.ok(e[k],e.id+':'+k);
  if(e.url)assert.match(e.url,/^https:\/\//);
 }
});
