(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await CF.setRoot('C:/Users/oukas/AppData/Local/Temp/proj'); await sleep(600);
  await cf.ext.installBundled('django'); await CF.loadExtensions();
  document.querySelector('[data-view=extensions]').click(); await sleep(800);
  const names = () => [...document.querySelectorAll('#side-body .ext .info b')].map((e) => e.textContent);
  const heads = () => [...document.querySelectorAll('#side-body .sec-head')].map((e) => e.textContent.trim());
  const type = async (v) => { const i = document.querySelector('#side-body input[type=search]'); i.value = v; i.dispatchEvent(new Event('input')); await sleep(150); };
  const R = { default: { heads: heads(), hasInstalledDjango: names().includes('Django Snippets'), count: names().length, installBtns: [...document.querySelectorAll('#side-body .ext button')].map((b) => b.textContent).filter((t) => t === 'Install').length } };
  await type('django'); R.searchDjango = { heads: heads(), names: names(), btns: [...document.querySelectorAll('#side-body .ext button')].map((b) => b.textContent) };
  await type('ocean'); R.searchOcean = { names: names(), btns: [...document.querySelectorAll('#side-body .ext button')].map((b) => b.textContent) };
  await type('zzzz'); R.searchNone = document.querySelector('#side-body').textContent.includes('No extensions match');
  await type('theme'); R.searchTheme = names().length;
  await type(''); await cf.ext.uninstall('django'); await CF.loadExtensions();
  return R;
})()
