import { readFile, readdir } from 'node:fs/promises';
import { parseDate, requireCondition } from './html.mjs';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const listJson = async path => (await readdir(new URL(path, root))).filter(name => name.endsWith('.json')).sort();
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isSlug = value => isText(value) && slug.test(value);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const kinds = ['new', 'refresh'];
const statuses = ['ready', 'hold', 'in-progress', 'complete', 'closed'];
const sourceKinds = ['demand', 'news', 'scrutiny', 'audit', 'statistics', 'casework', 'service'];
const evidenceRoles = ['process', 'delivery', 'scrutiny', 'cost', 'calendar', 'signal'];
const signalKinds = ['search', 'news', 'scrutiny', 'release', 'policy', 'recurring-need'];
const ratingOrder = ['usefulness', 'urgency', 'coverage', 'evidence'];
const levels = ['high', 'medium', 'low'];

function checkText(record, fields, context) {
  requireCondition(isRecord(record), `${context}: expected an object`);
  for (const field of fields) {
    requireCondition(isText(record[field]), `${context}: ${field} needs text`);
  }
}

function checkDate(value, context) {
  try {
    parseDate(value);
  } catch {
    throw new Error(`${context}: expected a valid date in YYYY-MM-DD format`);
  }
}

function checkSource(source, fields, context) {
  checkText(source, ['title', 'url', ...fields], context);
  const url = URL.parse(source.url);
  requireCondition(url?.protocol === 'https:' && !url.username && !url.password,
    `${context}: use a public HTTPS source URL`);
}

function checkRegister(register) {
  requireCondition(register?.version === 1 && Array.isArray(register.sources) && register.sources.length > 0,
    'source register: expected version 1 and a list of sources');
  const seen = new Set();
  for (const source of register.sources) {
    const context = `source register, ${source?.id ?? 'unknown source'}`;
    checkSource(source, ['scope', 'lookFor'], context);
    requireCondition(isSlug(source.id) && !seen.has(source.id), `${context}: invalid or duplicate ID`);
    requireCondition(sourceKinds.includes(source.kind), `${context}: unknown source kind`);
    seen.add(source.id);
  }
}

function checkBrief(brief, filename, existingTopics) {
  checkText(brief, ['title', 'category', 'scope', 'reader', 'primaryAngle', 'secondaryAngle',
    'lastingValue', 'evidenceGap', 'decisionReason'], filename);
  requireCondition(brief.version === 1, `${filename}: expected brief format version 1`);
  requireCondition(isSlug(brief.id) && filename === `${brief.id}.json`, `${filename}: filename must match the brief ID`);
  requireCondition(isSlug(brief.topic) && kinds.includes(brief.kind) && statuses.includes(brief.status),
    `${filename}: invalid topic ID, kind or status`);
  const exists = existingTopics.has(brief.topic);
  if (brief.kind === 'refresh') {
    requireCondition(exists, `${filename}: refresh must target an existing topic`);
    checkText(brief.refresh, ['anchor', 'change', 'impact'], `${filename}: refresh`);
    requireCondition(isSlug(brief.refresh.anchor), `${filename}: invalid refresh anchor`);
  } else if (brief.status === 'ready' || brief.status === 'hold') {
    requireCondition(!exists, `${filename}: topic already exists, consider a refresh`);
  }
  requireCondition(brief.status !== 'complete' || exists, `${filename}: complete brief needs a topic file`);

  checkDate(brief.commissionedOn, `${filename}: commissionedOn`);
  checkDate(brief.checkedOn, `${filename}: checkedOn`);
  requireCondition(brief.checkedOn >= brief.commissionedOn, `${filename}: checkedOn predates commissioning`);
  checkText(brief.nextCheck, ['what'], `${filename}: nextCheck`);
  checkDate(brief.nextCheck.when, `${filename}: nextCheck.when`);
  requireCondition(Array.isArray(brief.draftingChecks) && brief.draftingChecks.length && brief.draftingChecks.every(isText),
    `${filename}: provide drafting checks`);

  requireCondition(isRecord(brief.ratings), `${filename}: ratings are required`);
  for (const rating of ratingOrder) {
    const context = `${filename}: ${rating} rating`;
    checkText(brief.ratings[rating], ['reason'], context);
    requireCondition(levels.includes(brief.ratings[rating].level), `${context}: use high, medium or low`);
  }

  requireCondition(isRecord(brief.sources) && Object.keys(brief.sources).length, `${filename}: sources are required`);
  for (const [id, source] of Object.entries(brief.sources)) {
    const context = `${filename}: source ${id}`;
    checkSource(source, ['publisher', 'locator'], context);
    requireCondition(isSlug(id) && evidenceRoles.includes(source.role) && ['publisher', 'indexed-only'].includes(source.access),
      `${context}: invalid ID, evidence role or access`);
    checkDate(source.checkedOn, `${context}: checkedOn`);
    requireCondition(source.checkedOn <= brief.checkedOn, `${context}: checkedOn is later than the brief check`);
  }
  requireCondition(Array.isArray(brief.signals) && brief.signals.length, `${filename}: signals are required`);
  for (const signal of brief.signals) {
    checkText(signal, ['detail'], `${filename}: signal`);
    checkDate(signal.observedOn, `${filename}: signal observedOn`);
    requireCondition(signalKinds.includes(signal.kind) && signal.observedOn <= brief.checkedOn &&
      Array.isArray(signal.sources) && signal.sources.length && signal.sources.every(id => Object.hasOwn(brief.sources, id)),
    `${filename}: invalid signal kind, date or source reference`);
  }
  if (brief.status === 'ready') {
    const verifiedRoles = new Set(Object.values(brief.sources).filter(source => source.access === 'publisher').map(source => source.role));
    requireCondition(verifiedRoles.has('process') && verifiedRoles.has('delivery') && brief.ratings.evidence.level !== 'low',
      `${filename}: a ready brief needs publisher-checked process and delivery evidence`);
  }
}

function rankReady(a, b) {
  for (const rating of ratingOrder) {
    const difference = levels.indexOf(a.ratings[rating].level) - levels.indexOf(b.ratings[rating].level);
    if (difference) return difference;
  }
  return a.commissionedOn.localeCompare(b.commissionedOn) || a.id.localeCompare(b.id);
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const filter = args.filter(arg => arg !== '--json');
  requireCondition(filter.length <= 1 && (filter.length === 0 || kinds.includes(filter[0])),
    'Usage: node src/commissioning.mjs [new|refresh] [--json]');

  checkRegister(await readJson('commissioning/sources-v1.json'));
  const topicFiles = await listJson('content/topics/');
  const existingTopics = new Set(topicFiles.map(file => file.slice(0, -5)));
  const briefFiles = await listJson('commissioning/briefs/');
  const briefs = await Promise.all(briefFiles.map(file => readJson(`commissioning/briefs/${file}`)));
  const openTopics = new Set();
  for (const [index, brief] of briefs.entries()) {
    checkBrief(brief, briefFiles[index], existingTopics);
    if (brief.status === 'complete' || brief.status === 'closed') continue;
    requireCondition(!openTopics.has(brief.topic), `${briefFiles[index]}: another open brief targets ${brief.topic}`);
    openTopics.add(brief.topic);
  }

  const selected = briefs.filter(brief => !filter.length || filter[0] === brief.kind);
  const queue = Object.fromEntries(statuses.map(status => [status, selected.filter(brief => brief.status === status)]));
  queue.ready.sort(rankReady);
  queue.hold.sort((a, b) => a.nextCheck.when.localeCompare(b.nextCheck.when) || a.id.localeCompare(b.id));
  if (json) {
    process.stdout.write(`${JSON.stringify(queue, null, 2)}\n`);
    return;
  }

  for (const [status, items] of Object.entries(queue)) {
    process.stdout.write(`${status} (${items.length})\n`);
    for (const brief of items) {
      process.stdout.write(`  ${brief.title} [${brief.scope}]\n    commissioning/briefs/${brief.id}.json\n`);
      if (status === 'hold') process.stdout.write(`    Next check ${brief.nextCheck.when}. ${brief.nextCheck.what}\n`);
    }
  }
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
