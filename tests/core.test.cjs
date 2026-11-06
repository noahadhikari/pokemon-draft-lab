const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../core.js');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/champions.js'),'utf8'),context);
// Normalize objects created in the VM to this realm for strict comparisons.
const D = JSON.parse(JSON.stringify(context.window.DraftData));
test('snapshot is the Champions M-C format with real legal learnsets',()=>{
  assert.equal(D.meta.format,'gen9championsvgc2026regmc');
  assert.equal(D.meta.mod,'champions');assert.equal(D.meta.pointLimit,66);
  assert.ok(Object.values(D.species).filter(s=>s.legal).length>250);
  assert.equal(D.species.incineroar.legal,true);
  assert.equal(D.species.bulbasaur.legal,false);
  assert.ok(D.species.incineroar.moves.includes('fakeout'));
  assert.ok(!D.species.incineroar.moves.includes('spore'));
  for(const s of Object.values(D.species).filter(s=>s.legal)){
    assert.ok(s.moves.length,`${s.name} has a learnset`);
    for(const move of s.moves)assert.ok(D.moves[move],`${s.name}: ${move} exists`);
  }
});
test('the bundled move descriptions explain actual effects',()=>{
  const moves=Object.values(D.moves);
  assert.ok(moves.every(move=>typeof move.description==='string'&&move.description.length>0),'every bundled move has a description');
  assert.match(D.moves.protect.description,/prevents moves/i);
  assert.match(D.moves.protect.fullDescription,/protected from most attacks/i);
  assert.match(D.moves.icebeam.description,/10% chance to freeze/i);
  assert.match(D.moves.earthquake.description,/double damage on dig/i);
});
test('dual typing multiplies resistance, weakness, and immunity',()=>{
  assert.equal(C.effectiveness('Ice',D.species.garchomp,D),4);
  assert.equal(C.effectiveness('Electric',D.species.garchomp,D),0);
  assert.equal(C.effectiveness('Fire',D.species.ferrothorn||{types:['Grass','Steel']},D),4);
  assert.equal(C.effectiveness('Grass',{types:['Fire','Flying']},D),.25);
});
test('move-specific type exceptions and fixed damage are handled',()=>{
  assert.equal(C.moveEffectiveness({...D.moves.freezedry,id:'freezedry'}, {types:['Water','Flying']},D),4);
  assert.equal(C.moveEffectiveness({...D.moves.flyingpress,id:'flyingpress'}, {types:['Grass','Steel']},D),2);
  assert.equal(C.moveEffectiveness({id:'seismictoss',category:'Physical',fixed:true,type:'Fighting'},D.species.garchomp,D),null);
});
test('selected-move coverage changes with moves, STAB excludes off-type attacks',()=>{
  const p=C.newPokemon('garchomp',D);p.moves=['earthquake'];
  const flying={types:['Flying','Steel']};
  assert.equal(C.bestCoverage(p,flying,'selected',D).multiplier,0);
  p.moves=['firefang'];assert.equal(C.bestCoverage(p,flying,'selected',D).multiplier,2);
  assert.ok(C.attackMoves(p,'stab',D).every(m=>['Ground','Dragon'].includes(m.type)));
  assert.equal(C.attackMoves(p,'selected-stab',D).length,0,'off-type selected moves do not count as STAB');
  p.moves=['protect','substitute','swordsdance','rest','firefang'];
  assert.equal(C.bestCoverage(p,flying,'selected',D).multiplier,null,'only four moves can contribute to active coverage');
  p.moves=[];assert.equal(C.bestCoverage(p,flying,'selected',D).multiplier,null);
});
test('Champions speed uses stat points, nature flooring, and Tailwind',()=>{
  const p=C.newPokemon('garchomp',D);p.points.spe=32;p.nature='Jolly';
  assert.equal(C.stat(p,'spe',D),169);
  assert.deepEqual(C.speedRange('garchomp',D),{min:109,max:169});
  assert.deepEqual(C.speedRange('garchomp',D,true),{min:218,max:338});
  p.nature='Brave';p.points.spe=0;assert.equal(C.stat(p,'spe',D),109);
  assert.equal(C.stat(p,'hp',D),183);
});
test('weekly selections and opponent rosters stay independent',()=>{
  const league=C.emptyLeague(),p=C.newPokemon('garchomp',D);league.mine.push(p);
  const one=league.matches[0];one.mine.enabled.push(p.uid);one.mine.bring.push(p.uid);
  const two=C.newMatch('Week two',2);league.matches.push(two);
  assert.equal(C.selected(league,'mine','bring').length,1);
  league.active=two.id;assert.equal(C.selected(league,'mine','bring').length,0);
  assert.equal(C.selected(league,'mine','all')[0].uid,p.uid);
});
test('Showdown export preserves Champions points and Mega base species',()=>{
  const p=C.newPokemon('garchomp',D);p.points={hp:2,atk:32,def:0,spa:0,spd:0,spe:32};p.nature='Jolly';p.moves=['earthquake','protect'];
  const text=C.exportTeam([p],D);
  assert.match(text,/EVs: 2 HP \/ 32 Atk \/ 32 Spe/);assert.match(text,/Level: 50/);assert.match(text,/- Earthquake/);assert.doesNotMatch(text,/252/);
  const mega=C.newPokemon('charizardmegay',D);const out=C.exportTeam([mega],D);
  assert.match(out,/^Charizard @ Charizardite Y/);assert.doesNotMatch(out,/Charizard-Mega-Y/);
});
test('export flags species, item, point, move and team-size problems',()=>{
  const p=C.newPokemon('garchomp',D);p.moves=['spore'];p.points.atk=32;p.points.spe=32;p.points.hp=32;
  const errors=C.teamProblems([p],D);
  assert.ok(errors.some(e=>e.includes('exactly 6')));assert.ok(errors.some(e=>e.includes('unlearnable')));assert.ok(errors.some(e=>e.includes('66 total')));
  const q=C.newPokemon('garchomp',D);p.points.hp=0;p.moves=['protect'];q.moves=['protect'];p.item=q.item='Sitrus Berry';
  const duplicate=C.teamProblems([p,q],D);assert.ok(duplicate.some(e=>e.includes('Species Clause')));assert.ok(duplicate.some(e=>e.includes('Item Clause')));
});
test('backups round-trip while rejecting malformed or unsafe selections',()=>{
  const league=C.emptyLeague(),p=C.newPokemon('garchomp',D);league.mine.push(p);league.matches[0].mine.enabled.push(p.uid);
  assert.deepEqual(C.validateLeague(JSON.parse(JSON.stringify(league)),D),league);
  const corrupt=structuredClone(league);corrupt.matches[0].mine.battle=['unknown'];assert.throws(()=>C.validateLeague(corrupt,D));
  const excess=structuredClone(league);excess.mine[0].points.hp=999;assert.throws(()=>C.validateLeague(excess,D));
  const proto=structuredClone(league);proto.mine[0].species='__proto__';assert.throws(()=>C.validateLeague(proto,D));
  const injected=structuredClone(league);injected.mine[0].item={toString:'bad'};assert.throws(()=>C.validateLeague(injected,D));
  const uidInjection=structuredClone(league);uidInjection.mine[0].uid='\"><img src=x onerror=alert(1)>';assert.throws(()=>C.validateLeague(uidInjection,D));
  const itemInjection=structuredClone(league);itemInjection.mine[0].item='Sitrus Berry\n- Spore';assert.throws(()=>C.validateLeague(itemInjection,D));
});
test('backup validation enforces four-of-six and unique selections',()=>{
  const league=C.emptyLeague(),p=C.newPokemon('garchomp',D);league.mine.push(p);
  league.matches[0].mine.battle.push(p.uid);assert.throws(()=>C.validateLeague(league,D));
  league.matches[0].mine.bring.push(p.uid);assert.doesNotThrow(()=>C.validateLeague(league,D));
  league.matches[0].mine.bring.push(p.uid);assert.throws(()=>C.validateLeague(league,D));
});
