/* Use Discover's saved choice on standalone editorial pages before rendering. */
try {
  const savedTheme = localStorage.getItem('atlas.theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    document.documentElement.dataset.theme = savedTheme;
    // CSS keeps native widgets in sync when Games toggles the theme later.
  }
} catch (_) {
  // Storage may be unavailable; preserve the stylesheet's normal fallback.
}

/* The native details menu works without scripts; enhance it to match the
   Discover drawer's Escape and outside-click behavior when JS is available. */
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (event.defaultPrevented) return;
    const menus = document.querySelectorAll('details.site-mobile-chrome__nav[open]');
    if (!menus.length) return;
    menus.forEach(menu => { menu.open = false; });
    menus[0].querySelector('summary')?.focus();
    event.preventDefault();
    return;
  }
  // Discover's / keyboard search should work on every standalone page too.
  if (event.key !== '/' || event.defaultPrevented || event.repeat || event.isComposing ||
      event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target?.closest?.('input,textarea,select,[contenteditable],[role="textbox"]')) return;
  if (document.querySelector('details.site-mobile-chrome__nav[open]')) return;
  const search = document.querySelector('a.site-mobile-chrome__search[href]');
  if (!search) return;
  event.preventDefault();
  search.click();
});
document.addEventListener('pointerdown', (event) => {
  document.querySelectorAll('details.site-mobile-chrome__nav[open]').forEach(menu => {
    if (!menu.contains(event.target)) menu.open = false;
  });
});
