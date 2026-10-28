import { checkGeometry } from "./ui-geometry.mjs";
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox']});
const page = await browser.newPage({reducedMotion:'reduce'});
const dir = process.env.SCREENSHOT_DIR;
if (dir) await mkdir(dir,{recursive:true});
const geometry = (surface) => checkGeometry(page, surface);

try {
 await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8080/');
 for(const width of [320,390,768,1024,1440]) {
  await page.setViewportSize({width,height:1000}); await geometry(`setup ${width}`);
  assert.ok(await page.locator('.figure-choice span').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)+1)),'figure names should fit on one line');
  if(dir && [390,1440].includes(width)) await page.screenshot({path:`${dir}/setup-${width}.png`,fullPage:true});
 }
 await page.locator('#playerCount').focus();
 assert.ok(await page.locator('#playerCount').evaluate(e=>getComputedStyle(e).outlineStyle!=='none'),'keyboard focus must be visible');
 // Hover must never move a control or its neighbours.
 const target=page.locator('#setupForm .primary');
 const before=await target.boundingBox(); await target.hover();
 assert.deepEqual(await target.boundingBox(),before,'hover changes button geometry');
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
   if(selector.includes('explore')) assert.equal(await page.locator('[data-field="0"] svg').count(),1,'one clear icon per field');
   if(selector.includes('openTrade')) {
    const label=page.locator('.trade-side label').filter({has:page.locator('input[type=checkbox]')}).first();
    assert.ok(await label.evaluate(e=>e.getBoundingClientRect().height>=44));
   }
   if(dir && [390,1440].includes(width)) await page.screenshot({path:`${dir}/dialog-${selector.replace(/[^a-z0-9]/gi,'')}-${width}.png`});
   if(selector==='#newButton' && width===320) {
    const before=await page.evaluate(()=>localStorage.getItem('stadtvermoegen-v1'));
    const download=page.waitForEvent('download');
    await page.locator('[data-action="export"]').click();
    const stream=await (await download).createReadStream();
    let json=''; for await(const chunk of stream) json+=chunk;
    assert.deepEqual(JSON.parse(json),JSON.parse(before));
    assert.equal(await page.evaluate(()=>localStorage.getItem('stadtvermoegen-v1')),before);
   }
   await page.keyboard.press('Escape');
  }
 }
 // Invalid trade must provide readable feedback inside the modal top layer.
 await page.locator('[data-action="openTrade"]').click();
 await page.locator('#tradePlayer1').selectOption(await page.locator('#tradePlayer0').inputValue());
 await page.locator('#tradeCash0').fill('-1');
 assert.equal(await page.locator('#tradeForm').evaluate(f=>f.checkValidity()),false,'negative cash must fail native validation');
 await page.locator('#tradeCash0').fill('0');
 await page.locator('#tradeForm button[type=submit]').click();
 assert.match(await page.locator('#toast').innerText(), /Zwei aktive Personen/);
 assert.ok(await page.locator('#toast').evaluate(e=>{
   const r=e.getBoundingClientRect();
   return e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
 }), 'validation feedback must be painted above the modal backdrop');
 await page.keyboard.press('Escape');
 // Rent schedules for street, station, utility and special field share the dialog shell.
 for(const id of [0,5,12,39]) {
  await page.locator(`.square[data-square="${id}"]`).click(); await geometry(`deed ${id}`);
  await page.keyboard.press('Escape');
 }
 const baseline=await page.evaluate(()=>JSON.parse(localStorage.getItem('stadtvermoegen-v1')));
 const debt={type:'pay',from:0,to:null,amount:2000,reason:'Steuer'};
 const states=[
  ['doubles',{extra:true}, {},'roll'],
  ['jail',{}, {jail:2,cash:0},'jailPay'],
  ['buy',{phase:'buy',purchase:{id:39,player:0}}, {cash:0},'buy'],
  ['card',{phase:'card',card:{deck:'chance',index:0}}, {},'ackCard'],
  ['end',{phase:'end'}, {},'end'],
  ['debt',{phase:'debt',debt,queue:[debt,{type:'finish'}]}, {cash:0},'confirmBankrupt'],
  ['transfer',{phase:'transfer',transfer:{id:1,player:0}}, {},'transferKeep'],
  ['approval',{trade:{from:0,to:1,give:[1],take:[],cashGive:0,cashTake:30,cardsGive:['chance'],cardsTake:[]}}, {},'acceptTrade'],
  ['won',{phase:'won',winner:1}, {out:true},'new'],
 ];
 for(const [name,changes,playerChanges,action] of states) {
  await page.evaluate(({baseline,changes,playerChanges})=>{
   const s=structuredClone(baseline); s.current=0; Object.assign(s,changes); Object.assign(s.players[0],playerChanges);
   localStorage.setItem('stadtvermoegen-v1',JSON.stringify(s));
  },{baseline,changes,playerChanges});
  await page.reload();
  for(const width of [320,390,768,1024,1440]) {
   await page.setViewportSize({width,height:1000}); await geometry(`${name} ${width}`);
   assert.equal(await page.locator(`[data-action="${action}"]`).count(),1);
   if(name==='won') {
    assert.equal(await page.locator('.turn-name').innerText(),'Spiel beendet');
    assert.match(await page.locator('.center-turn').innerText(),/Person 2 gewinnt/);
   }
   if(['buy','jail'].includes(name)) assert.ok(await page.locator(`[data-action="${action}"]`).isDisabled());
   if(dir && [390,1440].includes(width)) await page.screenshot({path:`${dir}/state-${name}-${width}.png`,fullPage:true});
   if(name==='debt') {
    await page.locator('[data-action="confirmBankrupt"]').click(); await geometry(`bankruptcy ${width}`);
    if(dir && [390,1440].includes(width)) await page.screenshot({path:`${dir}/bankruptcy-${width}.png`});
    await page.keyboard.press('Escape');
   }
  }
 }
 await page.evaluate(s=>localStorage.setItem('stadtvermoegen-v1',JSON.stringify(s)),baseline); await page.reload();
 await page.setViewportSize({width:320,height:800});
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 for(const selector of ['#rulesButton','[data-action="explore"]','[data-square="1"]','[data-action="openTrade"]','#newButton']) {
  await page.locator(selector).first().click(); await geometry(`font scaling ${selector}`); await page.keyboard.press('Escape');
 }
 // Storage failure remains visible, without discarding the loaded game.
 await page.evaluate(()=>{
  document.documentElement.style.fontSize='';
  Storage.prototype.setItem=()=>{throw Error('quota');};
 });
 await page.locator('[data-action="roll"]').click();
 assert.match(await page.locator('#toast').innerText(),/Speichern ist nicht möglich/);
 assert.ok(await page.locator('#toast').evaluate(e=>{
  const r=e.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;
 }));
 await page.reload();
 await page.evaluate(()=>{localStorage.removeItem('stadtvermoegen-v1');}); await page.reload();
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 await page.locator('#playerCount').selectOption('4'); await geometry('setup four players font scaling');
 console.log('UI consistency: five widths, all action states and dialog types, 200% text, hover, validation, export and save failure passed.');
} finally {await browser.close();}
