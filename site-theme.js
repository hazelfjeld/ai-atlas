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

// The main workspace consumes this one-shot intent after catalog hydration.
// Use the same handoff for the slash shortcut and the visible search link.
function rememberSearchFocus() {
  try { sessionStorage.setItem('atlas.searchShortcutPending', '1'); }
  catch (_) { /* The native search link still works without storage. */ }
}


// Close a native shared drawer and release its background immediately, rather
// than leaving an invisible focused link or an inert workspace until the
// asynchronous <details> toggle event runs. Used on outside dismissal and
// BFCache restoration across editorial, reference and Discover routes.
function closeSharedDrawers({restoreFocus = false} = {}) {
  const menus = document.querySelectorAll('details.site-mobile-chrome__nav[open]');
  menus.forEach(menu => {
    const hadFocus = menu.contains(document.activeElement);
    menu.open = false;
    if (restoreFocus || hadFocus) menu.querySelector('summary')?.focus({preventScroll:true});
  });
  syncSharedDrawerIsolation();
}

/* The native details menu works without scripts; enhance it to match the
   Discover drawer's Escape and outside-click behavior when JS is available. */
document.addEventListener('keydown', (event) => {
  // Match Discover's mobile drawer: Tab must not escape behind an open rail.
  // This is progressive enhancement; native <details> links work without JS.
  if (event.key === 'Tab' && !event.defaultPrevented && window.innerWidth <= 650) {
    const menu = document.querySelector('details.site-mobile-chrome__nav[open]');
    if (menu) {
      const stops = [menu.querySelector('summary'), ...menu.querySelectorAll('a[href],button:not([disabled])')]
        .filter(el => el && el.getClientRects().length);
      if (stops.length) {
        const first = stops[0], last = stops[stops.length - 1];
        const current = document.activeElement;
        if (event.shiftKey && (current === first || !menu.contains(current))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (current === last || !menu.contains(current))) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    return;
  }
  if (event.key === 'Escape') {
    if (event.defaultPrevented) return;
    if (!document.querySelector('details.site-mobile-chrome__nav[open]')) return;
    closeSharedDrawers({restoreFocus:true});
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
  // After a cross-page / shortcut, make the real Discover search input ready
  // for typing, rather than requiring a second tap. No-JS links still work.
  rememberSearchFocus();
  search.click();
});
// A tap or keyboard activation of the existing search link must have the same
// one-step focus behavior as /. Do not affect modified/new-tab navigation.
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
      event.metaKey || event.altKey || event.shiftKey) return;
  if (!event.target?.closest?.('a.site-mobile-chrome__search[href]')) return;
  rememberSearchFocus();
});
document.addEventListener('pointerdown', (event) => {
  // A modal drawer deliberately makes the background inert. An outside tap
  // dismisses it first; return keyboard/AT focus to the still-visible toggle.
  if ([...document.querySelectorAll('details.site-mobile-chrome__nav[open]')]
      .some(menu => !menu.contains(event.target))) {
    closeSharedDrawers({restoreFocus:true});
  }
});

/* Discover makes its open drawer modal to assistive technology. The native
   shared drawer already traps Tab and scroll; isolate its background as well.
   Preserve any pre-existing inert state when the drawer closes or a device
   rotates into desktop mode. No-JS native <details> remains usable. */
const isolatedDrawerSiblings = new Map();
function syncSharedDrawerIsolation() {
  for (const [element, wasInert] of isolatedDrawerSiblings) element.inert = wasInert;
  isolatedDrawerSiblings.clear();
  const drawer = window.innerWidth <= 650
    ? document.querySelector('details.site-mobile-chrome__nav[open]') : null;
  if (!drawer) return;
  for (let node = drawer; node && node !== document.body; node = node.parentElement) {
    if (!node.parentElement) break;
    for (const sibling of node.parentElement.children) {
      if (sibling === node || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
      isolatedDrawerSiblings.set(sibling, sibling.inert);
      sibling.inert = true;
    }
  }
}
// "toggle" is not reliably bubbling on <details>; capture it at the document.
document.addEventListener('toggle', event => {
  if (event.target?.matches?.('details.site-mobile-chrome__nav')) syncSharedDrawerIsolation();
}, true);
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('resize', () => {
    // A native menu left open on desktop would reopen unexpectedly on rotation
    // back to mobile, trapping focus and locking the newly visible workspace.
    // Close it as the breakpoint is crossed; keep no-JS details behavior intact.
    if (window.innerWidth > 650) {
      document.querySelectorAll('details.site-mobile-chrome__nav[open]')
        .forEach(menu => { menu.open = false; });
    }
    syncSharedDrawerIsolation();
  });
}

// Restoring a page from the back/forward cache must not resurrect a modal
// drawer with stale inert siblings or hidden keyboard focus.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) closeSharedDrawers();
  });
}

/* Use the existing canonical selected link as the standalone workspace
   breadcrumb, matching Discover without introducing duplicate navigation. */
document.addEventListener('DOMContentLoaded', () => {
  const chrome = document.querySelector('.site-mobile-chrome');
  if (!chrome) return;
  const active = document.querySelector('.site-chrome__links a[aria-current]');
  const heading = document.querySelector('main h1');
  const label = active?.textContent?.trim() || chrome.dataset.pageLabel || heading?.textContent?.trim() || document.title.split('·')[0].trim();
  chrome.dataset.pageLabel = label;
  // Reuse the canonical desktop brand in the native mobile drawer. Never
  // maintain a second logo template; no-JS <details> navigation still works.
  const menu = chrome.querySelector('.site-mobile-chrome__menu');
  const desktopBrand = document.querySelector('.site-chrome__brand');
  if (menu && desktopBrand && !menu.querySelector('.site-mobile-chrome__brand')) {
    const mobileBrand = desktopBrand.cloneNode(true);
    mobileBrand.className = 'site-mobile-chrome__brand';
    menu.prepend(mobileBrand);
  }

  // All page families use the shared appearance action in their native drawer.
  // Discover retains its original desktop sidebar button; Games already has a
  // visible theme button in its own header, so neither gets a duplicate rail action.
  // Native links and no-JavaScript navigation remain untouched.
  if (typeof document.createElement === 'function' && menu) {
    const rail = document.querySelector('.site-chrome');
    const existing = document.getElementById?.('theme-toggle');
    const containers = rail && !existing ? [rail, menu] :
      existing && !rail ? [menu] : [];
    if (containers.length && !menu.querySelector('.site-chrome__theme-toggle')) {
      const controls = [];
      const effectiveTheme = () => document.documentElement.dataset.theme ||
        (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const syncThemeButtons = () => {
        const theme = effectiveTheme();
        controls.forEach(button => {
          button.setAttribute('aria-pressed', String(theme === 'dark'));
          button.textContent = '◐  ' + (theme === 'dark' ? 'Dark' : 'Light') + ' theme';
        });
      };
      for (const container of containers) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'site-chrome__theme-toggle';
        button.setAttribute('aria-label', 'Toggle color theme');
        button.addEventListener('click', () => {
          const chosen = effectiveTheme() === 'dark' ? 'light' : 'dark';
          document.documentElement.dataset.theme = chosen;
          try { localStorage.setItem('atlas.theme', chosen); }
          catch (_) { /* Theme still changes when persistence is unavailable. */ }
          syncThemeButtons();
        });
        container.append(button);
        controls.push(button);
      }
      // Discover's original desktop button can also change the saved theme.
      // Synchronize the shared mobile label after that existing click handler.
      if (existing && !rail) existing.addEventListener('click', syncThemeButtons);
      syncThemeButtons();
    }
  }
});
