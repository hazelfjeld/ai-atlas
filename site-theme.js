/* Use Discover's saved choice on standalone editorial pages before rendering. */
try {
  const savedTheme = localStorage.getItem('atlas.theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    document.documentElement.dataset.theme = savedTheme;
    document.documentElement.style.colorScheme = savedTheme;
  }
} catch (_) {
  // Storage may be unavailable; preserve the stylesheet's normal fallback.
}

/* The native details menu works without scripts; enhance it to match the
   Discover drawer's Escape and outside-click behavior when JS is available. */
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const menus = document.querySelectorAll('details.site-mobile-chrome__nav[open]');
  if (!menus.length) return;
  menus.forEach(menu => { menu.open = false; });
  menus[0].querySelector('summary')?.focus();
  event.preventDefault();
});
document.addEventListener('pointerdown', (event) => {
  document.querySelectorAll('details.site-mobile-chrome__nav[open]').forEach(menu => {
    if (!menu.contains(event.target)) menu.open = false;
  });
});
