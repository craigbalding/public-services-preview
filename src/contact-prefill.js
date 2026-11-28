const params = new URLSearchParams(window.location.search);
const guideId = params.get('guide');
const route = params.get('enquiry');
const { guideTitles } = document.querySelector('[data-guide-titles]').dataset;
const titles = JSON.parse(guideTitles);
const isSuggestion = route === 'suggestion';
const guideTitle = !isSuggestion && Object.hasOwn(titles, guideId) ? titles[guideId] : undefined;

if (isSuggestion || route === 'correction' || guideTitle) {
  const enquiry = isSuggestion ? 'Question' : 'Correction';
  function prefilledUrl(href) {
    const url = new URL(href);
    url.searchParams.set('enquiry', enquiry);
    if (guideTitle) url.searchParams.set('guide', guideTitle);
    return url.href;
  }

  const link = document.getElementById('tally-form-link');
  const iframe = document.getElementById('tally-form');
  link.href = prefilledUrl(link.href);
  iframe.src = prefilledUrl(iframe.src);
}
