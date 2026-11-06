const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context={window:{}};
for(const file of ['data/champions.js','data/mega-sprites.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const overrides=context.window.DraftSpriteOverrides;
const sources=JSON.parse(fs.readFileSync(path.join(root,'assets/mega-sprites/sources.json'),'utf8'));
test('every Mega fallback points to an actual PNG for a legal Mega form',()=>{
 assert.equal(Object.keys(overrides).length,11);
 for(const [id,relative] of Object.entries(overrides)){
  const species=context.window.DraftData.species[id];assert.ok(species.legal&&species.mega,id);
  assert.match(relative,/^assets\/mega-sprites\/[a-z0-9]+\.png$/);
  const bytes=fs.readFileSync(path.join(root,relative));
  assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),id+' is PNG');
  assert.ok(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0,id+' has image dimensions');
  assert.ok(sources.sprites[id].source.startsWith('https://raw.githubusercontent.com/smogon/sprites/'),id+' source is recorded');
 }
});
test('distinct Mega forms have distinct artwork and regular species use their existing sprites',()=>{
 const x=fs.readFileSync(path.join(root,overrides.raichumegax));
 const y=fs.readFileSync(path.join(root,overrides.raichumegay));assert.ok(!x.equals(y));
 assert.equal(overrides.garchomp,undefined);assert.equal(overrides.charizardmegay,undefined);
});