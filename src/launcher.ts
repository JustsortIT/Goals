/**
 * The list of games: every folder in `games/` with a `start.ts`, and what its `about.json`
 * says of it. Nothing here needs touching to add a game.
 */
import './launcher.css';

interface About {
  title?: string;
  by?: string;
  status?: string;
  summary?: string;
  /** False for a game that does not use the shell, which is then only offered without coins. */
  shell?: boolean;
}

const STARTS = import.meta.glob('./games/*/start.ts');
const ABOUTS = import.meta.glob<About>('./games/*/about.json', { eager: true, import: 'default' });

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
  className = '',
): HTMLElementTagNameMap[K] => {
  const made = document.createElement(tag);
  made.textContent = text;
  if (className) made.className = className;
  return made;
};

const link = (text: string, href: string, className: string): HTMLAnchorElement => {
  const made = element('a', text, className);
  made.href = href;
  return made;
};

const list = document.getElementById('games');
if (!list) throw new Error('The page has no #games element.');

list.append(
  element('h1', 'phaseplay'),
  element('p', 'Game types being tried out for PubPixels. Each is a folder in src/games.', 'lead'),
);

const names = Object.keys(STARTS)
  .map((path) => path.split('/')[2])
  // The template is listed last: it is what a new game starts as, not a game.
  .sort((a, b) => Number(a.startsWith('_')) - Number(b.startsWith('_')) || a.localeCompare(b));

for (const name of names) {
  const about = ABOUTS[`./games/${name}/about.json`] ?? {};
  const card = element('article');
  const heading = element('h2', about.title ?? name);
  if (about.status) heading.append(' ', element('span', about.status, 'status'));
  card.append(
    heading,
    element('p', [about.by && `By ${about.by}.`, about.summary].filter(Boolean).join(' ')),
  );

  const links = element('p', '', 'links');
  const page = `play.html?game=${encodeURIComponent(name)}`;
  if (about.shell !== false) links.append(link('Play on the pretend kiosk', page, 'button'));
  links.append(
    link('Play free, as a preview', `${page}&free=1`, about.shell === false ? 'button' : 'plain'),
  );
  card.append(links, element('code', `src/games/${name}`));
  list.append(card);
}
