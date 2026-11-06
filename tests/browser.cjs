const {chooseMove}=require('./helpers/moves.cjs');
/* npm run dev in another terminal, then npm run test:browser.
 * On Windows this uses installed Edge. Set PLAYWRIGHT_EXECUTABLE_PATH for another browser.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const base=process.env.DRAFT_BASE_URL||'http://127.0.0.1:4173/pokemon-draft/';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:process.platform==='win32'?{channel:'msedge'}:{channel:'chrome'})});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://play.pokemonshowdown.com/sprites/**',route=>route.abort());
 await page.goto(base);
 await page.locator('#my-search').fill('Garch');await page.locator('#mine-suggestions [data-add-species=garchomp]').click();
 assert.equal(await page.locator('#my-roster .pokemon-card').count(),1,'one suggestion click adds without a second submit');
 assert.equal(await page.locator('#my-search').inputValue(),'');assert.equal(await page.locator('#my-search').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator(':focus').getAttribute('id'),'my-search','search stays focused for the next addition');
 await page.locator('#my-search').fill('Milotic');await page.locator('#my-search').press('Enter');
 assert.equal(await page.locator('#my-roster .pokemon-card').count(),2,'Enter adds a typed name');
 await page.locator('#my-search').press('Enter');assert.equal(await page.locator('#my-roster .pokemon-card').count(),2,'a repeated Enter does not add another Pokémon');
 await page.locator('#my-search').fill('Rotom');await page.locator('#my-search').press('ArrowDown');
 const activeOption=await page.locator('#my-search').getAttribute('aria-activedescendant');
 const expectedSpecies=await page.locator('#'+activeOption).getAttribute('data-add-species');
 await page.locator('#my-search').press('Enter');
 assert.equal(await page.locator('#my-roster .pokemon-card').count(),3);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('noah-draft-lab-v1')).mine.at(-1).species),expectedSpecies,'Enter adds the keyboard-highlighted suggestion');
 await page.locator('#my-search').fill('Garchomp');await page.locator('#my-search').press('Enter');
 assert.equal(await page.locator('#my-roster .pokemon-card').count(),3,'an exact duplicate does not accidentally add a Mega form');
 await page.locator('#my-search').fill('DefinitelyNotAPokemon');await page.locator('#my-search').press('Enter');
 assert.equal(await page.locator('#my-roster .pokemon-card').count(),3,'invalid searches add nothing');
 await page.locator('#my-search').press('Escape');assert.equal(await page.locator('#my-search').getAttribute('aria-expanded'),'false');
 await page.locator('#their-search').fill('Venus');await page.locator('#theirs-suggestions [data-add-species=venusaur]').click();
 await page.locator('#their-search').fill('Incineroar');await page.locator('#their-search').press('Enter');
 assert.equal(await page.locator('#their-roster .pokemon-card').count(),2,'one-click and Enter also work for the opponent');
 assert.ok(await page.locator('#coverage-table tbody td').evaluateAll(cells=>cells.length>0&&cells.every(cell=>cell.textContent.trim()==='—')),'Pokémon without saved moves contribute no attacks');
 await page.locator('#my-search').fill('Gengar');await page.locator('#my-title').click();
 assert.equal(await page.locator('#my-roster .pokemon-card').count(),3,'leaving the field does not add a typed name');
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.locator('#load-demo').click();

 assert.ok(await page.locator('#my-roster .pokemon-card').count()>6,'supports draft rosters larger than six');
 assert.ok(await page.locator('#their-roster .pokemon-card').count()>=6,'opponent demo has a weekly six');
 assert.equal(await page.locator('#my-roster [data-pick=bring][aria-pressed=true]').count(),6);
 const allRows=await page.locator('#coverage-table tbody tr').count();
 await page.locator('#coverage-table td[title]').first().click();assert.ok((await page.locator('#coverage-detail').textContent()).includes('→'),'cell details work without hover');
 await page.locator('#my-roster [data-pick=enabled]').first().uncheck();
 assert.equal(await page.locator('#coverage-table tbody tr').count(),allRows-1,'analysis toggle updates coverage');
 await page.locator('#my-roster [data-pick=enabled]').first().check();
 await page.locator('#analysis-scope').selectOption('battle');
 assert.equal(await page.locator('#coverage-table tbody tr').count(),4,'battle subset is exactly four');
 await page.locator('#analysis-scope').selectOption('enabled');
 const originalOpponent=await page.locator('#opponent-select').inputValue();
 await page.locator('#match-notes').fill('A saved weekly plan');
 await page.locator('#new-opponent').click();await page.locator('#opponent-name').fill('Coach <b>literal</b>');
 await page.locator('#opponent-form [type=submit]').click();
 assert.equal(await page.locator('#their-roster .pokemon-card').count(),0,'new opponent has a separate draft');
 assert.ok((await page.locator('#their-title').textContent()).includes('<b>literal</b>'),'opponent names are escaped');
 assert.equal(await page.locator('#their-title b').count(),0);
 await page.locator('#their-search').fill('Venusaur');await page.locator('#add-theirs [type=submit]').click();
 assert.equal(await page.locator('#their-roster .pokemon-card').count(),1);
 await page.reload();assert.equal(await page.locator('#their-roster .pokemon-card').count(),1,'opponent draft survives reload');
 await page.locator('#opponent-select').selectOption(originalOpponent);
 assert.equal(await page.locator('#match-notes').inputValue(),'A saved weekly plan','notes stay with their opponent');
 await page.locator('#my-roster [data-pick=bring][aria-pressed=false]').first().click();
 assert.equal(await page.locator('#my-roster [data-pick=bring][aria-pressed=true]').count(),6,'weekly team cannot exceed six');
 const garchomp=page.locator('#my-roster .pokemon-card').filter({has:page.locator('.pokemon-name',{hasText:'Garchomp'})});
 await garchomp.locator('[data-edit]').click();await page.locator('#point-spe').fill('32');await page.locator('#set-nature').selectOption('Jolly');
 await chooseMove(page,0,'earthquake');await chooseMove(page,1,'protect');await chooseMove(page,2,'');await chooseMove(page,3,'');
 assert.equal(await page.locator('#stat-spe').textContent(),'169');
 await page.locator('#editor-form [type=submit]').click();assert.equal(await page.locator('#editor-dialog').isVisible(),false);
 assert.equal(await page.locator('#coverage-mode').inputValue(),'selected','my coverage defaults to active sets');
 assert.deepEqual(await page.locator('#coverage-mode option').evaluateAll(options=>options.map(o=>o.value)),['selected','selected-stab'],'own offense cannot use the whole learnset');
 const garchompCoverage=page.locator('#coverage-table tbody tr').filter({has:page.locator('th',{hasText:'Garchomp'})});
 assert.equal((await garchompCoverage.locator('td').first().textContent()).trim(),'0×','Earthquake cannot hit Pelipper');
 await garchomp.locator('[data-edit]').click();await chooseMove(page,0,'firefang');await page.locator('#editor-form [type=submit]').click();
 assert.equal((await garchompCoverage.locator('td').first().textContent()).trim(),'½×','saved move edits immediately update coverage');
 await page.locator('#coverage-mode').selectOption('selected-stab');
 assert.equal((await garchompCoverage.locator('td').first().textContent()).trim(),'—','STAB view does not invent unselected STAB moves');
 await page.locator('[data-direction=theirs]').click();assert.equal(await page.locator('#coverage-mode').inputValue(),'learnable');
 await page.locator('[data-direction=mine]').click();assert.equal(await page.locator('#coverage-mode').inputValue(),'selected-stab','direction switches preserve the active-set view');
 await page.locator('#coverage-mode').selectOption('selected');
 await garchomp.locator('[data-edit]').click();await chooseMove(page,0,'earthquake');await page.locator('#editor-form [type=submit]').click();

 await page.locator('[data-direction=theirs]').click();assert.equal(await page.locator('#coverage-mode').inputValue(),'learnable','closed sheet never uses fabricated selected moves');
 await page.locator('[data-direction=mine]').click();
 await page.locator('#tab-defense').click();await page.locator('#defense-view').selectOption('types');assert.equal(await page.locator('#defense-table tbody tr').count(),18);
 await page.locator('#tab-speed').click();assert.ok(await page.locator('.speed-row').count()>6);await page.locator('#tailwind-mine').check();await page.locator('#trick-room').check();
 await page.locator('#tab-moves').click();await page.locator('#move-search').fill('protect');assert.ok(await page.locator('#move-table tbody tr').count()>0);
 await page.locator('#export').click();assert.match(await page.locator('#export-text').inputValue(),/- Earthquake/);
 assert.match(await page.locator('#export-text').inputValue(),/32 Spe/);await page.locator('[data-close=export-dialog]').click();
 const backup=await page.evaluate(()=>JSON.parse(localStorage.getItem('noah-draft-lab-v1')));
 await page.locator('#restore').click();await page.locator('#backup-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('#confirm-dialog [value=confirm]').click();assert.ok(await page.locator('#my-roster .pokemon-card').count()>6);
 await page.locator('#tab-coverage').click();
 for(const size of [{width:1440,height:1100},{width:390,height:844}]){
  await page.setViewportSize(size);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'page has no horizontal overflow at '+size.width+'px');
  if(process.env.DRAFT_SCREENSHOT_DIR){fs.mkdirSync(process.env.DRAFT_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.DRAFT_SCREENSHOT_DIR,`draft-${size.width}.png`),fullPage:true});}
 }
 const megaNames=await page.evaluate(()=>Object.keys(window.DraftSpriteOverrides).map(id=>window.DraftData.species[id].name));
 for(const name of megaNames){await page.locator('#my-search').fill(name);await page.locator('#add-mine [type=submit]').click();}
 assert.equal(await page.locator('#my-roster img.pokemon-artwork').count(),11,'only the missing Mega forms use local artwork');
 for(const image of await page.locator('#my-roster img.pokemon-artwork').all())await image.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>[...document.querySelectorAll('#my-roster img.pokemon-artwork')].every(image=>image.complete&&image.naturalWidth>0));
 console.log('All 11 Mega sprite fallbacks rendered with remote sprites blocked.');
 assert.deepEqual(errors,[],'no browser runtime errors');
 console.log('Browser workflow passed: rosters, six/four limits, coverage, speed, moves, sets, persistence, closed sheet, export, backups, desktop and mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
