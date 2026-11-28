const input = document.getElementById('topic-query');
const search = input.closest('.topic-search');
const status = search.querySelector('[role="status"]');
const words = text => text.toLowerCase().replace(/[’']/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];
const topics = Array.from(document.querySelectorAll('[data-topic-search]'), item => ({
  item,
  terms: words(item.dataset.topicSearch),
}));

input.addEventListener('input', () => {
  const query = words(input.value);
  let count = 0;
  for (const { item, terms } of topics) {
    const matches = query.every(word => terms.some(term => term.startsWith(word)));
    item.hidden = !matches;
    if (matches) count += 1;
  }
  status.textContent = !query.length ? '' : count === 0 ? 'No topics found.' : `${count} ${count === 1 ? 'topic' : 'topics'} found.`;
});

search.hidden = false;
