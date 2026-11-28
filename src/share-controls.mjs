import { faBluesky, faFacebookF, faLinkedinIn, faWhatsapp, faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { escape } from './html.mjs';

function brandIcon({ icon: [width, height, , , path] }) {
  return `<svg aria-hidden="true" viewBox="0 0 ${width} ${height}" fill="currentColor"><path d="${path}"/></svg>`;
}

function actionIcon(content) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}

export function shareControl({ title, description, url }) {
  const post = `${title}\n\n${url}`;
  const networks = [
    ['whatsapp', 'WhatsApp', faWhatsapp, 'https://wa.me/', { text: post }],
    ['facebook', 'Facebook', faFacebookF, 'https://www.facebook.com/sharer/sharer.php', { u: url }],
    ['x', 'X', faXTwitter, 'https://x.com/intent/tweet', { url, text: title }],
    ['bluesky', 'Bluesky', faBluesky, 'https://bsky.app/intent/compose', { text: post }],
    ['linkedin', 'LinkedIn', faLinkedinIn, 'https://www.linkedin.com/sharing/share-offsite/', { url }],
  ];
  const links = networks.map(([id, name, icon, endpoint, params]) => {
    const href = new URL(endpoint);
    href.search = new URLSearchParams(params);
    const label = `Share on ${name}`;
    return `<a class="share-${id}" href="${escape(href.href)}" target="_blank" rel="noopener noreferrer"
      aria-label="${label}" title="${label}">${brandIcon(icon)}</a>`;
  }).join('\n      ');
  const email = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${description}\r\n\r\n${url}`)}`;
  return `<nav class="guide-share" data-guide-share aria-label="Share this guide">
    <span class="share-label">Share</span>
    <div class="share-options">
      <!-- Brand icons from Font Awesome Free by Fonticons, Inc. https://fontawesome.com/license/free (CC BY 4.0). -->
      ${links}
      <a href="${escape(email)}" aria-label="Email link" title="Email link">${actionIcon(
        '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>')}</a>
      <button type="button" data-share-copy aria-label="Copy link" title="Copy link" hidden>${actionIcon(
        '<path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2m3 5a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2"/>')}</button>
    </div>
    <label data-share-manual hidden>Link to this guide <input type="url" value="${escape(url)}" readonly></label>
    <p role="status" class="share-status"></p>
  </nav>`;
}
