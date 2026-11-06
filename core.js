/* Pure matchup and storage logic. Also loadable by Node for verification. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DraftCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const stats = ['hp','atk','def','spa','spd','spe'];
  const statNames = {hp:'HP',atk:'Atk',def:'Def',spa:'SpA',spd:'SpD',spe:'Spe'};
  const id = value => String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
  const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const has = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
  function newPokemon(species, data) {
    const s = data.species[species];
    return {uid:uid(),species,item:s.requiredItem || '',ability:s.abilities[0],nature:'Hardy',points:Object.fromEntries(stats.map(k=>[k,0])),moves:[]};
  }
  function newPrediction(species,data){
    const s=data.species[species];
    return {item:s.requiredItem||'',ability:s.abilities[0],nature:'Hardy',points:Object.fromEntries(stats.map(k=>[k,0])),moves:[]};
  }
  function defensiveMatchup(attacker,target,data){
    const prediction=attacker.prediction||null;
    const expected=prediction?bestCoverage({...prediction,species:attacker.species},target,'selected',data):{multiplier:null,moves:[]};
    const chosen=new Set(prediction?.moves||[]);
    const alternatives=attackMoves(attacker,'learnable',data)
      .filter(move=>!chosen.has(move.id))
      .map(move=>({id:move.id,name:move.name,type:move.type,multiplier:moveEffectiveness(move,target,data)}))
      .filter(move=>move.multiplier>1)
      .sort((a,b)=>b.multiplier-a.multiplier||a.name.localeCompare(b.name));
    return {predicted:!!prediction,expected,
      surprises:prediction?alternatives.filter(move=>move.multiplier>(expected.multiplier??0)):[],
      possibleThreats:prediction?[]:alternatives};
  }
  function newMatch(name='Opponent 1',week=1) {
    return {id:uid(),name,week,roster:[],mine:{enabled:[],bring:[],battle:[]},theirs:{enabled:[],bring:[],battle:[]},notes:''};
  }
  function emptyLeague() {
    const match = newMatch();
    return {version:1,mine:[],matches:[match],active:match.id};
  }
  function activeMatch(state) { return state.matches.find(m=>m.id===state.active) || state.matches[0]; }
  function selected(state,side,scope='enabled') {
    const match = activeMatch(state);
    const roster = side==='mine' ? state.mine : match.roster;
    return scope==='all' ? roster : roster.filter(p => match[side][scope].includes(p.uid));
  }
  function effectiveness(type, target, data) {
    return target.types.reduce((v,t)=>v*(data.chart[type]?.[t] ?? 1),1);
  }
  function moveEffectiveness(move,target,data) {
    if (move.category==='Status' || move.fixed) return null;
    if (move.id==='freezedry' && target.types.includes('Water')) return effectiveness(move.type,target,data)*4;
    if (move.id==='flyingpress') return effectiveness('Fighting',target,data)*effectiveness('Flying',target,data);
    if (move.id==='thousandarrows' && target.types.includes('Flying')) return effectiveness('Ground',{types:target.types.filter(t=>t!=='Flying')},data);
    return effectiveness(move.type,target,data);
  }
  function attackMoves(pokemon,mode,data) {
    const s=data.species[pokemon.species];
    const selected=mode==='selected'||mode==='selected-stab';
    const pool=selected ? (pokemon.moves || []).slice(0,4) : s.moves;
    return pool.map(m=>data.moves[m]).filter(m=>m && m.category!=='Status' && !m.fixed && (!['stab','selected-stab'].includes(mode)||s.types.includes(m.type)));
  }
  function bestCoverage(pokemon,target,mode,data) {
    const choices=attackMoves(pokemon,mode,data).map(move=>({move,multiplier:moveEffectiveness(move,target,data)}));
    if (!choices.length) return {multiplier:null,moves:[]};
    const best=Math.max(...choices.map(c=>c.multiplier));
    return {multiplier:best,moves:choices.filter(c=>c.multiplier===best).map(c=>c.move.name)};
  }
  function stat(pokemon,key,data) {
    const s=data.species[pokemon.species], n=data.natures[pokemon.nature] || {};
    const raw=s.stats[key]+(pokemon.points?.[key]||0)+(key==='hp'?75:20);
    return key==='hp' ? raw : Math.floor(raw*(n.plus===key?1.1:n.minus===key?.9:1));
  }
  function speedRange(species,data,tailwind=false) {
    const b=data.species[species].stats.spe, factor=tailwind?2:1;
    return {min:Math.floor((b+20)*.9)*factor,max:Math.floor((b+52)*1.1)*factor};
  }
  function setProblems(p,data) {
    const s=data.species[p.species], problems=[];
    if (!s.legal) problems.push(`${s.name}: not M-C legal.`);
    if (!s.abilities.includes(p.ability)) problems.push(`${s.name}: invalid ability.`);
    if (s.requiredItem && p.item!==s.requiredItem) problems.push(`${s.name} requires ${s.requiredItem}.`);
    if (p.item && !data.items.some(i=>i.name===p.item)) problems.push(`${s.name}: item unavailable in M-C.`);
    if (!p.moves.length) problems.push(`${s.name}: choose at least one move.`);
    if (p.moves.some(m=>!s.moves.includes(m))) problems.push(`${s.name}: unlearnable move.`);
    if (new Set(p.moves).size!==p.moves.length) problems.push(`${s.name}: duplicate moves.`);
    if (stats.some(k=>!Number.isInteger(p.points[k])||p.points[k]<0||p.points[k]>32) || stats.reduce((n,k)=>n+p.points[k],0)>data.meta.pointLimit) problems.push(`${s.name}: stat points must be 0–32 each, ${data.meta.pointLimit} total.`);
    if (!has(data.natures,p.nature)) problems.push(`${s.name}: invalid nature.`);
    if (stats.every(k=>p.points[k]===0) && p.nature==='Serious') problems.push(`${s.name}: Showdown requires a different neutral nature to confirm zero investment.`);
    return problems;
  }
  function teamProblems(team,data,scope='bring') {
    const problems=team.flatMap(p=>setProblems(p,data));
    if (scope==='bring' && team.length!==6) problems.unshift(`Select exactly 6 Pokémon for the weekly team (${team.length} selected).`);
    if (scope==='battle' && team.length!==4) problems.unshift(`Select exactly 4 Pokémon for battle (${team.length} selected).`);
    if (scope==='all' && team.length>6) problems.unshift('Entire draft export is a roster archive. Import a weekly six for VGC.');
    const species=new Set(), items=new Set();
    let megaCount=0;
    for (const p of team) {
      const s=data.species[p.species];
      if (species.has(s.base)) problems.push(`Species Clause: ${s.base} appears more than once.`);
      if (p.item && items.has(p.item)) problems.push(`Item Clause: ${p.item} appears more than once.`);
      species.add(s.base); if (p.item) items.add(p.item); if(s.mega) megaCount++;
    }
    if (megaCount>1) problems.push('Multiple Mega forms selected: only one can Mega Evolve in a battle.');
    return [...new Set(problems)];
  }
  function exportTeam(team,data) {
    return team.map(p=>{
      const s=data.species[p.species];
      const lines=[s.exportSpecies+(p.item?' @ '+p.item:''),'Ability: '+p.ability,'Level: 50'];
      const points=stats.filter(k=>p.points[k]).map(k=>p.points[k]+' '+statNames[k]);
      // Showdown stores Champions stat points in the EVs field, without scaling them to EVs.
      lines.push('EVs: '+(points.length?points.join(' / '):'0 HP'),p.nature+' Nature');
      lines.push(...p.moves.map(m=>'- '+data.moves[m].name));
      return lines.join('\n');
    }).join('\n\n');
  }
  function validateLeague(input,data) {
    const fail=()=>{throw new Error('Invalid league backup. Use a JSON backup from Draft Lab.');};
    if (!input || input.version!==1 || !Array.isArray(input.mine)||input.mine.length>100||!Array.isArray(input.matches)||!input.matches.length||input.matches.length>100) fail();
    const text=(v,max)=>{if(typeof v!=='string'||v.length>max)fail();return v;};
    function checkedSet(p,species){
      if(!p||typeof p.nature!=='string'||!has(data.natures,p.nature)||!data.species[species].abilities.includes(p.ability)||typeof p.item!=='string'||(p.item&&!data.items.some(i=>i.name===p.item))||!p.points||!Array.isArray(p.moves)||p.moves.length>4||p.moves.some(m=>typeof m!=='string'||!has(data.moves,m)))fail();
      const points=Object.fromEntries(stats.map(k=>{const n=p.points[k];if(!Number.isInteger(n)||n<0||n>32)fail();return[k,n];}));
      if(Object.values(points).reduce((a,b)=>a+b,0)>data.meta.pointLimit)fail();
      return {item:p.item,ability:p.ability,nature:p.nature,points,moves:[...p.moves]};
    }
    function roster(rows,own) {
      if(!Array.isArray(rows)||rows.length>100)fail();
      const seen=new Set(), species=new Set();
      return rows.map(p=>{
        if(!p||typeof p.species!=='string'||!has(data.species,p.species))fail();
        const key=text(p.uid,100); if(!/^[a-zA-Z0-9_-]+$/.test(key)||seen.has(key)||species.has(p.species))fail();seen.add(key);species.add(p.species);
        if(own)return {uid:key,species:p.species,...checkedSet(p,p.species)};
        const row={uid:key,species:p.species};
        if(p.prediction!==undefined&&p.prediction!==null){
          row.prediction=checkedSet(p.prediction,p.species);
          if(new Set(row.prediction.moves).size!==row.prediction.moves.length||row.prediction.moves.some(m=>!data.species[p.species].moves.includes(m)))fail();
        }
        return row;
      });
    }
    const mine=roster(input.mine,true), seen=new Set();
    const matches=input.matches.map(m=>{
      const key=text(m.id,100);if(!/^[a-zA-Z0-9_-]+$/.test(key)||seen.has(key)||!Number.isInteger(m.week)||m.week<1||m.week>99)fail();seen.add(key);
      const rows=roster(m.roster,false);
      function picks(side,team){
        const s=m[side],ids=new Set(team.map(p=>p.uid)); if(!s)fail();
        const result={};
        for(const [scope,limit] of [['enabled',100],['bring',6],['battle',4]]){
          if(!Array.isArray(s[scope])||s[scope].length>limit||new Set(s[scope]).size!==s[scope].length||s[scope].some(v=>!ids.has(v)))fail();result[scope]=[...s[scope]];
        }
        if(result.battle.some(v=>!result.bring.includes(v)))fail();return result;
      }
      return {id:key,name:text(m.name,60),week:m.week,roster:rows,mine:picks('mine',mine),theirs:picks('theirs',rows),notes:text(m.notes,30000)};
    });
    return {version:1,mine,matches,active:matches.some(m=>m.id===input.active)?input.active:matches[0].id};
  }
  return {stats,statNames,id,uid,newPrediction,defensiveMatchup,newPokemon,newMatch,emptyLeague,activeMatch,selected,effectiveness,moveEffectiveness,attackMoves,bestCoverage,stat,speedRange,setProblems,teamProblems,exportTeam,validateLeague};
});
