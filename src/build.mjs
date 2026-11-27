import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const content = new URL('content/', root);
const dist = new URL('dist/', root);

const readJson = async (base, path) => JSON.parse(await readFile(new URL(path, base), 'utf8'));
const site = await readJson(root, 'site.json');
const actors = await readJson(content, 'actors.json');
const number = new Intl.NumberFormat('en-GB');
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

function escape(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function dateLabel(value) {
  const parsed = new Date(value);
  requireCondition(
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value,
    `Invalid date: ${value}`,
  );
  return `<time datetime="${value}">${date.format(parsed)}</time>`;
}

function page({ title, description, prefix, body }) {
  const fullTitle = title ? `${title} | ${site.name}` : site.name;
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(description)}">
  ${site.indexable ? '' : '<meta name="robots" content="noindex, nofollow">'}
  <title>${escape(fullTitle)}</title>
  <link rel="stylesheet" href="${prefix}assets/site.css">
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="masthead">
    <div class="wrap masthead-inner">
      <a class="brand" href="${prefix}"><span class="brand-mark" aria-hidden="true"></span>${escape(site.name)}</a>
      <nav aria-label="Main navigation"><a href="${prefix}#topics">Topics</a></nav>
    </div>
  </header>
  <main id="main">${body}</main>
  <footer class="footer">
    <div class="wrap footer-inner">
      <a class="brand" href="${prefix}"><span class="brand-mark" aria-hidden="true"></span>${escape(site.name)}</a>
      <p>Independent guides to public services.</p>
    </div>
  </footer>
</body>
</html>
`;
}

function renderIndex(topics) {
  const cards = topics.map(topic => `<li>
    <a class="topic-card" href="topics/${topic.id}/">
      <span class="meta">${escape(topic.category)} <span aria-hidden="true">·</span> ${escape(topic.scope)}</span>
      <span class="card-title">${escape(topic.title)}</span>
      <span class="card-summary">${escape(topic.summary)}</span>
      <span class="card-arrow" aria-hidden="true">↗</span>
    </a>
  </li>`).join('');
  return page({
    description: site.description,
    prefix: './',
    body: `<div class="home-hero">
      <div class="wrap home-hero-inner">
        <h1>How public<br>services <em>work.</em></h1>
        <p>${escape(site.description)}</p>
      </div>
    </div>
    <section class="wrap topics" id="topics">
      <h2>Explore topics</h2>
      <ul class="topic-list">${cards}</ul>
    </section>`,
  });
}

async function loadTopic(filename) {
  const topic = await readJson(content, `topics/${filename}`);
  for (const [kind, value] of [['topic ID', topic.id], ['template', topic.template]]) {
    requireCondition(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), `${filename}: invalid ${kind}`);
  }
  requireCondition(basename(filename, '.json') === topic.id, `${filename}: filename must match topic ID`);
  const template = await readJson(content, `templates/${topic.template}.json`);
  const sectionIds = template.sections.map(section => section.id);
  requireCondition(new Set(sectionIds).size === sectionIds.length, `${filename}: duplicate template section`);
  requireCondition(
    Object.keys(topic.sections).length === sectionIds.length &&
      sectionIds.every(id => Array.isArray(topic.sections[id]) && topic.sections[id].length),
    `${filename}: sections must match the template and have content`,
  );
  return { ...topic, sectionOrder: template.sections };
}

async function renderTopic(topic) {
  const sourceIds = Object.keys(topic.sources);
  const citations = ids => {
    requireCondition(Array.isArray(ids) && ids.length, `${topic.id}: missing citation`);
    return `<sup class="citations">${ids.map(id => {
      requireCondition(sourceIds.includes(id), `${topic.id}: unknown source ${id}`);
      const index = sourceIds.indexOf(id) + 1;
      return `<a href="#source-${index}" aria-label="Source ${index}">[${index}]</a>`;
    }).join(' ')}</sup>`;
  };

  const getActor = id => {
    requireCondition(Object.hasOwn(actors, id) && Object.hasOwn(topic.actors, id), `${topic.id}: unknown actor ${id}`);
    return topic.actors[id];
  };

  function renderFlow(id) {
    requireCondition(Object.hasOwn(topic.visuals, id), `${topic.id}: unknown visual ${id}`);
    const visual = topic.visuals[id];
    const steps = visual.steps.map(step => {
      const labels = (step.actors ?? []).map(id => {
        getActor(id);
        return escape(actors[id]);
      });
      return `<li><strong>${escape(step.label)}</strong>${labels.length ? `<span class="step-actors">${labels.join(' · ')}</span>` : ''}
        <p>${escape(step.text)} ${citations(step.citations)}</p></li>`;
    });
    return `<figure class="figure process"><figcaption>${escape(visual.title)}</figcaption>
      <ol class="flow">${steps.join('')}</ol></figure>`;
  }

  async function renderChart(id) {
    requireCondition(Object.hasOwn(topic.charts, id), `${topic.id}: unknown chart ${id}`);
    const chart = topic.charts[id];
    requireCondition(/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(chart.data), `${topic.id}: invalid chart filename`);
    const data = await readJson(content, `data/${chart.data}`);
    requireCondition(data.series.length && data.series.every(row =>
      typeof row.label === 'string' && Number.isSafeInteger(row.value) && row.value >= 0),
      `${chart.data}: invalid series`,
    );
    const max = Math.max(1, ...data.series.map(row => row.value));
    const total = data.series.reduce((sum, row) => sum + row.value, 0);
    const rows = data.series.map(({ label, value }) => `<tr>
      <th scope="row">${escape(label)}</th>
      <td><span class="bar-track" aria-hidden="true"><span class="bar" style="--value:${100 * value / max}%"></span></span></td>
      <td>${number.format(value)}</td>
    </tr>`).join('');
    return `<figure class="figure chart">
      <figcaption>${escape(chart.title)} ${citations(chart.citations)}</figcaption>
      <p class="chart-date">As at ${dateLabel(data.asOf)}</p>
      ${chart.showTotal ? `<div class="chart-total"><strong>${number.format(total)}</strong> <span>${escape(data.unit)}</span></div>` : ''}
      <table aria-label="${escape(chart.title)}"><thead class="visually-hidden">
        <tr><th scope="col">${escape(data.groupLabel)}</th><th scope="col">Relative bar</th><th scope="col">${escape(data.unit)}</th></tr></thead>
        <tbody>${rows}</tbody></table>
      ${chart.note ? `<p class="chart-note">${escape(chart.note)}</p>` : ''}
    </figure>`;
  }

  async function renderBlock(block) {
    const blockKinds = ['text', 'visual', 'actors', 'chart'].filter(kind => Object.hasOwn(block, kind));
    requireCondition(blockKinds.length === 1, `${topic.id}: each block needs one content type`);
    switch (blockKinds[0]) {
      case 'text':
        return `<p>${escape(block.text)} ${citations(block.citations)}</p>`;
      case 'visual':
        return renderFlow(block.visual);
      case 'chart':
        return renderChart(block.chart);
      case 'actors':
        return `<dl class="actors">${block.actors.map(id => {
          const actor = getActor(id);
          return `<div><dt>${escape(actors[id])}</dt><dd>${escape(actor.role)} ${citations(actor.citations)}</dd></div>`;
        }).join('')}</dl>`;
    }
  }

  const sections = await Promise.all(topic.sectionOrder.map(async ({ id, title }) => {
    const blocks = await Promise.all(topic.sections[id].map(renderBlock));
    return `<section class="article-section" id="${escape(id)}"><h2>${escape(title)}</h2>${blocks.join('')}</section>`;
  }));
  const sources = Object.values(topic.sources).map((source, index) => {
    requireCondition(new URL(source.url).protocol === 'https:', `${topic.id}: source URLs must use HTTPS`);
    return `<li id="source-${index + 1}">
      <a href="${escape(source.url)}">${escape(source.title)}</a>
      <div class="source-detail">${escape(source.publisher)}${source.date ? ` · ${dateLabel(source.date)}` : ''}${source.reference ? ` · ${escape(source.reference)}` : ''}</div>
    </li>`;
  });
  const links = topic.sectionOrder.map(({ id, title }) =>
    `<li><a href="#${escape(id)}">${escape(title)}</a></li>`).join('');

  return page({
    title: topic.title,
    description: topic.summary,
    prefix: '../../',
    body: `<header class="article-hero">
      <div class="wrap">
        <a class="back" href="../../#topics"><span aria-hidden="true">←</span> All topics</a>
        <p class="meta">${escape(topic.category)} <span aria-hidden="true">·</span> ${escape(topic.scope)}</p>
        <h1>${escape(topic.title)}</h1>
        <p class="article-summary">${escape(topic.summary)} ${citations(topic.citations)}</p>
        <p class="review-date">Reviewed ${dateLabel(topic.reviewed)}</p>
      </div>
    </header>
    <div class="wrap article-layout">
      <aside><nav class="contents" aria-label="On this page">
        <p>On this page</p><ul>${links}<li><a href="#sources">Sources</a></li></ul>
      </nav></aside>
      <article>
        ${sections.join('')}
        <section class="article-section sources" id="sources"><h2>Sources</h2><ol>${sources.join('')}</ol></section>
      </article>
    </div>`,
  });
}

const files = (await readdir(new URL('topics/', content))).filter(file => file.endsWith('.json')).sort();
requireCondition(files.length, 'Add at least one topic in content/topics');
const topics = await Promise.all(files.map(loadTopic));
const topicPages = await Promise.all(topics.map(renderTopic));

await rm(dist, { recursive: true, force: true });
await mkdir(new URL('assets/', dist), { recursive: true });
await copyFile(new URL('src/site.css', root), new URL('assets/site.css', dist));
await writeFile(new URL('.nojekyll', dist), '');
await writeFile(new URL('index.html', dist), renderIndex(topics));
for (const [index, topic] of topics.entries()) {
  const directory = new URL(`topics/${topic.id}/`, dist);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('index.html', directory), topicPages[index]);
}
console.log(`Built ${topics.length} topic page(s) in ${fileURLToPath(dist)}`);
