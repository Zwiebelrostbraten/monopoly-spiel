import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const url=process.env.GAME_URL || 'http://127.0.0.1:8080/';
try {
 for(const system of ['light','dark']) {
  const context=await browser.newContext({colorScheme:system}); const page=await context.newPage();
  await page.goto(url);
  assert.equal(await page.locator('html').getAttribute('data-theme'),system,'system initialization');
  await page.emulateMedia({colorScheme:system==='dark'?'light':'dark'});
  const other=system==='dark'?'light':'dark';
  await page.waitForFunction(t=>document.documentElement.dataset.theme===t,other);
  await page.locator('#themeButton').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),system);
  await page.reload(); assert.equal(await page.locator('html').getAttribute('data-theme'),system);
  await page.emulateMedia({colorScheme:other}); assert.equal(await page.locator('html').getAttribute('data-theme'),system);
  await page.locator('#setupForm').evaluate(f=>f.requestSubmit());
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('stadtvermoegen-v1'));for(const id of [1,6,11,16,21,26,31,37])s.estates[id].owner=0;localStorage.setItem('stadtvermoegen-v1',JSON.stringify(s));});
  await page.reload();
  const saved=await page.evaluate(()=>localStorage.getItem('stadtvermoegen-v1'));
  await page.locator('[data-player="0"]').click();
  for(const id of [1,6,11,16,21,26,31,37]) {
   const stripe=await page.locator(`.square[data-square="${id}"] .stripe`).evaluate(e=>getComputedStyle(e).backgroundColor);
   assert.equal(await page.locator(`.deed-chip[data-square="${id}"]`).evaluate(e=>getComputedStyle(e).borderTopColor),stripe,'portfolio shares board group color');
   await page.locator('.explore-board').click();
   assert.equal(await page.locator(`[data-field="${id}"]`).evaluate(e=>getComputedStyle(e).borderLeftColor),stripe,'explorer shares board group color');
   await page.locator(`[data-field="${id}"]`).click();
   assert.equal(await page.locator('.deed-color').evaluate(e=>getComputedStyle(e).backgroundColor),stripe,'deed shares board group color');
   await page.keyboard.press('Escape');
  }

  for(const selector of ['#rulesButton','[data-action="openTrade"]','[data-square="1"]','#newButton','[data-action="explore"]']) {
   await page.locator(selector).first().click();
   const modal=page.locator('dialog[open]');
   if(selector.includes('openTrade')) {
    await page.locator('#tradePlayer0').selectOption('0');
    await page.locator('#tradeCash0').fill('47');
    await page.locator('input[name="property0"][value="1"]').check();
   }
   const choices=await modal.locator('input,select').evaluateAll(es=>es.map(e=>[e.id,e.value,e.checked]));
   const snapshot=await modal.evaluate(e=>{const input=e.querySelector('input,select');input?.focus();window.themeFocus=document.activeElement;return e.querySelector('#detailContent')?.innerHTML || e.querySelector('h2').textContent;});
   for(let i=0;i<2;i++) {
    // A keyboard shortcut uses the same presentation-only action without moving form focus.
    await page.keyboard.press('Alt+Shift+D');
    assert.equal(await modal.evaluate(e=>e.querySelector('#detailContent')?.innerHTML || e.querySelector('h2').textContent),snapshot,'dialog nodes and choices preserved');
    assert.ok(await page.evaluate(()=>document.activeElement===window.themeFocus),'form focus preserved');
    assert.equal(await page.evaluate(()=>localStorage.getItem('stadtvermoegen-v1')),saved);
   }
   await modal.locator('[data-theme-toggle]').click();await modal.locator('[data-theme-toggle]').click();
   assert.deepEqual(await modal.locator('input,select').evaluateAll(es=>es.map(e=>[e.id,e.value,e.checked])),choices,'input values and selections survive');
   if(selector.includes('openTrade'))assert.equal(await page.locator('#tradeCash0').inputValue(),'47');
   await page.keyboard.press('Escape');
  }
  await page.locator('#themeButton').click();await page.locator('#themeButton').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('stadtvermoegen-v1')),saved);
  await context.close();
 }
 const context=await browser.newContext({colorScheme:'dark'});await context.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
 const page=await context.newPage();await page.goto(url);await page.locator('#themeButton').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await context.close();
 console.log('Theme initialization, system changes, persistence, blocked storage, unchanged saves and dialog focus/choices passed.');
} finally {await browser.close();}
