const share = document.querySelector('[data-guide-share]');
const status = share.querySelector('[role="status"]');
const nativeButton = share.querySelector('[data-share-native]');
const copyButton = share.querySelector('[data-share-copy]');
const manualCopy = share.querySelector('[data-share-manual]');
const link = manualCopy.querySelector('input');
const { shareTitle: title, shareText: text } = share.dataset;
const url = link.value;

if (typeof navigator.share === 'function') {
  nativeButton.hidden = false;
  nativeButton.addEventListener('click', async () => {
    try {
      await navigator.share({ title, text, url });
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = 'Choose Copy link or Email link to share this guide.';
    }
  });
}

copyButton.hidden = false;
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(url);
    manualCopy.hidden = true;
    status.textContent = 'Link copied.';
  } catch {
    manualCopy.hidden = false;
    link.focus();
    link.select();
    status.textContent = 'Copy the selected link.';
  }
});
