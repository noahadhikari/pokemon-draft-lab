# Champions Draft Lab

A static VGC draft league planner for Pokémon Champions Regulation M-C. The source, bundled game data, development scripts, and tests live together in this folder. There is no backend or runtime API requirement.

The intended public path is **https://noahadhikari.github.io/pokemon-draft/**. This is a separate local project. Deployment must publish its static files under `pokemon-draft/` on the portfolio hosting; moving the source here does not publish it. The source, development scripts, and tests stay in this project. A link is included in the portfolio navigation.

## Run locally

With Node 22 or newer, from this directory:

```sh
npm run dev
```

Open **http://127.0.0.1:4173/pokemon-draft/**. Alternatively, open `index.html` directly. The planner uses classic scripts so opening a file does not require a fetch to load its game data. Local storage is tied to the browser and origin; a localhost league and a published league are separate. Use **Back up league** and **Restore backup** to transfer them.

## Use

The header’s **Dark mode** toggle switches colors and remembers your choice in this browser. Until you choose a mode, the planner follows your system theme.

1. Search for a Pokémon and click a suggestion or press Enter/Return to add it immediately. Up/Down chooses a different suggestion; Escape closes the list. Add every Pokémon in your draft. Your full roster can exceed six. Use **Load example** to explore a sample league.
2. Move selectors show type badges, Physical/Special/Status icons, base power, accuracy, and Showdown effect descriptions. Selected moves display their effect, with a Full effect disclosure when a longer description is available. Search by name, type, category, or effect; use Up/Down and Enter, or click a move. STAB and already-selected slots are marked. **Clear slot** removes a move. Variable-power and fixed-damage moves are labeled explicitly. Use each card's arrow to edit your own item, ability, nature, up to four moves, and Champions stat points (0–32 per stat, 66 total). Sets are shared across matchups.
3. Add each opponent and their week/round. Start with their species, then use each card’s arrow to enter a predicted item, ability, nature, points and up to four moves. Predictions belong to that opponent and are not presented as revealed information. Clear a prediction to return to an unknown set.
4. Select **6** for the weekly preview and **4** for battle. Battle picks are always members of the weekly six. Picks and notes are saved independently for every matchup.
5. Use **Analyze** to compare arbitrary subsets, or choose **Weekly six** / **Battle four** above the charts. These scopes are independent of the Analyze checkboxes.
6. Your offensive coverage uses only the four moves saved in each active set, with an optional STAB-only view of those same moves. The offensive “Their possibilities” view still shows learnable options. In **Defensive typing**, **Set matchups & surprises** uses opponent predictions against your enabled Pokémon; **Full type chart** retains all 18 incoming types. Explore other learnable moves in the Move explorer. Select a chart cell to see moves that achieve its best effectiveness. Check defensive typing, Speed ranges and learnable moves in the other tabs.
7. **Export team** provides Showdown/PokéPaste text, clipboard copy, and a text download. Showdown's `EVs:` field stores Champions stat points directly. Mega analysis forms export as their base species with the required stone. Open PokéPaste and paste the export there to create a hosted paste.

Everything saves to this browser's local storage. Export a JSON league backup before changing browsers, clearing site data, or loading a different league. Demo loading, restore, removal, and matchup deletion confirm replacement or data loss.

Drag each card's six-dot handle to reorder within a draft using a mouse or touch. Keyboard users can focus the handle and use Up/Down or Home/End. Order is saved and carries through to charts and export. Your draft order is shared across weeks; each opponent keeps a separate order. The trash button on each card deletes from the roster after confirmation.

### Predicted sets and surprises

The defensive matchup matrix shows the strongest type effectiveness among the moves in your opponent prediction. An unknown set shows `?`; a prediction without a damaging move shows `—`. Select a cell to inspect each predicted attack and its effectiveness. A **Surprise** flag lists legal attacking moves outside your prediction that are super effective and improve on its best type effectiveness. Unknown sets instead show learnable threats without claiming they are surprises. These lists are coverage watchlists, not predictions of likelihood or damage. Partial move predictions leave unchosen moves possible. Status and fixed-damage moves are excluded from this type analysis.

Predictions are saved with the matchup, survive reloads, reorder/delete correctly with their Pokémon, and are included in league JSON backups. Older species-only backups still restore. Your own Showdown team export never includes opponent predictions.

## Damage calculator

The **Damage calculator** tab uses a bundled, pinned [Smogon damage-calc](https://github.com/smogon/damage-calc) engine with its dedicated Champions mechanics, rather than a hand-written approximation or an embedded external page. It works offline with the rest of the planner. The source revision is recorded in `vendor/smogon-calc-source.json` and its MIT license is bundled alongside it.

- **Standard calculation:** choose an attacker, defender and learnable move; edit Champions stat points, nature, ability, item, stages, status and current HP. Inputs use 0–32 stat points per stat and a 66-point budget at level 50. Load either side from your draft or an opponent prediction. Edits in the calculator do not modify league sets.
- **Bulk comparison:** compares exactly 2 HP / 0 Def / 0 SpD, 32 HP / 0 Def / 0 SpD, and 32 HP / 32 in the defense stat used by the attack. Psyshock therefore uses Def investment even though it is Special. Other stat points are zero; the chosen nature, item, ability, status, stages, current HP percentage and field conditions are held fixed. The three points are benchmarks, rather than an exhaustive optimization or a claim to cover every possible spread.

Both modes show minimum/maximum HP damage and percentages from the engine's damage rolls. VGC doubles, weather, terrain, critical hits, spread targeting, screens, Helping Hand, Friend Guard, Protect, Gravity and multi-hit count are configurable. The selected Mega form is assumed active. Percentages use maximum HP, and damage assumes a hit. The output is uncapped damage before survival on 1 HP effects, rather than a guaranteed knockout prediction. Moves that need previous-hit context or unexposed special rules report an explicit error. Adaptive attacks can switch defenses; for those, the bulky benchmark chooses the better of the two legal 32 HP / 32 defensive-stat spreads.

To rebuild the local engine, install the development dependencies and use a pinned checkout that supports Champions:

```sh
node scripts/build-damage-engine.cjs /path/to/damage-calc FULL_COMMIT_SHA
```

## Data and assumptions

`data/champions.js` is a pinned Pokémon Showdown snapshot with 351 legal species/forms and 515 available moves. The metadata records its source revision and generation time; the application shows that metadata in **Data sources & how this works**. It was generated from the Champions M-C format, **not** the Scarlet/Violet Pokédex or a hand-written whitelist.

The generator uses Showdown's `TeamValidator.checkSpecies`, `Dex.species.getMovePool`, and `TeamValidator.checkCanLearn`. The Champions mod explicitly excludes inherited pre-evolution moves, and this workflow preserves that behavior. Individual moves are checked; complete combinations and league-specific restrictions still need validation in Showdown. The legal-only filter is on by default. Turning it off allows inspection of other species, without claiming they have Champions learnsets.

Coverage is type effectiveness, not damage. It excludes fixed-damage moves and handles Freeze-Dry and Flying Press type exceptions. It does not model abilities, items, variable move types, weather, terrain, or changes of form during a battle. Mega forms assume the Mega is active. Speed uses Champions' `floor((base + 20 + stat points) × nature)` formula, with optional Tailwind. Both sides exclude item/ability modifiers, paralysis, and stages. Opponent values are ranges, and overlapping ranges are not predictions of turn order. Trick Room sorting is slowest minimum first within the same priority bracket.

Regular Pokémon use Showdown's higher-resolution Pokédex artwork with smooth scaling. If artwork is unavailable for a form, its older sprite is tried before showing a text fallback. Eleven newer legal Mega forms missing from the older sprite folder use locally bundled Champions artwork in `assets/mega-sprites/`. Their source URLs and credits are recorded in `assets/mega-sprites/sources.json`; refresh those images with `node scripts/update-sprites.cjs`. No league information is sent to that service. The rest of the planner runs offline once its files are available. Pokémon Showdown data is MIT licensed; see `data/SHOWDOWN-LICENSE.txt`.

### Refresh the snapshot

Use a current, built [Pokémon Showdown checkout](https://github.com/smogon/pokemon-showdown) that contains `gen9championsvgc2026regmc`. The older published npm release may not contain that format. Follow Showdown's own installation/build instructions, then run:

```sh
node scripts/update-pokemon-data.cjs /absolute/path/to/pokemon-showdown SOURCE_COMMIT_SHA
npm test
```

Set `SHOWDOWN_SOURCE` to a built upstream checkout to also verify every bundled legal species and move against the real validator, and round-trip a complete six-Pokémon export through Showdown's importer and team validator. This integration check skips when the upstream checkout is not configured.

The script deliberately fails if the supplied checkout cannot resolve the Champions mod and M-C format. Review the regenerated data and source revision before publishing. The build tool and complete upstream source are not needed by visitors or stored in this project.

## Verification

Pure data, analysis, selection, backup, and export checks require only Node:

```sh
npm test
```

For a browser workflow check, install the optional development dependency, start the local server in another terminal, and run:

```sh
npm install
npm run test:browser
```

The browser test uses installed Microsoft Edge on Windows or Chrome on other platforms. Set `PLAYWRIGHT_EXECUTABLE_PATH` to use another Chromium browser, and `DRAFT_BASE_URL` to test another server. It covers roster sizes over six, selection limits, chart scopes, unknown opponent sets, weekly isolation, editing, reload persistence, backup restoration, export, escaped coach names, and desktop/mobile overflow. Sprites are intentionally blocked to also exercise offline fallbacks.

## Files

- `index.html`, `draft.css`, `app.js`: accessible responsive interface and browser state.
- `core.js`: pure analysis, validation, serialization, and export logic.
- `data/`: generated Showdown snapshot and upstream license.
- `scripts/`: local server and snapshot generator.
- `tests/`: unit and browser workflow tests.

All application assets use relative paths and work below `/pokemon-draft/`. The favicon is bundled here, and portfolio links point to `https://noahadhikari.github.io/`. This source project is independent of the portfolio repository.
