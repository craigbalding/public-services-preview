import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderBars, renderStatus, renderTrend } from './charts.mjs';
import { dateLabel, escape, number, requireCondition } from './html.mjs';

const root = new URL('../', import.meta.url);
const content = new URL('content/', root);
const dist = new URL('dist/', root);

const readJson = async (base, path) => JSON.parse(await readFile(new URL(path, base), 'utf8'));
const site = await readJson(root, 'site.json');
const actors = await readJson(content, 'actors.json');
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
    requireCondition(typeof value === 'string' && slug.test(value), `${filename}: invalid ${kind}`);
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
  for (const { id, requiredBlock } of template.sections) {
    if (requiredBlock) {
      requireCondition(
        topic.sections[id].some(block => Object.hasOwn(block, requiredBlock)),
        `${filename}: ${id} requires a ${requiredBlock} block`,
      );
    }
  }
  return {
    ...topic,
    sectionOrder: template.sections,
    requiredMetricFields: template.requiredMetricFields ?? [],
    requireConsequences: template.requireConsequences ?? false,
  };
}

async function renderTopic(topic) {
  const allBlocks = Object.values(topic.sections).flat();
  const listed = kind => allBlocks.flatMap(block => block[kind] ?? []);
  const visualIds = listed('visual');
  const chartIds = listed('chart');
  const metricIds = listed('metrics');
  const issueIds = listed('issues');
  const improvementIds = listed('improvements');
  const scrutinyIds = listed('scrutiny');
  for (const ids of [visualIds, chartIds, metricIds, issueIds, improvementIds, scrutinyIds]) {
    requireCondition(
      ids.every(id => typeof id === 'string' && slug.test(id)) && new Set(ids).size === ids.length,
      `${topic.id}: invalid or duplicate reference in the topic sections`,
    );
  }
  requireCondition(
    issueIds.length === improvementIds.length && issueIds.every(id => improvementIds.includes(id)),
    `${topic.id}: each issue needs a published improvement`,
  );

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

  const stepAnchor = (visual, step) => `step-${visual}--${step}`;

  function processLink(reference, label) {
    const visual = reference?.visual;
    const step = visualIds.includes(visual)
      ? topic.visuals[visual]?.steps.find(step => step.id && step.id === reference.id)
      : undefined;
    requireCondition(step, `${topic.id}: ${label} needs a published process step`);
    return `<a href="#${stepAnchor(visual, step.id)}">${escape(step.label)}</a>`;
  }

  function evidenceLinks({ charts = [], metrics = [] }) {
    requireCondition(Array.isArray(charts) && Array.isArray(metrics), `${topic.id}: invalid evidence references`);
    const links = [
      ...charts.map(id => {
        requireCondition(chartIds.includes(id) && Object.hasOwn(topic.charts ?? {}, id),
          `${topic.id}: evidence links to an unpublished chart ${id}`);
        return `<li><a href="#chart-${id}">${escape(topic.charts[id].title)}</a></li>`;
      }),
      ...metrics.map(id => {
        requireCondition(metricIds.includes(id) && Object.hasOwn(topic.metrics ?? {}, id),
          `${topic.id}: evidence links to an unpublished metric ${id}`);
        return `<li><a href="#metric-${id}">${escape(topic.metrics[id].label)}</a></li>`;
      }),
    ];
    return links.length ? `<ul class="evidence-links" aria-label="Related figures">${links.join('')}</ul>` : '';
  }

  function renderFlow(id) {
    requireCondition(Object.hasOwn(topic.visuals, id), `${topic.id}: unknown visual ${id}`);
    const visual = topic.visuals[id];
    const stepIds = visual.steps.flatMap(step => step.id === undefined ? [] : [step.id]);
    requireCondition(
      stepIds.every(id => typeof id === 'string' && slug.test(id)) && new Set(stepIds).size === stepIds.length,
      `${topic.id}: invalid or duplicate step ID in ${id}`,
    );
    const steps = visual.steps.map((step, index) => {
      const labels = (step.actors ?? []).map(id => {
        getActor(id);
        return escape(actors[id]);
      });
      const anchor = step.id ? ` id="${stepAnchor(id, step.id)}"` : '';
      return `<li${anchor}><span class="flow-number" aria-hidden="true">${index + 1}</span><strong>${escape(step.label)}</strong>${labels.length ? `<span class="step-actors">${labels.join(' · ')}</span>` : ''}
        <p>${escape(step.text)} ${citations(step.citations)}</p>${evidenceLinks(step)}</li>`;
    });
    return `<figure class="figure process"><figcaption>${escape(visual.title)}</figcaption>
      <ol class="flow">${steps.join('')}</ol></figure>`;
  }

  async function renderChart(id) {
    requireCondition(Object.hasOwn(topic.charts, id), `${topic.id}: unknown chart ${id}`);
    const chart = topic.charts[id];
    requireCondition(/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(chart.data), `${topic.id}: invalid chart filename`);
    const data = await readJson(content, `data/${chart.data}`);
    let body;
    switch (chart.type ?? 'bars') {
      case 'bars':
      case 'rates':
        body = renderBars(chart, data);
        break;
      case 'status':
        body = renderStatus(chart, data);
        break;
      case 'trend':
        body = renderTrend(chart, data, citations);
        break;
      default:
        throw new Error(`${topic.id}: unknown chart type ${chart.type}`);
    }
    return `<figure class="figure chart${chart.type === 'rates' ? ' rate-chart' : ''}" id="chart-${id}">
      <figcaption>${escape(chart.title)} ${citations(chart.citations)}</figcaption>
      ${chart.description ? `<p class="chart-description">${escape(chart.description)}</p>` : ''}
      ${body}
      ${chart.note ? `<p class="chart-note">${escape(chart.note)}</p>` : ''}
    </figure>`;
  }

  function renderMetrics(ids) {
    requireCondition(Array.isArray(ids) && ids.length, `${topic.id}: metrics block is empty`);
    const cards = ids.map(id => {
      requireCondition(Object.hasOwn(topic.metrics ?? {}, id), `${topic.id}: unknown metric ${id}`);
      const metric = topic.metrics[id];
      const { percentage, count, denominator } = metric;
      const reportedPercentage = percentage !== undefined;
      requireCondition(
        reportedPercentage
          ? Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 && count === undefined && denominator === undefined
          : Number.isSafeInteger(count) && Number.isSafeInteger(denominator) && count >= 0 && denominator > 0 && count <= denominator,
        `${topic.id}: invalid value or denominator for metric ${id}`,
      );
      for (const field of ['label', 'basis', 'type', ...topic.requiredMetricFields]) {
        requireCondition(typeof metric[field] === 'string' && metric[field].trim(), `${topic.id}: metric ${id} needs ${field}`);
      }
      const value = reportedPercentage ? `${number.format(percentage)}%` : `${number.format(count)} of ${number.format(denominator)}`;
      return `<div class="metric" id="metric-${id}">
        <dt>${escape(metric.label)}</dt>
        <dd><strong class="metric-value">${value}</strong>
          <p class="metric-source">${escape(metric.type)}${metric.asOf ? ` · ${dateLabel(metric.asOf)}` : ''}${metric.period ? ` · ${escape(metric.period)}` : ''} ${citations(metric.citations)}</p>
          ${metric.population ? `<p class="metric-population">${escape(metric.population)}.</p>` : ''}
          <p>${escape(metric.basis)}</p>
        </dd>
      </div>`;
    });
    return `<dl class="metric-grid">${cards.join('')}</dl>`;
  }

  function renderIssues(ids) {
    requireCondition(Array.isArray(ids) && ids.length, `${topic.id}: issues block is empty`);
    return ids.map(id => {
      requireCondition(Object.hasOwn(topic.issues ?? {}, id), `${topic.id}: unknown issue ${id}`);
      const issue = topic.issues[id];
      const step = processLink(issue.step, `issue ${id}`);
      const links = evidenceLinks(issue);
      requireCondition(
        links || issue.improvement?.evidenceGap?.trim(),
        `${topic.id}: issue ${id} needs a figure or an explicit evidence gap`,
      );
      const fix = `<a href="#improvement-${id}">Response and what to track</a>`;
      requireCondition(issue.title?.trim() && issue.text?.trim(), `${topic.id}: issue ${id} needs a title and finding`);
      const consequences = issue.consequences ?? [];
      requireCondition(Array.isArray(consequences) && (!topic.requireConsequences || consequences.length),
        `${topic.id}: issue ${id} needs a consequence`);
      const effects = consequences.map(consequence => {
        requireCondition(typeof consequence.text === 'string' && consequence.text.trim(),
          `${topic.id}: issue ${id} has an empty consequence`);
        return `<p>${escape(consequence.text)} ${citations(consequence.citations)}</p>`;
      });
      return `<div class="finding">
        <h3>${escape(issue.title)}</h3>
        <p class="finding-step">${step}</p>
        <p>${escape(issue.text)} ${citations(issue.citations)}</p>
        ${effects.length ? `<div class="consequences"><h4>Why it matters</h4>${effects.join('')}</div>` : ''}
        ${links}
        <p class="finding-next">${fix}</p>
      </div>`;
    }).join('');
  }

  function renderImprovements(ids) {
    requireCondition(Array.isArray(ids) && ids.length, `${topic.id}: improvements block is empty`);
    return ids.map(id => {
      const improvement = topic.issues?.[id]?.improvement;
      for (const field of ['title', 'status', 'measure']) {
        requireCondition(typeof improvement?.[field] === 'string' && improvement[field].trim(), `${topic.id}: improvement ${id} needs ${field}`);
      }
      getActor(improvement.owner);
      return `<div class="finding" id="improvement-${id}">
        <h3>${escape(improvement.title)}</h3>
        <p><strong>${escape(actors[improvement.owner])}.</strong> ${escape(improvement.status)} ${citations(improvement.citations)}</p>
        <p><strong>What to track.</strong> ${escape(improvement.measure)}</p>
        ${improvement.evidenceGap ? `<p class="evidence-gap">${escape(improvement.evidenceGap)}</p>` : ''}
      </div>`;
    }).join('');
  }

  function renderScrutiny(ids) {
    requireCondition(Array.isArray(ids) && ids.length, `${topic.id}: scrutiny block is empty`);
    const statusLabels = {
      requested: 'Requested by the committee',
      promised: 'Promised by officials',
      overdue: 'Overdue',
      partial: 'Partly provided',
      provided: 'Provided',
    };
    const followUps = [];
    const exchanges = ids.map(id => {
      requireCondition(Object.hasOwn(topic.scrutiny ?? {}, id), `${topic.id}: unknown scrutiny exchange ${id}`);
      const exchange = topic.scrutiny[id];
      for (const field of ['question', 'answer', 'watch']) {
        requireCondition(typeof exchange[field] === 'string' && exchange[field].trim(),
          `${topic.id}: scrutiny exchange ${id} needs ${field}`);
      }
      const step = processLink(exchange.step, `scrutiny exchange ${id}`);
      const recording = topic.sources[exchange.recording];
      requireCondition(Object.hasOwn(topic.sources, exchange.recording) && recording.reference?.trim(),
        `${topic.id}: scrutiny exchange ${id} needs a recording reference`);
      const followUp = exchange.followUp;
      if (followUp) {
        requireCondition(followUp.title?.trim() && Array.isArray(followUp.history) && followUp.history.length,
          `${topic.id}: scrutiny follow-up ${id} needs a title and dated history`);
        const history = followUp.history.map((event, index) => {
          requireCondition(Object.hasOwn(statusLabels, event.status) && event.text?.trim(),
            `${topic.id}: invalid follow-up entry for ${id}`);
          requireCondition((index === 0 || followUp.history[index - 1].date <= event.date) && event.date <= topic.reviewed,
            `${topic.id}: follow-up dates for ${id} must be ordered and within the review date`);
          return `<li>${dateLabel(event.date)} · <strong>${statusLabels[event.status]}</strong>. ${escape(event.text)} ${citations(event.citations)}</li>`;
        });
        followUps.push(`<li id="follow-up-${id}"><h4>${escape(followUp.title)}</h4>
          <ol class="follow-up-history">${history.join('')}</ol>
          <p class="finding-next"><a href="#scrutiny-${id}">Read the exchange</a></p></li>`);
      }
      return `<div class="finding" id="scrutiny-${id}">
        <h3>${escape(exchange.question)}</h3>
        <p class="finding-step">${step} <span aria-hidden="true">·</span> <a href="${escape(recording.url)}">Watch from ${escape(recording.reference)}</a></p>
        <p>${escape(exchange.answer)} ${citations(exchange.citations)}</p>
        <p><strong>What to watch for.</strong> ${escape(exchange.watch)}</p>
        ${evidenceLinks(exchange)}
        ${followUp ? `<p class="finding-next"><a href="#follow-up-${id}">Track the follow-up</a></p>` : ''}
      </div>`;
    });
    const tracker = followUps.length ? `<div class="figure follow-ups" id="scrutiny-follow-up">
      <h3>Evidence to follow up</h3><ul>${followUps.join('')}</ul></div>` : '';
    return tracker + exchanges.join('');
  }

  async function renderBlock(block) {
    const blockKinds = ['text', 'visual', 'actors', 'chart', 'metrics', 'issues', 'improvements', 'scrutiny']
      .filter(kind => Object.hasOwn(block, kind));
    requireCondition(blockKinds.length === 1, `${topic.id}: each block needs one content type`);
    switch (blockKinds[0]) {
      case 'text':
        return `${block.heading ? `<h3>${escape(block.heading)}</h3>` : ''}<p>${escape(block.text)} ${citations(block.citations)}</p>`;
      case 'visual':
        return renderFlow(block.visual);
      case 'chart':
        return renderChart(block.chart);
      case 'metrics':
        return renderMetrics(block.metrics);
      case 'issues':
        return renderIssues(block.issues);
      case 'improvements':
        return renderImprovements(block.improvements);
      case 'scrutiny':
        return renderScrutiny(block.scrutiny);
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
