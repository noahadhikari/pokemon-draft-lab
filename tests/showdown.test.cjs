/* Optional comparison against the real upstream validator:
 * SHOWDOWN_SOURCE=/path/to/built/showdown node --test tests/showdown.test.cjs
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../core.js');
test('bundled legality, learnsets and exported sets agree with Showdown', {skip:!process.env.SHOWDOWN_SOURCE},()=>{
 const root=path.resolve(process.env.SHOWDOWN_SOURCE);
 const {TeamValidator}=require(path.join(root,'dist/sim/team-validator.js'));
 const {Teams}=require(path.join(root,'dist/sim/teams.js'));
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/champions.js'),'utf8'),context);
 const D=context.window.DraftData,v=new TeamValidator(D.meta.format),dex=v.dex;
 assert.equal(dex.currentMod,'champions');
 const moveText=dex.loadTextData().Moves;
 for(const move of Object.values(D.moves)){
  const upstream=moveText[move.id]||{};
  assert.equal(move.description,upstream.shortDesc||upstream.desc||'',move.name+' summary');
  assert.equal(move.fullDescription,upstream.desc||upstream.shortDesc||'',move.name+' full description');
 }

 for(const s of Object.values(D.species).filter(s=>s.legal)){
  const species=dex.species.get(s.id),base=species.isMega?dex.species.get(species.baseSpecies):species;
  assert.equal(v.checkSpecies({name:s.name,species:base.name,ability:s.abilities[0],item:s.requiredItem},base,species,{}),null,s.name+' legality');
  for(const id of s.moves)assert.equal(v.checkCanLearn(dex.moves.get(id),species,undefined,{level:50}),null,s.name+' '+id+' learnability');
 }
 const rows=['garchomp','incineroar','rotomwash','whimsicott','milotic','charizardmegay'].map(id=>{
  const p=C.newPokemon(id,D);p.moves=['protect'];p.points.spe=32;p.nature='Timid';return p;
 });
 const imported=Teams.import(C.exportTeam(rows,D));
 assert.equal(v.validateTeam(imported),null,'exported six import and validate as an M-C team');
 assert.equal(imported[0].evs.spe,32,'points remain unscaled');
});
