import assert from 'node:assert/strict';
import {checkGeometry} from './ui-geometry.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const dir=process.env.SCREENSHOT_DIR || join(tmpdir(),'stadtvermoegen-viewport');
await mkdir(dir,{recursive:true});
const results=[];
try {
 const page=await browser.newPage({reducedMotion:'reduce'});
 await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8080/');
 await page.locator('#playerCount').selectOption('4');
 await page.locator('#setupForm').evaluate(f=>f.requestSubmit());
 const base=await page.evaluate(()=>JSON.parse(localStorage.getItem('stadtvermoegen-v1')));
 for(const theme of ['light','dark']) for(const [width,height] of [[1366,768],[1366,650],[1280,720],[1280,620],[1440,900],[1536,864],[1920,1080],[1024,768],[960,540],[844,390],[390,844],[320,844]]) {
  for(const count of [2,3,4]) for(const phase of ['roll','end','buy','card','debt','transfer','approval']) {
   await page.setViewportSize({width,height});
   await page.evaluate(({base,phase,theme,count})=>{
    const s=structuredClone(base);s.current=0;s.phase=phase;s.purchase={id:39,player:0};s.card={deck:'chance',index:0};
    if(phase==='debt') {s.debt={type:'pay',from:0,to:null,amount:2000,reason:'Steuer'};s.queue=[s.debt,{type:'finish'}];}
    if(phase==='transfer') s.transfer={id:1,player:0};
    if(phase==='approval') {s.phase='end';s.trade={from:0,to:1,give:[1,3],take:[],cashGive:0,cashTake:30,cardsGive:[],cardsTake:[]};}
    s.players=s.players.slice(0,count);
    s.players.forEach((p,i)=>{p.name='ABCDEFGHIJKLMNOPQRST';p.pos=1;});
    Object.values(s.estates).forEach(e=>e.owner=0);
    s.log=Array.from({length:30},(_,i)=>`Eintrag ${i+1}: Ein ausführlicher Spielzug mit Besitz und Geld.`);
    localStorage.setItem('stadtvermoegen-v1',JSON.stringify(s));localStorage.setItem('stadtvermoegen-theme',theme);
   },{base,phase,theme,count});
   await page.reload();
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const g=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    return {viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],areas:Object.fromEntries(['.masthead','.topline','.board-wrap','.board','.turn-panel','.players-panel','.asset-panel','.log-panel','footer'].map(s=>[s,rect(document.querySelector(s))])),controls:[...document.querySelectorAll('#actions button')].map(rect)};
   });
   const fit=width>=1280;
   assert.ok(g.document[0]<=width,`horizontal overflow ${width} ${height}`);
   assert.ok(Math.abs(g.areas['.board'].width-g.areas['.board'].height)<1,'square board');
   if(fit) {
    await checkGeometry(page,`${theme} ${width}x${height} ${count} ${phase}`);
    assert.ok(g.document[1]<=height,`document scroll ${theme} ${width}x${height} ${phase}: ${g.document[1]}`);
    for(const [s,r] of Object.entries(g.areas)) assert.ok(r.y>=0 && r.bottom<=height && r.right<=width,`${s} outside viewport`);
    for(const r of g.controls) assert.ok(r.y>=0 && r.bottom<=height && r.height>=44,'action reachable in viewport');
    for(const selector of ['.deed-list','.log']) {
     const scroll=await page.locator(selector).evaluate(e=>{e.scrollTop=e.scrollHeight;const last=e.lastElementChild.getBoundingClientRect(),r=e.getBoundingClientRect();return {height:r.height,lastHeight:last.height,overflow:e.scrollHeight>e.clientHeight,reached:last.bottom<=r.bottom+1 && last.top>=r.top-1};});
     assert.ok(scroll.overflow && scroll.reached,`${selector} last entry reachable ${width}x${height}: ${JSON.stringify(scroll)}`);
    }
   }
   const tokens=await page.locator('.square .token').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect(),p=e.closest('.square').getBoundingClientRect();return r.left>=p.left && r.right<=p.right && r.top>=p.top && r.bottom<=p.bottom;}));
   assert.ok(tokens,`tokens contained ${width}x${height}`);
   results.push({theme,width,height,count,phase,fit,...g});
   if(phase==='roll' && count===4) {
    await page.screenshot({path:`${dir}/${theme}-${width}x${height}-last-entries.png`});
    await page.locator('.deed-list,.log').evaluateAll(es=>es.forEach(e=>e.scrollTop=0));
    await page.screenshot({path:`${dir}/${theme}-${width}x${height}.png`});
   }
  }
 }
 await page.setViewportSize({width:1280,height:620});
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 await checkGeometry(page,'200% laptop text fallback');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),'enlarged text uses normal scroll');
 await page.screenshot({path:`${dir}/text-200-percent.png`});
 await writeFile(`${dir}/geometry.json`,JSON.stringify(results,null,2));
 console.log('Viewport fit, square board, crowded tokens and last portfolio/log entries passed.');
} finally {await browser.close();}
