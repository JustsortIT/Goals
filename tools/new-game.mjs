/**
 * Starts a new game as a copy of the template:   npm run new-game -- <name> ["Your name"]
 *
 * The name is the game's folder in src/games and its place in the address, so it is lower-case
 * letters, digits and hyphens. Nothing else needs touching: the list of games finds the folder.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [name, by = 'someone'] = process.argv.slice(2);
if (!name || !/^[a-z][a-z0-9-]{1,30}$/.test(name)) {
  console.error(
    'Usage: npm run new-game -- <name> ["Your name"]. The name is lower-case letters, digits and hyphens.',
  );
  process.exit(1);
}

const from = path.join('src', 'games', '_template');
const to = path.join('src', 'games', name);
if (existsSync(to)) {
  console.error(`There is already a game in ${to}.`);
  process.exit(1);
}

cpSync(from, to, { recursive: true });

const title = name.replaceAll('-', ' ').toUpperCase();
const about = {
  title: title[0] + title.slice(1).toLowerCase(),
  by,
  status: 'idea',
  summary: 'Say in a sentence what the player does.',
};
writeFileSync(path.join(to, 'about.json'), `${JSON.stringify(about, null, 2)}\n`);

const dataFile = path.join(to, 'game.json');
const data = JSON.parse(readFileSync(dataFile, 'utf8'));
// The title screen has room for 14 characters.
data.name = title.slice(0, 14);
writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`);

const notes = path.join(to, 'CLAUDE.md');
writeFileSync(notes, readFileSync(notes, 'utf8').replaceAll('_template', name));

console.log(`Made ${to}. Run npm run dev and open http://localhost:5173/play.html?game=${name}`);
console.log(`Then tell your assistant what the game is: its notes are in ${notes}.`);
