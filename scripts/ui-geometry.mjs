import assert from "node:assert/strict";
export async function checkGeometry(page, surface) {
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
    const panelPaddings = new Set();
    for(const p of document.querySelectorAll('.panel,.setup-card')) {
      const s=getComputedStyle(p);
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
    const shells=[...document.querySelectorAll('.masthead,main,footer')].map(e=>e.getBoundingClientRect());
    if(shells.some(r=>Math.abs(r.left-shells[0].left)>.5 || Math.abs(r.right-shells[0].right)>.5)) errors.push('page shells misaligned');
    if(modal) {
      if(modal.scrollWidth>modal.clientWidth) errors.push('dialog horizontal overflow');
      if(modal.getBoundingClientRect().height>innerHeight) errors.push('dialog exceeds viewport');
      const title=modal.querySelector('h2').getBoundingClientRect(),close=modal.querySelector('.close').getBoundingClientRect();
      if(title.right>close.left && title.top<close.bottom && title.bottom>close.top) errors.push('close overlaps title');
    }
    return errors;
  });
  assert.deepEqual(problems,[],surface);
}
