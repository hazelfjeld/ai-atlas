/* Enhance the native dropdown only when scripts can make its drawer modal.
   Without JavaScript, keep the accessible, nonmodal <details> fallback. */
document.documentElement.classList?.add('atlas-enhanced');

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

// Generated term and technology details previously showed only their parent
// section in the shared desktop workspace title, unlike named editorial pages.
// Reuse the existing data-page-label slot; never create a second header, and
// keep the static parent title available without JavaScript.
document.addEventListener('DOMContentLoaded', () => {
  const path = typeof window !== 'undefined' ? (window.location?.pathname || '') : '';
  if (!/(?:^|\/)(?:terms\/MLD-\d+|technology\/TECH-\d+)-[^/]+\.html$/.test(path)) return;
  const bar = document.querySelector('main.term-shell > .site-mobile-chrome:not([data-page-label])');
  const title = document.querySelector('main.term-shell h1')?.textContent?.trim();
  if (bar && title && title.length <= 90) bar.dataset.pageLabel = title;
});

// A generated reference puts its shared navigation before the article inside
// <main>. A native #main skip would therefore take keyboard users back through
// the entire rail. After hydration, move only that fragment destination to the
// existing article hero, leaving the <main> landmark and no-JS hash fallback
// intact. No extra header, link, dependency, or page-specific template is added.
document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main.term-shell#main');
  if (!main || !document.querySelector('a.skip[href="#main"]')) return;
  const hero = main.querySelector(':scope > header.hero');
  if (!hero) return;
  main.removeAttribute('id');
  hero.id = 'main';
  hero.setAttribute('tabindex', '-1');
  // Direct old #main bookmarks remain useful even if the browser initially
  // resolved the fragment against the pre-hydration main element.
  if (window.location.hash === '#main') {
    hero.scrollIntoView();
    hero.focus({preventScroll:true});
  }
});

// The main workspace consumes this one-shot intent after catalog hydration.
// Use the same handoff for the slash shortcut and the visible search link.
function rememberSearchFocus() {
  try { sessionStorage.setItem('atlas.searchShortcutPending', '1'); }
  catch (_) { /* The native search link still works without storage. */ }
}


// Prefer the selected desktop section rather than the standalone brand, whose
// anchor appears first in DOM order. All responsive focus handoffs use this.
function focusSharedDesktopRail() {
  const destination = document.querySelector('.site-chrome__links a[aria-current]') ||
    document.querySelector('#navigation a[aria-current]') ||
    document.querySelector('.site-chrome__brand') ||
    document.querySelector('#navigation a');
  destination?.focus({preventScroll:true});
}

// Close a native shared drawer and release its background immediately, rather
// than leaving an invisible focused link or an inert workspace until the
// asynchronous <details> toggle event runs. Used on outside dismissal and
// BFCache restoration across editorial, reference and Discover routes.
function closeSharedDrawers({restoreFocus = false, desktopFocus = false} = {}) {
  const menus = document.querySelectorAll('details.site-mobile-chrome__nav[open]');
  // Browsers can blur links as soon as the mobile drawer becomes display:none.
  // Track the open drawer itself, not only a focus state already lost to reflow.
  const moveFocusToDesktop = desktopFocus && menus.length > 0;
  menus.forEach(menu => {
    const hadFocus = menu.contains(document.activeElement);
    menu.open = false;
    if (!desktopFocus && (restoreFocus || hadFocus))
      menu.querySelector('summary')?.focus({preventScroll:true});
  });
  syncSharedDrawerIsolation();
  if (desktopFocus && moveFocusToDesktop) focusSharedDesktopRail();
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
    if (!document.querySelectorAll('details.site-mobile-chrome__nav[open]').length) return;
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
  const drawer = typeof window !== 'undefined' && window.innerWidth <= 650 &&
    typeof document.querySelector === 'function'
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
// A desktop rail link can lose DOM focus when CSS hides the rail during a
// desktop-to-mobile resize. Remember actual keyboard focus before the browser
// blurs it, so it never gets stranded on <body> behind the mobile header.
let lastDesktopRailFocus = null;
let lastMobileToggleFocus = null;
document.addEventListener('focusin', event => {
  lastDesktopRailFocus = event.target?.closest?.('.site-chrome,#navigation') ? event.target : null;
  lastMobileToggleFocus = event.target?.matches?.('details.site-mobile-chrome__nav summary')
    ? event.target : null;
});
let lastViewportWasDesktop = typeof window !== 'undefined' && window.innerWidth > 650;
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('resize', () => {
    const desktopNow = window.innerWidth > 650;
    // Close a native menu before it becomes hidden by desktop CSS.
    if (desktopNow) {
      // A closed mobile drawer's focused toggle also becomes hidden on resize.
      // An open drawer is handled by closeSharedDrawers; avoid double focus.
      const restoreClosedToggle = !lastViewportWasDesktop && lastMobileToggleFocus &&
        !lastMobileToggleFocus.getClientRects().length &&
        [document.body, document.documentElement, lastMobileToggleFocus].includes(document.activeElement);
      const drawerWasOpen = !!document.querySelector('details.site-mobile-chrome__nav[open]');
      closeSharedDrawers({desktopFocus:true});
      if (restoreClosedToggle && !drawerWasOpen) focusSharedDesktopRail();
    } else {
      syncSharedDrawerIsolation();
      // Only restore focus if a previously focused rail item just became
      // hidden, and no other visible control has taken focus in the meantime.
      if (lastViewportWasDesktop && lastDesktopRailFocus &&
          !lastDesktopRailFocus.getClientRects().length &&
          [document.body, document.documentElement, lastDesktopRailFocus].includes(document.activeElement)) {
        document.querySelector('details.site-mobile-chrome__nav summary')?.focus({preventScroll:true});
      }
    }
    lastViewportWasDesktop = desktopNow;
  });
}

// Restore a saved appearance changed on another page when this one comes back
// from BFCache. Reuse the same generated theme buttons and accessibility state;
// do not override an unsaved choice or blocked storage.
// Discover's sidebar action and Games' existing header action must expose
// the same pressed state as the native theme actions on standalone pages.
// Keep their existing accessible names and click handlers intact.
function syncPrimaryThemeButton(theme) {
  document.getElementById?.('theme-toggle')?.setAttribute('aria-pressed', String(theme === 'dark'));
}
function syncSharedStoredTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') return;
  document.documentElement.dataset.theme = theme;
  syncPrimaryThemeButton(theme);
  document.querySelectorAll('.site-chrome__theme-toggle').forEach(button => {
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.textContent = '◐  ' + (theme === 'dark' ? 'Dark' : 'Light') + ' theme';
  });
}
function restoreSharedThemeAfterHistory() {
  let savedTheme;
  try { savedTheme = localStorage.getItem('atlas.theme'); }
  catch (_) { return; }
  syncSharedStoredTheme(savedTheme);
}
// The same saved appearance must stay consistent across already-open Atlas
// workspaces too. Storage notifications fire in other tabs, not the source tab.
// Ignore unrelated/invalid values and preserve script-free rendering.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (event) => {
    if (event.key === 'atlas.theme') syncSharedStoredTheme(event.newValue);
  });
}

// Restoring a page from the back/forward cache must not resurrect a modal
// drawer with stale inert siblings or hidden keyboard focus.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      // Browsers may blur a focused menu link before restoring a cached page.
      // Return focus to the visible toggle before hiding the restored drawer.
      closeSharedDrawers({restoreFocus:true});
      restoreSharedThemeAfterHistory();
    }
  });
}

/* Use the existing canonical selected link as the standalone workspace
   breadcrumb, matching Discover without introducing duplicate navigation. */
document.addEventListener('DOMContentLoaded', () => {
  const chrome = document.querySelector('.site-mobile-chrome');
  if (!chrome) return;
  const active = document.querySelector('.site-chrome__links a[aria-current]');
  const heading = document.querySelector('main h1');
  // A selected primary section is not the identity of an editorial subpage.
  // Respect the server-rendered page label on first paint and after hydration.
  const label = chrome.dataset.pageLabel || active?.textContent?.trim() || heading?.textContent?.trim() || document.title.split('·')[0].trim();
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
        syncPrimaryThemeButton(theme);
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
      // Discover's app-level click handler may be registered after this head
      // script's DOMContentLoaded callback. Read its final palette after all
      // synchronous click listeners finish, not before the app toggles it.
      if (existing && !rail) existing.addEventListener('click', () => queueMicrotask(syncThemeButtons));
      syncThemeButtons();
    }
  }
});
