/* Refresh the small local fallback set for Mega forms absent from Showdown's gen5 folder. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data/champions.js'),'utf8'),context);
const ids=['barbaraclemega','dragalgemega','eelektrossmega','falinksmega','malamarmega','pyroarmega','raichumegax','raichumegay','scolipedemega','scraftymega','staraptormega'];
const output=path.join(root,'assets/mega-sprites');fs.mkdirSync(output,{recursive:true});
const png=Buffer.from([137,80,78,71,13,10,26,10]);
(async()=>{
 const sources={},overrides={};
 for(const id of ids){
  const s=context.window.DraftData.species[id];
  const sourceName='s'+s.sprite.replace(/mega([xyz])$/,'mega_$1').replace('-','-o')+'.png';
  const source='https://raw.githubusercontent.com/smogon/sprites/master/src/champions/'+sourceName;
  const response=await fetch(source,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Could not load '+s.name+': '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.subarray(0,8).equals(png))throw new Error('Not a PNG: '+s.name);
  fs.writeFileSync(path.join(output,id+'.png'),bytes);sources[id]={name:s.name,source};overrides[id]='assets/mega-sprites/'+id+'.png';
  console.log('Added '+s.name);
 }
 fs.writeFileSync(path.join(output,'sources.json'),JSON.stringify({provider:'Pokémon Showdown / Smogon sprite contributors',credits:'https://github.com/smogon/sprites',sprites:sources},null,2)+'\n');
 fs.writeFileSync(path.join(root,'data/mega-sprites.js'),'/* Mega-form artwork fallbacks. Sources: assets/mega-sprites/sources.json */\nwindow.DraftSpriteOverrides = '+JSON.stringify(overrides,null,2)+';\n');
 console.log('Updated '+ids.length+' Mega sprite fallbacks.');
})().catch(error=>{console.error(error);process.exitCode=1;});