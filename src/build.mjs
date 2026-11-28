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
const correctionsFormId = site.correctionsFormId ?? null;
requireCondition(correctionsFormId === null ||
  (typeof correctionsFormId === 'string' && /^[a-z0-9]+$/i.test(correctionsFormId)),
  'site.json: correctionsFormId must be a published Tally form ID or null');

function contentBlocks(blocks) {
  return blocks.flatMap(block => block.details ? [block, ...contentBlocks(block.details.blocks)] : [block]);
}

function permalink(id, label) {
  return `<a class="permalink" href="#${escape(id)}" aria-label="Link to ${escape(label)}" title="Link to this passage">#</a>`;
}

function page({ title, description, prefix, body, guideId }) {
  const fullTitle = title ? `${title} | ${site.name}` : site.name;
  const contactPath = `${prefix}corrections/`;
  const correctionPath = guideId ? `${contactPath}?guide=${encodeURIComponent(guideId)}` : `${contactPath}?enquiry=correction`;
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
      ${correctionsFormId ? `<div class="footer-corrections">
        <a href="${correctionPath}">Send a correction or update</a> <span aria-hidden="true">·</span>
        <a href="${contactPath}?enquiry=suggestion">Suggest a topic</a>
      </div>` : ''}
    </div>
  </footer>
</body>
</html>
`;
}

function renderIndex(topics) {
  const cards = topics.map(topic => `<li data-topic-search="${escape([
    topic.title, topic.summary, topic.category, topic.scope, ...(topic.searchTerms ?? []),
  ].join(' '))}">
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
        <h1>How public services <em>work in practice</em></h1>
        <p>${escape(site.description)}</p>
      </div>
    </div>
    <section class="wrap topics" id="topics">
      <h2>Explore topics</h2>
      <div class="topic-search" hidden>
        <label for="topic-query">Search topics</label>
        <input id="topic-query" type="search" aria-controls="topic-results" placeholder="For example, potholes or Delay Repay">
        <p class="search-status" role="status"></p>
      </div>
      <ul class="topic-list" id="topic-results">${cards}</ul>
    </section>
    <script src="./assets/topic-search.js" defer></script>`,
  });
}

function renderCorrections(formId, topics) {
  const embed = new URL(`https://tally.so/embed/${formId}`);
  embed.search = new URLSearchParams({
    alignLeft: '1',
    hideTitle: '1',
    transparentBackground: '1',
    dynamicHeight: '1',
  });
  const guideTitles = Object.fromEntries(topics.map(({ id, title }) => [id, title]));
  const prompt = 'Send a correction, suggest a topic or share a source that could help update a guide.';

  return page({
    title: 'Contact us',
    description: prompt,
    prefix: '../',
    body: `<header class="article-hero article-hero--compact">
      <div class="wrap">
        <h1>Contact us</h1>
        <p class="article-summary">${escape(prompt)}</p>
      </div>
    </header>
    <div class="wrap corrections-form" data-guide-titles="${escape(JSON.stringify(guideTitles))}">
      <p>For a topic suggestion, use <strong>Question</strong> and enter the proposed topic in <strong>Page or topic</strong>. For a correction or source update, use <strong>Correction</strong> and give the guide’s title or link. You can change any prefilled answers.</p>
      <p>This form uses Tally, a third-party service, to email us your message. Please leave out sensitive personal information. <a href="https://tally.so/help/privacy-policy">Read Tally’s privacy policy</a>.</p>
      <p><a id="tally-form-link" href="https://tally.so/r/${escape(formId)}">Open the form on Tally</a></p>
      <iframe id="tally-form" title="Contact form" src="${escape(embed.href)}" height="720" loading="lazy" referrerpolicy="no-referrer"></iframe>
    </div>
    <script src="../assets/contact-prefill.js" defer></script>
    <script src="https://tally.so/widgets/embed.js" defer></script>`,
  });
}

async function loadTopic(filename) {
  const topic = await readJson(content, `topics/${filename}`);
  for (const [kind, value] of [['topic ID', topic.id], ['template', topic.template]]) {
    requireCondition(typeof value === 'string' && slug.test(value), `${filename}: invalid ${kind}`);
  }
  requireCondition(basename(filename, '.json') === topic.id, `${filename}: filename must match topic ID`);
  const template = await readJson(content, `templates/${topic.template}.json`);
  for (const field of ['searchTerms', 'related']) {
    requireCondition(topic[field] === undefined || (Array.isArray(topic[field]) &&
      topic[field].every(value => typeof value === 'string' && value.trim()) &&
      new Set(topic[field]).size === topic[field].length), `${filename}: invalid ${field}`);
  }
  const sectionIds = template.sections.map(section => section.id);
  requireCondition(new Set(sectionIds).size === sectionIds.length, `${filename}: duplicate template section`);
  const sectionOrder = template.sections.filter(({ id, optional }) => !optional || Object.hasOwn(topic.sections, id));
  requireCondition(
    Object.keys(topic.sections).length === sectionOrder.length &&
      sectionOrder.every(({ id, allowEmpty }) => Array.isArray(topic.sections[id]) && (allowEmpty || topic.sections[id].length)),
    `${filename}: sections must match the template and required sections must have content`,
  );
  for (const { id, requiredBlock } of sectionOrder) {
    if (requiredBlock) {
      requireCondition(
        contentBlocks(topic.sections[id]).some(block => Object.hasOwn(block, requiredBlock)),
        `${filename}: ${id} requires a ${requiredBlock} block`,
      );
    }
  }
  for (const { id } of template.mobileLinks ?? []) {
    requireCondition(sectionOrder.some(section => section.id === id), `${filename}: unknown mobile link ${id}`);
  }
  return {
    ...topic,
    sectionOrder,
    mobileLinks: template.mobileLinks ?? [],
    requiredMetricFields: template.requiredMetricFields ?? [],
    requireConsequences: template.requireConsequences ?? false,
    requireImprovement: template.requireImprovement ?? true,
    inlineIssueEvidence: template.inlineIssueEvidence ?? false,
  };
}

async function renderTopic(topic, topicsById) {
  const allBlocks = contentBlocks(Object.values(topic.sections).flat());
  const listed = kind => allBlocks.flatMap(block => block[kind] ?? []);
  const visualIds = listed('visual');
  const issueIds = listed('issues');
  const inlineIssues = topic.inlineIssueEvidence ? issueIds :
    allBlocks.filter(block => block.issues && block.inlineEvidence).flatMap(block => block.issues);
  const chartIds = [...listed('chart'), ...inlineIssues.flatMap(id => topic.issues?.[id]?.charts ?? [])];
  const metricIds = [...listed('metrics'), ...inlineIssues.flatMap(id => topic.issues?.[id]?.metrics ?? [])];
  const improvementIds = listed('improvements');
  const scrutinyIds = listed('scrutiny');
  for (const ids of [visualIds, chartIds, metricIds, issueIds, improvementIds, scrutinyIds]) {
    requireCondition(
      ids.every(id => typeof id === 'string' && slug.test(id)) && new Set(ids).size === ids.length,
      `${topic.id}: invalid or duplicate reference in the topic sections`,
    );
  }
  requireCondition(
    improvementIds.every(id => issueIds.includes(id)),
    `${topic.id}: each published improvement needs a published issue`,
  );
  requireCondition(
    !topic.requireImprovement || issueIds.length === improvementIds.length,
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

  const blockIds = allBlocks.flatMap(block => block.id === undefined ? [] : [block.id]);
  const anchors = [...blockIds, ...topic.sectionOrder.map(section => section.id)];
  requireCondition(anchors.every(id => typeof id === 'string' && slug.test(id)) && new Set(anchors).size === anchors.length,
    `${topic.id}: invalid or duplicate block or section anchor`);

  function disclosure(title, body) {
    return `<details class="article-details"><summary>${escape(title)}</summary>${body}</details>`;
  }

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
      const note = step.note ? `<div class="flow-note"><strong>${escape(step.note.heading)}</strong>
        <p>${escape(step.note.text)} ${citations(step.note.citations)}</p></div>` : '';
      return `<li${anchor}><span class="flow-number" aria-hidden="true">${index + 1}</span><strong>${escape(step.label)}</strong>${labels.length ? `<span class="step-actors">${labels.join(' · ')}</span>` : ''}
        <p>${escape(step.text)} ${citations(step.citations)}</p>${note}${evidenceLinks(step)}</li>`;
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
      <figcaption>${escape(chart.title)} ${citations(chart.citations)} ${permalink(`chart-${id}`, chart.title)}</figcaption>
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
        <dt>${escape(metric.label)} ${permalink(`metric-${id}`, metric.label)}</dt>
        <dd><strong class="metric-value">${value}</strong>
          <p class="metric-source">${escape(metric.type)}${metric.asOf ? ` · ${dateLabel(metric.asOf)}` : ''}${metric.period ? ` · ${escape(metric.period)}` : ''} ${citations(metric.citations)}</p>
          ${metric.population ? `<p class="metric-population">${escape(metric.population)}.</p>` : ''}
          <p>${escape(metric.basis)}</p>
        </dd>
      </div>`;
    });
    return `<dl class="metric-grid">${cards.join('')}</dl>`;
  }

  async function renderIssues(ids) {
    requireCondition(Array.isArray(ids) && ids.length, `${topic.id}: issues block is empty`);
    const findings = await Promise.all(ids.map(async id => {
      requireCondition(Object.hasOwn(topic.issues ?? {}, id), `${topic.id}: unknown issue ${id}`);
      const issue = topic.issues[id];
      const step = processLink(issue.step, `issue ${id}`);
      const links = evidenceLinks(issue);
      const hasResponse = improvementIds.includes(id);
      requireCondition(
        links || issue.evidenceGap?.trim() || (hasResponse && issue.improvement?.evidenceGap?.trim()),
        `${topic.id}: issue ${id} needs a figure or an explicit evidence gap`,
      );
      const inline = inlineIssues.includes(id);
      const fix = hasResponse
        ? `<p class="finding-next"><a href="#improvement-${id}">${inline ? 'See the response and timeline' : 'Response and what to track'}</a></p>`
        : '';
      requireCondition(issue.title?.trim() && issue.text?.trim(), `${topic.id}: issue ${id} needs a title and finding`);
      const consequences = issue.consequences ?? [];
      requireCondition(Array.isArray(consequences) && (!topic.requireConsequences || consequences.length),
        `${topic.id}: issue ${id} needs a consequence`);
      const effects = consequences.map(consequence => {
        requireCondition(typeof consequence.text === 'string' && consequence.text.trim(),
          `${topic.id}: issue ${id} has an empty consequence`);
        return `<p>${escape(consequence.text)} ${citations(consequence.citations)}</p>`;
      });
      const metrics = inline && issue.metrics?.length ? renderMetrics(issue.metrics) : '';
      const charts = inline && issue.charts?.length ? (await Promise.all(issue.charts.map(renderChart))).join('') : '';
      const chartEvidence = charts && issue.chartDisclosure ? disclosure(issue.chartDisclosure, charts) : charts;
      const measure = issue.measure ?? issue.improvement?.measure;
      requireCondition(!inline || (typeof measure === 'string' && measure.trim()), `${topic.id}: issue ${id} needs a measure of progress`);
      const progress = inline ? `<p class="finding-measure"><strong>What would show progress.</strong> ${escape(measure)}</p>` : '';
      return `<div class="finding"${inline ? ` id="finding-${id}"` : ''}>
        <h3>${escape(issue.title)}${inline ? ` ${permalink(`finding-${id}`, issue.title)}` : ''}</h3>
        <p class="finding-step">${step}</p>
        <p>${escape(issue.text)} ${citations(issue.citations)}</p>
        ${metrics}
        ${effects.length ? `<div class="consequences"><h4>Why it matters</h4>${effects.join('')}</div>` : ''}
        ${issue.evidenceGap ? `<p class="evidence-gap">${escape(issue.evidenceGap)}</p>` : ''}${progress}
        ${inline ? chartEvidence : links}
        ${fix}
      </div>`;
    }));
    return findings.join('');
  }

  function renderImprovements(ids) {
    requireCondition(Array.isArray(ids) && ids.length, `${topic.id}: improvements block is empty`);
    return ids.map(id => {
      const issue = topic.issues?.[id];
      const improvement = issue?.improvement;
      for (const field of ['title', 'status']) {
        requireCondition(typeof improvement?.[field] === 'string' && improvement[field].trim(), `${topic.id}: improvement ${id} needs ${field}`);
      }
      const measure = issue.measure ?? improvement.measure;
      requireCondition(typeof measure === 'string' && measure.trim(), `${topic.id}: improvement ${id} needs a measure of progress`);
      getActor(improvement.owner);
      return `<div class="finding" id="improvement-${id}">
        <h3>${escape(improvement.title)} ${permalink(`improvement-${id}`, improvement.title)}</h3>
        <p><strong>${escape(actors[improvement.owner])}.</strong> ${escape(improvement.status)} ${citations(improvement.citations)}</p>
        ${inlineIssues.includes(id)
          ? `<p class="finding-next"><a href="#finding-${id}">See how to measure progress</a></p>`
          : `<p><strong>What to track.</strong> ${escape(measure)}</p>`}
        ${improvement.evidenceGap ? `<p class="evidence-gap">${escape(improvement.evidenceGap)}</p>` : ''}
      </div>`;
    }).join('');
  }

  function renderScrutiny(ids, collapseExchanges) {
    requireCondition(Array.isArray(ids) && ids.length, `${topic.id}: scrutiny block is empty`);
    const statusLabels = {
      requested: 'Requested by the committee',
      ordered: 'Ordered',
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
      const recordId = exchange.recording ?? exchange.record;
      const record = topic.sources[recordId];
      requireCondition(Object.hasOwn(topic.sources, recordId) && (!exchange.recording || record.reference?.trim()),
        `${topic.id}: scrutiny exchange ${id} needs a written record or a recording with a timestamp`);
      const recordLabel = exchange.recording ? `Watch from ${record.reference}` : 'Read the official record';
      const followUp = exchange.followUp;
      if (followUp) {
        requireCondition(followUp.title?.trim() && Array.isArray(followUp.history) && followUp.history.length,
          `${topic.id}: scrutiny follow-up ${id} needs a title and dated history`);
        const history = followUp.history.map((event, index) => {
          requireCondition(Object.hasOwn(statusLabels, event.status) && event.text?.trim(),
            `${topic.id}: invalid follow-up entry for ${id}`);
          requireCondition((index === 0 || followUp.history[index - 1].date <= event.date) && event.date <= topic.reviewed,
            `${topic.id}: follow-up dates for ${id} must be ordered and within the review date`);
          const status = event.status === 'requested' && !exchange.recording ? 'Requested' : statusLabels[event.status];
          return `<li>${dateLabel(event.date)} · <strong>${status}</strong>. ${escape(event.text)} ${citations(event.citations)}</li>`;
        });
        followUps.push(`<li id="follow-up-${id}"><h4>${escape(followUp.title)} ${permalink(`follow-up-${id}`, followUp.title)}</h4>
          <ol class="follow-up-history">${history.join('')}</ol>
          <p class="finding-next"><a href="#scrutiny-${id}">Read the exchange</a></p></li>`);
      }
      return `<div class="finding" id="scrutiny-${id}">
        <h3>${escape(exchange.question)} ${permalink(`scrutiny-${id}`, exchange.question)}</h3>
        <p class="finding-step">${step} <span aria-hidden="true">·</span> <a href="${escape(record.url)}">${escape(recordLabel)}</a></p>
        <p>${escape(exchange.answer)} ${citations(exchange.citations)}</p>
        <p><strong>What to watch for.</strong> ${escape(exchange.watch)}</p>
        ${evidenceLinks(exchange)}
        ${followUp ? `<p class="finding-next"><a href="#follow-up-${id}">Track the follow-up</a></p>` : ''}
      </div>`;
    });
    const tracker = followUps.length ? `<div class="figure follow-ups" id="scrutiny-follow-up">
      <h3>Evidence to follow up</h3><ul>${followUps.join('')}</ul></div>` : '';
    const summary = typeof collapseExchanges === 'string' ? collapseExchanges : 'Questions and answers from the hearing';
    return tracker + (collapseExchanges ? disclosure(summary, exchanges.join('')) : exchanges.join(''));
  }

  async function renderBlock(block) {
    const blockKinds = ['text', 'visual', 'actors', 'chart', 'metrics', 'issues', 'improvements', 'scrutiny', 'takeaways', 'details']
      .filter(kind => Object.hasOwn(block, kind));
    requireCondition(blockKinds.length === 1, `${topic.id}: each block needs one content type`);
    const anchor = block.id ? ` id="${escape(block.id)}"` : '';
    switch (blockKinds[0]) {
      case 'text':
        return `${block.heading ? `<h3${anchor}>${escape(block.heading)}${block.id ? ` ${permalink(block.id, block.heading)}` : ''}</h3>` : ''}<p${block.heading ? '' : anchor}>${escape(block.text)} ${citations(block.citations)}</p>`;
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
        return renderScrutiny(block.scrutiny, block.collapseExchanges);
      case 'takeaways':
        requireCondition(Array.isArray(block.takeaways) && block.takeaways.length === 3, `${topic.id}: provide three takeaways`);
        return `<ul class="takeaways"${anchor}>${block.takeaways.map(item => {
          requireCondition(item.label?.trim() && item.text?.trim(), `${topic.id}: each takeaway needs a label and text`);
          return `<li><strong>${escape(item.label)}.</strong> ${escape(item.text)} ${citations(item.citations)}</li>`;
        }).join('')}</ul>`;
      case 'details': {
        const { title, blocks } = block.details;
        requireCondition(title?.trim() && blocks.length, `${topic.id}: details need a title and content`);
        const body = await Promise.all(blocks.map(renderBlock));
        return disclosure(title, `<div${anchor}>${body.join('')}</div>`);
      }
      case 'actors':
        return `<dl class="actors">${block.actors.map(id => {
          const actor = getActor(id);
          return `<div><dt>${escape(actors[id])}</dt><dd>${escape(actor.role)} ${citations(actor.citations)}</dd></div>`;
        }).join('')}</dl>`;
    }
  }

  const sources = Object.values(topic.sources).map((source, index) => {
    requireCondition(new URL(source.url).protocol === 'https:', `${topic.id}: source URLs must use HTTPS`);
    return `<li id="source-${index + 1}">
      <a href="${escape(source.url)}">${escape(source.title)}</a>
      <div class="source-detail">${escape(source.publisher)}${source.date ? ` · ${dateLabel(source.date)}` : ''}${source.reference ? ` · ${escape(source.reference)}` : ''}</div>
    </li>`;
  });
  const sourceList = `<ol>${sources.join('')}</ol>`;
  const includesSources = topic.sectionOrder.some(section => section.id === 'sources');
  const sections = await Promise.all(topic.sectionOrder.map(async ({ id, title }) => {
    const blocks = await Promise.all(topic.sections[id].map(renderBlock));
    const references = id === 'sources' ? `<div class="sources"><h3>References</h3>${sourceList}</div>` : '';
    return `<section class="article-section" id="${escape(id)}"><h2>${escape(title)} ${permalink(id, title)}</h2>${blocks.join('')}${references}</section>`;
  }));
  const navigationLinks = entries => entries.map(({ id, title }) =>
    `<li><a href="#${escape(id)}">${escape(title)}</a></li>`).join('');
  const links = navigationLinks(topic.sectionOrder);
  const mobileLinks = topic.mobileLinks.length ? `<nav class="mobile-contents" aria-label="Jump to a section">
    <ul>${navigationLinks(topic.mobileLinks)}</ul></nav>` : '';
  const relatedLinks = (topic.related ?? []).map(id => {
    requireCondition(id !== topic.id && topicsById.has(id), `${topic.id}: invalid related topic ${id}`);
    return `<li><a href="../${escape(id)}/">${escape(topicsById.get(id).title)}</a></li>`;
  });

  return page({
    title: topic.title,
    description: topic.summary,
    prefix: '../../',
    guideId: topic.id,
    body: `<header class="article-hero${mobileLinks ? ' article-hero--compact' : ''}">
      <div class="wrap">
        <a class="back" href="../../#topics"><span aria-hidden="true">←</span> All topics</a>
        <p class="meta">${escape(topic.category)} <span aria-hidden="true">·</span> ${escape(topic.scope)}</p>
        <h1>${escape(topic.title)}</h1>
        <p class="article-summary">${escape(topic.summary)} ${citations(topic.citations)}</p>
        <p class="review-date">Reviewed ${dateLabel(topic.reviewed)}</p>
      </div>
    </header>
    <div class="wrap article-layout${mobileLinks ? ' has-mobile-contents' : ''}">
      <aside><nav class="contents" aria-label="On this page">
        <p>On this page</p><ul>${links}${includesSources ? '' : '<li><a href="#sources">Sources</a></li>'}</ul>
      </nav>${mobileLinks}</aside>
      <article>
        ${sections.join('')}
        ${includesSources ? '' : `<section class="article-section sources" id="sources"><h2>Sources</h2>${sourceList}</section>`}
        ${relatedLinks.length ? `<nav class="article-section related-topics" aria-label="Related topics"><h2>Related topics</h2><ul>${relatedLinks.join('')}</ul></nav>` : ''}
      </article>
    </div>`,
  });
}

const files = (await readdir(new URL('topics/', content))).filter(file => file.endsWith('.json')).sort();
requireCondition(files.length, 'Add at least one topic in content/topics');
const topics = await Promise.all(files.map(loadTopic));
const topicsById = new Map(topics.map(topic => [topic.id, topic]));
const topicPages = await Promise.all(topics.map(topic => renderTopic(topic, topicsById)));

await rm(dist, { recursive: true, force: true });
await mkdir(new URL('assets/', dist), { recursive: true });
await copyFile(new URL('src/site.css', root), new URL('assets/site.css', dist));
await copyFile(new URL('src/topic-search.js', root), new URL('assets/topic-search.js', dist));
await writeFile(new URL('.nojekyll', dist), '');
await writeFile(new URL('index.html', dist), renderIndex(topics));
if (correctionsFormId) {
  const directory = new URL('corrections/', dist);
  await mkdir(directory, { recursive: true });
  await copyFile(new URL('src/contact-prefill.js', root), new URL('assets/contact-prefill.js', dist));
  await writeFile(new URL('index.html', directory), renderCorrections(correctionsFormId, topics));
}
for (const [index, topic] of topics.entries()) {
  const directory = new URL(`topics/${topic.id}/`, dist);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('index.html', directory), topicPages[index]);
}
console.log(`Built ${topics.length} topic page(s) in ${fileURLToPath(dist)}`);
