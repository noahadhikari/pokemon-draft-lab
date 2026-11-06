const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../core.js'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/champions.js'),'utf8'),context);
const D=JSON.parse(JSON.stringify(context.window.DraftData));
function fixture(){
 const league=C.emptyLeague(),p={uid:C.uid(),species:'milotic',prediction:C.newPrediction('milotic',D)};
 p.prediction.moves=['hydropump','protect'];league.matches[0].roster.push(p);league.matches[0].theirs.enabled.push(p.uid);
 return {league,p};
}
test('predicted coverage distinguishes saved attacks from stronger off-set threats',()=>{
 const {p}=fixture(),result=C.defensiveMatchup(p,D.species.garchomp,D);
 assert.equal(result.predicted,true);assert.equal(result.expected.multiplier,1);assert.deepEqual(result.expected.moves,['Hydro Pump']);
 assert.ok(result.surprises.some(m=>m.id==='icebeam'&&m.multiplier===4));
 for(const move of result.surprises){assert.ok(D.species.milotic.moves.includes(move.id));assert.ok(!p.prediction.moves.includes(move.id));assert.ok(move.multiplier>1&&move.multiplier>result.expected.multiplier);assert.notEqual(D.moves[move.id].category,'Status');assert.ok(!D.moves[move.id].fixed);}
});
test('adding the threatening move to the prediction updates coverage and removes its surprise flag',()=>{
 const {p}=fixture();p.prediction.moves=['icebeam','hydropump','protect'];
 const result=C.defensiveMatchup(p,D.species.garchomp,D);
 assert.equal(result.expected.multiplier,4);assert.ok(result.expected.moves.includes('Ice Beam'));assert.ok(!result.surprises.some(m=>m.id==='icebeam'));
});
test('unknown and status-only predictions do not imply safety',()=>{
 const {p}=fixture();delete p.prediction;
 const unknown=C.defensiveMatchup(p,D.species.garchomp,D);
 assert.equal(unknown.predicted,false);assert.equal(unknown.expected.multiplier,null);assert.equal(unknown.surprises.length,0);assert.ok(unknown.possibleThreats.some(m=>m.id==='icebeam'));
 p.prediction=C.newPrediction('milotic',D);p.prediction.moves=['protect'];
 const status=C.defensiveMatchup(p,D.species.garchomp,D);assert.equal(status.predicted,true);assert.equal(status.expected.multiplier,null);assert.ok(status.surprises.some(m=>m.id==='icebeam'));
});
test('opponent predictions round-trip through existing backup version without affecting old rosters',()=>{
 const {league,p}=fixture();p.prediction.item='Sitrus Berry';p.prediction.nature='Timid';p.prediction.points.spe=32;
 assert.deepEqual(C.validateLeague(JSON.parse(JSON.stringify(league)),D),league);
 const legacy=structuredClone(league);delete legacy.matches[0].roster[0].prediction;
 assert.deepEqual(C.validateLeague(legacy,D),legacy);
 const normalized=C.validateLeague(league,D);normalized.matches[0].roster[0].prediction.points.spe=0;assert.equal(p.prediction.points.spe,32,'sets are copied, not shared');
});
test('prediction storage rejects illegal moves, duplicate moves, excessive points and oversized sets',()=>{
 for(const change of [p=>p.moves=['spore'],p=>p.moves=['protect','protect'],p=>p.points.spe=33,p=>p.points={hp:32,atk:32,def:32,spa:0,spd:0,spe:0},p=>p.moves=['protect','recover','hydropump','icebeam','icywind'],p=>p.item='Sitrus Berry\n- Spore']){
  const {league,p}=fixture();change(p.prediction);assert.throws(()=>C.validateLeague(league,D));
 }
});
test('the same opponent species can have different predictions in different matchups',()=>{
 const {league,p}=fixture(),second=C.newMatch('Second coach',2),q={uid:C.uid(),species:'milotic',prediction:C.newPrediction('milotic',D)};
 q.prediction.moves=['icebeam'];second.roster=[q];second.theirs.enabled=[q.uid];league.matches.push(second);
 const result=C.validateLeague(league,D);assert.deepEqual(result.matches[0].roster[0].prediction.moves,['hydropump','protect']);assert.deepEqual(result.matches[1].roster[0].prediction.moves,['icebeam']);
});
