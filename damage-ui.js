/* Two-mode Champions calculator, independent of the saved league's editable sets. */
(() => {
 'use strict';
 const D=window.DraftData,C=window.DraftCore,$=id=>document.getElementById(id);
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={hp:'HP',atk:'Atk',def:'Def',spa:'SpA',spd:'SpD',spe:'Spe'},stats=window.DraftDamage.stats;
 const colors={Normal:'#777e70',Fire:'#ae5638',Water:'#4b7896',Electric:'#99852b',Grass:'#64804b',Ice:'#508984',Fighting:'#985340',Poison:'#88617c',Ground:'#9a794a',Flying:'#7580a1',Psychic:'#aa647a',Bug:'#79863d',Rock:'#8e814e',Ghost:'#6c6384',Dragon:'#626e9b',Dark:'#675e55',Steel:'#6d8385',Fairy:'#ac7d8f'};
 const calc=window.DraftDamage.create(D,window.SmogonDamage);
 const species=Object.values(D.species).filter(s=>s.legal).sort((a,b)=>a.name.localeCompare(b.name));
 const option=(value,label,selected=false)=>'<option value="'+esc(value)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';
 const lab={attacker:calc.defaultUnit('garchomp'),defender:calc.defaultUnit('milotic'),move:'earthquake',mode:'standard',sources:{attacker:'',defender:''},field:{weather:'',terrain:'',spread:true,critical:false,hits:0,helpingHand:false,reflect:false,lightScreen:false,auroraVeil:false,friendGuard:false,protect:false,gravity:false}};
 lab.attacker.nature='Jolly';lab.attacker.points={hp:2,atk:32,def:0,spa:0,spd:0,spe:32};lab.defender.points.hp=32;
 let league=null,loaded=false;
 function unitPanel(side){
  const u=lab[side],s=D.species[u.species],prefix='damage-'+side;
  $(prefix+'-unit').innerHTML='<div class="field"><label for="'+prefix+'-species">POKÉMON / ACTIVE FORM</label><select id="'+prefix+'-species" data-unit="species">'+species.map(p=>option(p.id,p.name,p.id===u.species)).join('')+'</select></div><div class="damage-set-fields"><div class="field"><label for="'+prefix+'-nature">NATURE</label><select id="'+prefix+'-nature" data-unit="nature">'+Object.entries(D.natures).map(([name,n])=>option(name,name+(n.plus?' (+'+names[n.plus]+' / −'+names[n.minus]+')':' (neutral)'),name===u.nature)).join('')+'</select></div><div class="field"><label for="'+prefix+'-ability">ABILITY</label><select id="'+prefix+'-ability" data-unit="ability">'+s.abilities.map(a=>option(a,a,a===u.ability)).join('')+'</select></div><div class="field"><label for="'+prefix+'-item">ITEM</label><select id="'+prefix+'-item" data-unit="item">'+option('','No item',!u.item)+D.items.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(i=>option(i.name,i.name,i.name===u.item)).join('')+'</select></div><div class="field"><label for="'+prefix+'-status">STATUS</label><select id="'+prefix+'-status" data-unit="status">'+[['','Healthy'],['brn','Burned'],['par','Paralyzed'],['psn','Poisoned'],['tox','Badly poisoned'],['slp','Asleep'],['frz','Frozen']].map(([id,name])=>option(id,name,id===u.status)).join('')+'</select></div></div><div class="damage-hp-row"><div class="field"><label for="'+prefix+'-hp">CURRENT HP %</label><input id="'+prefix+'-hp" data-unit="hpPercent" type="number" min="1" max="100" value="'+u.hpPercent+'"></div><label class="damage-check"><input type="checkbox" data-unit="abilityOn" '+(u.abilityOn?'checked':'')+'> Ability trigger active <span title="For conditional abilities such as Flash Fire; always-on ability effects are applied automatically.">ⓘ</span></label></div><div class="damage-stat-label"><span>CHAMPIONS STAT POINTS</span><span id="'+prefix+'-budget"></span></div><div class="damage-stat-grid"><span>STAT</span><span>BASE</span><span>POINTS</span><span>STAGE</span><span>RESULT</span>'+stats.map(k=>'<label for="'+prefix+'-point-'+k+'">'+names[k]+'</label><span>'+s.stats[k]+'</span><input aria-label="'+side+' '+names[k]+' stat points" id="'+prefix+'-point-'+k+'" data-point="'+k+'" type="number" min="0" max="32" step="1" value="'+u.points[k]+'">'+(k==='hp'?'<span>—</span>':'<input aria-label="'+side+' '+names[k]+' stage" id="'+prefix+'-boost-'+k+'" data-boost="'+k+'" type="number" min="-6" max="6" step="1" value="'+u.boosts[k]+'">')+'<output id="'+prefix+'-stat-'+k+'"></output>').join('')+'</div><p id="'+prefix+'-point-note" class="method-note">0–32 points per stat · 66 total · level 50. Calculator edits stay in this calculator.</p>'+(s.mega?'<p class="method-note">The selected Mega form is assumed active.</p>':'');
  if(s.requiredItem){$(prefix+'-item').value=s.requiredItem;$(prefix+'-item').disabled=true;}
  disableBulkPoints();
 }
 function disableBulkPoints(){
  document.querySelectorAll('#damage-defender-unit [data-point]').forEach(input=>input.disabled=lab.mode==='range');
  const note=$('damage-defender-point-note');if(note)note.textContent=lab.mode==='range'?'Bulk comparison replaces these point inputs with the three benchmark spreads. Your selected nature, item, ability, status and stages still apply.':'0–32 points per stat · 66 total · level 50. Calculator edits stay in this calculator.';
 }
 function chooseMove(preferred){
  const s=D.species[lab.attacker.species],selected=lab.attacker.moves||[];
  const pool=s.moves.map(id=>D.moves[id]).filter(Boolean).sort((a,b)=>(selected.includes(b.id)?1:0)-(selected.includes(a.id)?1:0)||a.name.localeCompare(b.name));
  if(!s.moves.includes(preferred))preferred=selected.find(id=>D.moves[id]?.category!=='Status')||selected[0]||(s.moves.includes('earthquake')?'earthquake':pool.find(m=>m.category!=='Status')?.id)||pool[0]?.id||'';
  lab.move=preferred;
  $('damage-move').innerHTML=pool.map(m=>option(m.id,m.name+' · '+m.type+' / '+m.category+' · '+(m.category==='Status'?'—':m.fixed?'Fixed':m.power||'Variable')+' BP'+(selected.includes(m.id)?' · saved set':''),m.id===lab.move)).join('');
  movePreview();
 }
 function movePreview(){
  const m=D.moves[lab.move];
  $('damage-move-preview').innerHTML=m?'<div class="damage-move-badges"><span class="type-badge" style="--type-color:'+colors[m.type]+'">'+m.type+'</span><span class="move-category category-'+m.category.toLowerCase()+'">'+m.category+'</span><span class="move-power"><b>'+(m.category==='Status'?'—':m.fixed?'Fixed':m.power||'Var.')+'</b><small>BP</small></span><span class="damage-accuracy">'+(m.accuracy===true?'Always hits':m.accuracy+'% accuracy')+'</span></div><p class="method-note">'+esc(m.description||'')+'</p>':'';
  const spread=!!m&&['allAdjacent','allAdjacentFoes'].includes(m.target);$('damage-spread').disabled=!spread;
  $('damage-spread-label').classList.toggle('muted',!spread);
 }
 function updateStats(side){
  const u=lab[side],prefix='damage-'+side,total=stats.reduce((sum,k)=>sum+u.points[k],0);
  $(prefix+'-budget').textContent=side==='defender'&&lab.mode==='range'?'Benchmark spreads':(Number.isFinite(total)?total:'—')+' / 66';
  $(prefix+'-budget').classList.toggle('error',total>66);
  try{const values=calc.preview(u);for(const k of stats)$(prefix+'-stat-'+k).textContent=values[k];}
  catch{for(const k of stats)$(prefix+'-stat-'+k).textContent='—';}
 }
 const number=value=>Number(value).toFixed(1).replace(/\.0$/,'');
 function bars(profiles){
  const maximum=Math.max(125,Math.ceil(Math.max(...profiles.map(p=>p.maxPercent))/25)*25),ticks=5;
  return '<div class="damage-plot"><div class="damage-axis">'+Array.from({length:ticks+1},(_,i)=>'<span>'+number(maximum*i/ticks)+'%</span>').join('')+'</div>'+profiles.map(p=>'<div class="damage-range-row"><div class="damage-range-label"><span>'+esc(p.name)+'</span><strong>'+number(p.minPercent)+'–'+number(p.maxPercent)+'%</strong></div><div class="damage-range-track" role="img" aria-label="'+esc(p.name+': '+number(p.minPercent)+' to '+number(p.maxPercent)+' percent damage')+'"><span class="damage-health-line" style="left:'+(lab.defender.hpPercent/maximum*100)+'%"></span><span class="damage-range-band" style="left:'+(p.minPercent/maximum*100)+'%;width:'+Math.max(.3,(p.maxPercent-p.minPercent)/maximum*100)+'%"></span><span class="damage-midpoint" style="left:'+((p.minPercent+p.maxPercent)/2/maximum*100)+'%"></span></div></div>').join('')+'<p class="damage-chart-key"><i></i> Damage-roll range <span>┆ Current HP ('+lab.defender.hpPercent+'%)</span></p></div>';
 }
 function resultCard(result,name,spread){
  return '<article class="damage-result-card"><p class="eyebrow">'+esc(name)+'</p>'+(spread?'<p class="damage-spread-description">'+esc(spread)+'</p>':'')+'<strong class="damage-percent">'+number(result.minPercent)+'–'+number(result.maxPercent)+'<small>%</small></strong><p class="damage-hp-result">'+result.min+'–'+result.max+' HP damage</p><p class="damage-stat-result">Defender: '+result.hp+' HP · '+result.defense+' '+names[result.defenseStat]+'<br>Current HP: '+result.currentHP+' / '+result.hp+'</p></article>';
 }
 function calculate(){
  updateStats('attacker');updateStats('defender');
  try{
   $('damage-error').textContent='';
   if(lab.mode==='range'){
    const comparison=calc.compare(lab),profiles=comparison.profiles;
    $('damage-results').innerHTML='<div class="damage-result-cards">'+profiles.map(p=>resultCard(p,p.name,p.spread)).join('')+'</div>'+bars(profiles)+'<p class="method-note">The three benchmarks change HP and defensive stat points only; all other stat points are zero. The chosen defender nature, item, ability, HP percentage, status, stages and field conditions are held fixed. These are comparison points, not an exhaustive spread search.</p>'+(comparison.adaptive?'<p class="method-note">This attack can change its defensive target. The fully bulky benchmark uses the better of the two legal 32 HP / 32 defensive-stat spreads.</p>':'');
   }else{
    const result=calc.run(lab);
    $('damage-results').innerHTML=resultCard(result,'Custom spread',null)+bars([{name:'Selected matchup',...result}])+'<p class="damage-result-description">'+esc(result.description)+'</p>'+(result.rolls?'<details class="damage-roll-details"><summary>Damage rolls ('+result.rolls.length+')</summary><p>'+result.rolls.join(', ')+'</p></details>':'')+'<p class="method-note">'+(result.statusMove?'This status move does not directly deal damage. ':'')+(result.hits>1?result.hits+' hits are included in this result. ':'')+'Percentages use the defender’s maximum HP. Damage is shown before any survival on 1 HP effects.</p>';
   }
  }catch(error){$('damage-error').textContent=error.message;$('damage-results').innerHTML='';}
 }
 function refreshSources(){
  const match=league?C.activeMatch(league):null;
  for(const side of ['attacker','defender']){
   const select=$('damage-'+side+'-source');
   select.innerHTML=option('','Standalone / custom')+(league?.mine.length?'<optgroup label="My saved draft">'+league.mine.map(p=>option('mine:'+p.uid,D.species[p.species].name)).join('')+'</optgroup>':'')+(match?.roster.length?'<optgroup label="'+esc(match.name)+'">'+match.roster.map(p=>option('theirs:'+p.uid,D.species[p.species].name+(p.prediction?' · prediction':' · species only'))).join('')+'</optgroup>':'');
   if([...select.options].some(o=>o.value===lab.sources[side]))select.value=lab.sources[side];else{lab.sources[side]='';select.value='';}
  }
 }
 function loadSource(side,value){
  const [team,uid]=value.split(':'),match=league?C.activeMatch(league):null;
  const p=(team==='mine'?league?.mine:match?.roster)?.find(p=>p.uid===uid);if(!p)return;
  lab[side]=calc.importUnit(p);lab.sources[side]=value;unitPanel(side);if(side==='attacker')chooseMove();calculate();
 }
 function updateUnit(side,target){
  const u=lab[side];
  if(target.dataset.point)u.points[target.dataset.point]=target.valueAsNumber;
  else if(target.dataset.boost)u.boosts[target.dataset.boost]=target.valueAsNumber;
  else if(target.dataset.unit){
   const key=target.dataset.unit;
   if(key==='species'){
    lab[side]=calc.defaultUnit(target.value);lab.sources[side]='';$('damage-'+side+'-source').value='';unitPanel(side);if(side==='attacker')chooseMove();calculate();return;
   }
   u[key]=key==='abilityOn'?target.checked:key==='hpPercent'?target.valueAsNumber:target.value;
  }else return;
  lab.sources[side]='';$('damage-'+side+'-source').value='';calculate();
 }
 for(const side of ['attacker','defender']){
  unitPanel(side);
  const panel=$('damage-'+side+'-unit');
  panel.addEventListener('input',e=>{if(e.target.tagName==='INPUT')updateUnit(side,e.target);});
  panel.addEventListener('change',e=>{if(e.target.tagName==='SELECT')updateUnit(side,e.target);});
  $('damage-'+side+'-source').addEventListener('change',e=>loadSource(side,e.target.value));
 }
 document.querySelectorAll('[data-damage-mode]').forEach(button=>button.addEventListener('click',()=>{
  lab.mode=button.dataset.damageMode;document.querySelectorAll('[data-damage-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));disableBulkPoints();calculate();
 }));
 $('damage-move').addEventListener('change',e=>{lab.move=e.target.value;movePreview();calculate();});
 $('damage-field').addEventListener('change',e=>{
  const key=e.target.dataset.battle;if(!key)return;
  lab.field[key]=e.target.type==='checkbox'?e.target.checked:key==='hits'?Number(e.target.value):e.target.value;calculate();
 });
 $('damage-swap').addEventListener('click',()=>{
  [lab.attacker,lab.defender]=[lab.defender,lab.attacker];[lab.sources.attacker,lab.sources.defender]=[lab.sources.defender,lab.sources.attacker];unitPanel('attacker');unitPanel('defender');refreshSources();chooseMove();calculate();
 });
 chooseMove(lab.move);calculate();
 window.DraftDamageUI={refresh(state){
  league=state;refreshSources();
  if(!loaded){
   loaded=true;const match=C.activeMatch(state);
   if(state.mine.length)loadSource('attacker','mine:'+state.mine[0].uid);
   if(match.roster.length)loadSource('defender','theirs:'+match.roster[0].uid);
   refreshSources();
  }
  calculate();
 }};
})();
