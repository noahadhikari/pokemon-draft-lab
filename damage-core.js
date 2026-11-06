/* Champions damage adapter. The battle formula comes from the bundled Smogon engine. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DraftDamage=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const stats=['hp','atk','def','spa','spd','spe'];
 const zeros=()=>Object.fromEntries(stats.map(stat=>[stat,0]));
 const toID=value=>String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
 function create(data,engine){
  if(!engine?.Generations)throw new Error('The local damage engine could not be loaded.');
  const generation=engine.Generations.get(0);
  const legalItems=new Set(data.items.map(item=>item.name));
  const aliases={aegislash:'Aegislash-Shield'};
  function defaultUnit(species){
   const s=data.species[species];if(!s)throw new Error('Choose a Pokémon.');
   return {species,item:s.requiredItem||'',ability:s.abilities[0],nature:'Hardy',points:zeros(),boosts:zeros(),status:'',hpPercent:100,abilityOn:false,moves:[]};
  }
  function importUnit(pokemon){
   const result=defaultUnit(pokemon.species),set=pokemon.prediction||pokemon;
   for(const key of ['item','ability','nature'])if(typeof set[key]==='string')result[key]=set[key];
   if(set.points)result.points={...set.points};if(Array.isArray(set.moves))result.moves=set.moves.slice(0,4);
   return result;
  }
  function validateUnit(unit,label){
   const s=data.species[unit.species];if(!s?.legal)throw new Error(label+': choose an M-C legal Pokémon.');
   if(!Object.prototype.hasOwnProperty.call(data.natures,unit.nature))throw new Error(label+': choose a nature.');
   if(!s.abilities.includes(unit.ability))throw new Error(label+': choose an ability available to this Pokémon.');
   if(unit.item&&!legalItems.has(unit.item))throw new Error(label+': choose an M-C item.');
   if(stats.some(stat=>!Number.isInteger(unit.points[stat])||unit.points[stat]<0||unit.points[stat]>32))throw new Error(label+': each stat needs 0–32 whole stat points.');
   if(stats.reduce((sum,stat)=>sum+unit.points[stat],0)>66)throw new Error(label+': the total stat-point budget is 66.');
   if(stats.some(stat=>!Number.isInteger(unit.boosts[stat])||unit.boosts[stat]<-6||unit.boosts[stat]>6))throw new Error(label+': stat stages must be whole numbers from −6 to +6.');
   if(!Number.isFinite(unit.hpPercent)||unit.hpPercent<1||unit.hpPercent>100)throw new Error(label+': current HP must be between 1% and 100%.');
   if(!['','brn','par','psn','tox','slp','frz'].includes(unit.status))throw new Error(label+': choose a valid status.');
  }
  function makePokemon(unit,label='Pokémon'){
   validateUnit(unit,label);const s=data.species[unit.species],name=aliases[s.id]||s.name;
   if(!generation.species.get(toID(name)))throw new Error(s.name+' is not available in the bundled Champions damage engine.');
   const pokemon=new engine.Pokemon(generation,name,{level:50,evs:{...unit.points},boosts:{...unit.boosts},nature:unit.nature,ability:unit.ability,abilityOn:!!unit.abilityOn,item:unit.item,status:unit.status,overrides:{baseStats:{...s.stats},types:[...s.types]}});
   pokemon.originalCurHP=Math.max(1,Math.floor(pokemon.maxHP()*unit.hpPercent/100));return pokemon;
  }
  function preview(unit){return {...makePokemon(unit).rawStats};}
  function run(config,defenderPoints){
   const defenderUnit=defenderPoints?{...config.defender,points:{...defenderPoints}}:config.defender;
   const attacker=makePokemon(config.attacker,'Attacker'),defender=makePokemon(defenderUnit,'Defender');
   const m=data.moves[config.move];if(!m)throw new Error('Choose a move.');
   if(!data.species[config.attacker.species].moves.includes(m.id))throw new Error('The attacker cannot learn this move in Champions M-C.');
   if(['counter','mirrorcoat','metalburst','comeuppance','bide','endeavor','fissure','guillotine','horndrill','sheercold','superfang','naturesmadness','ruination'].includes(m.id))throw new Error(m.name+' requires context or a damage rule not exposed by this calculator. Choose another move.');
   const known=generation.moves.get(m.id);
   // The planner's pinned move data supplies numeric attributes; retain engine-specific flags and mechanics.
   const overrides={basePower:m.power,type:m.type,category:m.category,target:m.target};
   if(!known){if(m.id==='pound')overrides.flags={contact:1};else if(m.category==='Status')overrides.flags={};else throw new Error(m.name+' is not supported by the bundled Champions engine.');}
   if(config.field.spread===false&&['allAdjacent','allAdjacentFoes'].includes(m.target))overrides.target='normal';
   const options={ability:attacker.ability,item:attacker.item,species:attacker.name,isCrit:!!config.field.critical,overrides};
   if(config.field.hits){if(!Number.isInteger(config.field.hits)||config.field.hits<1||config.field.hits>10)throw new Error('Hit count must be 1–10.');options.hits=config.field.hits;}
   const move=new engine.Move(generation,m.name,options);
   const field=new engine.Field({gameType:'Doubles',weather:config.field.weather||undefined,terrain:config.field.terrain||undefined,isGravity:!!config.field.gravity,attackerSide:{isHelpingHand:!!config.field.helpingHand},defenderSide:{isReflect:!!config.field.reflect,isLightScreen:!!config.field.lightScreen,isAuroraVeil:!!config.field.auroraVeil,isFriendGuard:!!config.field.friendGuard,isProtected:!!config.field.protect}});
   const result=engine.calculate(generation,attacker,defender,move,field),range=result.range();
   if(range.some(value=>!Number.isFinite(value)||value<0))throw new Error('This move could not be resolved under the selected conditions.');
   const hp=defender.maxHP(),currentHP=defender.curHP();
   let description='';try{description=result.fullDesc('%',false).split(' -- ')[0];}catch{description=data.species[config.attacker.species].name+' '+m.name+' into '+data.species[config.defender.species].name;}
   const damage=result.damage;
   const rolls=Array.isArray(damage)&&damage.length===16&&damage.every(value=>typeof value==='number')?[...damage]:typeof damage==='number'?[damage]:null;
   const defenseStat=result.move.overrideDefensiveStat||((result.move.category==='Physical')?'def':'spd');
   return {min:range[0],max:range[1],minPercent:range[0]*100/hp,maxPercent:range[1]*100/hp,hp,currentHP,defenseStat,defense:result.defender.rawStats[defenseStat],category:result.move.category,points:{...defenderUnit.points},attackerStats:{...attacker.rawStats},defenderStats:{...defender.rawStats},rolls,hits:result.move.hits,description,statusMove:m.category==='Status',threshold:range[0]>=currentHP?'all':range[1]>=currentHP?'some':'none'};
  }
  function compare(config){
   const minimalPoints={...zeros(),hp:2},genericPoints={...zeros(),hp:32};
   const minimal=run(config,minimalPoints),generic=run(config,genericPoints);
   const relevant=minimal.defenseStat;
   let bulky=run(config,{...zeros(),hp:32,[relevant]:32});
   let adaptive=false;
   // Adaptive attacks can switch which defense they hit after investment. Keep the better legal benchmark.
   if(bulky.defenseStat!==relevant&&data.moves[config.move].category!=='Status'){
    const other=run(config,{...zeros(),hp:32,[relevant==='def'?'spd':'def']:32});
    if(other.maxPercent<bulky.maxPercent)bulky=other;adaptive=true;
   }
   const invested=bulky.points.def===32?'def':'spd';
   return {profiles:[{id:'minimal',name:'Minimal bulk',spread:'2 HP / 0 Def / 0 SpD',...minimal},{id:'generic',name:'Generic bulk',spread:'32 HP / 0 Def / 0 SpD',...generic},{id:'bulky',name:'Fully bulky',spread:'32 HP / 32 '+(invested==='def'?'Def':'SpD'),...bulky}],adaptive};
  }
  return {defaultUnit,importUnit,preview,run,compare,generation:0};
 }
 return {create,stats};
});
