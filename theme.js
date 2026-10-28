/* Runs before styles paint; deliberately independent of the game and its save. */
(() => {
  const key = 'stadtvermoegen-theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  if (!['light', 'dark'].includes(preference)) preference = null;
  function apply() {
    const dark = (preference || (system.matches ? 'dark' : 'light')) === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#171d20' : '#edf2f4';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.textContent = dark ? '☀ Hellmodus' : '☾ Dunkelmodus';
      button.setAttribute('aria-label', `${dark ? 'Dunkelmodus aktiv. Zum Hellmodus' : 'Hellmodus aktiv. Zum Dunkelmodus'} wechseln`);
      button.setAttribute('aria-pressed', String(dark));
      button.title = 'Darstellung wechseln (Alt+Umschalt+D)';
    });
  }
  function toggle() {
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(key, preference); } catch {}
    apply();
  }
  apply();
  system.addEventListener('change', () => { if (!preference) apply(); });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('dialog').forEach(dialog => {
      const button = document.createElement('button');
      button.className = 'dialog-theme quiet';
      button.dataset.themeToggle = '';
      dialog.prepend(button);
    });
    apply();
  });
  document.addEventListener('click', event => { if (event.target.closest('[data-theme-toggle]')) toggle(); });
  document.addEventListener('keydown', event => {
    if (event.altKey && event.shiftKey && event.code === 'KeyD') { event.preventDefault(); toggle(); }
  });
})();
