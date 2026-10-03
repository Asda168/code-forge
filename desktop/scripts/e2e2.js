(async () => {
  const R = {}; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = (await cf.ws.recents())[0].path;
  await CF.setRoot(root); await sleep(800);
  await cf.fs.createFile(root, 'watched.txt'); await sleep(1500);
  R.watcherAddedToTree = CF.T.flat.some((n) => n.name === 'watched.txt');
  CF.quickOpen(); await sleep(500);
  const inp = document.querySelector('.palette input'); inp.value = 'wat'; inp.dispatchEvent(new Event('input')); await sleep(200);
  R.quickOpenHits = [...document.querySelectorAll('.palette .it span:first-child')].map((e) => e.textContent);
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await sleep(600);
  R.openedTab = CF.activeGroup().active && CF.base(CF.activeGroup().active);
  CF.closeActiveTab(); await sleep(300); R.tabsAfterClose = CF.activeGroup().tabs.length;
  R.splitters = document.querySelectorAll('.splitter').length;
  R.watermark = getComputedStyle(document.getElementById('watermark')).display;
  return R;
})()
