import assert from "node:assert/strict";
export async function checkGeometry(page, surface) {
  const problems = await page.evaluate(() => {
    const errors=[];
    if(document.documentElement.scrollWidth>innerWidth) errors.push('document overflow');
    const theme=document.documentElement.dataset.theme;
    if(!['light','dark'].includes(theme)) errors.push('missing theme');
    if(getComputedStyle(document.documentElement).colorScheme!==theme) errors.push('native color scheme mismatch');
    if(document.querySelector('meta[name="theme-color"]').content!==(theme==='dark'?'#171d20':'#edf2f4')) errors.push('theme metadata mismatch');
    const headerButtons=[...document.querySelectorAll('.masthead button')];
    if(headerButtons.length!==4) errors.push('header controls missing');
    for(const b of headerButtons) { const r=b.getBoundingClientRect();if(r.width<44 || r.height<44 || r.left<0 || r.right>innerWidth)errors.push('header target geometry'); }
    const rgb=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
    const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    const modal=document.querySelector('dialog[open]');
    const root=modal || document;
    for(const b of root.querySelectorAll('button, input:not([type=checkbox]), select')) {
      const r=b.getBoundingClientRect();
      if(!r.width || b.closest('.square')) continue;
      if(r.height<43.9) errors.push(`${b.textContent.trim() || b.id}: control below 44px`);
      if(modal && (r.left<modal.getBoundingClientRect().left || r.right>modal.getBoundingClientRect().right)) errors.push('modal control overflow');
    }
    for(const e of root.querySelectorAll('h1,h2,h3,p,small,label,.sq-name,.sq-price,.stock,.center-hint,.center-turn,button,input,select')) {
      if(e.closest('svg') || e.matches(':disabled') || !e.getBoundingClientRect().width)continue;
      const style=getComputedStyle(e);
      if(style.opacity!=='1' || e.closest('button:disabled'))continue;
      let ancestor=e,background;
      while(ancestor) {const color=getComputedStyle(ancestor).backgroundColor;if(color!=='rgba(0, 0, 0, 0)' && color!=='transparent'){background=color;break;}ancestor=ancestor.parentElement;}
      if(!background)continue;
      const a=luminance(rgb(style.color)),b=luminance(rgb(background));
      const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      const large=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && parseInt(style.fontWeight)>=700);
      if(ratio<(large?3:4.5))errors.push(`contrast ${e.className || e.tagName}: ${ratio.toFixed(2)}`);
    }
    const panelPaddings = new Set();
    for(const p of document.querySelectorAll('.panel,.setup-card')) {
      const s=getComputedStyle(p);
      if(s.display==='contents')errors.push('panel lost its visual container');
      panelPaddings.add(s.paddingLeft);
      if(s.paddingLeft!==s.paddingRight || s.paddingLeft!==s.paddingTop) errors.push('unequal panel padding');
    }
    if(panelPaddings.size>1) errors.push('panels use different padding');
    const spacing = new Set([0,4,8,12,16,24,32,48]);
    for(const e of document.querySelectorAll('.game-layout,.sidebar,.figure-options,.action-buttons,.detail-actions,.trade-grid,.field-list')) {
      const style=getComputedStyle(e);
      if(style.display==='contents') continue;
      for(const gap of [style.rowGap,style.columnGap]) {
        if(gap!=='normal' && !spacing.has(parseFloat(gap))) errors.push('gap outside shared spacing scale');
      }
    }
    const panels=[...document.querySelectorAll('.game-layout > .panel')];
    for(const panel of panels) {
      const r=panel.getBoundingClientRect();
      for(const control of panel.querySelectorAll('button')) {const c=control.getBoundingClientRect();if(c.left<r.left || c.right>r.right || c.top<r.top || c.bottom>r.bottom)errors.push('control outside panel');}
    }
    if(panels.length && panels.map(p=>p.className).join('|')!=='panel turn-panel|panel players-panel|panel asset-panel|panel log-panel')errors.push('reading order mismatch');
    const stripes=[...document.querySelectorAll('.square .stripe')].map(e=>getComputedStyle(e).backgroundColor);
    if(stripes.length && new Set(stripes).size!==8)errors.push('property groups must be distinct');
    const shells=[...document.querySelectorAll('.masthead,main,footer')].map(e=>e.getBoundingClientRect());
    if(shells.some(r=>Math.abs(r.left-shells[0].left)>.5 || Math.abs(r.right-shells[0].right)>.5)) errors.push('page shells misaligned');
    if(modal) {
      if(modal.scrollWidth>modal.clientWidth) errors.push('dialog horizontal overflow');
      if(modal.getBoundingClientRect().height>innerHeight) errors.push('dialog exceeds viewport');
      const themeButton=modal.querySelector('[data-theme-toggle]').getBoundingClientRect();
      const content=modal.querySelector('#detailContent') || modal.querySelector('.eyebrow');
      if(content.getBoundingClientRect().top<themeButton.bottom)errors.push('theme switch overlaps dialog content');
      const title=modal.querySelector('h2').getBoundingClientRect(),close=modal.querySelector('.close').getBoundingClientRect();
      if(title.right>close.left && title.top<close.bottom && title.bottom>close.top) errors.push('close overlaps title');
    }
    return errors;
  });
  assert.deepEqual(problems,[],surface);
}
