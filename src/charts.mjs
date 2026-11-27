import { dateLabel, escape, number, parseDate, requireCondition } from './html.mjs';

const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });
const integer = value => Number.isSafeInteger(value) && value >= 0;

export function renderBars(chart, data) {
  requireCondition(data.series.length && data.series.every(row =>
    typeof row.label === 'string' && integer(row.value)), `${chart.data}: invalid series`);
  const max = Math.max(1, ...data.series.map(row => row.value));
  const total = data.series.reduce((sum, row) => sum + row.value, 0);
  const rows = data.series.map(({ label, value }) => `<tr>
    <th scope="row">${escape(label)}</th>
    <td><span class="bar-track" aria-hidden="true"><span class="bar" style="--value:${100 * value / max}%"></span></span></td>
    <td>${number.format(value)}</td>
  </tr>`).join('');
  const table = `<table aria-label="${escape(chart.title)}"><thead class="visually-hidden">
    <tr><th scope="col">${escape(data.groupLabel)}</th><th scope="col">Relative bar</th><th scope="col">${escape(data.unit)}</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  return `<p class="chart-date">As at ${dateLabel(data.asOf)}</p>
    ${chart.showTotal ? `<div class="chart-total"><strong>${number.format(total)}</strong> <span>${escape(data.unit)}</span></div>` : ''}
    ${chart.details ? `<details class="chart-details"><summary>Breakdown by order type</summary>${table}</details>` : table}`;
}

export function renderStatus(chart, data) {
  const { stages, groups } = data;
  requireCondition(Array.isArray(stages) && stages.length >= 2 && stages.length <= 4 &&
    stages.every(stage => typeof stage === 'string' && stage.trim()) && Array.isArray(groups) && groups.length,
    `${chart.data}: status charts need stages and groups`);
  const series = groups.map(group => {
    requireCondition(Array.isArray(group.snapshots) && group.snapshots.length, `${chart.data}: empty status group`);
    let previousDate = '';
    const snapshots = group.snapshots.map(({ asOf, counts }) => {
      requireCondition(Array.isArray(counts) && counts.length === stages.length && counts.every(integer) &&
        asOf > previousDate, `${chart.data}: invalid status counts or date order for ${group.label}`);
      previousDate = asOf;
      const total = counts.reduce((sum, count) => sum + count, 0);
      requireCondition(total > 0 && Number.isSafeInteger(total), `${chart.data}: invalid status denominator`);
      const marks = counts.map((count, index) =>
        `<span class="status-fill stage-${index}" style="flex:${count} 1 0"></span>`).join('');
      const labels = counts.map((count, index) => `<li class="status-value">
        <span class="status-label"><span class="status-fill stage-${index}" aria-hidden="true"></span>${escape(stages[index])}</span>
        <span><strong>${percent.format(count / total)}</strong> <span class="status-count">(${number.format(count)})</span></span>
      </li>`).join('');
      return `<div class="status-snapshot">
        <p class="chart-date">${dateLabel(asOf)} · ${number.format(total)} people</p>
        <div class="status-bar" aria-hidden="true">${marks}</div>
        <ul class="status-values" style="--stages:${stages.length}" aria-label="Share and number of people by status">${labels}</ul>
      </div>`;
    });
    return `<div class="status-group"><h3>${escape(group.label)}</h3>${snapshots.join('')}</div>`;
  });
  return series.join('');
}

export function renderTrend(chart, data, citations) {
  requireCondition(Array.isArray(data.segments) && data.segments.length, `${chart.data}: missing trend segments`);
  const events = data.events ?? [];
  requireCondition(Array.isArray(events), `${chart.data}: invalid trend events`);
  let previous = -Infinity;
  const segments = data.segments.map(segment => {
    requireCondition(Array.isArray(segment.points) && segment.points.length && segment.label && segment.definition,
      `${chart.data}: each trend segment needs observations and a definition`);
    const points = segment.points.map(([asOf, value, status]) => {
      const time = parseDate(asOf).getTime();
      requireCondition(time > previous && (value === null || integer(value)) &&
        (status === undefined || ['Revised', 'Provisional'].includes(status)),
        `${chart.data}: invalid or out-of-order observation on ${asOf}`);
      previous = time;
      return { asOf, time, value, status };
    });
    requireCondition(points.some(point => point.value !== null), `${chart.data}: trend segment has no values`);
    return { ...segment, points };
  });

  const first = segments[0].points[0].time;
  const last = segments.at(-1).points.at(-1).time;
  const values = segments.flatMap(segment => segment.points.map(point => point.value ?? 0));
  const interval = Math.max(1, Math.ceil(Math.max(...values) / 4000)) * 1000;
  const top = 18;
  const bottom = 181;
  const left = 47;
  const right = 621;
  const x = time => left + (right - left) * (time - first) / Math.max(1, last - first);
  const y = value => bottom - (bottom - top) * value / (4 * interval);
  const num = coordinate => coordinate.toFixed(1);

  const gaps = segments.slice(1).map((segment, index) => {
    const end = segments[index].points.at(-1).time;
    const start = segment.points[0].time;
    return `<rect class="trend-gap" x="${num(x(end))}" y="${top}" width="${num(x(start) - x(end))}" height="${bottom - top}"/>`;
  });
  const rules = Array.from({ length: 5 }, (_, i) => {
    const value = i * interval;
    return `<line class="trend-gridline" x1="${left}" x2="${right}" y1="${num(y(value))}" y2="${num(y(value))}"/>
      <text x="${left - 8}" y="${num(y(value) + 4)}" text-anchor="end">${value ? `${value / 1000}k` : '0'}</text>`;
  });
  const firstYear = new Date(first).getUTCFullYear();
  const lastYear = new Date(last).getUTCFullYear();
  const yearStep = Math.max(1, Math.ceil((lastYear - firstYear) / 6));
  const years = [];
  for (let year = firstYear + 1; year <= lastYear; year += yearStep) {
    years.push(`<text x="${num(x(Date.UTC(year, 0, 1)))}" y="205" text-anchor="middle">${year}</text>`);
  }
  const policyLines = events.filter(event => event.kind === 'policy').map(event => {
    const time = parseDate(event.date).getTime();
    if (time < first || time > last) return '';
    return `<line class="trend-policy" x1="${num(x(time))}" x2="${num(x(time))}" y1="${top}" y2="${bottom}"/>`;
  });
  const marks = segments.map(({ points }, index) => {
    let path = '';
    let continuing = false;
    for (const point of points) {
      if (point.value === null) {
        continuing = false;
        continue;
      }
      path += `${continuing ? 'L' : 'M'}${num(x(point.time))} ${num(y(point.value))} `;
      continuing = true;
    }
    const dots = points.flatMap((point, pointIndex) => {
      if (point.value === null || (points[pointIndex - 1]?.value != null && points[pointIndex + 1]?.value != null)) return [];
      return `<circle cx="${num(x(point.time))}" cy="${num(y(point.value))}" r="2.8"/>`;
    });
    return `<g class="trend-series ${index % 2 ? 'trend-current' : 'trend-earlier'}"><path d="${path.trim()}"/>${dots.join('')}</g>`;
  });
  const legend = segments.map((segment, index) => `<li><span class="trend-key ${index % 2 ? 'trend-current' : 'trend-earlier'}" aria-hidden="true"></span>${escape(segment.label)}</li>`);
  if (gaps.length) legend.push('<li><span class="trend-key trend-gap" aria-hidden="true"></span>Break in the series</li>');
  if (policyLines.some(Boolean)) legend.push('<li><span class="trend-key trend-policy" aria-hidden="true"></span>Policy change</li>');
  const eventLabels = { collection: 'Collection change', policy: 'Policy change' };
  const notes = events.map(event => {
    requireCondition(Object.hasOwn(eventLabels, event.kind) && event.text, `${chart.data}: invalid trend event`);
    return `<li><strong>${eventLabels[event.kind]}</strong> · ${dateLabel(event.date)}. ${escape(event.text)} ${citations(event.citations)}</li>`;
  });
  const tables = segments.map(segment => `<p><strong>${escape(segment.label)}.</strong> ${escape(segment.definition)} ${citations(segment.citations)}</p>
    <table aria-label="${escape(segment.label)}">
      <thead><tr><th scope="col">Month ending</th><th scope="col">People</th><th scope="col">Publication status</th></tr></thead>
      <tbody>${segment.points.map(point => `<tr><th scope="row">${dateLabel(point.asOf)}</th><td>${point.value === null ? 'Unavailable' : number.format(point.value)}</td><td>${point.status ?? '—'}</td></tr>`).join('')}</tbody>
    </table>`);
  return `<ul class="chart-legend" aria-label="Trend legend">${legend.join('')}</ul>
    <svg class="trend-plot" viewBox="0 0 640 215" aria-hidden="true" focusable="false">
      ${gaps.join('')}${rules.join('')}${years.join('')}${policyLines.join('')}${marks.join('')}
    </svg>
    ${notes.length ? `<ul class="trend-events">${notes.join('')}</ul>` : ''}
    <details class="chart-details"><summary>View monthly figures and definitions</summary>${tables.join('')}</details>`;
}
