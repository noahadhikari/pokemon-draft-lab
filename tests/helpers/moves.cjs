/* Drive the real move picker; fall back to the native select on older browsers. */
exports.chooseMove=async function chooseMove(page,slot,id){
 const trigger=page.locator('#set-move-trigger-'+slot);
 if(!await trigger.count()){await page.locator('#set-move-'+slot).selectOption(id);return;}
 await trigger.click();
 if(!id){await page.locator('#move-menu-'+slot+' .clear-move').click();return;}
 const name=await page.evaluate(move=>window.DraftData.moves[move]?.name,id);
 if(!name)throw new Error('Unknown move: '+id);
 await page.locator('#move-query-'+slot).fill(name);
 await page.locator('#move-option-'+slot+'-'+id).click();
};
