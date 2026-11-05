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
