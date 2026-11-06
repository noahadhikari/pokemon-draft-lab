/* Bundle a pinned Smogon damage-calc checkout: node scripts/build-damage-engine.cjs /path/to/source COMMIT_SHA */
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const source=path.resolve(process.argv[2]||''),revision=process.argv[3];
if(!revision||!/^[a-f0-9]{40}$/.test(revision))throw new Error('Pass the full source commit SHA.');
if(!fs.existsSync(path.join(source,'calc/src/mechanics/champions.ts')))throw new Error('This damage engine must include Champions mechanics.');
const out=path.resolve(__dirname,'../vendor');fs.mkdirSync(out,{recursive:true});
esbuild.buildSync({stdin:{contents:"export {calculate,Pokemon,Move,Field,Stats} from './adaptable'; export {Generations} from './data';",resolveDir:path.join(source,'calc/src'),sourcefile:'draft-damage-entry.ts',loader:'ts'},bundle:true,platform:'browser',format:'iife',globalName:'SmogonDamage',outfile:path.join(out,'smogon-calc.js'),minify:true,target:'es2020',legalComments:'eof',banner:{js:'/* Smogon damage-calc, MIT. Revision '+revision+'. See SMOGON-CALC-LICENSE.txt. */'}});
fs.copyFileSync(path.join(source,'LICENSE'),path.join(out,'SMOGON-CALC-LICENSE.txt'));
fs.writeFileSync(path.join(out,'smogon-calc-source.json'),JSON.stringify({name:'@smogon/calc',source:'https://github.com/smogon/damage-calc',revision,generation:'Champions (0)',generated:new Date().toISOString()},null,2)+'\n');
console.log('Bundled Champions damage engine ('+fs.statSync(path.join(out,'smogon-calc.js')).size+' bytes).');
