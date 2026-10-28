import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox']});
const page = await browser.newPage({reducedMotion:'reduce'});
const dir = process.env.SCREENSHOT_DIR;
if (dir) await mkdir(dir,{recursive:true});
async function geometry(surface) {
  const problems = await page.evaluate(() => {
    const errors=[];
    if(document.documentElement.scrollWidth>innerWidth) errors.push('document overflow');
    const modal=document.querySelector('dialog[open]');
    const root=modal || document;
    for(const b of root.querySelectorAll('button, input:not([type=checkbox]), select')) {
      const r=b.getBoundingClientRect();
      if(!r.width || b.closest('.square')) continue;
      if(r.height<43.9) errors.push(`${b.textContent.trim() || b.id}: control below 44px`);
      if(modal && (r.left<modal.getBoundingClientRect().left || r.right>modal.getBoundingClientRect().right)) errors.push('modal control overflow');
    }
    for(const p of document.querySelectorAll('.panel,.setup-card')) {
      const s=getComputedStyle(p);
      if(s.paddingLeft!==s.paddingRight || s.paddingLeft!==s.paddingTop) errors.push('unequal panel padding');
    }
    if(modal) {
      const title=modal.querySelector('h2').getBoundingClientRect(),close=modal.querySelector('.close').getBoundingClientRect();
      if(title.right>close.left && title.top<close.bottom && title.bottom>close.top) errors.push('close overlaps title');
    }
    return errors;
  });
  assert.deepEqual(problems,[],surface);
}
try {
 await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8080/');
 for(const width of [320,390,768,1024,1440]) {
  await page.setViewportSize({width,height:1000}); await geometry(`setup ${width}`);
  if(dir && [390,1440].includes(width)) await page.screenshot({path:`${dir}/setup-${width}.png`,fullPage:true});
 }
 await page.locator('#setupForm').evaluate(f=>f.requestSubmit());
 await page.evaluate(async()=>{
  const s=JSON.parse(localStorage.getItem('stadtvermoegen-v1'));
  s.estates[1].owner=0;s.estates[3].owner=0;s.players[0].cards=['chance'];
  localStorage.setItem('stadtvermoegen-v1',JSON.stringify(s));
 });
 await page.reload();
 for(const width of [320,390,768,1024,1440]) {
  await page.setViewportSize({width,height:1000}); await geometry(`game ${width}`);
  if(width<=768) assert.ok(await page.locator('.turn-panel').evaluate(e=>e.getBoundingClientRect().top<document.querySelector('.asset-panel').getBoundingClientRect().top));
  if(dir && [390,1440].includes(width)) await page.screenshot({path:`${dir}/game-${width}.png`,fullPage:true});
  for(const selector of ['#rulesButton','[data-action="explore"]','[data-square="1"]','[data-action="openTrade"]','#newButton']) {
   await page.locator(selector).first().click(); await geometry(`${selector} ${width}`);
   if(selector.includes('openTrade')) {
    const label=page.locator('.trade-side label').filter({has:page.locator('input[type=checkbox]')}).first();
    assert.ok(await label.evaluate(e=>e.getBoundingClientRect().height>=44));
   }
   if(dir && [390,1440].includes(width)) await page.screenshot({path:`${dir}/dialog-${selector.replace(/[^a-z0-9]/gi,'')}-${width}.png`});
   await page.keyboard.press('Escape');
  }
 }
 await page.setViewportSize({width:320,height:800});
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 await page.locator('[data-action="openTrade"]').click(); await geometry('trade font scaling');
 console.log('UI consistency: setup, populated game and five dialog surfaces at five widths passed.');
} finally {await browser.close();}
