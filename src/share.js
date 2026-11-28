const share = document.querySelector('[data-guide-share]');
const status = share.querySelector('[role="status"]');
const copyButton = share.querySelector('[data-share-copy]');
const manualCopy = share.querySelector('[data-share-manual]');
const link = manualCopy.querySelector('input');
const url = link.value;

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
