/* Run with Node 22+: node scripts/update-pokemon-data.cjs /path/to/built/pokemon-showdown [source-revision]
 * Uses Showdown's actual format validator, not a manually maintained Pokémon list.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || '.preview/pokemon-showdown');
const {Dex} = require(path.join(root, 'dist/sim/dex.js'));
const {TeamValidator} = require(path.join(root, 'dist/sim/team-validator.js'));
const format = 'gen9championsvgc2026regmc';
const validator = new TeamValidator(format);
const dex = validator.dex;
if (dex.currentMod !== 'champions' || !validator.format.exists) throw new Error('This Showdown checkout must support Champions Reg M-C.');
const moveText = dex.loadTextData().Moves;
const species = {};
const moves = {};
for (const s of dex.species.all()) {
  if (s.num <= 0 || s.gen > 9 || s.isCosmeticForme || (s.battleOnly && !s.isMega)) continue;
  const base = s.isMega ? dex.species.get(s.baseSpecies) : s;
  const reason = validator.checkSpecies({name:s.name, species:base.name, ability:s.abilities['0'], item:s.requiredItem || ''}, base, s, {});
  let learnset = [];
  // Champions deliberately doesn't inherit pre-evolution moves. The Dex and validator implement that rule.
  if (!s.isNonstandard && !reason) {
    learnset = [...dex.species.getMovePool(s.id)].filter(id => {
      const m = dex.moves.get(id);
      return !m.isNonstandard && !validator.checkCanLearn(m, s, undefined, {level:50});
    }).sort();
  }
  species[s.id] = {id:s.id, name:s.name, base:s.baseSpecies, types:s.types, stats:s.baseStats,
    abilities:Object.values(s.abilities).filter((a, i, all) => all.indexOf(a) === i),
    requiredItem:s.requiredItem || '', exportSpecies:base.name, mega:!!s.isMega, sprite:s.spriteid,
    legal:!reason && !s.isNonstandard, reason:reason || (s.isNonstandard ? 'Unavailable in Champions M-C.' : ''), moves:learnset};
}
for (const m of dex.moves.all()) {
  if (m.isNonstandard || m.isZ || m.isMax || !m.exists) continue;
  moves[m.id] = {id:m.id, name:m.name, type:m.type, category:m.category, power:m.basePower,
    accuracy:m.accuracy, pp:Math.min(20,m.pp), priority:m.priority, target:m.target,
    description:moveText[m.id]?.shortDesc || moveText[m.id]?.desc || '',
    fullDescription:moveText[m.id]?.desc || moveText[m.id]?.shortDesc || '', fixed:!!(m.damage || m.damageCallback)};
}
const chart = {};
const types = dex.types.all().filter(t => t.name !== 'Stellar' && t.name !== '???').map(t => t.name);
for (const attack of types) {
  chart[attack] = {};
  for (const defend of types) {
    chart[attack][defend] = [1,2,.5,0][dex.types.get(defend).damageTaken[attack] || 0];
  }
}
const natures = Object.fromEntries(dex.natures.all().map(n => [n.name, {plus:n.plus || '',minus:n.minus || ''}]));
const items = dex.items.all().filter(i => !i.isNonstandard && i.exists).map(i => ({name:i.name,description:i.shortDesc || i.desc || ''}));
const abilities = Object.fromEntries(dex.abilities.all().map(a => [a.name,a.shortDesc || a.desc || '']));
const data = {meta:{format, name:validator.format.name, revision:process.argv[3] || 'local checkout',
  generated:new Date().toISOString(), source:'https://github.com/smogon/pokemon-showdown',
  mod:dex.currentMod, pointLimit:validator.ruleTable.evLimit},types,chart,natures,items,abilities,species,moves};
const output = path.resolve(__dirname,'../data');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'champions.js'), '/* Pokémon Showdown data, MIT. See SHOWDOWN-LICENSE.txt. Generated; use scripts/update-pokemon-data.cjs. */\nwindow.DraftData = ' + JSON.stringify(data) + ';\n');
fs.copyFileSync(path.join(root,'LICENSE'),path.join(output,'SHOWDOWN-LICENSE.txt'));
console.log(`${Object.values(species).filter(s=>s.legal).length} legal species/forms; ${Object.keys(moves).length} moves; ${data.meta.pointLimit} stat points.`);
