const guideId = new URLSearchParams(window.location.search).get('guide');
const { guideTitles } = document.querySelector('[data-guide-titles]').dataset;
const titles = JSON.parse(guideTitles);

if (guideId && Object.hasOwn(titles, guideId)) {
  const link = document.getElementById('tally-form-link');
  const iframe = document.getElementById('tally-form');
  const standaloneUrl = new URL(link.href);
  const embeddedUrl = new URL(iframe.src);
  standaloneUrl.searchParams.set('guide', titles[guideId]);
  embeddedUrl.searchParams.set('guide', titles[guideId]);
  link.href = standaloneUrl.href;
  iframe.src = embeddedUrl.href;
}
