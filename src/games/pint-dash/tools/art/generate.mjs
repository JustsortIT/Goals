/**
 * Generates the art for a theme with the PixelLab API and writes it as a pack the game
 * can load: src/games/pint-dash/themes/packs/<theme>/ (images, theme.json and a preview page).
 *
 * The theme is described in src/games/pint-dash/tools/art/themes/<theme>.json: a setting, a style, and what
 * each role in the game should be (hero, enemy, pickup, goal, scenery, ground materials,
 * the skyline behind the level). It can also borrow pieces from another pack (`reuse`).
 *
 *   npm run art:generate -- street-daylight --dry-run
 *   npm run art:generate -- street-daylight                  (generate what is missing)
 *   npm run art:generate -- street-daylight --only hero,goal (redo two, keep the rest)
 *   npm run art:generate -- street-daylight --only hero-run  (an animation of the hero)
 *   npm run art:generate -- street-daylight --page-only      (rebuild the preview, no calls)
 *
 * Needs PIXELLAB_API_KEY in .env.local. Every image spends the account's allowance or
 * credit; the run stops at --max-generations or --max-usd, whichever it is charged in.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng, placeOnCanvas } from './png.mjs';

const API = 'https://api.pixellab.ai/v2';
const TILE = 16;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
/** How long to keep retrying when the service says it is busy with our previous job. */
const BUSY_TIMEOUT_MS = 3 * 60 * 1000;

/** Image sizes must be multiples of 4, and square when a side is under 32. */
const SPRITE_SIZES = {
  hero: [24, 24],
  enemy: [TILE, TILE],
  pickup: [TILE, TILE],
  heart: [TILE, TILE],
  crate: [TILE, TILE],
  // Optional. The game writes on the first two, so they have to be big enough to hold
  // three short lines of the pixel font, or one line for the banner.
  noticeBoard: [48, 48],
  banner: [128, 32],
  flyer: [TILE, TILE],
};
/**
 * Scenery comes back filling most of its canvas, so the canvas sets how big it is in the
 * game: one tile for low things, two for tall ones. The game trims the empty margin.
 */
const DECOR_SIZES = {
  weeds: [TILE, TILE],
  fence: [TILE, TILE],
  barrel: [TILE, TILE],
  roadBarrier: [TILE, TILE],
  // The set pieces: four tiles each way, about three times the hero's height.
  landmark: [64, 64],
  building: [64, 64],
};
const TALL_DECOR_SIZE = [TILE * 2, TILE * 2];
/** Seven tiles wide and four tall, the same footprint as the hand-built pub. */
const GOAL_SIZE = [112, 64];
/**
 * The two rows of skyline behind the level. The game fades them towards the sky colour
 * and repeats them sideways. A row is one picture (`subject`), or several laid side by
 * side (`subjects`): use several when one has landmarks that should not be seen twice
 * on the same screen. Much wider pictures come back sparse, so the width stays at 256.
 */
const BACKDROP_SIZES = { far: [256, 96], near: [256, 64] };
const BACKDROP_SHAPE =
  'flat silhouette seen from the side, buildings standing in a row along the bottom edge, ' +
  'plain white background, nothing else';
/**
 * Animations are drawn on a bigger canvas than the hero, so limbs have room to move. The
 * hero stands at the bottom, in the middle.
 */
const ANIMATION_SIZE = [32, 32];
/** Asks for one thing on its own, so no scenery is drawn around it. */
const ISOLATED = 'single object centered on a plain white background, nothing else';

// --- Command line -------------------------------------------------------------------------

const args = process.argv.slice(2);
const KNOWN_OPTIONS = ['dry-run', 'page-only', 'only', 'max-generations', 'max-usd'];
const unknown = args.filter((arg) => arg.startsWith('--') && !KNOWN_OPTIONS.includes(arg.slice(2)));
const themeName = args.find(
  (arg, index) => !arg.startsWith('--') && !args[index - 1]?.match(/^--(only|max-)/),
);
if (unknown.length > 0 || !themeName) {
  console.error(
    unknown.length > 0
      ? `Unknown option: ${unknown.join(', ')}. Known: ${KNOWN_OPTIONS.map((o) => `--${o}`).join(' ')}`
      : 'Usage: npm run art:generate -- <theme> [options]. Themes are in src/games/pint-dash/tools/art/themes/.',
  );
  process.exit(1);
}
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const maxGenerations = Number(option('max-generations', '12'));
const maxUsd = Number(option('max-usd', '0.25'));
const only = option('only', '').split(',').filter(Boolean);
const wanted = (id) => only.length === 0 || only.includes(id);

// Everything of Pint Dash is in its own folder (see the README at the top of the repo).
const GAME = path.join('src', 'games', 'pint-dash');
const definitionFile = path.join(GAME, 'tools', 'art', 'themes', `${themeName}.json`);
if (!existsSync(definitionFile)) {
  console.error(`No theme definition at ${definitionFile}.`);
  process.exit(1);
}
const definition = JSON.parse(readFileSync(definitionFile, 'utf8'));
const directory = path.join(GAME, 'themes', 'packs', themeName);
const manifestFile = path.join(directory, 'theme.json');
const manifest = existsSync(manifestFile)
  ? JSON.parse(readFileSync(manifestFile, 'utf8'))
  : { name: themeName, tileSize: TILE, images: {}, tilesets: {} };
manifest.animations ??= {};
manifest.setting = definition.setting;
manifest.style = definition.style;

// --- What to make ---------------------------------------------------------------------------

/** Every single image the theme needs: sprites, scenery and the goal building. */
function plannedImages() {
  const images = [];
  for (const [id, subject] of Object.entries(definition.sprites)) {
    images.push({
      id,
      size: SPRITE_SIZES[id] ?? [TILE, TILE],
      prompt: `${subject}, ${definition.style}, ${ISOLATED}`,
      direction: id === 'hero' ? 'east' : undefined,
      detail: 'low detail',
    });
  }
  for (const [id, subject] of Object.entries(definition.decor ?? {})) {
    images.push({
      id,
      size: DECOR_SIZES[id] ?? TALL_DECOR_SIZE,
      prompt: `${subject}, ${definition.style}, ${ISOLATED}`,
      detail: 'low detail',
    });
  }
  for (const row of Object.keys(BACKDROP_SIZES)) {
    const { subject, subjects } = definition.backdrop?.[row] ?? {};
    const pictures = subjects ?? (subject ? [subject] : []);
    pictures.forEach((picture, index) => {
      images.push({
        // One picture is `backdrop-far`; several are `backdrop-far-1`, `-2`, ... left to right.
        id: pictures.length === 1 ? `backdrop-${row}` : `backdrop-${row}-${index + 1}`,
        size: BACKDROP_SIZES[row],
        prompt: `${picture}, ${BACKDROP_SHAPE}`,
        detail: 'low detail',
        outline: 'lineless',
      });
    });
  }
  images.push({
    id: 'goal',
    size: GOAL_SIZE,
    prompt:
      `${definition.goal}, flat front elevation seen straight on, no perspective, no ground, ` +
      `${definition.style}, ${ISOLATED}`,
    detail: 'medium detail',
  });
  return images;
}

/** Pieces copied from another pack instead of being generated: `{ "<pack>": ["heart", ...] }`. */
const borrowed = Object.entries(definition.reuse ?? {}).flatMap(([from, ids]) =>
  ids.map((id) => ({ from, id })),
);

/** Copies the borrowed images in. Costs nothing, and never replaces one already there. */
function borrow() {
  for (const { from, id } of borrowed) {
    if (manifest.images[id]) continue;
    const source = path.join(GAME, 'themes', 'packs', from);
    const image = JSON.parse(readFileSync(path.join(source, 'theme.json'), 'utf8')).images[id];
    if (!image) throw new Error(`Cannot reuse "${id}": pack "${from}" has no such image.`);
    mkdirSync(directory, { recursive: true });
    copyFileSync(path.join(source, image.file), path.join(directory, image.file));
    manifest.images[id] = { ...image, usage: `reused from ${from}` };
  }
}

const todo = (id, existing) => wanted(id) && (only.length > 0 || !existing);
const images = plannedImages().filter((image) => todo(image.id, manifest.images[image.id]));
const tilesets = Object.keys(definition.tilesets).filter((id) => todo(id, manifest.tilesets[id]));
/** Animations of the hero, made from the hero image. Their ids are `hero-run`, `hero-jump`, ... */
const animations = Object.keys(definition.animations ?? {}).filter((name) =>
  todo(`hero-${name}`, manifest.animations[name]),
);

// --- API ----------------------------------------------------------------------------------

const key = process.env.PIXELLAB_API_KEY;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(method, route, body) {
  const send = () =>
    fetch(API + route, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

  // 429 means the previous job still holds the account's only slot; nothing is charged.
  let response = await send();
  const started = Date.now();
  while (response.status === 429 && Date.now() - started < BUSY_TIMEOUT_MS) {
    await sleep(Number(response.headers.get('retry-after') ?? 5) * 1000);
    response = await send();
  }
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Not JSON; keep the raw text for the error message.
  }
  return { status: response.status, headers: response.headers, data, text };
}

async function getBalance() {
  const { status, data, text } = await api('GET', '/balance');
  if (status !== 200) throw new Error(`Balance check failed (${status}): ${text.slice(0, 200)}`);
  return { usd: data.credits.usd, generations: data.subscription.generations };
}

const describeUsage = (usage) =>
  usage ? (usage.type === 'usd' ? `$${usage.usd}` : `${usage.generations} generation(s)`) : 'n/a';
const png = (image) => Buffer.from(image.base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

async function createImage(image) {
  const [width, height] = image.size;
  const { status, data, text } = await api('POST', '/create-image-pixen', {
    description: image.prompt,
    image_size: { width, height },
    no_background: true,
    outline: image.outline ?? 'single color black outline',
    detail: image.detail,
    view: 'side',
    ...(image.direction ? { direction: image.direction } : {}),
  });
  if (status !== 200) throw new Error(`${image.id}: HTTP ${status} ${text.slice(0, 300)}`);
  return { usage: data.usage, file: png(data.image) };
}

async function createTileset(id) {
  const { lower, transition } = definition.tilesets[id];
  const request = {
    lower_description: `${lower}, ${definition.setting}, ${definition.style}`,
    transition_description: transition,
    transition_size: transition ? 0.25 : 0,
    tile_size: { width: TILE, height: TILE },
    outline: 'single color black outline',
    detail: 'low detail',
  };
  const created = await api('POST', '/create-tileset-sidescroller', request);
  if (created.status !== 202 && created.status !== 200) {
    throw new Error(`${id}: HTTP ${created.status} ${created.text.slice(0, 300)}`);
  }
  const tilesetId = created.data.tileset_id;

  // 423 means "still generating"; the server says how long to wait.
  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const result = await api('GET', `/tilesets-sidescroller/${tilesetId}`);
    if (result.status === 200) return { request, usage: created.data.usage, data: result.data };
    if (result.status !== 423) {
      throw new Error(`${id} ${tilesetId}: HTTP ${result.status} ${result.text.slice(0, 300)}`);
    }
    await sleep(Number(result.headers.get('retry-after') ?? 5) * 1000);
  }
  throw new Error(`${id} ${tilesetId}: still not ready after ${POLL_TIMEOUT_MS / 1000}s`);
}

/**
 * Animates the hero image: the service is given the standing hero as the first frame and
 * a description of the movement, and returns the frames. `beforeRunning` is told what the
 * job says it will cost, and can refuse it.
 */
async function createAnimation(name, beforeRunning) {
  const { action, frames } = definition.animations[name];
  const hero = manifest.images.hero;
  if (!hero) throw new Error(`hero-${name}: the hero image has to exist first`);

  const [width, height] = ANIMATION_SIZE;
  const heroX = Math.floor((width - hero.width) / 2);
  const heroY = height - hero.height;
  const standing = decodePng(readFileSync(path.join(directory, hero.file)));
  const firstFrame = encodePng(placeOnCanvas(standing, width, height, heroX, heroY));

  const created = await api('POST', '/animate-with-text-v3', {
    first_frame: { type: 'base64', base64: firstFrame.toString('base64'), format: 'png' },
    action,
    frame_count: frames,
    no_background: true,
  });
  if (created.status !== 200 && created.status !== 202) {
    throw new Error(`hero-${name}: HTTP ${created.status} ${created.text.slice(0, 300)}`);
  }
  const jobId = created.data.background_job_id;
  console.log(`  hero-${name}: job ${jobId}, reported cost ${describeUsage(created.data.usage)}`);
  if (!beforeRunning(created.data.usage)) {
    await api('DELETE', `/background-jobs/${jobId}`);
    throw new Error(`hero-${name}: over the cap, cancelled`);
  }

  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await sleep(3000);
    const job = await api('GET', `/background-jobs/${jobId}`);
    if (job.status !== 200) {
      throw new Error(`hero-${name} ${jobId}: HTTP ${job.status} ${job.text.slice(0, 300)}`);
    }
    if (job.data.status === 'failed') {
      throw new Error(
        `hero-${name} ${jobId}: ${JSON.stringify(job.data.last_response).slice(0, 300)}`,
      );
    }
    if (job.data.status === 'completed') {
      const images = job.data.last_response?.images;
      if (!Array.isArray(images) || images.some((image) => !image?.base64)) {
        // The job is paid for by now, so keep whatever came back.
        const dump = path.join(directory, `hero-${name}.response.json`);
        writeFileSync(dump, job.text);
        throw new Error(`hero-${name} ${jobId}: unexpected result, saved to ${dump}`);
      }
      return {
        action,
        width,
        height,
        heroX,
        heroY,
        usage: job.data.usage ?? created.data.usage,
        files: images.map(png),
      };
    }
  }
  throw new Error(`hero-${name} ${jobId}: still not ready after ${POLL_TIMEOUT_MS / 1000}s`);
}

/**
 * Each tile of a tileset is a corner piece. Its code says which of its four corners are
 * solid: north-west 1, north-east 2, south-west 4, south-east 8. The game looks tiles
 * up by this code.
 */
function cornerCode(corners) {
  const solid = (corner) => (corner === 'lower' ? 1 : 0);
  return solid(corners.NW) + solid(corners.NE) * 2 + solid(corners.SW) * 4 + solid(corners.SE) * 8;
}

// --- Preview page ---------------------------------------------------------------------------

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

/** A mock-up of the assets in place, drawn the way the game draws them. */
function buildScene() {
  const cells = [
    '....................',
    '....................',
    '..........===.......',
    '....................',
    '................BB..',
    '######..############',
    '######..############',
  ];
  const scale = 4;
  const size = TILE * scale;
  const parts = [];
  const materials = { '#': 'ground', '=': 'platform', B: 'wall' };

  for (const [symbol, material] of Object.entries(materials)) {
    const tiles = manifest.tilesets[material]?.tiles;
    if (!tiles) continue;
    const solid = (row, column) =>
      cells[row]?.[column] === symbol || (symbol === '#' && row >= cells.length);
    for (let row = 0; row <= cells.length; row++) {
      for (let column = 0; column <= cells[0].length; column++) {
        const code =
          (solid(row - 1, column - 1) ? 1 : 0) +
          (solid(row - 1, column) ? 2 : 0) +
          (solid(row, column - 1) ? 4 : 0) +
          (solid(row, column) ? 8 : 0);
        if (code > 0 && tiles[code]) {
          parts.push(
            `<img src="${tiles[code]}" style="left:${(column - 0.5) * size}px;top:${(row - 0.5) * size}px;width:${size}px">`,
          );
        }
      }
    }
  }

  // Sprites stand on a cell: [id, column, row of the cell they stand in].
  const placed = [
    ['hero', 2, 4],
    ['pickup', 4, 4],
    ['enemy', 9, 4],
    ['pickup', 11, 1],
    ['lampPost', 13, 4],
    ['crate', 15, 4],
  ];
  for (const [id, column, row] of placed) {
    const image = manifest.images[id];
    if (!image) continue;
    const left = (column + 0.5) * size - (image.width * scale) / 2;
    const top = (row + 1) * size - image.height * scale;
    parts.push(
      `<img src="${image.file}" style="left:${left}px;top:${top}px;width:${image.width * scale}px">`,
    );
  }

  const width = cells[0].length * size;
  const height = cells.length * size;
  return `<div class="scene" style="width:${width}px;height:${height}px">${parts.join('')}</div>`;
}

function buildPage() {
  const cards = Object.entries(manifest.images)
    .map(
      ([
        id,
        image,
      ]) => `<section><h3>${escapeHtml(id)} <small>${image.width}×${image.height}</small></h3>
      <img src="${image.file}" style="width:${image.width * 8}px">
      <p class="prompt">${escapeHtml(image.prompt)}<br><small>${escapeHtml(image.usage)}</small></p></section>`,
    )
    .join('\n');
  const animationBlocks = Object.entries(manifest.animations)
    .map(
      ([name, animation]) =>
        `<section><h3>hero-${escapeHtml(name)} <small>${animation.files.length} frames, ${animation.frames.length} used</small></h3>
      <div class="tiles"><figure><img class="playing" data-frames="${animation.frames.join(',')}" src="${animation.frames[0]}" width="${animation.width * 6}"><figcaption>playing</figcaption></figure>${animation.files
        .map(
          (file, index) =>
            `<figure${animation.frames.includes(file) ? '' : ' class="unused"'}><img src="${file}" width="${animation.width * 4}"><figcaption>${index}</figcaption></figure>`,
        )
        .join('')}</div>
      <p class="prompt">${escapeHtml(animation.action)}<br><small>${escapeHtml(animation.usage)}</small></p></section>`,
    )
    .join('\n');
  const tilesetBlocks = Object.entries(manifest.tilesets)
    .map(
      ([id, tileset]) =>
        `<h3>${escapeHtml(id)}</h3><div class="tiles">${Object.entries(tileset.tiles)
          .map(
            ([code, file]) =>
              `<figure><img src="${file}" width="${TILE * 4}"><figcaption>${code}</figcaption></figure>`,
          )
          .join('')}</div>`,
    )
    .join('\n');

  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(themeName)}</title>
<style>
  body { font: 15px system-ui, sans-serif; background: #cfe3ef; color: #1b1424; margin: 16px; }
  img { image-rendering: pixelated; max-width: 100%; height: auto; }
  h1 { margin: 0 0 4px; } h2 { margin: 28px 0 8px; } h3 { margin: 0 0 8px; } small { color: #48608f; font-weight: normal; }
  section { border-top: 1px solid #9db3c8; padding: 14px 0; } .prompt { margin: 10px 0 0; max-width: 640px; }
  .tiles { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; } figure { margin: 0; } figcaption { font-size: 10px; }
  .unused { opacity: 0.35; } .playing { background: #b9d7ea; }
  .scene { position: relative; overflow: hidden; background: #b9d7ea; } .scene img { position: absolute; max-width: none; }
</style>
<h1>${escapeHtml(themeName)}</h1>
<p>${escapeHtml(manifest.setting)}; ${escapeHtml(manifest.style)}</p>
<h2>Put together</h2>
<div id="fit">${buildScene()}</div>
<h2>Sprites, scenery and the goal</h2>
${cards}
${animationBlocks ? `<h2>Hero animations (faded frames are not used)</h2>\n${animationBlocks}` : ''}
<h2>Tilesets (corner pieces, labelled with their code)</h2>
${tilesetBlocks}
<script>
  // Play each animation at the speed the game does.
  for (const image of document.querySelectorAll('.playing')) {
    const frames = image.dataset.frames.split(',');
    let index = 0;
    setInterval(() => (image.src = frames[(index = (index + 1) % frames.length)]), 100);
  }
  // Shrink the mock-up to the width of the screen.
  const scene = document.querySelector('.scene');
  const fit = () => {
    scene.style.zoom = 1;
    scene.style.zoom = Math.min(1, document.getElementById('fit').clientWidth / scene.offsetWidth);
  };
  fit();
  addEventListener('resize', fit);
</script>`;
}

/**
 * Which frames of each animation the game plays. A theme can pick with `use` (a list of
 * frame numbers, in order), for example to drop a frame where the hero is still standing.
 */
function selectFrames() {
  for (const [name, animation] of Object.entries(manifest.animations)) {
    const use = definition.animations?.[name]?.use ?? animation.files.map((_, index) => index);
    const missing = use.filter((index) => !animation.files[index]);
    if (missing.length > 0) {
      throw new Error(`hero-${name}: "use" lists frames that do not exist: ${missing.join(', ')}`);
    }
    animation.frames = use.map((index) => animation.files[index]);
  }
}

/** The sky and skyline colours, which can be changed without generating anything. */
function setBackdropColours() {
  const { backdrop } = definition;
  manifest.backdrop = backdrop
    ? { sky: backdrop.sky, far: backdrop.far?.color, near: backdrop.near?.color }
    : undefined;
}

function save() {
  selectFrames();
  setBackdropColours();
  mkdirSync(directory, { recursive: true });
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(path.join(directory, 'preview.html'), buildPage());
}

// --- Run ------------------------------------------------------------------------------------

async function main() {
  console.log(`Theme: ${themeName} (${definition.setting}; ${definition.style})`);
  console.log(
    `To generate: ${[...images.map((image) => image.id), ...tilesets.map((id) => `${id} tileset`), ...animations.map((name) => `hero-${name} animation`)].join(', ') || 'nothing'}`,
  );
  if (borrowed.length > 0) {
    console.log(
      `Reused from other packs: ${borrowed.map(({ from, id }) => `${id} (${from})`).join(', ')}`,
    );
  }
  if (flag('dry-run')) return;
  borrow();

  if (flag('page-only') || images.length + tilesets.length + animations.length === 0) {
    save();
    console.log(`Preview rebuilt: ${path.join(directory, 'preview.html')}`);
    return;
  }

  if (!key) throw new Error('PIXELLAB_API_KEY is not set. Put it in .env.local.');
  const before = await getBalance();
  console.log(`Balance before: ${before.generations} trial generations, $${before.usd} credit`);

  // The balance can lag behind, so the cap is checked against what each call reports.
  // Tilesets do not report their cost. The balance shows three generations for one with a
  // transition and two without; the cap counts three, to stay on the safe side.
  const spent = { generations: 0, usd: 0 };
  const charge = (usage, fallbackGenerations = 0) => {
    spent.generations += usage?.generations ?? (usage ? 0 : fallbackGenerations);
    spent.usd += usage?.usd ?? 0;
  };
  const overCap = () => spent.generations >= maxGenerations || spent.usd >= maxUsd;
  mkdirSync(directory, { recursive: true });

  for (const image of images) {
    if (overCap()) {
      console.log(`Stopping: reached the cap (${maxGenerations} generations or $${maxUsd}).`);
      break;
    }
    const started = Date.now();
    try {
      const { usage, file } = await createImage(image);
      charge(usage);
      writeFileSync(path.join(directory, `${image.id}.png`), file);
      manifest.images[image.id] = {
        file: `${image.id}.png`,
        width: image.size[0],
        height: image.size[1],
        prompt: image.prompt,
        usage: describeUsage(usage),
      };
      save();
      console.log(`  ${image.id}: ${describeUsage(usage)}, ${Date.now() - started}ms`);
    } catch (error) {
      console.log(`  ${image.id}: FAILED ${error.message}`);
    }
  }

  for (const id of tilesets) {
    if (overCap()) {
      console.log(`Stopping: reached the cap (${maxGenerations} generations or $${maxUsd}).`);
      break;
    }
    const started = Date.now();
    try {
      const { request, usage, data } = await createTileset(id);
      charge(usage, 3);
      const tiles = {};
      for (const tile of data.tileset.tiles) {
        const code = cornerCode(tile.corners);
        tiles[code] = `${id}-${String(code).padStart(2, '0')}.png`;
        writeFileSync(path.join(directory, tiles[code]), png(tile.image));
      }
      manifest.tilesets[id] = {
        prompt: request.lower_description,
        transition: request.transition_description,
        tiles,
      };
      save();
      console.log(
        `  ${id} tileset: ${Object.keys(tiles).length} tiles, ${describeUsage(usage)}, ${Date.now() - started}ms`,
      );
    } catch (error) {
      console.log(`  ${id} tileset: FAILED ${error.message}`);
    }
  }

  for (const name of animations) {
    if (overCap()) {
      console.log(`Stopping: reached the cap (${maxGenerations} generations or $${maxUsd}).`);
      break;
    }
    const started = Date.now();
    try {
      const withinCap = (usage) =>
        spent.generations + (usage?.generations ?? 0) <= maxGenerations &&
        spent.usd + (usage?.usd ?? 0) <= maxUsd;
      const { usage, files, ...details } = await createAnimation(name, withinCap);
      // If no cost is reported, count a generation per frame, to stay on the safe side.
      charge(usage, files.length);
      const names = files.map((file, index) => {
        const fileName = `hero-${name}-${String(index).padStart(2, '0')}.png`;
        writeFileSync(path.join(directory, fileName), file);
        return fileName;
      });
      manifest.animations[name] = { ...details, files: names, usage: describeUsage(usage) };
      save();
      console.log(
        `  hero-${name}: ${names.length} frames, ${describeUsage(usage)}, ${Date.now() - started}ms`,
      );
    } catch (error) {
      console.log(`  hero-${name}: FAILED ${error.message}`);
    }
  }

  save();
  const after = await getBalance();
  console.log(
    `Reported by this run: ${spent.generations} generation(s), $${spent.usd.toFixed(4)}. ` +
      `Balance now: ${after.generations} trial generations, $${after.usd} credit.`,
  );
  console.log(`Pack: ${directory}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
