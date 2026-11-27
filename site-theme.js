/* Enhance the native dropdown only when scripts can make its drawer modal.
   Without JavaScript, keep the accessible, nonmodal <details> fallback. */
document.documentElement.classList?.add('atlas-enhanced');

// GitHack is a shared origin across unrelated repositories. Discover and the
// standalone Games page already refuse to persist appearance there; the shared
// chrome must follow that same privacy and navigation policy on every page.
const themePersistenceAllowed = !['raw.githack.com', 'rawcdn.githack.com']
  .includes(typeof location === 'undefined' ? '' : location.hostname);

/* Use Discover's saved choice on standalone editorial pages before rendering. */
try {
  const savedTheme = themePersistenceAllowed ? localStorage.getItem('atlas.theme') : null;
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
  // Both sibling-chrome technology profiles and nested-chrome concept pages
  // use this one article header, without maintaining two independent paths.
  const bar = document.querySelector('.site-mobile-chrome:not([data-page-label])');
  const title = document.querySelector('main.term-shell h1')?.textContent?.trim();
  if (bar && title && title.length <= 90) {
    bar.dataset.pageLabel = title;
    // The common renderer below supplies the same real heading for all native pages.
  }
});

// The published 1,345 concept pages keep immutable, manifest-verified HTML.
// Their native footer is still inside <main> without JavaScript, where its
// policy/source links remain readable. With JavaScript, move the *existing*
// footer (never clone it) into the same global contentinfo position as
// Discover, technology profiles and editorial pages. This is a bounded shared
// enhancement until the complete concept HTML + manifest can rebuild atomically.
document.addEventListener('DOMContentLoaded', () => {
  if (!/(?:^|\/)terms\/MLD-\d+-[^/]+\.html$/.test(window.location.pathname)) return;
  const main = document.querySelector('body > main.term-shell');
  const footer = main?.querySelector(':scope > footer');
  const nav = document.querySelector('body > nav.site-chrome.term-nav');
  if (!main || !footer || !nav || document.querySelectorAll('footer').length !== 1 ||
      !document.querySelector('a.skip[href="#main"]')) return;
  footer.classList.add('site-chrome__footer');
  main.after(footer);
});

// Use one DOM-backed workspace title for every native page family, including
// generated concept and technology references. The earlier CSS-only pseudo
// heading was visible but unavailable as text to assistive technology. Keep
// that pseudo heading for the script-free first paint and suppress it using
// the existing :has(> .site-mobile-chrome__title) rule after hydration.
function ensureSharedWorkspaceTitle(chrome, label) {
  if (!chrome || !label || !document.querySelector('.site-chrome')) return;
  if (chrome.querySelector(':scope > .site-mobile-chrome__title')) return;
  const drawer = chrome.querySelector(':scope > details.site-mobile-chrome__nav');
  if (!drawer) return;
  const titleNode = document.createElement('span');
  titleNode.className = 'site-mobile-chrome__title';
  titleNode.textContent = label;
  drawer.insertAdjacentElement('afterend', titleNode);
}

// The main workspace consumes this one-shot intent after catalog hydration.
// Use the same handoff for the slash shortcut and the visible search link.

/* atlas-prehydration-section-state:begin */

// A native page may become the canonical destination for an existing hash
// workspace (currently Research), so its mobile href can differ from the
// legacy desktop rail href. Prefer exact hrefs, then the rail's *own* visible
// label; never maintain another page/alias table. This one helper serves both
// prehydration and hydrated navigation and keeps only one mobile item current.
function syncDiscoverMobileSelection(mobileNav, current) {
  if (!mobileNav) return;
  const links = [...mobileNav.querySelectorAll(
    '.site-mobile-chrome__menu a[href]:not(.site-mobile-chrome__brand)')];
  const href = current?.getAttribute('href');
  const label = current?.querySelector('span:not(.nav-count)')?.textContent?.trim();
  const selected = (href && links.find(link => link.getAttribute('href') === href)) ||
    (label && links.find(link => link.textContent?.trim() === label));
  links.forEach(link => {
    if (link === selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
if (typeof window !== 'undefined') window.atlasSyncDiscoverMobileSelection = syncDiscoverMobileSelection;

// Restore the committed search query in the shared header, not just the
// results form. A pending catalog hydration must not overwrite a new draft
// the visitor has started typing after the same route was already applied.
let lastDiscoverSearchQuery = null;
function syncDiscoverSearchQuery(view, query) {
  if (view !== 'search') {
    lastDiscoverSearchQuery = null;
    return;
  }
  const field = document.getElementById('global-query');
  if (!field || query === lastDiscoverSearchQuery) return;
  field.value = query;
  lastDiscoverSearchQuery = query;
}
if (typeof window !== 'undefined') window.atlasSyncDiscoverSearchQuery = syncDiscoverSearchQuery;

/* The catalog is loaded asynchronously. A visitor can manually close and
   reopen an auto-revealed More disclosure before app.js starts; record that
   choice in the shared parser-loaded chrome so navigation won't undo it. */
document.addEventListener('click', event => {
  const summary = event.target.closest?.(
    '#additional-navigation > summary, #discover-mobile-nav .site-mobile-chrome__more > summary');
  if (summary) {
    // A deliberate close or re-open wins over later asynchronous catalog hydration.
    delete summary.parentElement.dataset.atlasAutoOpened;
    summary.parentElement.dataset.atlasManualTouched = 'true';
  }
});
/* Native pages expose their active rail destination in static HTML. Discover
   must also reflect a direct hash link before its asynchronous catalog loads;
   otherwise Research, dictionary and Games links briefly appear as Discover.
   Derive everything from existing canonical anchors, never another route map. */
document.addEventListener('DOMContentLoaded', () => {
  const rail = document.getElementById('navigation');
  const mobileNav = document.getElementById('discover-mobile-nav');
  if (!rail || !mobileNav) return;
  const syncWhileLoading = () => {
    // A visitor can change hashes before the async catalog binds its own
    // router. Keep both rails and the workspace title correct until hydration.
    if (!document.getElementById('catalog-loading')) return;
    const [routeValue, queryString] = window.location.hash.replace(/^#\/?/, '').split('?');
    const route = routeValue || 'overview';
    const query = Object.fromEntries(new URLSearchParams(queryString || '')).q || '';
    syncDiscoverSearchQuery(route, query);
    const links = [...rail.querySelectorAll('a[data-view]')];
    // The canonical anchors own legacy aliases for both early and hydrated
    // routing. Never maintain a second alias table or fake mobile destination.
    const matched = links.find(link => link.dataset.view === route ||
      (link.dataset.viewAliases || '').split(/\s+/).includes(route));
    // The hydrated router renders unknown hashes as Discover. Follow it here
    // too, including after rapid navigation from a secondary workspace.
    const current = matched || (route === 'search' || route === 'queue' ? null :
      links.find(link => link.dataset.view === 'overview'));
  // Search is an existing functional workspace, but has no primary rail link.
  // Use the real search field's accessible name; never invent a second route list.
  const searchLabel = route === 'search'
    ? document.getElementById('global-query')?.getAttribute('aria-label')?.trim()
    : '';
  // Review queue is also a real workspace without a primary navigation tab.
  // Give it the same early mobile/desktop title and clear the stale Discover
  // selection while catalog hydration is pending, as already done for Search.
  const untabbedLabel = route === 'queue' ? 'Review queue' : searchLabel;
  if (!current && !untabbedLabel) return; // Unknown routes retain the safe fallback.
  for (const link of links) {
    const active = link === current;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  syncDiscoverMobileSelection(mobileNav, current);
  // Make a directly visited secondary workspace discoverable on both rails
  // just as the hydrated app does, without overriding user-opened disclosures.
  const secondary = !!current?.closest('details.nav-more');
  for (const details of [
    document.getElementById('additional-navigation'),
    mobileNav.querySelector('details.site-mobile-chrome__more'),
  ]) {
    if (!details) continue;
    if (secondary && !details.open && details.dataset.atlasManualTouched !== 'true') {
      details.open = true;
      details.dataset.atlasAutoOpened = 'true';
    } else if (!secondary && details.dataset.atlasAutoOpened === 'true') {
      details.open = false;
      delete details.dataset.atlasAutoOpened;
    }
  }
  const name = current?.querySelector('span:not(.nav-count)')?.textContent?.trim() || untabbedLabel;
  const breadcrumb = document.getElementById('breadcrumb');
  if (name && breadcrumb) breadcrumb.textContent = name;
  const header = document.querySelector('.discover-mobile-chrome');
  if (name && header) {
    header.dataset.pageLabel = name;
    header.setAttribute('aria-label', 'AI Updates mobile header · ' + name);
    mobileNav.querySelector(':scope > summary')
      ?.setAttribute('aria-label', 'Toggle navigation · ' + name);
  }
  // A direct secondary hash must not show the hard-coded Discover teaser while
  // its requested section is pending. Keep the real loading status visible;
  // only remove the original teaser, never an already-rendered view or error.
  const page = document.getElementById('page');
    if (current?.dataset.view !== 'overview' && page?.querySelector('.discover-heading'))
      page.replaceChildren();
  };
  syncWhileLoading();
  window.addEventListener('hashchange', syncWhileLoading);
});
/* atlas-prehydration-section-state:end */

/* atlas-native-research-prehydration:begin */
/* Research has three native hash views, but its shared desktop/mobile rails
   used to announce "Research library" until the catalog finished loading.
   Use the already-rendered local view links as the label source; this makes
   Safety and Publication progress correct on first paint without introducing
   a second route list or affecting script-free navigation. */
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.research-local-nav');
  const chrome = document.querySelector('.research-mobile-topbar');
  if (!nav || !chrome || !document.querySelector('.site-chrome.research-site-chrome')) return;
  const views = [...nav.querySelectorAll('a[data-nav]')];
  const labelFor = key => views.find(link => link.dataset.nav === key)
    ?.firstChild?.textContent?.trim();
  const researchLabel = labelFor('papers');
  const safetyLabel = labelFor('alerts');
  if (!researchLabel || !safetyLabel) return;

  const sync = () => {
    const hashView = window.location.hash.match(/^#\/?([a-z]+)(?:\?|$)/)?.[1];
    const selected = views.find(link => link.dataset.nav === hashView) ||
      views.find(link => link.dataset.nav === 'papers');
    if (!selected) return;
    const label = selected.firstChild?.textContent?.trim();
    if (!label) return;
    const parentLabel = selected.dataset.nav === 'alerts' ? safetyLabel : researchLabel;
    // Both rails already contain canonical links generated from site_chrome.py.
    // Change their state, not the routes, order or content of those links.
    document.querySelectorAll(
      '.site-chrome.research-site-chrome .site-chrome__more-links a, ' +
      '.research-mobile-topbar .site-mobile-chrome__more-links a'
    ).forEach(link => {
      const name = link.textContent.trim();
      if (name !== researchLabel && name !== safetyLabel) return;
      if (name === parentLabel) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    views.forEach(link => {
      if (link === selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    chrome.dataset.pageLabel = label;
    // The mobile header and its visible title must announce the same Research hash view.
    chrome.setAttribute('aria-label', 'AI Updates mobile header · ' + label);
    const title = chrome.querySelector('.site-mobile-chrome__title');
    if (title) title.textContent = label;
    chrome.querySelector('details.site-mobile-chrome__nav > summary')
      ?.setAttribute('aria-label', 'Toggle navigation · ' + label);
  };
  sync();
  window.addEventListener('hashchange', sync);
});
/* atlas-native-research-prehydration:end */

/* atlas-shared-search-submit:begin */
/* One real submit handler for Discover and native pages. This parser-loaded
   script catches Discover searches before the catalog finishes loading, while
   native forms retain their no-JavaScript navigation-link fallback. */
document.addEventListener('submit', event => {
  const form = event.target;
  if (!form?.matches?.('#global-search, form.site-mobile-chrome__search-form')) return;
  event.preventDefault();
  const query = (form.querySelector('input[type="search"]')?.value || '').trim();
  const route = form.dataset.searchRoute || '#/search';
  const destination = route + (query ? '?q=' + encodeURIComponent(query) : '');
  if (route.startsWith('#/')) {
    if (window.location.hash === destination) window.dispatchEvent(new Event('hashchange'));
    else window.location.hash = destination;
  } else {
    rememberSearchFocus();
    window.location.assign(destination);
  }
});
/* atlas-shared-search-submit:end */

/* Real search everywhere: keep the static link as the no-JavaScript fallback,
   and use its relative route on both root and nested reference pages. */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a.site-mobile-chrome__search[href]').forEach(link => {
    const route = link.getAttribute('href') || '';
    if (!/^(?:\.\.\/)*index\.html#\/search$/.test(route)) return;
    const form = document.createElement('form');
    form.className = link.className + ' site-mobile-chrome__search-form';
    // Retain the original, build-time navigation destination even when this
    // mobile-only form is hidden by the shared desktop breakpoint.
    form.dataset.searchRoute = route;
    form.setAttribute('role', 'search');
    form.setAttribute('aria-label', 'Search AI Updates');
    const icon = link.querySelector('.site-mobile-chrome__search-icon');
    if (icon) form.append(icon.cloneNode(true));
    const field = document.createElement('input');
    field.type = 'search';
    field.className = 'site-mobile-chrome__search-input';
    field.setAttribute('aria-label', 'Search AI Updates');
    field.placeholder = link.querySelector('.site-mobile-chrome__search-placeholder')?.textContent?.trim() ||
      'Search tools, research, concepts…';
    field.autocomplete = 'off';
    field.maxLength = 200;
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'site-mobile-chrome__search-submit';
    submit.setAttribute('aria-label', 'Submit search');
    submit.textContent = '↵';
    // Discover labels the working desktop / shortcut alongside its search.
    // Reuse that same key hint across native page families; CSS suppresses it
    // on phones where the real 36px submit action is more useful.
    const hint = document.createElement('kbd');
    hint.className = 'site-mobile-chrome__search-hint';
    hint.textContent = '/';
    hint.setAttribute('aria-hidden', 'true');
    form.append(field, hint, submit);
    link.replaceWith(form);
  });
});

function rememberSearchFocus() {
  try { sessionStorage.setItem('atlas.searchShortcutPending', '1'); }
  catch (_) { /* The native search link still works without storage. */ }
}


// On a secondary destination, focus the actual active link after a phone-to-
// desktop transition, not its primary parent or the brand. The shared native
// markup already exposes aria-current before JavaScript; do not infer routes.
function focusSharedDesktopRail() {
  const destination = document.querySelector('.site-chrome__more a[aria-current]') ||
    document.querySelector('.site-chrome__links a[aria-current]') ||
    document.querySelector('#navigation a[aria-current]') ||
    document.querySelector('.site-chrome__brand') ||
    document.querySelector('#navigation a');
  // A user may have collapsed More before rotating to mobile. The active link
  // retains aria-current but is not focusable inside a closed <details>.
  // Preserve their disclosure choice; put focus on its visible summary rather
  // than reopening the menu or silently stranding keyboard focus on <body>.
  const collapsedMore = destination?.closest?.(
    'details.site-chrome__more:not([open]), details#additional-navigation:not([open])');
  const candidate = collapsedMore?.querySelector(':scope > summary') || destination;
  const fallback = document.querySelector('.site-chrome__brand') ||
    document.querySelector('#sidebar .brand') ||
    document.querySelector('#navigation a');
  [candidate, fallback].find(node => node?.getClientRects?.().length)
    ?.focus({preventScroll:true});
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
      const stops = [menu.querySelector('summary'), ...menu.querySelectorAll('a[href],button:not([disabled]),summary')]
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
    if (document.querySelectorAll('details.site-mobile-chrome__nav[open]').length) {
      closeSharedDrawers({restoreFocus:true});
      event.preventDefault();
      return;
    }
    // Discover and standalone rails share a native desktop More disclosure.
    // Close only the one holding keyboard focus; leave dialogs and other
    // page-level Escape actions alone. Native links still work without JS.
    if (document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]')) return;
    const more = document.activeElement?.closest?.('details.site-chrome__more[open], details#additional-navigation[open]');
    if (more) {
      more.open = false;
      more.querySelector(':scope > summary')?.focus({preventScroll:true});
      event.preventDefault();
    }
    return;
  }
  // Discover's / keyboard search should work on every standalone page too.
  if (event.key !== '/' || event.defaultPrevented || event.repeat || event.isComposing ||
      event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target?.closest?.('input,textarea,select,[contenteditable],[role="textbox"]')) return;
  // An open native or ARIA-modal record belongs to its own keyboard scope.
  // Do not leave Research detail dialogs for the site-wide search route.
  if (document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]')) return;
  if (document.querySelector('details.site-mobile-chrome__nav[open]')) return;
  const inline = document.querySelector('#global-query') ||
    document.querySelector('.site-mobile-chrome__search-input');
  if (inline && inline.getClientRects().length) {
    event.preventDefault();
    inline.focus({preventScroll:true});
    return;
  }
  // Desktop native workspaces hide their mobile search form; the old
  // link has already been enhanced into that form. Preserve Discover's
  // '/' shortcut by following that same real search destination instead
  // of silently doing nothing on Research, News, Games and directories.
  const hiddenSearchRoute = document.querySelector('form.site-mobile-chrome__search-form')?.dataset.searchRoute;
  if (hiddenSearchRoute) {
    event.preventDefault();
    rememberSearchFocus();
    window.location.assign(hiddenSearchRoute);
    return;
  }
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
  normalizeResearchEarlyLink(event);
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
      event.metaKey || event.altKey || event.shiftKey) return;
  if (!event.target?.closest?.('a.site-mobile-chrome__search[href]')) return;
  rememberSearchFocus();
});
// The same desktop More dismissal policy applies to pointer and keyboard
// navigation across Discover and every native page. Preserve an active
// secondary destination so its section indication remains visible.
function dismissInactiveDesktopMore(target, restoreFocusedSummary = false) {
  if (typeof window === 'undefined' || window.innerWidth <= 650) return;
  document.querySelectorAll(
    'details.site-chrome__more[open], details#additional-navigation[open]'
  ).forEach(menu => {
    if (menu.contains(target)) return;
    if (menu.querySelector('.site-chrome__more-links a[aria-current], .nav-more-links a[aria-current]')) return;
    const hadFocus = restoreFocusedSummary && menu.contains(document.activeElement);
    menu.open = false;
    if (hadFocus) menu.querySelector(':scope > summary')?.focus({preventScroll:true});
  });
}
document.addEventListener('pointerdown', (event) => {
  normalizeResearchEarlyLink(event);
  // A modal drawer deliberately makes the background inert. An outside tap
  // dismisses it first; return keyboard/AT focus to the still-visible toggle.
  if ([...document.querySelectorAll('details.site-mobile-chrome__nav[open]')]
      .some(menu => !menu.contains(event.target))) {
    closeSharedDrawers({restoreFocus:true});
  }
  /* atlas-shared-desktop-more-dismiss:begin */
  dismissInactiveDesktopMore(event.target, true);
  /* atlas-shared-desktop-more-dismiss:end */
});
// When keyboard focus leaves an inactive More disclosure, use the same shared
// dismissal behavior as an outside pointer. This prevents the expanded rail
// from persisting while tabbing through the page; script-free <details> and
// the selected secondary destination keep their existing behavior.
document.addEventListener('focusin', event => {
  dismissInactiveDesktopMore(event.target);
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
// Discover's brand, appearance action and coverage link sit outside #navigation.
// Track the whole desktop rail, just as on every native page.
let lastDesktopRailFocus = null;
let lastMobileToggleFocus = null;
document.addEventListener('focusin', event => {
  normalizeResearchEarlyLink(event);
  lastDesktopRailFocus = event.target?.closest?.('.site-chrome,#sidebar') ? event.target : null;
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
/* Discover and native rails share the same sidebar-bottom structure and CSS.
   Retain script-free native navigation when JS is disabled. */
function buildSharedRailBottom(rail) {
  if (!rail || typeof rail.querySelector !== 'function') return null;
  const previous = rail.querySelector('.sidebar-bottom');
  if (previous) return previous;
  const home = rail.querySelector('.site-chrome__brand')?.getAttribute('href') || '';
  const suffix = 'index.html#/overview';
  if (!home.endsWith(suffix)) return null;
  const prefix = home.slice(0, -suffix.length);
  const bottom = document.createElement('div');
  bottom.className = 'sidebar-bottom site-chrome__bottom';
  const snapshot = document.createElement('div');
  snapshot.className = 'snapshot';
  const dot = document.createElement('i');
  dot.setAttribute('aria-hidden', 'true');
  const description = document.createElement('span');
  description.append('Research snapshot');
  const date = document.createElement('small');
  date.textContent = 'November 1, 2026';
  description.append(date);
  snapshot.append(dot, description);
  const motto = document.createElement('p');
  motto.append('Sources, not speculation.', document.createElement('br'), 'Tradeoffs, not rankings.');
  const coverage = document.createElement('a');
  coverage.href = prefix + 'index.html#/sources';
  coverage.textContent = 'Coverage & collection status ↗';
  const actions = document.createElement('div');
  actions.className = 'sidebar-actions';
  const sourced = document.createElement('span');
  sourced.textContent = 'Curated & sourced';
  actions.append(sourced);
  bottom.append(snapshot, motto, coverage, actions);
  rail.append(bottom);
  return bottom;
}
function syncSharedThemeAction(button, theme) {
  button.setAttribute('aria-pressed', String(theme === 'dark'));
  button.textContent = '◐  ' + (theme === 'dark' ? 'Dark' : 'Light') + ' theme';
}

function syncPrimaryThemeButton(theme) {
  const button = document.getElementById?.('theme-toggle');
  if (!button) return;
  // Discover and Games have their own working action; normalize its name to
  // the shared toggle contract when a saved theme changes in another tab or
  // the page returns from BFCache. aria-pressed reports the actual theme.
  button.setAttribute('aria-label', 'Toggle color theme');
  button.setAttribute('aria-pressed', String(theme === 'dark'));
}
function syncSharedStoredTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') return;
  document.documentElement.dataset.theme = theme;
  syncPrimaryThemeButton(theme);
  document.querySelectorAll('.site-chrome__theme-toggle').forEach(button => {
    syncSharedThemeAction(button, theme);
  });
}
function restoreSharedThemeAfterHistory() {
  if (!themePersistenceAllowed) return;
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
    if (themePersistenceAllowed && event.key === 'atlas.theme') syncSharedStoredTheme(event.newValue);
  });
}

// Restoring a page from the back/forward cache must not resurrect a modal
// drawer with stale inert siblings or hidden keyboard focus.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      // Browsers may blur a focused menu link before restoring a cached page.
      // Return focus to the visible toggle before hiding the restored drawer.
      const desktopNow = window.innerWidth > 650;
      closeSharedDrawers(desktopNow ? {desktopFocus:true} : {restoreFocus:true});
      restoreSharedThemeAfterHistory();
    }
  });
}

/* Use the existing canonical selected link as the standalone workspace
   breadcrumb, matching Discover without introducing duplicate navigation. */
document.addEventListener('DOMContentLoaded', () => {
  // Discover has no native .site-mobile-chrome element. Normalize its
  // script-free navigation before the early return, then again for generated
  // native menus that are appended during this same hydration callback.
  syncCanonicalResearchEntry();
  const chrome = document.querySelector('.site-mobile-chrome');
  if (!chrome) return;
  const active = document.querySelector('.site-chrome__links a[aria-current]');
  const heading = document.querySelector('main h1');
  // A selected primary section is not the identity of an editorial subpage.
  // Respect the server-rendered page label on first paint and after hydration.
  const label = chrome.dataset.pageLabel || active?.textContent?.trim() || heading?.textContent?.trim() || document.title.split('·')[0].trim();
  chrome.dataset.pageLabel = label;
  // Discover already names its mobile header; give every native page the same
  // accessible workspace identity from its existing canonical title source.
  chrome.setAttribute('aria-label', 'AI Updates mobile header · ' + label);
  ensureSharedWorkspaceTitle(chrome, label);
  // Every shared mobile menu should announce the same current workspace as
  // its visible header. Native reference pages still carry a generic
  // script-free summary label; normalize it centrally after hydration instead
  // of duplicating a screen-reader-only label in every page template.
  const mobileToggle = chrome.querySelector(':scope > details.site-mobile-chrome__nav > summary');
  if (mobileToggle && label) mobileToggle.setAttribute('aria-label', 'Toggle navigation · ' + label);
  // Reuse the canonical desktop brand in the native mobile drawer. Never
  // maintain a second logo template; no-JS <details> navigation still works.
  const menu = chrome.querySelector('.site-mobile-chrome__menu');
  const desktopBrand = document.querySelector('.site-chrome__brand');
  if (menu && desktopBrand && !menu.querySelector('.site-mobile-chrome__brand')) {
    const mobileBrand = desktopBrand.cloneNode(true);
    mobileBrand.className = 'site-mobile-chrome__brand';
    menu.prepend(mobileBrand);
  }

  // Match Discover's existing "More sections" rail on every native page.
  // This is one progressive desktop enhancement; the original seven primary
  // links, mobile drawer and script-free navigation remain unchanged.
  const desktopRail = document.querySelector('.site-chrome');
  const desktopPrimary = desktopRail?.querySelector?.('.site-chrome__links');
  if (desktopPrimary && !desktopRail.querySelector('.site-chrome__more')) {
    // The brand is the canonical relative-root link for both root and nested
    // concept/technology routes. Never guess the deployment's base pathname.
    const homeLink = desktopRail.querySelector('.site-chrome__brand')?.getAttribute('href') || '';
    if (homeLink.endsWith('index.html#/overview')) {
      const prefix = homeLink.slice(0, -'index.html#/overview'.length);
      /* atlas-secondary-data:begin */
      const sharedSecondarySections = [
        ["index.html#/safety", "Safety observatory"],
        ["index.html#/papers", "Research library"],
        ["index.html#/compare", "Compare tools"],
        ["index.html#/saved", "Your notebook"],
        ["index.html#/sources", "Sources & coverage"],
        ["demo.html", "Guided professor demo"],
        ["terms/index.html", "Concept encyclopedia"],
        ["downloads/Atlas_Demo_Offline.html", "Offline demo download ↓"],
      ];
      /* atlas-secondary-data:end */
      const more = document.createElement('details');
      more.className = 'site-chrome__more';
      const trigger = document.createElement('summary');
      trigger.textContent = 'More sections';
      more.append(trigger);
      const links = document.createElement('div');
      links.className = 'site-chrome__more-links';
      sharedSecondarySections.forEach(([route, label]) => {
        const a = document.createElement('a');
        a.href = prefix + route;
        a.textContent = label;
        if (route === 'downloads/Atlas_Demo_Offline.html') a.download = '';
        links.append(a);
      });
      more.append(links);
      desktopPrimary.insertAdjacentElement('afterend', more);
    }
  }

  // The desktop rail already owns the eight secondary destinations.
  // Expose those same working routes in every mobile drawer without maintaining
  // a second list or altering the seven script-free primary links.
  if (menu && !menu.querySelector('.site-mobile-chrome__more')) {
    const sourceLinks = document.querySelector(
      '#additional-navigation .nav-more-links, .site-chrome__more-links');
    if (sourceLinks) {
      const more = document.createElement('details');
      more.className = 'site-mobile-chrome__more';
      const summary = document.createElement('summary');
      summary.textContent = 'More sections';
      const links = document.createElement('div');
      links.className = 'site-mobile-chrome__more-links';
      sourceLinks.querySelectorAll('a[href]').forEach(source => {
        const link = document.createElement('a');
        link.setAttribute('href', source.getAttribute('href'));
        link.textContent = (source.querySelector('span:not(.nav-count)')?.textContent ||
          source.textContent).trim();
        if (source.hasAttribute('download'))
          link.setAttribute('download', source.getAttribute('download') || '');
        links.append(link);
      });
      if (links.children.length === 8) {
        more.append(summary, links);
        menu.append(more);
      }
    }
  }

  // All page families use the shared appearance action in their native drawer.
  // Discover retains its original desktop sidebar button; Games retains its
  // desktop header action, but uses this same control inside the mobile drawer.
  // Native links and no-JavaScript navigation remain untouched.
  if (typeof document.createElement === 'function' && menu) {
    const rail = document.querySelector('.site-chrome');
    const existing = document.getElementById?.('theme-toggle');
    const railBottom = buildSharedRailBottom(rail);
    const desktopAction = railBottom?.querySelector('.sidebar-actions');
    // Games already owns a working theme button, but formerly floated it over
    // the desktop search bar. Reparent that SAME control into Discover's
    // canonical rail action slot before Games registers its click handler.
    // A stable ID, existing listeners and the mobile drawer action survive.
    // CSS hides its old header position on first paint to prevent a jump.
    if (existing && desktopAction &&
        document.querySelector('.games-header__inner > #theme-toggle') === existing) {
      desktopAction.prepend(existing);
      existing.classList.add('site-chrome__theme-toggle--rail');
    }
    const containers = rail && !existing && desktopAction ? [desktopAction, menu] :
      existing ? [menu] : [];
    if (containers.length && !menu.querySelector('.site-chrome__theme-toggle')) {
      const controls = [];
      const effectiveTheme = () => document.documentElement.dataset.theme ||
        (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const syncThemeButtons = () => {
        const theme = effectiveTheme();
        syncPrimaryThemeButton(theme);
        controls.forEach(button => {
          syncSharedThemeAction(button, theme);
        });
      };
      for (const container of containers) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'site-chrome__theme-toggle' +
          (container === desktopAction ? ' site-chrome__theme-toggle--rail icon-button' : '');
        button.setAttribute('aria-label', 'Toggle color theme');
        button.addEventListener('click', () => {
          const chosen = effectiveTheme() === 'dark' ? 'light' : 'dark';
          document.documentElement.dataset.theme = chosen;
          if (themePersistenceAllowed) {
            try { localStorage.setItem('atlas.theme', chosen); }
            catch (_) { /* Theme still changes when persistence is unavailable. */ }
          }
          syncThemeButtons();
        });
        if (container === desktopAction) container.prepend(button);
        else container.append(button);
        controls.push(button);
      }
      // Discover's app-level click handler may be registered after this head
      // script's DOMContentLoaded callback. Read its final palette after all
      // synchronous click listeners finish, not before the app toggles it.
      if (existing) existing.addEventListener('click', () => queueMicrotask(syncThemeButtons));
      syncThemeButtons();
    }
  }  syncCanonicalResearchEntry();
});

/* atlas-early-research-activation:begin */
// Reuse the already registered shared click, pointerdown and focus handlers;
// additional global listeners would compete with the existing drawer/focus
// behavior. Canonicalize Research just before early link activation while
// preserving script-free and offline routes and every other destination.
function normalizeResearchEarlyLink(event) {
  const link = event.target?.closest?.('a[href]');
  if (!link || !link.closest(
    '#navigation, #discover-mobile-nav, .site-chrome__more-links, .site-mobile-chrome__more-links')) return;
  const label = link.querySelector('span:not(.nav-count)')?.textContent?.trim() ||
    link.textContent?.trim();
  if (label === 'Research library') syncCanonicalResearchEntry();
}
/* atlas-early-research-activation:end */

/* atlas-canonical-research-entry:begin */
// Preserve legacy hash links for script-free and offline users, but use the
// existing native Research workspace on live pages after shared chrome builds.
function syncCanonicalResearchEntry() {
  if (typeof window === 'undefined' || window.ATLAS_OFFLINE) return;
  const home = document.querySelector('#sidebar .brand, .site-chrome__brand')?.getAttribute('href') || '';
  const suffix = 'index.html#/overview';
  const prefix = home === '#/overview' ? '' : home.endsWith(suffix) ? home.slice(0, -suffix.length) : null;
  if (prefix === null || typeof document.querySelectorAll !== 'function') return;
  const oldLinks = new Set([prefix + 'index.html#/papers']);
  if (!prefix) oldLinks.add('#/papers');
  document.querySelectorAll('a[href]').forEach(link => {
    if (!oldLinks.has(link.getAttribute('href'))) return;
    const label = link.querySelector('span:not(.nav-count)')?.textContent?.trim() ||
      link.textContent?.trim();
    const sharedNav = label === 'Research library' && link.closest(
      '#navigation, #discover-mobile-nav, .site-chrome__more-links, .site-mobile-chrome__more-links');
    const discoveryCta = link.matches('.reading-link a.btn') &&
      link.textContent?.includes('Open the library');
    if (sharedNav || discoveryCta) link.setAttribute('href', prefix + 'research.html');
  });
}
/* atlas-canonical-research-entry:end */
