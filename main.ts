// Hand-in program: copy the playable game and the screenshots into the output
// directory and write the dossier the judge reads. Node 22, standard library only,
// and the same input always writes the same bytes.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });

// Copy the game tree whole. Clearing the destination first means a re-run writes the
// same files rather than layering over a stale build.
const gameSrc = join(here, 'game');
const gameDst = join(out, 'game');
if (existsSync(gameDst)) rmSync(gameDst, { recursive: true, force: true });
cpSync(gameSrc, gameDst, { recursive: true });

// Screenshots are optional at hand-in time so the program still runs on a bare tree.
const shotsSrc = join(here, 'screenshots');
if (existsSync(shotsSrc)) {
  const shotsDst = join(out, 'screenshots');
  if (existsSync(shotsDst)) rmSync(shotsDst, { recursive: true, force: true });
  cpSync(shotsSrc, shotsDst, { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`wrote ${join(out, 'dossier.json')} (${dossier.length} bytes)`);
