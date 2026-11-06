/* Run with the local preview running: node tests/roster.browser.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const base=process.env.DRAFT_BASE_URL||'http://127.0.0.1:4173/pokemon-draft/';
const read=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('noah-draft-lab-v1')));
const order=(page,side)=>page.locator('#'+(side==='mine'?'my':'their')+'-roster .pokemon-card').evaluateAll(cards=>cards.map(card=>card.dataset.uid));
const card=(page,side,uid)=>page.locator('#'+(side==='mine'?'my':'their')+'-roster .pokemon-card[data-uid="'+uid+'"]');
async function drag(page,side,uid,targetSide,targetUid,after=true,cancel=false){
 const handle=card(page,side,uid).locator('[data-reorder]'),target=card(page,targetSide,targetUid);
 await target.scrollIntoViewIfNeeded();await handle.scrollIntoViewIfNeeded();
 const a=await handle.boundingBox(),b=await target.boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
 await page.mouse.move(b.x+b.width/2,b.y+b.height*(after?.75:.25),{steps:8});
 if(cancel)await page.keyboard.press('Escape');
 await page.mouse.up();
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:process.platform==='win32'?{channel:'msedge'}:{channel:'chrome'})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://play.pokemonshowdown.com/sprites/**',route=>route.abort());
  await page.goto(base);await page.locator('#load-demo').click();
  const original=await read(page),mine=original.mine.map(p=>p.uid),current=original.matches.find(m=>m.id===original.active);
  await drag(page,'mine',mine[0],'mine',mine[2]);
  const moved=[mine[1],mine[2],mine[0],...mine.slice(3)];
  assert.deepEqual(await order(page,'mine'),moved,'drag downward places the card after its target');
  const afterDrag=await read(page);
  assert.deepEqual(afterDrag.matches,original.matches,'reordering does not change selections, opponents, or notes');
  assert.deepEqual([...afterDrag.mine].sort((a,b)=>a.uid.localeCompare(b.uid)),[...original.mine].sort((a,b)=>a.uid.localeCompare(b.uid)),'sets are preserved');
  await page.locator('#export').click();
  const firstName=await page.evaluate(id=>window.DraftData.species[id].exportSpecies,original.mine[1].species);
  assert.ok((await page.locator('#export-text').inputValue()).startsWith(firstName),'export follows roster order');
  await page.locator('[data-close=export-dialog]').click();
  assert.ok((await page.locator('#coverage-table tbody th').first().textContent()).startsWith(firstName),'coverage follows roster order');
  await page.reload();assert.deepEqual(await order(page,'mine'),moved,'order survives reload');
  await drag(page,'mine',mine[0],'mine',mine[1],false);
  assert.deepEqual(await order(page,'mine'),mine,'drag upward inserts before its target');
  const theirs=current.roster.map(p=>p.uid);
  await drag(page,'mine',mine[0],'theirs',theirs[0]);
  assert.deepEqual(await order(page,'mine'),mine,'cards cannot be dragged into the other team');
  assert.deepEqual(await order(page,'theirs'),theirs);
  await drag(page,'mine',mine[0],'mine',mine[2],true,true);
  assert.deepEqual(await order(page,'mine'),mine,'Escape cancels a drag');
  assert.equal(await page.locator('.is-dragging,[data-drop]').count(),0,'drag decorations are cleared');
  let handle=card(page,'mine',mine[0]).locator('[data-reorder]');
  await handle.focus();await page.keyboard.press('ArrowDown');
  assert.deepEqual((await order(page,'mine')).slice(0,2),[mine[1],mine[0]],'keyboard moves one position');
  assert.equal(await page.locator(':focus').getAttribute('data-reorder'),mine[0],'focus stays on the moved handle');
  await page.keyboard.press('Home');assert.deepEqual(await order(page,'mine'),mine);
  await page.keyboard.press('End');assert.equal((await order(page,'mine')).at(-1),mine[0]);
  await page.keyboard.press('ArrowDown');assert.equal((await order(page,'mine')).at(-1),mine[0],'boundary move does not change order');
  await page.keyboard.press('Home');
  await drag(page,'theirs',theirs[0],'theirs',theirs[2]);
  const theirMoved=[theirs[1],theirs[2],theirs[0],...theirs.slice(3)];
  assert.deepEqual(await order(page,'theirs'),theirMoved,'opponent draft can be reordered');
  const other=original.matches.find(m=>m.id!==original.active);
  await page.locator('#opponent-select').selectOption(other.id);
  assert.deepEqual(await order(page,'theirs'),other.roster.map(p=>p.uid),'other opponents keep their own order');
  assert.deepEqual(await order(page,'mine'),mine,'own order is shared across opponents');
  await page.locator('#opponent-select').selectOption(original.active);
  assert.deepEqual(await order(page,'theirs'),theirMoved);
  // Delete without opening the set builder; cancellation must keep all data.
  await card(page,'mine',mine[0]).locator('[data-delete]').click();
  assert.equal(await page.locator('#editor-dialog').isVisible(),false);
  await page.locator('#confirm-dialog [value=cancel]').click();assert.deepEqual(await order(page,'mine'),mine);
  await card(page,'mine',mine[0]).locator('[data-delete]').click();await page.locator('#confirm-dialog [value=confirm]').click();
  await card(page,'mine',mine[0]).waitFor({state:'detached'});
  const afterDelete=await read(page);
  assert.ok(!afterDelete.mine.some(p=>p.uid===mine[0]));
  for(const m of afterDelete.matches)for(const key of ['enabled','bring','battle'])assert.ok(!m.mine[key].includes(mine[0]),'delete clears own picks in every week');
  assert.deepEqual(await order(page,'mine'),mine.slice(1));
  assert.deepEqual(await order(page,'theirs'),theirMoved,'own deletion leaves the opponent alone');
  await card(page,'theirs',theirs[0]).locator('[data-delete]').click();await page.locator('#confirm-dialog [value=confirm]').click();
  await card(page,'theirs',theirs[0]).waitFor({state:'detached'});
  const afterTheirDelete=await read(page),active=afterTheirDelete.matches.find(m=>m.id===original.active);
  assert.ok(!active.roster.some(p=>p.uid===theirs[0]));for(const key of ['enabled','bring','battle'])assert.ok(!active.theirs[key].includes(theirs[0]));
  assert.deepEqual(afterTheirDelete.matches.find(m=>m.id===other.id),afterDelete.matches.find(m=>m.id===other.id),'opponent deletion stays within the active matchup');
  await page.reload();assert.deepEqual(await order(page,'mine'),mine.slice(1),'deletion survives reload');
  // Keep the existing delete control inside the editor functional too.
  await card(page,'mine',mine[1]).locator('[data-edit]').click();await page.locator('#remove-pokemon').click();await page.locator('#confirm-dialog [value=confirm]').click();
  await card(page,'mine',mine[1]).waitFor({state:'detached'});
  assert.equal(await page.locator('#editor-dialog').isVisible(),false);assert.ok(!(await order(page,'mine')).includes(mine[1]));
  assert.deepEqual(errors,[],'desktop has no runtime errors');
  // Exercise real touch input, rather than synthesizing DOM drag events.
  const mobileContext=await browser.newContext({viewport:{width:390,height:1000},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const mobile=await mobileContext.newPage();mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.route('https://play.pokemonshowdown.com/sprites/**',route=>route.abort());
  await mobile.goto(base);await mobile.locator('#load-demo').click();
  const mobileOrder=await order(mobile,'mine'),source=card(mobile,'mine',mobileOrder[0]).locator('[data-reorder]'),destination=card(mobile,'mine',mobileOrder[1]);
  await destination.scrollIntoViewIfNeeded();await source.scrollIntoViewIfNeeded();
  const a=await source.boundingBox(),b=await destination.boundingBox(),session=await mobileContext.newCDPSession(mobile);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
  for(let step=1;step<=8;step++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(b.x+b.width/2-a.x-a.width/2)*step/8,y:a.y+a.height/2+(b.y+b.height*.75-a.y-a.height/2)*step/8}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.deepEqual((await order(mobile,'mine')).slice(0,2),[mobileOrder[1],mobileOrder[0]],'touch drag reorders the team');
  for(const width of [320,390,800,1440]){
   await mobile.setViewportSize({width,height:1000});
   assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width+'px');
   assert.ok(await mobile.locator('.pokemon-card').evaluateAll(cards=>cards.every(card=>card.scrollWidth<=card.clientWidth+1)),'roster controls fit at '+width+'px');
  }
  if(process.env.DRAFT_SCREENSHOT_DIR){
   fs.mkdirSync(process.env.DRAFT_SCREENSHOT_DIR,{recursive:true});
   for(const width of [390,1440]){await mobile.setViewportSize({width,height:1000});await mobile.locator('#my-roster .pokemon-card').first().screenshot({path:path.join(process.env.DRAFT_SCREENSHOT_DIR,'roster-'+width+'.png')});}
  }
  await mobile.setViewportSize({width:390,height:1000});
  const beforePicker=await mobile.locator('#my-roster .pokemon-card').count();
  await mobile.locator('#my-search').fill('Venus');await mobile.locator('#mine-suggestions [data-add-species=venusaur]').tap();
  assert.equal(await mobile.locator('#my-roster .pokemon-card').count(),beforePicker+1,'one tap adds a suggestion on mobile');
  assert.equal(await mobile.locator('#my-search').inputValue(),'');
  assert.deepEqual(errors,[],'touch has no runtime errors');await mobileContext.close();
  console.log('Roster controls passed: mouse/touch/keyboard ordering, cancellation, team boundaries, persistence, export/chart order, direct and editor deletion, selection cleanup, and responsive layout.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
