import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { requireCondition } from './html.mjs';

export const imageWidth = 1200;
export const imageHeight = 630;

function wrap(context, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  return [...lines, line];
}

function drawLines(context, { text, x, y, width, leading, maxLines, font, colour, topicId }) {
  context.font = font;
  context.fillStyle = colour;
  const lines = wrap(context, text, width);
  requireCondition(lines.length <= maxLines && lines.every(line => context.measureText(line).width <= width),
    `${topicId}: shorten the share card copy "${text}"`);
  lines.forEach((line, index) => context.fillText(line, x, y + index * leading));
  return y + (lines.length - 1) * leading;
}

async function renderCard(topicId, siteName, card, credit, imageDirectory) {
  const canvas = createCanvas(imageWidth, imageHeight);
  const context = canvas.getContext('2d');
  const paper = '#f7f6f2';
  const accent = '#c3dfc8';
  const sans = '"Liberation Sans", sans-serif';
  const serif = '"Liberation Serif", serif';
  const x = 64;
  const width = card.image ? 652 : 936;

  context.fillStyle = '#183e32';
  context.fillRect(0, 0, imageWidth, imageHeight);
  if (card.image) {
    const photo = await loadImage(await readFile(new URL(card.image, imageDirectory)));
    const photoWidth = 416;
    const scale = Math.max(photoWidth / photo.width, imageHeight / photo.height);
    const cropWidth = photoWidth / scale;
    const cropHeight = imageHeight / scale;
    context.drawImage(photo, (photo.width - cropWidth) / 2, (photo.height - cropHeight) / 2,
      cropWidth, cropHeight, imageWidth - photoWidth, 0, photoWidth, imageHeight);
  } else {
    context.fillStyle = '#1e493b';
    context.fillRect(1040, 0, 160, imageHeight);
  }

  context.strokeStyle = paper;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(79, 67, 14, 0, 2 * Math.PI);
  context.stroke();
  context.fillStyle = paper;
  context.beginPath();
  context.arc(79, 67, 5, 0, 2 * Math.PI);
  context.fill();
  drawLines(context, { text: siteName, x: 107, y: 77, width: width - 43, leading: 0, maxLines: 1,
    font: `bold 30px ${sans}`, colour: paper, topicId });

  context.font = `bold 132px ${serif}`;
  const size = Math.min(132, Math.floor(132 * width / context.measureText(card.fact).width));
  requireCondition(size >= 64, `${topicId}: shorten the headline share fact`);
  drawLines(context, { text: card.fact, x, y: 237, width, leading: 0, maxLines: 1,
    font: `bold ${size}px ${serif}`, colour: paper, topicId });

  const labelEnd = drawLines(context, { text: card.label, x, y: 308, width, leading: 43, maxLines: 3,
    font: `bold 36px ${sans}`, colour: paper, topicId });
  drawLines(context, { text: credit, x, y: labelEnd + 52, width, leading: 28, maxLines: 2,
    font: `25px ${sans}`, colour: paper, topicId });

  context.strokeStyle = '#66877b';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, 503);
  context.lineTo(x + width, 503);
  context.stroke();
  drawLines(context, { text: card.question, x, y: 548, width, leading: 42, maxLines: 2,
    font: `bold 37px ${sans}`, colour: accent, topicId });
  return canvas.toBuffer('image/png');
}

export async function prepareTopicShare(topic, card, site, imageDirectory) {
  const url = new URL(`topics/${topic.id}/`, site.publicBaseUrl).href;
  const share = { title: topic.title, url, description: topic.summary };
  if (card === undefined) return share;

  requireCondition(card && typeof card === 'object' && !Array.isArray(card), `${topic.id}: invalid share card`);
  for (const field of ['fact', 'label', 'period', 'source', 'credit', 'question', 'answerAt']) {
    requireCondition(typeof card[field] === 'string' && card[field].trim(), `${topic.id}: share card needs ${field}`);
  }
  requireCondition(Object.hasOwn(topic.sources, card.source), `${topic.id}: unknown share card source ${card.source}`);
  requireCondition(card.question.endsWith('?') && /^[a-z0-9-]+$/.test(card.answerAt),
    `${topic.id}: share card needs a question and answer anchor`);
  requireCondition(card.scope === undefined || (typeof card.scope === 'string' && card.scope.trim()),
    `${topic.id}: invalid share card scope`);
  requireCondition(card.image === undefined ||
    (typeof card.image === 'string' && /^[a-z0-9-]+\.jpg$/.test(card.image)),
    `${topic.id}: invalid share card image`);

  const scope = card.scope ?? topic.scope;
  const credit = [card.credit, scope, card.period].join(' · ');
  const fact = `${card.fact} ${card.label}.`;
  const png = await renderCard(topic.id, site.name, card, credit, imageDirectory);
  const filename = `${topic.id}.png`;
  const imageUrl = new URL(`assets/share/${filename}`, site.publicBaseUrl);
  imageUrl.searchParams.set('v', createHash('sha256').update(png).digest('hex').slice(0, 12));
  return {
    ...share,
    description: `${fact} ${scope}, ${card.period}. ${card.question}`,
    image: { url: imageUrl.href, filename, png, alt: `${fact} ${credit}. ${card.question}` },
    answerAt: card.answerAt,
  };
}
