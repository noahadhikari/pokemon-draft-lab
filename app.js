/* No server, account, build step, or runtime API dependency. */
(() => {
  'use strict';
  const D=window.DraftData, C=window.DraftCore;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STORE='noah-draft-lab-v1';
  const addPickers=[];
  const coverageModes={mine:'selected',theirs:'learnable'};
  const colors={Normal:'#777e70',Fire:'#ae5638',Water:'#4b7896',Electric:'#99852b',Grass:'#64804b',Ice:'#508984',Fighting:'#985340',Poison:'#88617c',Ground:'#9a794a',Flying:'#7580a1',Psychic:'#aa647a',Bug:'#79863d',Rock:'#8e814e',Ghost:'#6c6384',Dragon:'#626e9b',Dark:'#675e55',Steel:'#6d8385',Fairy:'#ac7d8f'};
  let state=C.emptyLeague(), storageError='', tab='coverage', direction='mine', defense='mine', editTarget=null, opponentEditing=false, toastTimer;
  try { const saved=localStorage.getItem(STORE); if(saved)state=C.validateLeague(JSON.parse(saved),D); }
  catch(e){storageError='Saved league could not be read. Restore a backup; existing saved data has not been overwritten.';}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
  function save(){
    try{localStorage.setItem(STORE,JSON.stringify(state));$('save-status').textContent='Saved on this device';$('save-status').classList.remove('unsaved');storageError='';}
    catch(e){$('save-status').textContent='Not saved — download a league backup';$('save-status').classList.add('unsaved');}
  }
  function commit(){save();render();}
  const match=()=>C.activeMatch(state);
  const roster=side=>side==='mine'?state.mine:match().roster;
  const scope=()=>$('analysis-scope').value;
  const included=side=>C.selected(state,side,scope());
  const badges=s=>s.types.map(t=>`<span class="type-badge" style="--type-color:${colors[t]}">${esc(t)}</span>`).join('');
  const option=(value,label,selected)=>`<option value="${esc(value)}"${selected?' selected':''}>${esc(label)}</option>`;
  function empty(message){return `<p class="no-analysis">${esc(message)}</p>`;}
  function effect(value,title=''){
    const cls=value===null?'':value===0?'immune':value>=4?'super quad':value>1?'super':value===1?'neutral':value<=.25?'resist half':'resist';
    const label=value===null?'—':value===.5?'½×':value===.25?'¼×':value+'×';
    return `<span class="effect ${cls}"${title?` title="${esc(title)}"`:''}>${label}</span>`;
  }
  const dragIcon='<svg viewBox="0 0 12 18" width="12" height="18" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="1.3"/><circle cx="9" cy="3" r="1.3"/><circle cx="3" cy="9" r="1.3"/><circle cx="9" cy="9" r="1.3"/><circle cx="3" cy="15" r="1.3"/><circle cx="9" cy="15" r="1.3"/></g></svg>';
  const trashIcon='<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h14M8 3h4l1 2M5 5l1 12h8l1-12M8 8v6m4-6v6"/></svg>';
  function spriteImage(species,preview=false){
    const sprite=(species.sprite||species.id).replace(/[^a-z0-9-]/g,'');
    const local=window.DraftSpriteOverrides?.[species.id];
    const url=local||'https://play.pokemonshowdown.com/sprites/dex/'+sprite+'.png';
    const size=preview?36:48;
    return '<img class="pokemon-sprite'+(local?' pokemon-artwork':'')+(preview?' suggestion-sprite':'')+'" src="'+esc(url)+'" width="'+size+'" height="'+size+'" loading="lazy" alt="" data-fallback="'+esc(species.name.slice(0,2).toUpperCase())+'">';
  }
  function bindSpriteFallbacks(container){
    container.querySelectorAll('img.pokemon-sprite').forEach(img=>img.addEventListener('error',()=>{
      if(img.src.startsWith('https://play.pokemonshowdown.com/sprites/dex/')){
        img.src=img.src.replace('/sprites/dex/','/sprites/gen5/');return;
      }
      const fallback=document.createElement('span');
      fallback.className='sprite-fallback'+(img.classList.contains('suggestion-sprite')?' suggestion-sprite':'');
      fallback.textContent=img.dataset.fallback;fallback.setAttribute('aria-hidden','true');img.replaceWith(fallback);
    }));
  }
  function renderRoster(side){
    const rows=roster(side),sel=match()[side],prefix=side==='mine'?'my':'their';
    $(prefix+'-count').textContent=rows.length+' drafted';
    $(prefix+'-summary').innerHTML=`<span><b>${sel.enabled.length}</b> analyzing</span><span><b>${sel.bring.length} / 6</b> weekly · <b>${sel.battle.length} / 4</b> battle</span>`;
    $(prefix+'-roster').innerHTML=rows.length?rows.map(p=>{
      const s=D.species[p.species],active=sel.enabled.includes(p.uid);
      const sub=side==='mine'?(p.moves.length?p.moves.map(m=>D.moves[m].name).join(' · '):'No moves chosen · edit set'):p.prediction?'Predicted: '+(p.prediction.moves.length?p.prediction.moves.map(m=>D.moves[m].name).join(' · '):'no moves chosen'):'No set prediction yet';
      const set=side==='mine'?p:p.prediction;
      const spread=set?C.stats.filter(k=>set.points[k]).map(k=>set.points[k]+' '+C.statNames[k]).join(' / ')||'0 in all stats':'';
      const setSummary=set?'<div class="pokemon-set-summary"'+(side==='theirs'?' aria-label="Predicted item and stat spread"':'')+'><span class="pokemon-item"><b>Item</b> '+esc(set.item||'No item')+'</span><span class="pokemon-spread"><b>EVs / points</b> '+esc(spread)+'</span></div>':'';
      const handle=`<button type="button" class="drag-handle" data-side="${side}" data-reorder="${p.uid}" aria-label="Reorder ${esc(s.name)}" aria-describedby="reorder-help" title="Drag to reorder; use Up/Down arrows when focused">${dragIcon}</button>`;
      const remove=`<button class="delete-card" type="button" data-side="${side}" data-delete="${p.uid}" aria-label="Delete ${esc(s.name)} from draft" title="Delete ${esc(s.name)}">${trashIcon}</button>`;
      return `<article data-side="${side}" data-uid="${p.uid}" class="pokemon-card${active?'':' disabled'}${sel.battle.includes(p.uid)?' in-battle':''}">${handle}${spriteImage(s)}<div class="pokemon-identity"><p class="pokemon-name">${esc(s.name)}${s.legal?'':'<span class="legality-warning" title="Not M-C legal">!</span>'}</p><div>${badges(s)}</div><div class="pokemon-subtitle" title="${esc(sub)}">${esc(sub)}</div>${setSummary}</div><div class="card-actions"><label title="Include ${esc(s.name)} in analysis"><input type="checkbox" data-side="${side}" data-uid="${p.uid}" data-pick="enabled" ${active?'checked':''} aria-label="Analyze ${esc(s.name)}">Analyze</label><button type="button" data-side="${side}" data-uid="${p.uid}" data-pick="bring" aria-pressed="${sel.bring.includes(p.uid)}" aria-label="Weekly six: ${esc(s.name)}" title="Bring in weekly six">6</button><button type="button" data-side="${side}" data-uid="${p.uid}" data-pick="battle" aria-pressed="${sel.battle.includes(p.uid)}" aria-label="Battle four: ${esc(s.name)}" title="Pick in battle four">4</button><button class="edit-card" type="button" data-side="${side}" data-edit="${p.uid}" aria-label="${side==='mine'?'Edit set for':'Predict set for'} ${esc(s.name)}" title="${side==='mine'?'Edit set':'Predict set'}">↗</button>${remove}</div></article>`;
    }).join(''):`<div class="empty-roster"><b>${side==='mine'?'Start with your draft.':'Who are you facing?'}</b><p>${side==='mine'?'Add your whole roster, including the bench.':'Add their draft; the sets stay unknown.'}</p><p>Or load an example from the toolbar.</p></div>`;
    bindSpriteFallbacks($(prefix+'-roster'));
  }
  function speciesOptions(){addPickers.forEach(picker=>picker.refresh());}
  function render(){
    $('opponent-select').innerHTML=[...state.matches].sort((a,b)=>a.week-b.week).map(m=>option(m.id,`Week ${m.week} · ${m.name}`,m.id===state.active)).join('');
    $('their-title').textContent=match().name+"'s draft";
    $('match-notes').value=match().notes;
    renderRoster('mine');renderRoster('theirs');renderAnalysis();
  }
  function renderAnalysis(){
    if(tab==='coverage')renderCoverage();
    if(tab==='defense')renderDefense();
    if(tab==='speed')renderSpeed();
    if(tab==='moves'){renderMoveOptions();renderMoves();}
    if(tab==='damage')window.DraftDamageUI?.refresh(state);
  }
  function renderCoverage(){
    const attackers=included(direction),defenders=included(direction==='mine'?'theirs':'mine');
    const own=direction==='mine',mode=coverageModes[direction];
    const choices=own?[['selected','Active set moves'],['selected-stab','STAB from active sets']]:[['learnable','Learnable possibilities'],['stab','STAB possibilities']];
    $('coverage-mode').innerHTML=choices.map(([value,label])=>option(value,label,value===mode)).join('');
    $('coverage-detail').textContent='Select a matchup cell to see the matching moves.';
    const missing=own?attackers.filter(p=>!p.moves.length).length:0;
    $('coverage-description').textContent=(own?'Your offense uses only the up to four moves saved in each active set. '+(mode==='selected-stab'?'Only selected STAB attacks are included. ':''):'Their coverage shows learnable possibilities because their actual moves are unknown. '+(mode==='stab'?'Only possible STAB attacks are included. ':''))+'Status and fixed-damage moves do not count toward type coverage. Select a cell for matching moves.'+(missing?' '+missing+' Pokémon have no moves saved; edit their sets to include their coverage.':'');
    if(!attackers.length||!defenders.length){$('coverage-stats').innerHTML='';$('coverage-table').innerHTML=empty('Add Pokémon to both drafts and include them in the current analysis selection.');return;}
    const cells=attackers.map(a=>defenders.map(d=>C.bestCoverage(a,D.species[d.species],mode,D)));
    const covered=defenders.filter((_,j)=>cells.some(row=>row[j].multiplier>1)).length;
    const gaps=defenders.length-covered;
    $('coverage-stats').innerHTML=`<div class="insight"><strong>${covered}<small> / ${defenders.length}</small></strong><span>targets with super effective coverage</span></div><div class="insight${gaps?' warning':''}"><strong>${gaps}</strong><span>targets without super effective coverage</span></div><div class="insight"><strong>${attackers.length} × ${defenders.length}</strong><span>matchups in this view</span></div>`;
    $('coverage-table').innerHTML=`<table><caption class="sr-only">Best offensive coverage for ${direction==='mine'?'my team':'opponent possibilities'}</caption><thead><tr><th scope="col">ATTACKER ↓ / TARGET →</th>${defenders.map(d=>`<th scope="col">${esc(D.species[d.species].name)}<div>${badges(D.species[d.species])}</div></th>`).join('')}</tr></thead><tbody>${attackers.map((a,i)=>`<tr><th scope="row">${esc(D.species[a.species].name)}<small>${C.attackMoves(a,mode,D).length} ${own?'selected attacks':'possible attacks'}</small></th>${cells[i].map((cell,j)=>{const title=`${D.species[a.species].name} → ${D.species[defenders[j].species].name}: ${cell.moves.join(', ')||'No attacking move in this selection'}`;return `<td tabindex="0" title="${esc(title)}" aria-label="${esc(title)}">${effect(cell.multiplier)}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function defenseCell(attacker,target){
    return defense==='mine'?C.defensiveMatchup(attacker,D.species[target.species],D):{predicted:true,expected:C.bestCoverage(attacker,D.species[target.species],'selected',D),surprises:[],possibleThreats:[]};
  }
  function renderDefense(){
    $('defense-detail').innerHTML='';
    if($('defense-view').value==='types'){
      $('defense-description').textContent='All incoming types, independent of movesets. Red marks weaknesses; green marks resistances and immunities.';
      renderTypeDefense();return;
    }
    const defenders=included(defense),attackers=included(defense==='mine'?'theirs':'mine');
    $('defense-description').textContent=defense==='mine'?'Incoming coverage from your opponent predictions. ? means no prediction; — means no damaging move in the predicted set. Surprise flags mark unchosen learnable attacks that are super effective and hit harder by typing than your prediction. Select a cell to inspect the exact moves.':'Incoming coverage from your saved sets against their typing. Red marks weaknesses; green marks resistances and immunities. Select a cell for matching moves.';
    if(!defenders.length||!attackers.length){$('defense-table').innerHTML=empty('Include Pokémon on both sides to compare incoming attacks.');return;}
    $('defense-table').innerHTML='<table><caption class="sr-only">Incoming set-based coverage and surprise moves</caption><thead><tr><th scope="col">ATTACKER ↓ / DEFENDER →</th>'+defenders.map(p=>'<th scope="col">'+esc(D.species[p.species].name)+'<div>'+badges(D.species[p.species])+'</div></th>').join('')+'</tr></thead><tbody>'+attackers.map(a=>{
      const predicted=defense==='mine'?a.prediction:a;
      const label=defense==='mine'?(predicted?'Predicted '+predicted.moves.length+'/4 moves':'Set unknown'):'Your active set';
      return '<tr><th scope="row">'+esc(D.species[a.species].name)+'<small>'+esc(label)+'</small></th>'+defenders.map(d=>{
        const cell=defenseCell(a,d),warning=cell.surprises.length?' · '+cell.surprises.length+' possible surprise moves':'';
        const title=D.species[a.species].name+' into '+D.species[d.species].name+': '+(cell.predicted?cell.expected.moves.join(', ')||'No damaging moves in this set':'No set prediction')+warning;
        return '<td><button type="button" class="defense-cell" data-threat-attacker="'+a.uid+'" data-threat-defender="'+d.uid+'" aria-label="'+esc(title)+'" title="'+esc(title)+'">'+(cell.predicted?effect(cell.expected.multiplier):'<span class="effect unknown">?</span>')+(cell.surprises.length?'<small class="surprise-marker">+ Surprise</small>':'')+'</button></td>';
      }).join('')+'</tr>';
    }).join('')+'</tbody></table>';
    $('defense-detail').innerHTML='<p class="method-note">Select a matchup cell to inspect the predicted attacks and possible surprise moves. Surprise lists show coverage threats, not their likelihood.</p>';
  }
  function renderTypeDefense(){
    const rows=included(defense);
    if(!rows.length){$('defense-table').innerHTML=empty('Include at least one Pokémon in this analysis selection.');return;}
    $('defense-table').innerHTML=`<table><caption class="sr-only">Incoming defensive type effectiveness</caption><thead><tr><th scope="col">INCOMING TYPE ↓</th>${rows.map(p=>`<th scope="col">${esc(D.species[p.species].name)}<div>${badges(D.species[p.species])}</div></th>`).join('')}<th scope="col">WEAK</th><th scope="col">RESISTS / IMMUNE</th></tr></thead><tbody>${D.types.map(t=>{const values=rows.map(p=>C.effectiveness(t,D.species[p.species],D));return `<tr><th scope="row"><span class="type-badge" style="--type-color:${colors[t]}">${t}</span></th>${values.map((v,i)=>`<td aria-label="${esc(t+' against '+D.species[rows[i].species].name+': '+v+' times')}">${effect(v)}</td>`).join('')}<td>${values.filter(v=>v>1).length}</td><td>${values.filter(v=>v<1).length}</td></tr>`;}).join('')}</tbody></table>`;
  }
  function showDefenseDetail(attackerId,defenderId){
    const attacker=included(defense==='mine'?'theirs':'mine').find(p=>p.uid===attackerId),target=included(defense).find(p=>p.uid===defenderId);
    if(!attacker||!target)return;
    const cell=defenseCell(attacker,target),set=defense==='mine'?attacker.prediction:attacker;
    const attacks=set?C.attackMoves({...set,species:attacker.species},'selected',D):[];
    const moves=list=>list.length?'<ul class="threat-moves">'+list.map(move=>'<li><span>'+esc(move.name)+'</span><span class="type-badge" style="--type-color:'+colors[move.type]+'">'+move.type+'</span>'+moveCategory(D.moves[move.id])+movePower(D.moves[move.id])+effect(move.multiplier)+'<span class="threat-move-description">'+esc(D.moves[move.id].description||'Description unavailable.')+'</span></li>').join('')+'</ul>':'<p class="method-note">None in this matchup.</p>';
    const expected=attacks.map(move=>({...move,multiplier:C.moveEffectiveness(move,D.species[target.species],D)}));
    $('defense-detail').innerHTML='<h3>'+esc(D.species[attacker.species].name)+' into '+esc(D.species[target.species].name)+'</h3><div class="threat-columns"><div><h4>'+(defense==='mine'?'Predicted attacks':'Your selected attacks')+'</h4>'+(cell.predicted?moves(expected):'<p class="method-note">No set prediction saved. Edit this opponent Pokémon to enter one.</p>')+'</div><div><h4>'+(cell.predicted?'Possible surprise moves':'Learnable threats · set unknown')+'</h4>'+moves(cell.predicted?cell.surprises:cell.possibleThreats)+'</div></div>';
  }
  function renderSpeed(){
    const mine=included('mine').map(p=>{const speed=C.stat(p,'spe',D)*($('tailwind-mine').checked?2:1);return {p,side:'mine',min:speed,max:speed};});
    const theirs=included('theirs').map(p=>({p,side:'theirs',...C.speedRange(p.species,D,$('tailwind-theirs').checked)}));
    const reverse=$('trick-room').checked;
    const rows=[...mine,...theirs].sort((a,b)=>reverse?a.min-b.min:b.max-a.max);
    if(!rows.length){$('speed-chart').innerHTML=empty('Add and include Pokémon to compare speed tiers.');return;}
    const max=Math.max(...rows.map(r=>r.max),1);
    $('speed-chart').innerHTML=`<div class="speed-key"><span><i></i> YOUR CONFIGURED SPEED</span><span><i></i> OPPONENT POSSIBLE RANGE</span></div>${rows.map(r=>`<div class="speed-row"><div class="speed-label">${esc(D.species[r.p.species].name)}<small>${r.side==='mine'?esc(r.p.nature)+' · '+r.p.points.spe+' Spe points':'Opponent · set unknown'}</small></div><div class="speed-track" aria-hidden="true">${r.side==='mine'?`<span class="speed-marker" style="left:${(r.max/max*100).toFixed(2)}%"></span>`:`<span class="speed-range" style="left:${(r.min/max*100).toFixed(2)}%;width:${((r.max-r.min)/max*100).toFixed(2)}%"></span>`}</div><div class="speed-value">${r.min===r.max?r.max:r.min+'–'+r.max}<small> ${r.side==='mine'?'yours':'possible'}</small></div></div>`).join('')}<p class="method-note">${reverse?'Sorted by minimum speed, slowest first for Trick Room.':'Sorted by maximum speed, fastest first.'} Overlapping ranges mean the actual order depends on the opponent’s set.</p>`;
  }
  function renderMoveOptions(){
    const previous=$('move-pokemon').value;
    const choices=['mine','theirs'].flatMap(side=>included(side).map(p=>({p,side})));
    $('move-pokemon').innerHTML=choices.map(({p,side})=>option(p.uid,`${side==='mine'?'Mine':'Opponent'} · ${D.species[p.species].name}`,p.uid===previous)).join('');
  }
  function renderMoves(){
    const uid=$('move-pokemon').value;
    const p=[...state.mine,...match().roster].find(p=>p.uid===uid);
    if(!p){$('move-count').textContent='';$('move-table').innerHTML=empty('Include a Pokémon in the current analysis selection to explore its learnable moves.');return;}
    const query=$('move-search').value.toLowerCase().trim(),type=$('move-type').value,category=$('move-category').value;
    const own=state.mine.some(r=>r.uid===uid),s=D.species[p.species];
    const planned=own?p.moves:p.prediction?.moves||[];
    const moves=s.moves.map(m=>D.moves[m]).filter(m=>m&&(!type||m.type===type)&&(!category||m.category===category)&&(!query||(m.name+' '+m.description).toLowerCase().includes(query))).sort((a,b)=>a.name.localeCompare(b.name));
    $('move-count').textContent=`${moves.length} of ${s.moves.length} M-C learnable moves for ${s.name}. ${own?'Edit the set to choose up to four.':p.prediction?'Your predicted moves are marked. Other learnable moves remain possible.':'No prediction saved; the opponent’s actual moves are unknown.'}`;
    $('move-table').innerHTML=moves.length?`<table class="moves-table"><caption class="sr-only">Learnable moves for ${esc(s.name)}</caption><thead><tr><th scope="col">MOVE</th><th scope="col">TYPE</th><th scope="col">CATEGORY</th><th scope="col">POWER</th><th scope="col">ACC.</th><th scope="col">PRIORITY</th><th scope="col">TARGET</th><th scope="col">EFFECT</th></tr></thead><tbody>${moves.map(m=>`<tr><th scope="row">${esc(m.name)}${planned.includes(m.id)?'<small>'+(own?'IN YOUR SET':'IN YOUR PREDICTION')+'</small>':''}</th><td><span class="type-badge" style="--type-color:${colors[m.type]}">${m.type}</span></td><td>${moveCategory(m)}</td><td>${movePower(m)}</td><td>${m.accuracy===true?'Always':m.accuracy+'%'}</td><td>${m.priority>0?'+':''}${m.priority}</td><td>${esc(m.target)}</td><td>${esc(m.description)}</td></tr>`).join('')}</tbody></table>`:empty(s.legal?'No moves match these filters.':'This species is not legal in M-C; no Champions learnset is available.');
  }
  function showTab(next){
    tab=next;
    document.querySelector('.analysis-heading .field').hidden=tab==='damage';
    document.querySelector('.analysis-footnote').hidden=tab==='damage';
    document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;$('panel-'+b.dataset.tab).hidden=!active;});
    renderAnalysis();
  }
  function togglePick(side,uid,pick){
    const sel=match()[side],list=sel[pick],index=list.indexOf(uid);
    if(index>=0){list.splice(index,1);if(pick==='bring')sel.battle=sel.battle.filter(x=>x!==uid);}
    else{
      const limit=pick==='bring'?6:pick==='battle'?4:100;
      if(list.length>=limit){toast(`Choose at most ${limit} Pokémon for ${pick==='bring'?'the weekly team':'battle'}.`);return;}
      if(pick==='battle'&&!sel.bring.includes(uid)){
        if(sel.bring.length>=6){toast('Choose this Pokémon in the weekly six before picking it for battle.');return;}
        sel.bring.push(uid);
      }
      list.push(uid);
    }
    commit();
  }
  function addPokemon(side,name){
    const s=Object.values(D.species).find(s=>C.id(s.name)===C.id(name));
    if(!s){toast('Choose a Pokémon from the search suggestions.');return false;}
    if($('legal-only').checked&&!s.legal){toast('This Pokémon is not legal in M-C. Turn off the legal filter to inspect it.');return false;}
    const rows=roster(side);
    if(rows.length>=100){toast('The roster limit is 100 Pokémon.');return false;}
    if(rows.some(p=>p.species===s.id)){toast('That Pokémon is already in this draft.');return false;}
    const p=side==='mine'?C.newPokemon(s.id,D):{uid:C.uid(),species:s.id};rows.push(p);
    if(side==='mine')for(const m of state.matches)m.mine.enabled.push(p.uid);
    else match().theirs.enabled.push(p.uid);
    commit();return true;
  }
  function movePowerValue(move){return move.category==='Status'?'—':move.fixed?'Fixed':move.power||'Var.';}
  function movePower(move){
    const value=movePowerValue(move);
    const title=move.category==='Status'?'Status move: no base power':move.fixed?'Fixed or counter-based damage':move.power?'Base power: '+move.power:'Variable base power';
    return '<span class="move-power" title="'+esc(title)+'"><b>'+value+'</b><small>BP</small></span>';
  }
  function moveCategory(move){
    const icons={Physical:'<path d="M8 1l2 4 5-2-2 5 3 3-5 1-1 4-3-4-5 2 2-5-3-3 5-1z" fill="currentColor"/>',Special:'<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="2.5" fill="currentColor"/>',Status:'<path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="4" r="2" fill="currentColor"/><circle cx="11" cy="8" r="2" fill="currentColor"/><circle cx="5" cy="12" r="2" fill="currentColor"/>'};
    return '<span class="move-category category-'+move.category.toLowerCase()+'"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">'+icons[move.category]+'</svg><span>'+move.category+'</span></span>';
  }
  function moveBadges(move){
    return '<span class="type-badge" style="--type-color:'+colors[move.type]+'">'+move.type+'</span>'+moveCategory(move)+movePower(move);
  }
  let activeMovePicker=null;
  function createMovePicker(select,species){
    const slot=Number(select.id.replace('set-move-','')),field=select.closest('.field');
    const description=document.createElement('p');description.id='move-description-'+slot;description.className='move-selected-description';
    const details=document.createElement('details');details.className='move-full-description';
    details.innerHTML='<summary>Full effect</summary><p></p>';
    select.after(description,details);
    function updateDescription(){
      const move=D.moves[select.value],short=move?.description||'',full=move?.fullDescription||short;
      description.hidden=!move;description.textContent=move?(short||'Description unavailable.'):'';
      details.hidden=!move||!full||full===short;details.open=false;details.querySelector('p').textContent=full;
    }
    select.setAttribute('aria-describedby',description.id);select.addEventListener('change',updateDescription);updateDescription();
    // Older browsers retain the native select and its descriptions.
    if(typeof HTMLElement.prototype.showPopover!=='function')return;
    const wrapper=document.createElement('div');wrapper.className='move-picker';
    const trigger=document.createElement('button');trigger.type='button';trigger.id='set-move-trigger-'+slot;trigger.className='move-trigger';
    trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-describedby',description.id);
    const popup=document.createElement('div');popup.id='move-menu-'+slot;popup.className='move-menu';popup.setAttribute('popover','manual');popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Choose move '+(slot+1));
    trigger.setAttribute('aria-controls',popup.id);
    popup.innerHTML='<div class="move-menu-header"><label for="move-query-'+slot+'">MOVE '+(slot+1)+' / LEARNABLE OPTIONS</label><button type="button" class="clear-move">Clear slot</button></div><input id="move-query-'+slot+'" class="move-query" type="search" placeholder="Search name, type, category or effect…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="move-options-'+slot+'" aria-expanded="true"><p class="move-result-count"></p><div id="move-options-'+slot+'" class="move-options" role="listbox" aria-label="Learnable moves"></div>';
    const query=popup.querySelector('.move-query'),results=popup.querySelector('.move-options'),count=popup.querySelector('.move-result-count');
    const pool=species.moves.map(id=>D.moves[id]).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
    let choices=[],active=0;
    function paint(){
      const move=D.moves[select.value];
      trigger.innerHTML=move?'<span class="move-trigger-name">'+esc(move.name)+'<span class="move-chevron" aria-hidden="true">⌄</span></span><span class="move-trigger-badges">'+moveBadges(move)+'</span>':'<span class="move-empty">Choose a move <span class="move-chevron" aria-hidden="true">⌄</span></span><span class="move-empty-hint">Search legal moves for '+esc(species.name)+'</span>';
      trigger.setAttribute('aria-label','Move '+(slot+1)+': '+(move?move.name+', '+move.type+', '+move.category+', '+movePowerValue(move)+' base power':'Choose a move'));
    }
    function position(){
      if(!popup.matches(':popover-open'))return;
      const rect=trigger.getBoundingClientRect(),view=window.visualViewport;
      const width=view?.width||innerWidth,height=view?.height||innerHeight,offset=view?.offsetTop||0,leftOffset=view?.offsetLeft||0;
      const below=offset+height-rect.bottom-12,above=rect.top-offset-12,down=below>=Math.min(300,above);
      popup.style.width=Math.min(560,width-24)+'px';
      popup.style.maxHeight=Math.min(height-24,Math.max(120,Math.min(420,down?below:above)))+'px';
      popup.style.left=Math.max(leftOffset+12,Math.min(rect.left,leftOffset+width-popup.getBoundingClientRect().width-12))+'px';
      popup.style.top=(down?rect.bottom+6:Math.max(offset+12,rect.top-popup.getBoundingClientRect().height-6))+'px';
    }
    function highlight(index,scroll=false){
      active=index;
      results.querySelectorAll('[role=option]').forEach((option,i)=>option.setAttribute('aria-selected',i===active));
      const option=results.querySelectorAll('[role=option]')[active];
      if(option){query.setAttribute('aria-activedescendant',option.id);if(scroll)option.scrollIntoView({block:'nearest'});}else query.removeAttribute('aria-activedescendant');
    }
    function render(){
      const needle=query.value.toLowerCase().trim();
      choices=pool.filter(m=>!needle||(m.name+' '+m.type+' '+m.category+' '+m.description).toLowerCase().includes(needle));
      const selected=[0,1,2,3].map(i=>$('set-move-'+i).value);
      results.innerHTML=choices.length?choices.map(m=>{
        const chosen=selected.indexOf(m.id),stab=m.category!=='Status'&&species.types.includes(m.type);
        return '<button type="button" class="move-choice" role="option" tabindex="-1" id="move-option-'+slot+'-'+m.id+'" data-move="'+m.id+'"><span class="move-choice-heading"><span class="move-choice-name">'+esc(m.name)+'</span><span class="move-choice-tags">'+(stab?'<span class="move-stab">STAB</span>':'')+(chosen>=0?'<span class="move-slot-tag">Slot '+(chosen+1)+'</span>':'')+'</span></span><span class="move-choice-stats">'+moveBadges(m)+'<span class="move-accuracy">'+(m.accuracy===true?'Always hits':m.accuracy+'% ACC')+'</span></span><span class="move-choice-description">'+esc(m.description||'Description unavailable.')+'</span></button>';
      }).join(''):'<p class="no-pokemon-options">No learnable moves match this search.</p>';
      count.textContent=choices.length+' / '+pool.length+' moves · BP = base power';
      highlight(0);results.scrollTop=0;position();
    }
    function close(focus=false){
      if(popup.matches(':popover-open'))popup.hidePopover();
      trigger.setAttribute('aria-expanded','false');
      if(activeMovePicker===picker)activeMovePicker=null;
      if(focus&&trigger.isConnected)trigger.focus({preventScroll:true});
    }
    function choose(id){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));close(true);}
    const picker={close,position,contains:target=>wrapper.contains(target)};
    trigger.addEventListener('click',()=>{
      if(popup.matches(':popover-open')){close(true);return;}
      activeMovePicker?.close();activeMovePicker=picker;query.value='';render();popup.showPopover();trigger.setAttribute('aria-expanded','true');position();query.focus({preventScroll:true});
    });
    query.addEventListener('input',render);
    query.addEventListener('keydown',e=>{
      if(e.isComposing)return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(choices.length)highlight((active+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length,true);}
      else if(e.key==='Enter'){e.preventDefault();if(choices[active])choose(choices[active].id);}
    });
    popup.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}});
    results.addEventListener('click',e=>{const option=e.target.closest('[data-move]');if(option)choose(option.dataset.move);});
    popup.querySelector('.clear-move').addEventListener('click',()=>choose(''));
    select.addEventListener('change',paint);
    select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    field.querySelector('label').htmlFor=trigger.id;select.after(wrapper);wrapper.append(trigger,popup);paint();
  }
  document.addEventListener('pointerdown',e=>{if(activeMovePicker&&!activeMovePicker.contains(e.target))activeMovePicker.close();});
  window.addEventListener('resize',()=>activeMovePicker?.position());
  window.addEventListener('scroll',()=>activeMovePicker?.position(),true);
  window.visualViewport?.addEventListener('resize',()=>activeMovePicker?.position());
  window.visualViewport?.addEventListener('scroll',()=>activeMovePicker?.position());
  function editableSet(side,pokemon){
    return side==='mine'?pokemon:{...C.newPrediction(pokemon.species,D),...pokemon.prediction,uid:pokemon.uid,species:pokemon.species};
  }
  function editor(side,uid){
    activeMovePicker?.close();
    const original=roster(side).find(p=>p.uid===uid),p=editableSet(side,original),s=D.species[p.species];
    editTarget={side,uid};
    $('editor-title').textContent=s.name+(side==='theirs'?' · prediction':'');$('editor-error').textContent='';
    $('editor-form').querySelector('.eyebrow').textContent=side==='mine'?'SET BUILDER':'OPPONENT PREDICTION';
    $('editor-form').querySelector('[type=submit]').textContent=side==='mine'?'Save set':'Save prediction';
    $('clear-prediction').hidden=side!=='theirs';$('clear-prediction').disabled=!original.prediction;
    const legalMoves=s.moves.map(id=>D.moves[id]).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
    $('editor-content').innerHTML=(side==='theirs'?'<p class="preview-warning">Your prediction, not a revealed set. Unchosen learnable attacks remain possible surprises.</p>':'')+`<div class="editor-types">${badges(s)}${s.mega?'<p class="method-note">Analysis assumes Mega form. Export uses the base Pokémon and its required Mega Stone.</p>':''}</div><div class="editor-fields"><div class="field"><label for="set-item">ITEM</label><select id="set-item">${option('','No item',!p.item)}${D.items.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(i=>option(i.name,i.name,p.item===i.name)).join('')}</select></div><div class="field"><label for="set-ability">ABILITY</label><select id="set-ability">${s.abilities.map(a=>option(a,a,p.ability===a)).join('')}</select></div><div class="field"><label for="set-nature">NATURE</label><select id="set-nature">${Object.entries(D.natures).map(([name,n])=>option(name,name+(n.plus?' (+'+C.statNames[n.plus]+' / −'+C.statNames[n.minus]+')':' (neutral)'),p.nature===name)).join('')}</select></div></div><p id="ability-description" class="method-note"></p><p class="editor-section-title">CHAMPIONS STAT POINTS</p><div class="stat-grid">${C.stats.map(k=>`<div class="field"><label for="point-${k}">${C.statNames[k]}</label><input id="point-${k}" type="number" min="0" max="32" step="1" required value="${p.points[k]}" data-stat="${k}"><output id="stat-${k}" aria-label="Resulting ${C.statNames[k]}"></output></div>`).join('')}</div><p class="point-budget" id="point-budget"></p><p class="method-note">0–32 per stat · ${D.meta.pointLimit} total. Champions uses stat points directly, rather than 252-EV spreads. ${side==='mine'?'Your set is saved across weekly matchups.':'This prediction is saved only for this opponent.'}</p><p class="editor-section-title">MOVESET</p><div class="moves-editor">${[0,1,2,3].map(i=>`<div class="field"><label for="set-move-${i}">MOVE ${i+1}</label><select id="set-move-${i}">${option('','Choose a move',!p.moves[i])}${legalMoves.map(m=>option(m.id,m.name+' · '+m.type+' / '+m.category+' · '+movePowerValue(m)+' BP',p.moves[i]===m.id)).join('')}</select></div>`).join('')}</div>${s.legal?'':`<p class="error">${esc(s.reason)}</p>`}`;
    if(s.requiredItem){$('set-item').value=s.requiredItem;$('set-item').disabled=true;}
    $('set-ability').addEventListener('change',()=>$('ability-description').textContent=D.abilities[$('set-ability').value]||'');
    $('ability-description').textContent=D.abilities[p.ability]||'';
    $('set-nature').addEventListener('change',updateEditorStats);
    $('editor-content').querySelectorAll('[data-stat]').forEach(el=>el.addEventListener('input',updateEditorStats));
    updateEditorStats();
    for(const slot of [0,1,2,3])createMovePicker($('set-move-'+slot),s);
    $('editor-dialog').showModal();
  }
  function readEditor(){
    const original=roster(editTarget.side).find(p=>p.uid===editTarget.uid),p=editableSet(editTarget.side,original);
    return {...p,item:$('set-item').value,ability:$('set-ability').value,nature:$('set-nature').value,points:Object.fromEntries(C.stats.map(k=>[k,Number($('point-'+k).value)])),moves:[0,1,2,3].map(i=>$('set-move-'+i).value).filter(Boolean)};
  }
  function updateEditorStats(){
    const p=readEditor(),total=Object.values(p.points).reduce((a,b)=>a+b,0);
    $('point-budget').textContent=total+' / '+D.meta.pointLimit+' points used';$('point-budget').classList.toggle('error',total>D.meta.pointLimit);
    for(const key of C.stats)$('stat-'+key).textContent=C.stat(p,key,D);
  }
  async function confirmAction(title,description){
    $('confirm-title').textContent=title;$('confirm-description').textContent=description;$('confirm-dialog').returnValue='';
    return new Promise(resolve=>{$('confirm-dialog').addEventListener('close',()=>resolve($('confirm-dialog').returnValue==='confirm'),{once:true});$('confirm-dialog').showModal();});
  }
  function opponentEditor(existing){
    opponentEditing=existing;$('opponent-dialog-title').textContent=existing?'Edit matchup':'Add opponent';
    $('opponent-name').value=existing?match().name:'';
    $('opponent-week').value=existing?match().week:Math.min(99,Math.max(...state.matches.map(m=>m.week))+1);
    $('delete-opponent').hidden=!existing;$('opponent-dialog').showModal();
  }
  function updateExport(){
    const mode=$('export-scope').value,team=C.selected(state,'mine',mode==='all'?'all':mode);
    $('export-text').value=C.exportTeam(team,D);
    const problems=C.teamProblems(team,D,mode);
    $('export-warnings').textContent=problems.length?'Review before battling: '+problems.join(' '):`${team.length} Pokémon ready for import. Champions stat points are written to Showdown’s EVs field.`;
    $('export-warnings').classList.toggle('error',!!problems.length);
    $('copy-export').disabled=!team.length;$('download-export').disabled=!team.length;
  }
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function demo(){
    const league=C.emptyLeague();
    const candidates=['incineroar','garchomp','rotomwash','whimsicott','metagross','milotic','amoonguss','talonflame','tyranitar'];
    league.mine=candidates.filter(id=>D.species[id]?.legal).map(id=>{
      const p=C.newPokemon(id,D),s=D.species[id];
      const special=s.stats.spa>s.stats.atk,atk=special?'spa':'atk';p.nature=special?'Timid':'Jolly';p.points[atk]=32;p.points.spe=32;p.points.hp=2;
      const attacks=C.attackMoves(p,'stab',D).sort((a,b)=>b.power-a.power).filter(m=>m.power>=60&&m.power<=100&&m.accuracy>=90);
      p.moves=[...new Set([attacks[0]?.id,attacks.find(m=>m.type!==attacks[0]?.type)?.id,'protect'].filter(m=>m&&s.moves.includes(m)))];
      return p;
    });
    const opponents=[{name:'Rain check',ids:['pelipper','basculegion','archaludon','sneasler','maushold','kingambit','dragonite','gengar','sinistcha']},{name:'Room service',ids:['farigiraf','torkoal','hatterene','ursaluna','indeedee','hariyama','tyranitar','gallade','ampharos']}];
    league.matches=opponents.map((o,i)=>{
      const m=C.newMatch(o.name,i+1);m.roster=o.ids.filter(id=>D.species[id]?.legal).map(species=>({uid:C.uid(),species}));
      m.mine.enabled=league.mine.map(p=>p.uid);m.mine.bring=m.mine.enabled.slice(0,6);m.mine.battle=m.mine.bring.slice(0,4);
      m.theirs.enabled=m.roster.map(p=>p.uid);m.theirs.bring=m.theirs.enabled.slice(0,6);m.theirs.battle=m.theirs.bring.slice(0,4);
      m.notes=i===0?'Example only. Rain offense can change speed order through abilities. Check their possible speed control and Wide Guard options before choosing leads.':'Example only. Identify possible Trick Room setters and compare minimum speed ranges.';return m;
    });league.active=league.matches[0].id;return league;
  }
  function focusRosterHandle(side,uid){
    const prefix=side==='mine'?'my':'their';
    $(prefix+'-roster').querySelector('[data-reorder="'+uid+'"]')?.focus({preventScroll:true});
  }
  function movePokemon(side,uid,to){
    const rows=roster(side),from=rows.findIndex(p=>p.uid===uid);
    if(from<0||to<0||to>=rows.length||from===to)return false;
    const [pokemon]=rows.splice(from,1);rows.splice(to,0,pokemon);
    commit();focusRosterHandle(side,uid);
    toast(D.species[pokemon.species].name+' moved to position '+(to+1)+' of '+rows.length+'.');
    return true;
  }
  async function removePokemon(side,uid){
    const current=match(),rows=side==='mine'?state.mine:current.roster;
    const index=rows.findIndex(p=>p.uid===uid),pokemon=rows[index];
    if(!pokemon)return false;
    const name=D.species[pokemon.species].name;
    const description=side==='mine'?'This removes its saved set and selections from every weekly matchup.':'This removes it from this opponent\'s draft and selections.';
    if(!await confirmAction('Remove '+name+'?',description))return false;
    if(side==='mine'){
      state.mine=state.mine.filter(p=>p.uid!==uid);
      for(const m of state.matches)for(const key of ['enabled','bring','battle'])m.mine[key]=m.mine[key].filter(x=>x!==uid);
    }else{
      current.roster=current.roster.filter(p=>p.uid!==uid);
      for(const key of ['enabled','bring','battle'])current.theirs[key]=current.theirs[key].filter(x=>x!==uid);
    }
    if($('editor-dialog').open&&editTarget?.side===side&&editTarget.uid===uid)$('editor-dialog').close();
    commit();
    const remaining=roster(side),next=remaining[Math.min(index,remaining.length-1)],prefix=side==='mine'?'my':'their';
    if(next)$(prefix+'-roster').querySelector('[data-delete="'+next.uid+'"]')?.focus({preventScroll:true});
    else $(prefix+'-search').focus({preventScroll:true});
    toast(name+' removed from the draft.');
    return true;
  }
  // A single pointer-based handle supports a mouse, touch, and pen.
  let rosterDrag=null;
  function clearDropMarker(){document.querySelectorAll('.pokemon-card[data-drop]').forEach(card=>card.removeAttribute('data-drop'));}
  function findDropTarget(drag){
    clearDropMarker();drag.target=null;
    if(drag.matchId!==match().id)return;
    const card=document.elementFromPoint(drag.x,drag.y)?.closest('.pokemon-card');
    if(!card||card.dataset.side!==drag.side||card.dataset.uid===drag.uid)return;
    const bounds=card.getBoundingClientRect();
    drag.target={uid:card.dataset.uid,after:drag.y>=bounds.top+bounds.height/2};
    card.dataset.drop=drag.target.after?'after':'before';
  }
  function scrollRosterDrag(){
    const drag=rosterDrag;if(!drag?.dragging)return;
    const bounds=drag.list.getBoundingClientRect(),edge=64;
    if(drag.x>=bounds.left&&drag.x<=bounds.right){
      const step=drag.y<edge?-Math.min(18,(edge-drag.y)/3):drag.y>innerHeight-edge?Math.min(18,(drag.y-innerHeight+edge)/3):0;
      if(step){window.scrollBy({top:step,behavior:'instant'});findDropTarget(drag);}
    }
    drag.frame=requestAnimationFrame(scrollRosterDrag);
  }
  function finishRosterDrag(apply=false){
    const drag=rosterDrag;if(!drag)return;
    rosterDrag=null;cancelAnimationFrame(drag.frame);
    drag.card.classList.remove('is-dragging');document.body.classList.remove('roster-dragging');clearDropMarker();
    if(drag.handle.hasPointerCapture(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
    if(!apply||!drag.dragging||!drag.target||drag.matchId!==match().id)return;
    const rows=roster(drag.side),from=rows.findIndex(p=>p.uid===drag.uid);
    let to=rows.findIndex(p=>p.uid===drag.target.uid);
    if(from<0||to<0)return;
    if(drag.target.after)to++;if(from<to)to--;
    movePokemon(drag.side,drag.uid,to);
  }
  const rosterElement=document.querySelector('.rosters');
  rosterElement.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-reorder]');
    if(!handle||!e.isPrimary||e.button!==0||rosterDrag)return;
    e.preventDefault();handle.focus({preventScroll:true});
    const card=handle.closest('.pokemon-card');
    rosterDrag={handle,card,list:card.parentElement,side:handle.dataset.side,uid:handle.dataset.reorder,matchId:match().id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,dragging:false,target:null,frame:0};
    handle.setPointerCapture(e.pointerId);
  });
  rosterElement.addEventListener('pointermove',e=>{
    const drag=rosterDrag;if(!drag||drag.pointerId!==e.pointerId)return;
    drag.x=e.clientX;drag.y=e.clientY;
    if(!drag.dragging&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)<5)return;
    e.preventDefault();
    if(!drag.dragging){drag.dragging=true;drag.card.classList.add('is-dragging');document.body.classList.add('roster-dragging');drag.frame=requestAnimationFrame(scrollRosterDrag);}
    findDropTarget(drag);
  });
  rosterElement.addEventListener('pointerup',e=>{
    if(rosterDrag?.pointerId!==e.pointerId)return;
    rosterDrag.x=e.clientX;rosterDrag.y=e.clientY;
    if(rosterDrag.dragging)findDropTarget(rosterDrag);
    finishRosterDrag(true);
  });
  for(const event of ['pointercancel','lostpointercapture'])rosterElement.addEventListener(event,e=>{if(rosterDrag?.pointerId===e.pointerId)finishRosterDrag();});
  window.addEventListener('blur',()=>finishRosterDrag());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&rosterDrag){e.preventDefault();finishRosterDrag();}});
  rosterElement.addEventListener('keydown',e=>{
    const handle=e.target.closest('[data-reorder]');if(!handle||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    e.preventDefault();finishRosterDrag();
    const rows=roster(handle.dataset.side),from=rows.findIndex(p=>p.uid===handle.dataset.reorder);
    const to=e.key==='Home'?0:e.key==='End'?rows.length-1:from+(e.key==='ArrowUp'?-1:1);
    movePokemon(handle.dataset.side,handle.dataset.reorder,to);
  });
  // Event delegation keeps roster controls usable after a selection re-renders the charts.
  document.querySelector('.rosters').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.pick)togglePick(button.dataset.side,button.dataset.uid,button.dataset.pick);if(button.dataset.edit)editor(button.dataset.side,button.dataset.edit);if(button.dataset.delete)removePokemon(button.dataset.side,button.dataset.delete);});
  document.querySelector('.rosters').addEventListener('change',e=>{if(e.target.matches('[type=checkbox][data-pick]'))togglePick(e.target.dataset.side,e.target.dataset.uid,e.target.dataset.pick);});
  function createAddPicker(side){
    const form=$('add-'+side),input=$(side==='mine'?'my-search':'their-search');
    const popup=document.createElement('div');
    popup.id=side+'-suggestions';popup.className='pokemon-suggestions';popup.hidden=true;
    popup.setAttribute('role','listbox');popup.setAttribute('aria-label','Add Pokémon to '+(side==='mine'?'my draft':'opponent draft'));
    form.append(popup);
    input.removeAttribute('list');input.setAttribute('role','combobox');
    input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','listbox');
    input.setAttribute('aria-controls',popup.id);input.setAttribute('aria-expanded','false');
    let choices=[],active=0,navigated=false;
    function close(){popup.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
    function highlight(index,scroll=false){
      active=index;
      popup.querySelectorAll('[role=option]').forEach((option,i)=>option.setAttribute('aria-selected',i===active));
      const option=popup.querySelectorAll('[role=option]')[active];
      if(option){input.setAttribute('aria-activedescendant',option.id);if(scroll)option.scrollIntoView({block:'nearest'});}
      else input.removeAttribute('aria-activedescendant');
    }
    function show(){
      navigated=false;
      const query=C.id(input.value),existing=new Set(roster(side).map(p=>p.species));
      choices=Object.values(D.species).filter(s=>(!$('legal-only').checked||s.legal)&&!existing.has(s.id)&&(!query||C.id(s.name).includes(query)))
        .sort((a,b)=>{
          const rank=s=>C.id(s.name)===query?0:C.id(s.name).startsWith(query)?1:2;
          return rank(a)-rank(b)||a.name.localeCompare(b.name);
        }).slice(0,8);
      popup.innerHTML=choices.length?choices.map(s=>'<button type="button" role="option" tabindex="-1" class="pokemon-option" id="'+side+'-option-'+s.id+'" data-add-species="'+s.id+'"><span class="pokemon-option-preview">'+spriteImage(s,true)+'<span class="pokemon-option-name">'+esc(s.name)+(s.legal?'':'<small>Not M-C legal</small>')+'</span></span><span>'+badges(s)+'</span></button>').join(''):'<p class="no-pokemon-options">No available Pokémon match this search.</p>';
      bindSpriteFallbacks(popup);
      popup.hidden=false;input.setAttribute('aria-expanded','true');highlight(0);
    }
    function add(name){
      if(!name.trim())return;
      if(addPokemon(side,name)){input.value='';input.focus({preventScroll:true});close();}
    }
    function accept(){
      // A fully typed name takes precedence, so duplicates cannot select a different form.
      const exact=Object.values(D.species).find(s=>C.id(s.name)===C.id(input.value));
      const choice=!popup.hidden&&choices[active];
      add(navigated&&choice?choice.name:exact?exact.name:choice?choice.name:input.value);
    }
    input.addEventListener('input',show);input.addEventListener('focus',show);
    input.addEventListener('keydown',e=>{
      if(e.isComposing)return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();if(popup.hidden){show();if(e.key==='ArrowUp')highlight(choices.length-1,true);}
        else if(choices.length)highlight((active+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length,true);
        navigated=true;
      }else if(e.key==='Enter'){
        e.preventDefault();accept();
      }else if(e.key==='Escape'){e.preventDefault();close();}
      else if(e.key==='Tab')close();
    });
    // Keep focus on the combobox so choosing a suggestion needs only one click/tap.
    popup.addEventListener('pointerdown',e=>{if(e.target.closest('[data-add-species]'))e.preventDefault();});
    popup.addEventListener('click',e=>{
      const option=e.target.closest('[data-add-species]');if(option)add(D.species[option.dataset.addSpecies].name);
    });
    input.addEventListener('blur',()=>{if(!form.contains(document.activeElement))close();});
    document.addEventListener('pointerdown',e=>{if(!form.contains(e.target))close();});
    form.addEventListener('submit',e=>{e.preventDefault();accept();});
    return {refresh(){if(!popup.hidden)show();}};
  }
  for(const side of ['mine','theirs'])addPickers.push(createAddPicker(side));
  $('legal-only').addEventListener('change',speciesOptions);
  $('opponent-select').addEventListener('change',()=>{state.active=$('opponent-select').value;commit();});
  $('analysis-scope').addEventListener('change',renderAnalysis);
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  document.querySelector('.tabs').addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('[data-tab]')],index=tabs.indexOf(document.activeElement);if(index<0)return;let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();showTab(tabs[next].dataset.tab);tabs[next].focus();}});
  document.querySelectorAll('[data-direction]').forEach(b=>b.addEventListener('click',()=>{direction=b.dataset.direction;document.querySelectorAll('[data-direction]').forEach(x=>x.setAttribute('aria-pressed',x===b));renderCoverage();}));
  document.querySelectorAll('[data-defense]').forEach(b=>b.addEventListener('click',()=>{defense=b.dataset.defense;document.querySelectorAll('[data-defense]').forEach(x=>x.setAttribute('aria-pressed',x===b));renderDefense();}));
  $('defense-view').addEventListener('change',renderDefense);
  $('defense-table').addEventListener('click',e=>{const cell=e.target.closest('[data-threat-attacker]');if(cell)showDefenseDetail(cell.dataset.threatAttacker,cell.dataset.threatDefender);});
  $('coverage-mode').addEventListener('change',()=>{coverageModes[direction]=$('coverage-mode').value;renderCoverage();});
  for(const event of ['click','focusin'])$('coverage-table').addEventListener(event,e=>{const cell=e.target.closest('td[title]');if(cell)$('coverage-detail').textContent=cell.title;});
  $('coverage-table').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const cell=e.target.closest('td[title]');if(cell){e.preventDefault();$('coverage-detail').textContent=cell.title;}}});
  ['tailwind-mine','tailwind-theirs','trick-room'].forEach(id=>$(id).addEventListener('change',renderSpeed));
  ['move-pokemon','move-type','move-category'].forEach(id=>$(id).addEventListener('change',renderMoves));$('move-search').addEventListener('input',renderMoves);
  $('match-notes').maxLength=30000;$('match-notes').addEventListener('input',()=>{match().notes=$('match-notes').value;save();});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  $('editor-dialog').addEventListener('close',()=>activeMovePicker?.close());
  $('editor-form').addEventListener('submit',e=>{
    e.preventDefault();
    const candidate=readEditor();
    // An unfinished set is allowed, but never an invalid budget or duplicate/illegal move.
    const problems=C.setProblems(candidate,D).filter(p=>!p.includes('choose at least one move')&&!p.includes('not M-C legal'));
    if(problems.length){$('editor-error').textContent=problems.join(' ');return;}
    if(editTarget.side==='mine')state.mine[state.mine.findIndex(p=>p.uid===candidate.uid)]=candidate;
    else{
      const {uid,species,...prediction}=candidate;
      roster('theirs').find(p=>p.uid===uid).prediction=prediction;
    }
    commit();$('editor-dialog').close();toast(editTarget.side==='mine'?'Set saved.':'Opponent prediction saved.');
  });
  $('clear-prediction').addEventListener('click',()=>{
    if(editTarget?.side!=='theirs')return;
    delete roster('theirs').find(p=>p.uid===editTarget.uid).prediction;
    commit();$('editor-dialog').close();toast('Prediction cleared. Opponent set is unknown.');
  });
  $('remove-pokemon').addEventListener('click',()=>{if(editTarget)removePokemon(editTarget.side,editTarget.uid);});
  $('new-opponent').addEventListener('click',()=>opponentEditor(false));$('edit-opponent').addEventListener('click',()=>opponentEditor(true));
  $('opponent-form').addEventListener('submit',e=>{e.preventDefault();const name=$('opponent-name').value.trim();if(!name){$('opponent-name').focus();return;}const week=Number($('opponent-week').value);if(opponentEditing){match().name=name;match().week=week;}else{if(state.matches.length>=100){toast('The league limit is 100 matchups.');return;}const m=C.newMatch(name,week);m.mine.enabled=state.mine.map(p=>p.uid);state.matches.push(m);state.active=m.id;}commit();$('opponent-dialog').close();});
  $('delete-opponent').addEventListener('click',async()=>{if(!await confirmAction('Delete this matchup?','This removes the opponent’s draft, weekly selections, and notes. Your own draft stays saved.'))return;state.matches=state.matches.filter(m=>m.id!==state.active);if(!state.matches.length)state.matches=[C.newMatch()];state.active=state.matches[0].id;commit();$('opponent-dialog').close();});
  $('export').addEventListener('click',()=>{updateExport();$('export-dialog').showModal();});$('export-scope').addEventListener('change',updateExport);
  $('copy-export').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('export-text').value);toast('Team copied for Showdown or PokéPaste.');}catch(e){$('export-text').focus();$('export-text').select();toast('Press Ctrl+C (or ⌘C) to copy the selected team.');}});
  $('download-export').addEventListener('click',()=>download('draft-team.txt',$('export-text').value,'text/plain;charset=utf-8'));
  $('backup').addEventListener('click',()=>download('draft-lab-backup.json',JSON.stringify(state,null,2),'application/json'));
  $('restore').addEventListener('click',()=>$('backup-file').click());
  $('backup-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw new Error('Backup is too large (2 MB maximum).');const imported=C.validateLeague(JSON.parse(await file.text()),D);if(await confirmAction('Restore this league?',`Replace the current league with ${imported.mine.length} drafted Pokémon and ${imported.matches.length} matchups? Download a backup first if you want to keep the current league.`)){state=imported;commit();toast('League restored.');}}catch(err){toast(err.message||'Could not read this backup.');}e.target.value='';});
  $('load-demo').addEventListener('click',async()=>{if((state.mine.length||state.matches.some(m=>m.roster.length))&&!await confirmAction('Load example league?','This replaces your saved league. Download a backup first if you want to keep it.'))return;state=demo();commit();toast('Example league loaded. Edit the drafts to make it yours.');});
  $('move-type').innerHTML+=D.types.map(t=>option(t,t)).join('');
  $('legal-count').textContent=Object.values(D.species).filter(s=>s.legal).length+' species / forms';
  const generated=new Date(D.meta.generated).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'America/Los_Angeles'});
  $('data-provenance').textContent=`Pokémon Showdown snapshot: ${generated}. Format: ${D.meta.name}. Source revision: ${D.meta.revision}. The snapshot is bundled with the page so a remote API outage cannot interrupt preparation.`;
  speciesOptions();render();
  if(storageError){$('save-status').textContent='Saved league could not be read — restore a backup';$('save-status').classList.add('unsaved');toast(storageError);}
})();
