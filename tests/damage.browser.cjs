const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const {chooseMove}=require('./helpers/moves.cjs');
const base=process.env.DRAFT_BASE_URL||'http://127.0.0.1:4173/pokemon-draft/';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:process.platform==='win32'?{channel:'msedge'}:{channel:'chrome'})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},colorScheme:'dark'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://**/*',route=>route.abort());await page.goto(base);await page.locator('#tab-damage').click();
  assert.equal(await page.locator('#damage-error').textContent(),'');
  assert.equal(await page.locator('#damage-attacker-species').inputValue(),'garchomp');assert.equal(await page.locator('#damage-defender-species').inputValue(),'milotic');
  assert.ok((await page.locator('#damage-results').textContent()).includes('76–91 HP damage'),'standalone calculation works before any roster exists');
  assert.equal(await page.locator('#damage-attacker-stat-atk').textContent(),'182');
  assert.equal(await page.locator('#analysis-scope').isVisible(),false,'unrelated chart scope is hidden for the independent calculator');
  await page.locator('#damage-attacker-point-atk').fill('33');assert.ok((await page.locator('#damage-error').textContent()).includes('0–32'));assert.equal(await page.locator('#damage-results .damage-result-card').count(),0,'invalid inputs do not leave stale damage results');
  await page.locator('#damage-attacker-point-atk').fill('32');assert.equal(await page.locator('#damage-error').textContent(),'');
  await page.locator('#damage-defender-point-def').fill('32');assert.ok((await page.locator('#damage-results').textContent()).includes('58–70 HP damage'),'custom defense points alter normal damage');
  await page.locator('[data-damage-mode=range]').click();
  assert.equal(await page.locator('.damage-result-cards .damage-result-card').count(),3);
  const profiles=await page.locator('.damage-result-cards .damage-result-card').allTextContents();
  assert.ok(profiles[0].includes('2 HP / 0 Def / 0 SpD')&&profiles[0].includes('76–91 HP damage'));
  assert.ok(profiles[1].includes('32 HP / 0 Def / 0 SpD')&&profiles[1].includes('76–91 HP damage'));
  assert.ok(profiles[2].includes('32 HP / 32 Def')&&profiles[2].includes('58–70 HP damage'));
  assert.equal(await page.locator('#damage-defender-point-def').isDisabled(),true);
  assert.equal(await page.locator('.damage-range-band').count(),3,'bulk comparison has one range per benchmark');
  if(process.env.DRAFT_SCREENSHOT_DIR){fs.mkdirSync(process.env.DRAFT_SCREENSHOT_DIR,{recursive:true});await page.locator('#damage-results').screenshot({path:path.join(process.env.DRAFT_SCREENSHOT_DIR,'bulk-comparison.png')});}
  await page.locator('[data-damage-mode=standard]').click();assert.equal(await page.locator('#damage-defender-point-def').inputValue(),'32','custom inputs survive a mode switch');
  assert.equal(await page.locator('#damage-defender-point-def').isDisabled(),false);
  await page.locator('#damage-defender-point-def').fill('0');await page.locator('#damage-spread').uncheck();
  assert.ok(!(await page.locator('#damage-results').textContent()).includes('76–91 HP damage'),'single-target spread setting changes damage');
  await page.locator('#damage-spread').check();await page.locator('#damage-reflect').check();
  assert.ok(!(await page.locator('#damage-results').textContent()).includes('76–91 HP damage'),'Reflect changes physical damage');await page.locator('#damage-reflect').uncheck();
  await page.locator('#damage-attacker-species').selectOption('milotic');await page.locator('#damage-attacker-point-spa').fill('32');await page.locator('#damage-attacker-nature').selectOption('Modest');
  await page.locator('#damage-defender-species').selectOption('garchomp');await page.locator('#damage-move').selectOption('hydropump');await page.locator('[data-damage-mode=range]').click();
  assert.ok((await page.locator('.damage-result-cards .damage-result-card').nth(2).textContent()).includes('32 HP / 32 SpD'),'special move uses SpD bulk');
  await page.locator('#damage-attacker-species').selectOption('gardevoir');await page.locator('#damage-move').selectOption('psyshock');
  assert.ok((await page.locator('.damage-result-cards .damage-result-card').nth(2).textContent()).includes('32 HP / 32 Def'),'Psyshock uses Def rather than its Special category');
  await page.locator('[data-damage-mode=standard]').click();await page.locator('#damage-attacker-species').selectOption('garchomp');await page.locator('#damage-move').selectOption('protect');
  assert.ok((await page.locator('#damage-results').textContent()).includes('does not directly deal damage'));
  // Loading a roster or prediction copies its fields into the calculator.
  await page.locator('#my-search').fill('Garchomp');await page.locator('#my-search').press('Enter');await page.locator('#my-roster [data-edit]').click();
  await page.locator('#set-nature').selectOption('Jolly');await page.locator('#point-atk').fill('32');await page.locator('#point-spe').fill('32');await page.locator('#point-hp').fill('2');await chooseMove(page,0,'earthquake');await chooseMove(page,1,'protect');await page.locator('#editor-form [type=submit]').click();
  await page.locator('#their-search').fill('Milotic');await page.locator('#their-search').press('Enter');await page.locator('#their-roster [data-edit]').click();
  await page.locator('#set-nature').selectOption('Calm');await page.locator('#set-item').selectOption('Sitrus Berry');await page.locator('#point-hp').fill('32');await page.locator('#point-spd').fill('32');await chooseMove(page,0,'hydropump');await page.locator('#editor-form [type=submit]').click();
  const league=await page.evaluate(()=>JSON.parse(localStorage.getItem('noah-draft-lab-v1'))),match=league.matches.find(m=>m.id===league.active);
  await page.locator('#damage-attacker-source').selectOption('mine:'+league.mine[0].uid);await page.locator('#damage-defender-source').selectOption('theirs:'+match.roster[0].uid);
  assert.equal(await page.locator('#damage-attacker-point-atk').inputValue(),'32');assert.equal(await page.locator('#damage-attacker-nature').inputValue(),'Jolly');
  assert.equal(await page.locator('#damage-defender-nature').inputValue(),'Calm');assert.equal(await page.locator('#damage-defender-point-spd').inputValue(),'32');assert.equal(await page.locator('#damage-defender-item').inputValue(),'Sitrus Berry');
  await page.locator('#damage-attacker-point-atk').fill('16');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('noah-draft-lab-v1'))),league,'calculator edits do not change saved league sets');
  await page.locator('#damage-swap').click();assert.equal(await page.locator('#damage-attacker-species').inputValue(),'milotic');assert.equal(await page.locator('#damage-move').inputValue(),'hydropump','swap brings the new attacker saved move');
  await page.locator('[data-damage-mode=range]').click();
  for(const width of [320,390,800,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no calculator overflow at '+width+'px');}
  await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');assert.equal(await page.locator('#damage-error').textContent(),'');
  assert.deepEqual(errors,[]);
  console.log('Damage calculator browser workflow passed: editable Champions spreads, exact bulk benchmarks, exceptions, field effects, set/prediction loading, independent edits, modes, themes, and responsive layout.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
