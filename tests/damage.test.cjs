const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/champions.js'),'utf8'),context);vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../vendor/smogon-calc.js'),'utf8'),context);
const D=JSON.parse(JSON.stringify(context.window.DraftData)),E=context.SmogonDamage,calc=require('../damage-core.js').create(D,E);
function matchup(attacker='garchomp',defender='milotic',move='earthquake'){
 const a=calc.defaultUnit(attacker),d=calc.defaultUnit(defender);a.points.atk=32;a.nature='Jolly';d.points.hp=32;
 return {attacker:a,defender:d,move,field:{spread:true}};
}
test('damage uses Champions stat points and the doubles damage rolls',()=>{
 const config=matchup(),r=calc.run(config);assert.equal(calc.generation,0);assert.equal(r.attackerStats.atk,182);assert.equal(r.hp,202);assert.equal(r.defense,99);assert.deepEqual([r.min,r.max],[76,91]);assert.equal(r.rolls.length,16);assert.equal(r.minPercent,76/202*100);
});
test('bulk profiles are exactly the requested spreads and preserve the original inputs',()=>{
 const config=matchup(),before=JSON.stringify(config),profiles=calc.compare(config).profiles;
 assert.deepEqual(profiles.map(p=>p.points),[{hp:2,atk:0,def:0,spa:0,spd:0,spe:0},{hp:32,atk:0,def:0,spa:0,spd:0,spe:0},{hp:32,atk:0,def:32,spa:0,spd:0,spe:0}]);
 assert.deepEqual(profiles.map(p=>[p.hp,p.defense]),[[172,99],[202,99],[202,131]]);assert.deepEqual(profiles.map(p=>[p.min,p.max]),[[76,91],[76,91],[58,70]]);
 assert.ok(profiles[0].maxPercent>profiles[1].maxPercent&&profiles[1].maxPercent>profiles[2].maxPercent);assert.equal(JSON.stringify(config),before);
});
test('special attacks invest SpD but Psyshock invests Def',()=>{
 const special=matchup('milotic','garchomp','hydropump');special.attacker.points.atk=0;special.attacker.points.spa=32;special.attacker.nature='Modest';
 const result=calc.compare(special).profiles[2];assert.equal(result.defenseStat,'spd');assert.equal(result.points.spd,32);assert.equal(result.points.def,0);
 const psy=matchup('gardevoir','milotic','psyshock');psy.attacker.points.atk=0;psy.attacker.points.spa=32;psy.attacker.nature='Modest';
 const p=calc.compare(psy).profiles[2];assert.equal(p.category,'Special');assert.equal(p.defenseStat,'def');assert.equal(p.points.def,32);assert.equal(p.points.spd,0);
});
test('nature remains fixed across bulk profiles and boosts affect actual damage',()=>{
 const config=matchup();config.defender.nature='Bold';const profiles=calc.compare(config).profiles;assert.equal(profiles[0].defense,108);assert.equal(profiles[2].defense,144);
 const original=calc.run(config).max;config.attacker.boosts.atk=2;assert.ok(calc.run(config).max>original);config.attacker.boosts.atk=0;config.defender.boosts.def=2;assert.ok(calc.run(config).max<original);
});
test('spread targeting, screens, helping hand, weather and burn affect results',()=>{
 const config=matchup(),normal=calc.run(config);config.field.spread=false;assert.ok(calc.run(config).max>normal.max);config.field.spread=true;config.field.reflect=true;assert.ok(calc.run(config).max<normal.max);config.field.reflect=false;config.field.helpingHand=true;assert.ok(calc.run(config).max>normal.max);config.field.helpingHand=false;config.attacker.status='brn';assert.ok(calc.run(config).max<normal.max);
 const water=matchup('milotic','garchomp','hydropump');water.attacker.points.atk=0;water.attacker.points.spa=32;const dry=calc.run(water);water.field.weather='Rain';assert.ok(calc.run(water).max>dry.max);water.field.weather='Sun';assert.ok(calc.run(water).max<dry.max);
});
test('abilities, held items, immunities and Protect use the engine',()=>{
 const config=matchup('garchomp','rotomwash','earthquake');assert.equal(calc.run(config).max,0,'Levitate grants immunity');
 const breaker=matchup('excadrill','rotomwash','earthquake');breaker.attacker.ability='Mold Breaker';assert.ok(calc.run(breaker).max>0);
 const direct=matchup(),unboosted=calc.run(direct).max;direct.attacker.item='Life Orb';assert.ok(calc.run(direct).max>unboosted);direct.field.protect=true;assert.equal(calc.run(direct).max,0);
});
test('Body Press responds to the attacker defense, not Attack investment',()=>{
 const config=matchup('blastoise','milotic','bodypress');config.attacker.points.atk=0;config.attacker.nature='Hardy';const zero=calc.run(config).max;config.attacker.points.atk=32;assert.equal(calc.run(config).max,zero);config.attacker.points.atk=0;config.attacker.points.def=32;assert.ok(calc.run(config).max>zero);
});
test('fixed damage, status moves and multihit damage are represented correctly',()=>{
 const fixed=calc.run(matchup('machamp','milotic','seismictoss'));assert.equal(fixed.min,50);assert.equal(fixed.max,50);
 const status=calc.run(matchup('garchomp','milotic','protect'));assert.equal(status.statusMove,true);assert.equal(status.max,0);
 const multi=matchup('venusaur','milotic','bulletseed');multi.field.hits=3;const three=calc.run(multi);multi.field.hits=5;const five=calc.run(multi);assert.equal(three.hits,3);assert.equal(five.hits,5);assert.ok(five.max>three.max);assert.equal(five.rolls,null);
});
test('saved sets and opponent predictions load without editing the originals',()=>{
 const set={species:'garchomp',item:'Sitrus Berry',ability:'Rough Skin',nature:'Jolly',points:{hp:2,atk:32,def:0,spa:0,spd:0,spe:32},moves:['earthquake','protect']};
 const imported=calc.importUnit(set);assert.deepEqual(imported.points,set.points);imported.points.hp=0;assert.equal(set.points.hp,2);
 const opponent={species:'milotic',prediction:{item:'Sitrus Berry',ability:'Competitive',nature:'Calm',points:{hp:32,atk:0,def:0,spa:0,spd:32,spe:0},moves:['hydropump']}};
 const prediction=calc.importUnit(opponent);assert.equal(prediction.ability,'Competitive');assert.equal(prediction.points.spd,32);assert.deepEqual(prediction.moves,['hydropump']);
 const unknown=calc.importUnit({species:'milotic'});assert.equal(unknown.nature,'Hardy');assert.equal(unknown.points.hp,0);
});
test('bad stat inputs and unlearnable moves fail explicitly',()=>{
 for(const change of [c=>c.attacker.points.atk=33,c=>c.defender.points.hp=.5,c=>c.attacker.points={hp:32,atk:32,def:32,spa:0,spd:0,spe:0},c=>c.defender.hpPercent=0,c=>c.attacker.boosts.atk=7,c=>c.move='spore']){const c=matchup();change(c);assert.throws(()=>calc.run(c));}
});
test('comparison ignores the disabled custom defender points but validates the attacker',()=>{
 const c=matchup();c.defender.points.hp=999;assert.equal(calc.compare(c).profiles.length,3);c.attacker.points.atk=999;assert.throws(()=>calc.compare(c));
});
test('the Shield-form alias uses the planner stats and current HP is preserved',()=>{
 const unit=calc.defaultUnit('aegislash'),s=calc.preview(unit);assert.equal(s.def,D.species.aegislash.stats.def+20);
 const c=matchup();c.defender.hpPercent=50;assert.equal(calc.run(c).currentHP,101);
});
