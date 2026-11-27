"""Exercise the packaged or deployed Atlas with real browser navigation and downloads."""
import argparse
import csv
import hashlib
import io
import json
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--base', required=True)
parser.add_argument('--output', default='deployment-validation/site')
args = parser.parse_args()
base = args.base.rstrip('/') + '/'
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
checks, errors = [], []


def check(name, condition):
    assert condition, name
    checks.append(name)
    print('PASS', name, flush=True)


def desktop_shared_navigation(page):
    """The native search wrapper remains visible on desktop, but its
    mobile disclosure must be hidden; only the shared sidebar is navigation."""
    nav = page.locator('nav.site-chrome')
    search = page.locator('form.site-mobile-chrome__search')
    return (nav.count() == 1 and nav.is_visible()
            and nav.locator('.site-chrome__links a').count() == 7
            and search.count() == 1 and search.is_visible()
            and search.locator('kbd.site-mobile-chrome__search-hint').count() == 1
            and search.locator('kbd.site-mobile-chrome__search-hint').is_visible()
            and search.locator('kbd.site-mobile-chrome__search-hint').text_content() == '/'
            and search.evaluate('el => getComputedStyle(el.closest(".site-mobile-chrome")).position === "fixed"')
            and not page.locator('details.site-mobile-chrome__nav').is_visible())


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'), headless=True)
    page = browser.new_page(viewport={'width':1440, 'height':1000}, reduced_motion='reduce')
    page.on('pageerror', lambda e: errors.append(str(e)))
    # Discover's parser-loaded live search requires JavaScript. With scripts
    # disabled, do not leave an inert form pretending to search: offer a real
    # script-free route into the preserved catalog instead.
    for scriptless_scheme in ('light', 'dark'):
        scriptless_context = browser.new_context(java_script_enabled=False,
                                                color_scheme=scriptless_scheme,
                                                reduced_motion='reduce')
        scriptless_page = scriptless_context.new_page()
        for scriptless_width in (320, 390, 768, 1280):
            scriptless_page.set_viewport_size({'width': scriptless_width, 'height': 844})
            scriptless_page.goto(base + 'index.html')
            fallback = scriptless_page.locator('a.nojs-catalog-link')
            check('Discover no-JS truthful search fallback ' + scriptless_scheme + ' ' + str(scriptless_width),
                  scriptless_page.locator('#global-search').is_hidden()
                  and fallback.count() == 1 and fallback.is_visible()
                  and fallback.get_attribute('href') == 'terms/index.html'
                  and scriptless_page.locator('.nojs-primary-routes').is_hidden()
                  and scriptless_page.locator('#catalog-loading').is_hidden()
                  and scriptless_page.locator('#page').is_visible())
            if scriptless_width in (320, 1280):
                scriptless_page.screenshot(path=str(out / (
                    'discover-nojs-search-' + scriptless_scheme + '-' +
                    str(scriptless_width) + '.png')))
            fallback.click()
            scriptless_page.wait_for_url(base + 'terms/index.html', wait_until='load', timeout=15000)
            expect(scriptless_page.locator('main')).to_have_count(1, timeout=15000)
            expect(scriptless_page.locator('main h1')).to_be_visible(timeout=15000)
            check('Discover no-JS browse navigation ' + scriptless_scheme + ' ' + str(scriptless_width),
                  scriptless_page.url.endswith('/terms/index.html')
                  and scriptless_page.locator('main').count() == 1)
        # The existing Safety review-queue link has no primary navigation tab.
        # Without JavaScript its hash needs a truthful, focused fallback.
        for queue_width in (320, 1280):
            scriptless_page.set_viewport_size({'width': queue_width, 'height': 844})
            # CSS that clears the static Discover selection is an external stylesheet.
            # DOMContentLoaded can precede its load in JS-disabled browsers;
            # assert the fully rendered state rather than racing network CSS.
            scriptless_page.goto(base + 'index.html#/queue', wait_until='load')
            queue_section = scriptless_page.locator('[id="/queue"]')
            queue_policy = queue_section.locator('a[data-nojs-static="queue-policy"]')
            check('Script-free review queue ' + scriptless_scheme + ' ' + str(queue_width),
                  queue_section.is_visible() and scriptless_page.locator('#page').is_hidden()
                  and queue_section.locator('[role="heading"][aria-level="1"]').text_content() == 'Review queue'
                  and queue_policy.get_attribute('href') == 'about.html')
            check('Script-free Review queue clears stale Discover rail ' + scriptless_scheme + ' ' + str(queue_width),
                  scriptless_page.locator('#navigation a[data-view="overview"]').evaluate(
                      'el => getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)"'))
            if queue_width == 320:
                scriptless_page.screenshot(path=str(out / (
                    'discover-nojs-queue-' + scriptless_scheme + '-320.png')))
            queue_policy.click()
            scriptless_page.wait_for_url(base + 'about.html', wait_until='domcontentloaded', timeout=15000)
            check('Script-free queue policy destination ' + scriptless_scheme + ' ' + str(queue_width),
                  scriptless_page.locator('main').count() == 1)
            scriptless_page.goto(base + 'index.html#/search', wait_until='load')
            check('Script-free Search clears stale Discover rail ' + scriptless_scheme + ' ' + str(queue_width),
                  scriptless_page.locator('[id="/search"]').is_visible()
                  and scriptless_page.locator('#navigation a[data-view="overview"]').evaluate(
                      'el => getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)"'))
        # Native and generated headers deliberately retain the same SPA hash
        # destinations as Discover. Without JS, those hashes now identify
        # real route-specific fallback content rather than a generic home page.
        routes = {320: ('dictionary', 'terms/index.html'),
                  390: ('technologies', 'technology/index.html'),
                  768: ('games', 'games.html'),
                  1280: ('dictionary', 'terms/index.html')}
        for route_width, (route_key, catalog_href) in routes.items():
            scriptless_page.set_viewport_size({'width': route_width, 'height': 844})
            scriptless_page.goto(base + 'research.html')
            if route_width <= 650:
                scriptless_page.locator('details.site-mobile-chrome__nav > summary').click()
                route_link = scriptless_page.locator(
                    'nav.site-mobile-chrome__menu > a[href="index.html#/' + route_key + '"]')
            else:
                route_link = scriptless_page.locator(
                    '.site-chrome__links > a[href="index.html#/' + route_key + '"]')
            route_link.click()
            # Wait for the destination document, not just a click on its source.
            # Remote cross-document navigation can commit after Playwright's
            # click returns; evaluating visibility in the old page races the
            # transition even when the new hash target is on screen.
            scriptless_page.wait_for_url(base + 'index.html#/' + route_key,
                                         wait_until='domcontentloaded', timeout=15000)
            # The browser completes a cross-document fragment jump after
            # navigation resolves on some production requests. Wait for native
            # scrolling, as we already do for secondary routes below; do not
            # scroll the target ourselves or excuse an offscreen destination.
            # Locator assertions poll across remote navigation and do not rely
            # on page-side requestAnimationFrame in a JS-disabled context.
            try:
                expect(scriptless_page.locator('[id="/' + route_key + '"]')).to_be_in_viewport(timeout=15000)
            except Exception:
                # Keep this a hard failure. Capture independent browser evidence
                # to distinguish a missing fragment, hidden content, layout shift
                # or remote redirect instead of guessing from a bare timeout.
                snapshot = scriptless_page.evaluate("""section => {
                    const t=document.getElementById('/'+section);
                    const r=t?.getBoundingClientRect();
                    const style=t?getComputedStyle(t):null;
                    const group=document.querySelector('.nojs-primary-routes');
                    return {url:location.href, hash:location.hash,
                      scrollY, innerHeight, readyState:document.readyState,
                      targetExists:!!t, targetRect:r?.toJSON(),
                      targetDisplay:style?.display, targetVisibility:style?.visibility,
                      groupDisplay:group?getComputedStyle(group).display:null,
                      mainRect:document.querySelector('main')?.getBoundingClientRect().toJSON(),
                      headings:[...document.querySelectorAll('h1')].map(x=>x.textContent.trim()),
                      visibleFallbacks:[...document.querySelectorAll('.nojs-primary-routes > section')]
                        .filter(x=>getComputedStyle(x).display!=='none')
                        .map(x=>x.id)};
                }""", route_key)
                print('REMOTE SCRIPT-FREE HASH DIAGNOSTIC', scriptless_scheme,
                      route_width, route_key, snapshot, flush=True)
                scriptless_page.screenshot(path=str(out / (
                    'failed-primary-route-'+route_key+'-'+scriptless_scheme+'-'+str(route_width)+'.png')))
                raise
            fallback_route = scriptless_page.locator(
                '.nojs-primary-routes > section[id="/' + route_key + '"]')
            frame = fallback_route.bounding_box()
            check('cross-page no-JS hash route '+scriptless_scheme+' '+str(route_width)+' '+route_key,
                  scriptless_page.url.endswith('/index.html#/' + route_key)
                  and fallback_route.is_visible()
                  and fallback_route.locator('div[role="heading"][aria-level="1"]').count() == 1
                  and scriptless_page.get_by_role('heading', level=1).count() == 1
                  and scriptless_page.locator('#page').is_hidden()
                  and fallback_route.locator('a[href="' + catalog_href + '"]').count() == 1
                  and scriptless_page.locator('.nojs-primary-routes > section.notice:visible').count() == 1
                  and frame is not None and frame['y'] < 844 and frame['y']+frame['height'] > 0)
            # Check the actually visible navigation at each breakpoint (not a
            # hidden desktop or mobile duplicate); both layouts are exercised.
            selected_visual = scriptless_page.evaluate("""key => {
                const before=document.querySelector('#navigation a[data-view="overview"]');
                const active=document.querySelector('#navigation a[data-view="'+key+'"]');
                const mobile=document.querySelector('.discover-mobile-chrome .site-mobile-chrome__menu a[href="#/'+key+'"]');
                const mobileBefore=document.querySelector('.discover-mobile-chrome .site-mobile-chrome__menu > a[href="#/overview"]');
                const desktopVisible=getComputedStyle(document.querySelector('.sidebar')).display!=='none';
                const mobileVisible=getComputedStyle(document.querySelector('.discover-mobile-chrome')).display!=='none';
                return !!(before && active && mobile && mobileBefore && (desktopVisible || mobileVisible)
                    && (!desktopVisible || getComputedStyle(active).backgroundColor !== getComputedStyle(before).backgroundColor)
                    && (!mobileVisible || getComputedStyle(mobile).backgroundColor !== getComputedStyle(mobileBefore).backgroundColor));
            }""", route_key)
            if not selected_visual:
                detail = scriptless_page.evaluate("""key => {
                    const dsel=key=>document.querySelector(key);
                    const nodes={overview:dsel('#navigation a[data-view="overview"]'),
                      active:dsel('#navigation a[data-view="'+key+'"]'),
                      mobileOverview:dsel('.discover-mobile-chrome .site-mobile-chrome__menu > a[href="#/overview"]'),
                      mobileActive:dsel('.discover-mobile-chrome .site-mobile-chrome__menu a[href="#/'+key+'"]'),
                      sidebar:dsel('.sidebar'),mobileHeader:dsel('.discover-mobile-chrome')};
                    return {hash:location.hash,width:innerWidth,activeTarget:document.querySelector('.notice:target')?.id,
                      selectors:Object.fromEntries(Object.entries(nodes).map(([k,v])=>[k,{exists:!!v,
                        display:v?getComputedStyle(v).display:null,
                        bg:v?getComputedStyle(v).backgroundColor:null,
                        color:v?getComputedStyle(v).color:null,
                        classes:v?.className}]))};
                }""", route_key)
                print('SCRIPT-FREE ACTIVE DETAIL', scriptless_scheme, route_width, route_key, detail, flush=True)
            check('script-free cross-page current section '+scriptless_scheme+' '+str(route_width)+' '+route_key,
                  selected_visual)
            if route_width in (320, 1280):
                scriptless_page.screenshot(path=str(out / (
                    'discover-nojs-route-'+route_key+'-'+scriptless_scheme+'-'+str(route_width)+'.png')))
        # Legacy public hash aliases must land on the same real script-free
        # destination and selected shared rail as their canonical routes.
        for alias_width, legacy_key, canonical_key, destination in (
                (320, 'terms', 'dictionary', 'terms/index.html'),
                (390, 'alerts', 'safety', 'research.html'),
                (1280, 'coverage', 'sources', 'about.html')):
            scriptless_page.set_viewport_size({'width': alias_width, 'height': 844})
            scriptless_page.goto(base + 'research.html')
            # Visual contrast depends on the shared external stylesheet.
            # DOMContentLoaded may fire before CSS on a cold production CDN.
            # Wait for the actual page load; keep the selected-vs-Discover
            # computed-color assertion unchanged so genuine CSS bugs still fail.
            scriptless_page.goto(base + 'index.html#/' + legacy_key,
                                 wait_until='load')
            alias_section = scriptless_page.locator(
                '.nojs-primary-routes > section[id="/' + legacy_key + '"]')
            check('script-free legacy alias ' + scriptless_scheme + ' ' +
                  str(alias_width) + ' ' + legacy_key,
                  scriptless_page.url.endswith('/index.html#/' + legacy_key)
                  and alias_section.is_visible()
                  and scriptless_page.locator('#page').is_hidden()
                  and scriptless_page.locator('.nojs-primary-routes > section.notice:visible').count() == 1
                  and scriptless_page.get_by_role('heading', level=1).count() == 1
                  and alias_section.locator('a[href="' + destination + '"]').count() == 1)
            check('legacy alias retains canonical rail selection ' + legacy_key,
                  scriptless_page.evaluate("""key => {
                      const nav=document.querySelector('#navigation');
                      const active=nav?.querySelector('a[data-view="'+key+'"]');
                      const discover=nav?.querySelector('a[data-view="overview"]');
                      return !!(active && discover &&
                        getComputedStyle(active).backgroundColor !==
                          getComputedStyle(discover).backgroundColor);
                  }""", canonical_key))
            if alias_width in (320, 1280):
                scriptless_page.screenshot(path=str(out / (
                    'discover-nojs-legacy-' + legacy_key + '-' +
                    scriptless_scheme + '-' + str(alias_width) + '.png')))
            alias_section.locator('a[href="' + destination + '"]').click()
            check('script-free legacy alias reaches native catalog ' + legacy_key,
                  scriptless_page.url.endswith('/' + destination)
                  and scriptless_page.locator('main').count() == 1)
        # Shared native secondary links also need useful script-free content.
        # The Research route itself is already canonical; the remaining
        # hash workspaces must not fall through to generic Discover content.
        secondary_routes = {320: ('safety', 'research.html'),
                            390: ('compare', 'technology/index.html'),
                            768: ('saved', 'terms/index.html'),
                            1280: ('sources', 'about.html')}
        for secondary_width, (section, target_path) in secondary_routes.items():
            scriptless_page.set_viewport_size({'width': secondary_width, 'height': 844})
            scriptless_page.goto(base + 'research.html')
            if secondary_width <= 650:
                scriptless_page.locator('details.site-mobile-chrome__nav > summary').click()
                more = scriptless_page.locator('details.site-mobile-chrome__more')
                if more.get_attribute('open') is None:
                    more.locator('summary').click()
                route_link = scriptless_page.locator(
                    '.site-mobile-chrome__more-links > a[href="index.html#/' + section + '"]')
            else:
                more = scriptless_page.locator('details.site-chrome__more')
                if more.get_attribute('open') is None:
                    more.locator('summary').click()
                route_link = scriptless_page.locator(
                    '.site-chrome__more-links > a[href="index.html#/' + section + '"]')
            route_link.click()
            # Require the exact destination document before polling the real
            # native fragment scroll. This does not scroll or reveal anything
            # on behalf of the visitor; missing links remain hard failures.
            scriptless_page.wait_for_url(base + 'index.html#/' + section,
                                         wait_until='domcontentloaded', timeout=15000)
            # A cross-document hash scroll can complete one or two frames after
            # Playwright's click/navigation resolves, especially with cold CDN
            # styles. Wait for the browser's *own* fragment scroll; never call
            # scroll_into_view, which would mask a broken native deep link.
            # Use a Playwright visibility assertion instead of in-page polling
            # because scripts are intentionally disabled in this context.
            expect(scriptless_page.locator('[id="/' + section + '"]')).to_be_in_viewport(timeout=15000)
            fallback = scriptless_page.locator(
                '.nojs-primary-routes > section[id="/' + section + '"]')
            frame = fallback.bounding_box()
            check('cross-page no-JS secondary route ' + scriptless_scheme +
                  ' ' + str(secondary_width) + ' ' + section,
                  scriptless_page.url.endswith('/index.html#/' + section)
                  and fallback.is_visible()
                  and fallback.locator('div[role="heading"][aria-level="1"]').count() == 1
                  and scriptless_page.get_by_role('heading', level=1).count() == 1
                  and scriptless_page.locator('#page').is_hidden()
                  and fallback.locator('a[href="' + target_path + '"]').count() == 1
                  and scriptless_page.locator('.nojs-primary-routes > section.notice:visible').count() == 1
                  and frame is not None and frame['y'] < 844
                  and frame['y'] + frame['height'] > 0)
            if secondary_width in (320, 1280):
                scriptless_page.screenshot(path=str(out / (
                    'discover-nojs-secondary-' + section + '-' +
                    scriptless_scheme + '-' + str(secondary_width) + '.png')))
        scriptless_context.close()
    # Hold the first manifest fetch to test early Discover form submission
    # before asynchronous catalog verification. This avoids a network race.
    for early_width in (390, 1280):
        early = browser.new_page(viewport={'width': early_width, 'height': 800},
                                 reduced_motion='reduce')
        early.add_init_script("""(() => {
          const originalFetch = window.fetch.bind(window);
          window.fetch = (resource, options) =>
            String(resource).endsWith('publication.json')
              ? new Promise(() => {})
              : originalFetch(resource, options);
        })();""")
        early.goto(base + 'index.html', wait_until='domcontentloaded')
        check('Discover pending catalog before early search ' + str(early_width),
              early.locator('#catalog-loading').count() == 1)
        early.locator('#global-query').fill('preload search')
        early.locator('#global-query').press('Enter')
        # Assigning a fragment is synchronous, but browsers dispatch hashchange
        # asynchronously. Wait for the REAL shared prehydration handler before
        # asserting its title, rather than racing it on faster local Workers.
        # Keep both the canonical route and accessible workspace title required.
        early.wait_for_function("""() =>
            location.hash === '#/search?q=preload%20search' &&
            document.getElementById('breadcrumb')?.textContent?.trim() === 'Search AI Updates'
        """, timeout=5000)
        check('shared early search route before catalog hydration ' + str(early_width),
              early.evaluate('location.hash') == '#/search?q=preload%20search'
              and early.locator('#breadcrumb').text_content() == 'Search AI Updates')
        # A search initiated from any native page must not turn Discover's
        # old teaser into a blank workspace while catalog data is delayed.
        # Inspect actual rendered dimensions and clipping, not just DOM text.
        loading_frame = early.locator('#catalog-loading').bounding_box()
        check('shared early search visibly announces pending catalog ' + str(early_width),
              loading_frame is not None and loading_frame['width'] > 200
              and loading_frame['height'] > 40
              and early.locator('#catalog-loading').evaluate(
                  '(el) => getComputedStyle(el).clipPath === "none"')
              and early.locator('#catalog-loading').text_content().strip()
                  == 'Loading verified search and catalog…')
        early.screenshot(path=str(out / (
            'shared-early-search-' + str(early_width) + '.png')))
        early.close()
    # Release a genuinely pending catalog after keyboard routing from a native
    # Discover topic. The initial render replaces the focused static anchor,
    # so it must use the same landmark-focus policy as later topic changes.
    for focus_scheme in ('light', 'dark'):
        for focus_width in (320, 390, 768, 1280):
            early_topic = browser.new_page(
                viewport={'width': focus_width, 'height': 844},
                color_scheme=focus_scheme, reduced_motion='reduce')
            early_topic.add_init_script("""(() => {
              const originalFetch = window.fetch.bind(window);
              window.fetch = (resource, options) =>
                String(resource).endsWith('publication.json')
                  ? new Promise(resolve => {
                      window.releaseAtlasManifest = () => {
                        resolve(originalFetch(resource, options));
                      };
                    })
                  : originalFetch(resource, options);
            })();""")
            early_topic.goto(base + 'index.html', wait_until='domcontentloaded')
            early_topic.wait_for_function(
                "typeof window.releaseAtlasManifest === 'function'")
            topic = early_topic.get_by_role('navigation', name='Discover topics').get_by_role(
                'link', name='Tools & models', exact=True)
            topic.focus()
            check('early topic focus before hydration ' + focus_scheme + ' ' + str(focus_width),
                  early_topic.locator('#catalog-loading').count() == 1
                  and topic.evaluate('(el) => document.activeElement === el'))
            early_topic.keyboard.press('Enter')
            early_topic.wait_for_function("location.hash === '#/overview?topic=tools'")
            early_topic.evaluate("window.releaseAtlasManifest()")
            early_topic.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
            early_topic.wait_for_function(
                "document.querySelectorAll('.discovery-card').length === 2")
            check('early topic focus recovers on actual catalog hydration ' +
                  focus_scheme + ' ' + str(focus_width),
                  early_topic.evaluate("document.activeElement.id === 'main'")
                  and topic.get_attribute('aria-current') == 'page')
            early_topic.close()
    page.goto(base)
    page.locator('#navigation a[href="#/games"]').wait_for()
    # The native headers previously used 16px (Games), 20px (news/reference)
    # and 18px (Discover/Research) left gutters, so menu/search controls jumped
    # horizontally between existing sections. Compare actual first-paint menu
    # geometry with JavaScript disabled at both phone widths and themes.
    for chrome_scheme in ('light', 'dark'):
        chrome_context = browser.new_context(java_script_enabled=False,
                                             color_scheme=chrome_scheme,
                                             reduced_motion='reduce')
        chrome_page = chrome_context.new_page()
        for chrome_width in (320, 390):
            chrome_page.set_viewport_size({'width': chrome_width, 'height': 844})
            chrome_page.goto(base + 'index.html')
            discover_menu = chrome_page.locator('#discover-mobile-nav > summary').bounding_box()
            assert discover_menu, 'Discover has a visible native mobile menu'
            for chrome_route in ('whats-new.html', 'research.html', 'playbooks.html',
                                 'technologies.html', 'games.html', 'catalog-review.html',
                                 'hardware-review.html', 'terms/index.html',
                                 'technology/index.html', 'terms/MLD-0002-ablation-study.html'):
                chrome_page.goto(base + chrome_route)
                menu_frame = chrome_page.locator(
                    'details.site-mobile-chrome__nav > summary').bounding_box()
                check('shared mobile menu aligns with Discover '+ chrome_scheme + ' ' +
                      str(chrome_width) + ' ' + chrome_route,
                      menu_frame is not None and
                      abs(menu_frame['x'] - discover_menu['x']) <= 1 and
                      abs(menu_frame['width'] - discover_menu['width']) <= 1 and
                      chrome_page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
                if chrome_width == 390 and chrome_route in (
                        'whats-new.html', 'research.html', 'games.html',
                        'technology/index.html'):
                    chrome_page.screenshot(path=str(out / (
                        'mobile-header-horizontal-'+chrome_route.replace('/', '-')+
                        '-'+chrome_scheme+'.png')))
        chrome_context.close()
    # The appearance action belongs to the shared mobile drawer on every page.
    # Its former dark-rail colors were pale on light menu backgrounds. Check
    # actual computed contrast in BOTH themes at the narrowest phone widths.
    for mobile_scheme in ('light', 'dark'):
        for mobile_width in (320, 390):
            for mobile_route in ('index.html', 'whats-new.html',
                                 'research.html', 'playbooks.html',
                                 'games.html', 'technology/index.html'):
                contrast_page = browser.new_page(
                    viewport={'width': mobile_width, 'height': 760},
                    color_scheme=mobile_scheme, reduced_motion='reduce')
                contrast_page.add_init_script(
                    "localStorage.setItem('atlas.theme', '" + mobile_scheme + "')")
                contrast_page.goto(base + mobile_route)
                contrast_page.locator(
                    'details.site-mobile-chrome__nav > summary').click()
                toggle = contrast_page.locator(
                    '.site-mobile-chrome__menu > .site-chrome__theme-toggle')
                toggle.wait_for(state='visible')
                actual_contrast = toggle.evaluate("""(el) => {
                    const rgb = value => (value.match(/\d+(?:\.\d+)?/g) || [])
                      .slice(0, 3).map(n => Number(n)/255)
                      .map(n => n <= 0.04045 ? n/12.92 : ((n+0.055)/1.055)**2.4);
                    const luminance = rgb => rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
                    const style = getComputedStyle(el);
                    const a = luminance(rgb(style.color));
                    const b = luminance(rgb(style.backgroundColor));
                    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
                }""")
                check('shared mobile appearance contrast ' + mobile_route +
                      ' ' + mobile_scheme + ' ' + str(mobile_width),
                      actual_contrast >= 4.5 and
                      toggle.get_attribute('aria-label') == 'Toggle color theme')
                if mobile_width == 390 and mobile_route in (
                        'index.html', 'research.html', 'technology/index.html'):
                    contrast_page.screenshot(path=str(out / (
                        'shared-mobile-theme-' + mobile_route.replace('/', '-') +
                        '-' + mobile_scheme + '.png')))
                contrast_page.close()
    check('homepage retains original Atlas shell and native Games tab', page.locator('.app-shell').count() == 1)
    # Discover and native pages retain the same real submit action at
    # every viewport. The desktop slash hint and 44px mobile row remain.
    for scheme in ('light', 'dark'):
        for width in (320, 390, 768, 1280):
            submit_page = browser.new_page(
                viewport={'width': width, 'height': 844},
                color_scheme=scheme, reduced_motion='reduce')
            submit_page.goto(base + 'index.html')
            submit_button = submit_page.locator(
                '#global-search > button.site-mobile-chrome__search-submit')
            check('shared Discover submit appears at every viewport ' +
                  scheme + ' ' + str(width),
                  submit_button.count() == 1 and
                  submit_button.is_visible() and
                  submit_page.locator('#global-search').count() == 1)
            if width <= 650:
                frame = submit_page.locator('#global-search').bounding_box()
                menu = submit_page.locator(
                    '#discover-mobile-nav > summary').bounding_box()
                check('Discover search and mobile menu share a 44px row ' +
                      scheme + ' ' + str(width),
                      frame is not None and menu is not None
                      and abs(frame['height'] - 44) <= 1
                      and abs(frame['y'] - menu['y']) <= 2)
                if width == 390:
                    submit_page.screenshot(
                        path=str(out / ('discover-submit-' + scheme + '-390.png')))
            else:
                frame = submit_page.locator('#global-search').bounding_box()
                check('Discover desktop search shares the 40px native row ' +
                      scheme + ' ' + str(width),
                      frame is not None and abs(frame['height'] - 40) <= 1)
            submit_page.locator('#global-query').fill('reward hacking')
            submit_page.wait_for_function(
                "() => !document.getElementById('catalog-loading')",
                timeout=45000)
            submit_button.click()
            submit_page.wait_for_function(
                """() => location.hash.startsWith('#/search?q=') &&
                new URLSearchParams(location.hash.split('?')[1]).get('q') === 'reward hacking'""",
                timeout=15000)
            check('shared Discover submit executes real search ' +
                  scheme + ' ' + str(width),
                  submit_page.evaluate(
                      "new URLSearchParams(location.hash.split('?')[1]).get('q')") ==
                  'reward hacking')
            submit_page.close()
    # Compare the rendered native search fields against Discover, not just
    # their markup. A desktop 16px native input looked noticeably different
    # from Discover's 12px field; both should remain 16px on phones.
    for search_scheme in ('light', 'dark'):
        for search_width in (320, 390, 768, 1280):
            search_page = browser.new_page(
                viewport={'width': search_width, 'height': 844},
                color_scheme=search_scheme, reduced_motion='reduce')
            search_page.goto(base + 'index.html')
            discover_font = search_page.locator('#global-query').evaluate(
                'el => getComputedStyle(el).fontSize')
            for search_route in ('whats-new.html', 'research.html',
                                 'playbooks.html', 'games.html',
                                 'technology/index.html', 'terms/index.html',
                                 'about.html', 'catalog-review.html',
                                 'hardware-review.html', 'demo.html',
                                 'terms/MLD-0002-ablation-study.html',
                                 'technology/TECH-0216-pytorch.html', 'technologies.html'):
                search_page.goto(base + search_route)
                field = search_page.locator(
                    'form.site-mobile-chrome__search-form input.site-mobile-chrome__search-input')
                field.wait_for(state='attached')
                native_font = field.evaluate('el => getComputedStyle(el).fontSize')
                native_submit = search_page.locator('form.site-mobile-chrome__search-form button.site-mobile-chrome__search-submit')
                check('native shared search has a real visible submit ' + search_route +
                      ' ' + search_scheme + ' ' + str(search_width),
                      field.is_visible() and native_submit.count() == 1 and native_submit.is_visible())
                check('shared search type matches Discover ' + search_route +
                      ' ' + search_scheme + ' ' + str(search_width),
                      native_font == discover_font and
                      native_font == ('16px' if search_width <= 650 else '12px'))
                if search_width in (390, 1280) and search_route == 'research.html':
                    search_page.screenshot(path=str(out /
                        ('research-shared-search-' + search_scheme +
                         '-' + str(search_width) + '.png')))
            search_page.close()
    # Scriptless Discover must not advertise an inert input or submit button.
    # The real native browse fallback is keyboard and pointer navigable instead.
    # Keep this independent of the matrix above so a one-off regression fails.
    nojs_submit = browser.new_page(viewport={'width': 390, 'height': 844},
                                   java_script_enabled=False)
    nojs_submit.goto(base + 'index.html')
    nojs_fallback = nojs_submit.locator('a.nojs-catalog-link[href="terms/index.html"]')
    check('script-free Discover does not advertise an inert submit button',
          nojs_submit.locator('#global-search').is_hidden()
          and nojs_submit.locator('#global-query').is_hidden()
          and not nojs_submit.locator(
              '#global-search > button.site-mobile-chrome__search-submit').is_visible()
          and nojs_fallback.count() == 1 and nojs_fallback.is_visible())
    # The old fallback wrapped into two lines at 320px, making Discover's
    # script-free mobile header taller than the shared native search entry.
    # Keep the visible label compact, while its aria-label explains the
    # JavaScript limitation to assistive technology.
    for fallback_scheme in ('light', 'dark'):
        nojs_submit.emulate_media(color_scheme=fallback_scheme)
        for fallback_width in (320, 390):
            nojs_submit.set_viewport_size({'width': fallback_width, 'height': 844})
            check('script-free Discover search entry stays on one line ' +
                  fallback_scheme + ' ' + str(fallback_width),
                  nojs_fallback.evaluate("""el => {
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    return range.getClientRects().length === 1;
                  }""")
                  and nojs_fallback.inner_text().strip() == 'Browse concepts ↗'
                  and 'interactive search requires JavaScript' in
                  (nojs_fallback.get_attribute('aria-label') or ''))
            nojs_submit.screenshot(path=str(out / (
                'discover-scriptless-search-' + fallback_scheme + '-' +
                str(fallback_width) + '.png')))
    nojs_submit.set_viewport_size({'width':390,'height':844})
    # Click the real link and await the exact document. A click can return
    # before the navigation commits or before the generated catalog is parsed.
    # Keep the destination assertion strict; do not navigate directly or retry the click.
    nojs_fallback.click()
    nojs_submit.wait_for_url(base + 'terms/index.html', wait_until='load', timeout=15000)
    expect(nojs_submit.locator('main')).to_have_count(1, timeout=15000)
    expect(nojs_submit.locator('main h1')).to_be_visible(timeout=15000)
    check('script-free Discover fallback opens the actual catalog',
          nojs_submit.url.endswith('/terms/index.html')
          and nojs_submit.locator('main').count() == 1)
    nojs_submit.close()
    # Discover's desktop workspace title is a real text node. Native article
    # families must provide the same accessible heading instead of a CSS-only
    # pseudo-element; the compact mobile drawer retains its original layout.
    for scheme in ('light','dark'):
        title_context = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        title_page = title_context.new_page()
        for width in (320,390,768,1280):
            title_page.set_viewport_size({'width':width,'height':844})
            title_page.goto(base+'index.html')
            for route, expected in (
                ('research.html','Research library'),
                ('playbooks.html','Playbooks'),
                ('technologies.html','Technology profiles'),
                ('whats-new.html','What’s New Today'),
                ('games.html','Games'),
                ('about.html','About'),
                ('terms/index.html','Concept encyclopedia'),
                ('technology/index.html','Technology profiles')
            ):
                title_page.goto(base+route)
                title = title_page.locator('.site-mobile-chrome > .site-mobile-chrome__title')
                chrome = title_page.locator('.site-mobile-chrome')
                check('Native DOM workspace title '+route+' '+scheme+' '+str(width),
                      title.count()==1 and title.inner_text()==expected
                      and title.is_visible()==(width>650)
                      and (width<=650 or chrome.evaluate(
                          "el => getComputedStyle(el,'::before').display === 'none'"))
                      and title_page.locator('.site-mobile-chrome__search').is_visible())
                if width in (390,1280) and route in ('research.html','whats-new.html'):
                    title_page.screenshot(path=str(out/('workspace-title-'+route.split('.')[0]+'-'+scheme+'-'+str(width)+'.png')))
        title_context.close()
    # Landing pages share Discover's first-content baseline. Generated
    # individual articles retain their compact 18px article rhythm. Check
    # both contracts before JavaScript and under both OS theme preferences.
    for scheme in ('light', 'dark'):
        intro_context = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        intro_page = intro_context.new_page()
        for width in (320, 390):
            intro_page.set_viewport_size({'width': width, 'height': 844})
            intro_page.goto(base + 'index.html', wait_until='load')
            discover_top = intro_page.locator('.discover-heading').first.evaluate(
                'el => el.getBoundingClientRect().top')
            for route in (
                'about.html',
                'terms/index.html',
                'terms/MLD-0001-a-b-test.html',
                'technology/index.html',
                'technology/TECH-0001-adversarial-robustness-toolbox.html'
            ):
                intro_page.goto(base + route, wait_until='load')
                detail = route.startswith(('terms/MLD-', 'technology/TECH-'))
                measurement = intro_page.locator('.term-shell > .hero').evaluate("""el => {
                    const heading = el.querySelector('.discover-heading');
                    return {margin: getComputedStyle(el).marginTop,
                            visible: el.getBoundingClientRect().height > 0,
                            headingTop: heading ? heading.getBoundingClientRect().top : null,
                            fits: document.documentElement.scrollWidth <= innerWidth};
                }""")
                label = scheme + ' ' + str(width) + ' ' + route + ' ' + json.dumps(measurement)
                check('script-free reference article retains compact spacing ' + label
                      if detail else 'script-free reference landing aligns with Discover ' + label,
                      measurement['visible'] and measurement['fits']
                      and measurement['margin'] == ('18px' if detail else '28px')
                      and (detail or (measurement['headingTop'] is not None
                                      and abs(measurement['headingTop'] - discover_top) <= 2)))
                if detail:
                    check('script-free generated profile has separate shared nav and main '
                          + scheme + ' ' + str(width) + ' ' + route,
                          intro_page.locator('body > .directory-mobile-topbar.site-mobile-chrome').count() == 1
                          and intro_page.locator('body > nav.site-chrome.term-nav').count() == 1
                          and intro_page.locator('main.term-shell > .site-chrome').count() == 0
                          and intro_page.locator('main.term-shell > header.hero#main').count() == 1)
        intro_context.close()
    # Long-form article copy used to run the entire 1000px reference and
    # evidence workspace while Discover constrained its introductory prose.
    # Compare real native layouts in both themes and with scripts disabled;
    # cards, tables and the shared navigation are intentionally unaffected.
    for scheme in ('light', 'dark'):
        reading_ctx = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        reading_page = reading_ctx.new_page()
        for width in (390, 1280):
            reading_page.set_viewport_size({'width':width, 'height':844})
            for route, selector in (
                ('about.html', '.term-shell > .profile-section > p'),
                ('terms/MLD-0691-machine-learning.html', '.term-shell > .detail-block > p'),
                ('technology/TECH-0216-pytorch.html', '.term-shell > .profile-section > p'),
                ('hardware-review.html', '.review-shell > section > p')
            ):
                reading_page.goto(base + route)
                actual = reading_page.locator(selector).first.evaluate("""el => ({
                    max: getComputedStyle(el).maxWidth,
                    visible: el.getBoundingClientRect().height > 0,
                    right: el.getBoundingClientRect().right,
                    available: innerWidth
                })""")
                check('shared script-free article reading width ' + route + ' ' + scheme + ' ' + str(width),
                      actual['max'] != 'none' and actual['visible']
                      and actual['right'] <= actual['available'] + 1)
                if scheme == 'dark' and width == 1280 and route in ('about.html', 'hardware-review.html'):
                    reading_page.screenshot(path=str(out / ('longform-' + route.split('.')[0] + '-1280-dark.png')))
        reading_ctx.close()
    # The static technology and playbook directories used to keep separate
    # narrow footer treatments even after moving outside their article main.
    # Confirm the shared global component is a true contentinfo landmark in
    # both themes, with and without scripts, at the four reference widths.
    for scheme in ('light', 'dark'):
        shared_footer_context = browser.new_context(
            java_script_enabled=False, color_scheme=scheme, reduced_motion='reduce')
        shared_footer_page = shared_footer_context.new_page()
        for width in (320, 390, 768, 1280):
            shared_footer_page.set_viewport_size({'width':width, 'height':844})
            for route in ('technologies.html', 'playbooks.html'):
                shared_footer_page.goto(base + route)
                footer = shared_footer_page.locator('footer.site-chrome__footer')
                check('native directory uses shared global contentinfo footer ' +
                      route + ' ' + scheme + ' ' + str(width),
                      footer.count() == 1 and footer.is_visible()
                      and shared_footer_page.get_by_role('contentinfo').count() == 1
                      and shared_footer_page.locator('main footer').count() == 0
                      and footer.locator('a[href="about.html"]').count() == 1
                      and footer.locator('a[href="index.html#/sources"]').count() == 1
                      and footer.evaluate("""el => {
                          const s = getComputedStyle(el), r = el.getBoundingClientRect();
                          return s.borderTopStyle === 'solid' && s.fontSize === '13px'
                              && r.width > 0 && r.left >= -1
                              && r.right <= innerWidth + 1;
                      }""")
                      and shared_footer_page.evaluate(
                          'document.documentElement.scrollWidth <= innerWidth + 1'))
                if scheme == 'dark' and width in (390, 1280):
                    footer.scroll_into_view_if_needed()
                    shared_footer_page.screenshot(path=str(
                        out / ('shared-footer-' + route.split('.')[0] + '-' +
                               str(width) + '-dark.png')))
        shared_footer_context.close()
    # Compare Discover's existing global footer treatment against real concept
    # and technology profiles across breakpoints and both themes. The 1,345
    # concept HTML assets remain hash-identical; the shared runtime moves the
    # existing footer rather than rewriting history or duplicating policy links.
    for scheme in ('light', 'dark'):
        footer_ctx = browser.new_context(color_scheme=scheme, reduced_motion='reduce')
        footer_page = footer_ctx.new_page()
        for width in (320, 390, 768, 1280):
            footer_page.set_viewport_size({'width':width, 'height':844})
            footer_page.goto(base + 'technology/TECH-0216-pytorch.html')
            technology_style = footer_page.locator('body > footer.site-chrome__footer').evaluate(
                """el => { const s=getComputedStyle(el), r=el.getBoundingClientRect();
                    return {font:s.fontSize,color:s.color,border:s.borderTopStyle,
                            line:s.lineHeight,width:r.width,left:r.left}; }""")
            footer_page.goto(base + 'terms/MLD-0001-a-b-test.html')
            concept = footer_page.locator('body > footer.site-chrome__footer')
            concept_style = concept.evaluate(
                """el => { const s=getComputedStyle(el), r=el.getBoundingClientRect();
                    return {font:s.fontSize,color:s.color,border:s.borderTopStyle,
                            line:s.lineHeight,width:r.width,left:r.left}; }""")
            check('concept and technology share real global footer '+scheme+' '+str(width),
                  concept.count() == 1 and footer_page.get_by_role('contentinfo').count() == 1
                  and footer_page.locator('main.term-shell > footer').count() == 0
                  and footer_page.locator('body > nav.site-chrome.term-nav').count() == 1
                  and footer_page.locator('body > main.term-shell').count() == 1
                  and footer_page.locator('body > footer a[href="../about.html"]').count() == 1
                  and footer_page.locator('body > footer a[href="../index.html#/sources"]').count() == 1
                  and concept_style == technology_style
                  and concept_style['font'] == '13px'
                  and footer_page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
            if scheme == 'dark' and width in (390, 1280):
                concept.scroll_into_view_if_needed()
                footer_page.screenshot(path=str(out / ('concept-global-footer-'+str(width)+'-dark.png')))
            if scheme == 'light' and width == 390:
                # Check the actual destination and its global chrome, not an
                # implementation-specific About article heading selector.
                footer_page.locator('body > footer a[href="../about.html"]').click()
                footer_page.wait_for_url('**/about.html')
                check('concept footer policy navigates to the shared About page',
                      footer_page.evaluate("location.pathname.endsWith('/about.html')")
                      and footer_page.locator('body > nav.site-chrome.term-nav').count() == 1
                      and footer_page.locator('body > footer.site-chrome__footer').count() == 1
                      and footer_page.get_by_role('heading', name='The frontier, in context.').count() == 1)
                footer_page.go_back()
                footer_page.wait_for_url('**/terms/MLD-0001-a-b-test.html')
                check('returning to concept preserves the single global footer',
                      footer_page.locator('body > footer.site-chrome__footer').count() == 1)
        footer_ctx.close()
    for scheme in ('light','dark'):
        scriptless_ctx = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        scriptless_page = scriptless_ctx.new_page()
        for width in (320, 390, 768, 1280):
            scriptless_page.set_viewport_size({'width':width,'height':844})
            scriptless_page.goto(base+'terms/MLD-0001-a-b-test.html')
            footer = scriptless_page.locator('body > footer.site-chrome__footer')
            check('script-free concept exposes global contentinfo with styled policy and source links '+scheme+' '+str(width),
                  footer.count() == 1
                  and scriptless_page.get_by_role('contentinfo').count() == 1
                  and scriptless_page.locator('main.term-shell > footer').count() == 0
                  and footer.locator('a[href="../about.html"]').count() == 1
                  and footer.locator('a[href="../index.html#/sources"]').count() == 1
                  and footer.evaluate("""el => {const s=getComputedStyle(el);
                      return s.fontSize==='13px' && s.borderTopStyle==='solid' &&
                          s.color!=='' && el.getBoundingClientRect().width > 0;}""")
                  and scriptless_page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        scriptless_ctx.close()
    # Every profile should have separate site and article landmarks, even when
    # scripts are disabled and the viewport is just 320 pixels wide.
    for scheme in ('light', 'dark'):
        ctx = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        profile = ctx.new_page()
        for width in (320, 390, 768, 1280):
            profile.set_viewport_size({'width': width, 'height': 844})
            profile.goto(base + 'technology/TECH-0216-pytorch.html')
            valid = profile.evaluate("""() => {
                const main=document.querySelector('main.term-shell');
                const nav=document.querySelector('nav.site-chrome.term-nav');
                const bar=document.querySelector('body > .site-mobile-chrome');
                const breadcrumb=main?.querySelector(':scope > .breadcrumb-links');
                const hero=main?.querySelector(':scope > .hero#main');
                return !!main && !!nav && !!bar && !!breadcrumb && !!hero &&
                    !main.contains(nav) && !main.contains(bar) &&
                    !!(nav.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING) &&
                    document.documentElement.scrollWidth <= innerWidth + 1;
            }""")
            check('technology profile nav landmarks ' + scheme + ' ' + str(width), valid)
        ctx.close()
    # Native reference/editorial skip links were stacked below the shared 68px
    # mobile or 78px desktop chrome. Verify the first keyboard target really
    # receives pointer hit-testing above that header, even without JavaScript.
    # Compare against Discover's original visible skip-link at every breakpoint.
    for scheme in ('light', 'dark'):
        no_script = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        skip_page = no_script.new_page()
        for width in (320, 390, 768, 1280):
            skip_page.set_viewport_size({'width':width, 'height':844})
            for route in (
                'index.html', 'whats-new.html', 'about.html',
                'terms/MLD-0001-a-b-test.html',
                'technology/TECH-0001-adversarial-robustness-toolbox.html',
                'games.html'
            ):
                skip_page.goto(base + route)
                selector = 'a.skip-link' if route == 'index.html' else 'body > a.skip'
                target = skip_page.locator(selector)
                target.focus()
                visible = target.evaluate("""link => {
                    const r = link.getBoundingClientRect();
                    const x = Math.round(r.left + r.width / 2);
                    const y = Math.round(r.top + r.height / 2);
                    return r.width > 0 && r.height > 0 && r.top >= 0
                        && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight
                        && document.elementFromPoint(x,y) === link;
                }""")
                check('script-free skip above shared chrome '
                      + scheme + ' ' + str(width) + ' ' + route, visible)
        no_script.close()
    # The daily archive used to display an endless "Checking editions" message
    # and disabled filters to script-free visitors, unlike Research/Playbooks/Tech.
    # Its native fallback must retain the same shared site navigation and point
    # at immutable source records rather than pretending there is a live feed.
    # Pending review batches can be registered for deployment testing before
    # the publisher has recorded production HTTP/browser certification.
    # Script-free previews must only promote previously certified editions.
    receipts = json.loads((ROOT / 'data/daily/published-batches.json').read_text(encoding='utf-8'))['receipts']
    verified_edition_ids = {r['publication_edition'] for r in receipts
                            if r.get('production_verified_at') and
                            r.get('publication_outcome', '').endswith('_verified')}
    published_dates = {}
    for edition in json.loads((ROOT / 'data/daily/index.json').read_text(encoding='utf-8'))['editions']:
        if f"{edition['date']}-v{edition['revision']}" not in verified_edition_ids:
            continue
        old = published_dates.get(edition['date'])
        if old is None or edition['revision'] > old['revision']:
            published_dates[edition['date']] = edition
    newest_archive_paths = [
        published_dates[day]['path']
        for day in sorted(published_dates, reverse=True)[:3]
    ]
    for scheme in ('light','dark'):
        archive_context = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        archive_page = archive_context.new_page()
        for width in (320,390,768,1280):
            archive_page.set_viewport_size({'width':width,'height':844})
            archive_page.goto(base+'index.html')
            # Cross-page navigation is deliberately a real click, not just a URL probe.
            if width <= 650:
                archive_page.locator('#discover-mobile-nav > summary').click()
                archive_page.locator('#discover-mobile-nav .site-mobile-chrome__menu a[href="whats-new.html"]').click()
            else:
                archive_page.locator('#navigation a[href="whats-new.html"]').click()
            fallback = archive_page.locator('#scriptfree-daily-archive')
            check('script-free archive follows native site link '+scheme+' '+str(width),
                  archive_page.url.split('#')[0].rstrip('/').endswith('/whats-new.html'))
            check('script-free archive renders ordinary native content '+scheme+' '+str(width),
                  fallback.is_visible())
            check('script-free archive register is accessible '+scheme+' '+str(width),
                  fallback.locator('a[href="data/daily/index.json"]').is_visible())
            check('script-free archive has three dated records '+scheme+' '+str(width),
                  len(newest_archive_paths) == 3
                  and all(fallback.locator('a[href="' + path + '"]').is_visible()
                          for path in newest_archive_paths))
            check('script-free archive hides misleading loaders and dead filters '+scheme+' '+str(width),
                  archive_page.locator('#edition-status').is_hidden()
                  and archive_page.locator('#edition-content').is_hidden()
                  and archive_page.locator('main > .panel').is_hidden()
                  and archive_page.locator('.site-chrome__links a[href="whats-new.html"]').count()==1
                  and archive_page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
            archive_page.screenshot(path=str(out / ('daily-scriptfree-'+scheme+'-'+str(width)+'.png')), full_page=False)
        archive_context.close()
    # The same source-linked fallback remains until the reader has verified
    # and rendered an edition, even when the shared theme script initializes.
    # Wait for the async SHA-256 gate rather than asserting on initial navigation:
    # the recovery links must never disappear merely because JavaScript exists.
    archive_enhanced = browser.new_context(java_script_enabled=True)
    archive_enhanced_page = archive_enhanced.new_page()
    archive_enhanced_page.goto(base+'whats-new.html')
    archive_enhanced_page.wait_for_function(
        "() => document.documentElement.classList.contains('atlas-daily-ready')",
        timeout=45000)
    check('archive hides native recovery only after verified edition is rendered',
          archive_enhanced_page.locator('#scriptfree-daily-archive').count() == 1
          and archive_enhanced_page.locator('#scriptfree-daily-archive').is_hidden()
          and archive_enhanced_page.locator('#edition-content').is_visible()
          and archive_enhanced_page.locator('#edition-search').is_enabled()
          and archive_enhanced_page.locator('html.atlas-enhanced.atlas-daily-ready').count() == 1)
    archive_enhanced.close()
    # Daily news and Discover are the same editorial desk, not separate type
    # systems. Check actual verified cards after following the native nav.
    for story_scheme in ('light', 'dark'):
        story_context = browser.new_context(color_scheme=story_scheme)
        story_page = story_context.new_page()
        for story_width in (320, 390, 768, 1280):
            story_page.set_viewport_size({'width': story_width, 'height': 900})
            story_page.goto(base + 'index.html#/overview')
            story_page.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
            discover_story = story_page.locator('.story-body h3').first
            discover_story.wait_for(state='visible')
            story_style = """el => {
                const s = getComputedStyle(el);
                return [s.fontFamily,s.fontWeight,s.fontSize,s.lineHeight,s.letterSpacing];
            }"""
            baseline = discover_story.evaluate(story_style)
            discover_story.scroll_into_view_if_needed()
            story_page.screenshot(path=str(out / f'discover-story-type-{story_scheme}-{story_width}.png'))
            if story_width <= 650:
                story_page.locator('#discover-mobile-nav > summary').click()
                story_page.locator('#discover-mobile-nav .site-mobile-chrome__menu a[href="whats-new.html"]').click()
            else:
                story_page.locator('#navigation a[href="whats-new.html"]').click()
            story_page.wait_for_function(
                "() => document.documentElement.classList.contains('atlas-daily-ready')",
                timeout=45000)
            # Use an immutable known nonempty edition so a legitimate empty
            # future collection does not break the presentation regression.
            edition = story_page.locator('#edition-select')
            pinned_path = 'data/daily/editions/2026-11-23-v1.json'
            if edition.input_value() != pinned_path:
                edition.select_option(pinned_path)
            story_page.wait_for_function(
                "() => location.search.includes('date=2026-11-23') && location.search.includes('revision=1') && document.querySelector('#edition-content').getAttribute('aria-busy') === 'false'",
                timeout=45000)
            archive_story = story_page.locator('#edition-content .item > h3').first
            archive_story.wait_for(state='visible')
            actual = archive_story.evaluate(story_style)
            archive_summary = story_page.locator('#edition-content .item > h3 + p').first.evaluate("""el => {
                const s = getComputedStyle(el);
                return [s.fontSize, s.lineHeight];
            }""")
            check('Archive primary summary preserves readable type ' + story_scheme + ' ' + str(story_width),
                  archive_summary == ['14px', '23.1px'])
            archive_story.scroll_into_view_if_needed()
            story_page.screenshot(path=str(out / f'archive-story-type-{story_scheme}-{story_width}.png'))
            print('Editorial story type', story_scheme, story_width, baseline, actual)
            check('Verified news cards match Discover type '+story_scheme+' '+str(story_width),
                  actual == baseline and
                  story_page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
            check('Verified news card retains readable source links '+story_scheme+' '+str(story_width),
                  archive_story.locator('xpath=..').locator('a[href^="https://"]').first.is_visible())
        story_context.close()
    # Compact reference cards intentionally keep a denser scale than the
    # illustrated Discover feed, but the three native catalog families share it.
    for compact_scheme in ('light', 'dark'):
        compact_context = browser.new_context(color_scheme=compact_scheme)
        compact_page = compact_context.new_page()
        compact_style = """el => {
            const s = getComputedStyle(el);
            return [s.fontFamily,s.fontWeight,s.fontSize,s.lineHeight,s.letterSpacing];
        }"""
        summary_style = """el => {
            const s = getComputedStyle(el);
            const probe = document.createElement('span');
            probe.style.color = 'var(--muted)';
            el.append(probe);
            const muted = getComputedStyle(probe).color;
            probe.remove();
            return [s.fontSize, s.lineHeight, s.color === muted];
        }"""
        heading_gap = """el => {
            const next = el.nextElementSibling;
            return [getComputedStyle(el).marginTop, getComputedStyle(el).marginBottom,
                    getComputedStyle(next).marginTop,
                    Math.round(next.getBoundingClientRect().top - el.getBoundingClientRect().bottom)];
        }"""
        for compact_width in (320, 390, 768, 1280):
            compact_page.set_viewport_size({'width': compact_width, 'height': 900})
            compact_page.goto(base + 'technologies.html')
            tech_title = compact_page.locator('#tech-results .tech-card > h2').first
            tech_title.wait_for(state='visible', timeout=45000)
            tech_type = tech_title.evaluate(compact_style)
            tech_gap = tech_title.evaluate(heading_gap)
            tech_inset = tech_title.evaluate("el => [getComputedStyle(el.parentElement).paddingLeft, getComputedStyle(el.parentElement).paddingRight]")
            tech_summary = compact_page.locator('#tech-results .tech-card > .lede').first.evaluate(summary_style)
            tech_title.scroll_into_view_if_needed()
            compact_page.screenshot(path=str(out / f'compact-tech-{compact_scheme}-{compact_width}.png'))
            check('Technology card retains a real title link ' + compact_scheme + str(compact_width),
                  tech_title.locator('a[href^="#"]').is_visible())
            if compact_width <= 650:
                compact_page.locator('.site-mobile-chrome__nav > summary').click()
                compact_page.locator('.site-mobile-chrome__menu a[href="playbooks.html"]').click()
            else:
                compact_page.locator('.site-chrome__links a[href="playbooks.html"]').click()
            play_title = compact_page.locator('.playbook-shell .playbook > h2').first
            play_title.wait_for(state='visible', timeout=45000)
            play_type = play_title.evaluate(compact_style)
            play_gap = play_title.evaluate(heading_gap)
            play_inset = play_title.evaluate("el => [getComputedStyle(el.parentElement).paddingLeft, getComputedStyle(el.parentElement).paddingRight]")
            play_summary = compact_page.locator('.playbook-shell .playbook > h2 + p').first.evaluate(summary_style)
            play_title.scroll_into_view_if_needed()
            compact_page.screenshot(path=str(out / f'compact-playbooks-{compact_scheme}-{compact_width}.png'))
            if compact_width <= 650:
                compact_page.locator('.site-mobile-chrome__nav > summary').click()
                compact_more = compact_page.locator('.site-mobile-chrome__menu .site-mobile-chrome__more')
            else:
                compact_more = compact_page.locator('.site-chrome > .site-chrome__more')
            if not compact_more.evaluate('el => el.open'):
                compact_more.locator('summary').click()
            compact_more.locator('a[href="research.html"]').click()
            research_title = compact_page.locator('#results .card > h2').first
            research_title.wait_for(state='visible', timeout=45000)
            research_type = research_title.evaluate(compact_style)
            research_gap = research_title.evaluate(heading_gap)
            research_inset = research_title.evaluate("el => [getComputedStyle(el.parentElement).paddingLeft, getComputedStyle(el.parentElement).paddingRight]")
            research_summary = compact_page.locator('#results .card > h2 + p').first.evaluate(summary_style)
            title_button = research_title.locator('button.title-button')
            research_title.scroll_into_view_if_needed()
            compact_page.screenshot(path=str(out / f'compact-research-{compact_scheme}-{compact_width}.png'))
            print('Compact editorial card type', compact_scheme, compact_width, tech_type, play_type, research_type)
            check('Shared compact card type ' + compact_scheme + ' ' + str(compact_width),
                  tech_type == play_type == research_type
                  and research_type == title_button.evaluate(compact_style)
                  and research_type[1] == '400'
                  and research_type[2] == ('23px' if compact_width == 1280 else '20px')
                  and compact_page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
            print('Compact editorial summary', compact_scheme, compact_width, tech_summary, play_summary, research_summary)
            check('Shared primary card summary ' + compact_scheme + ' ' + str(compact_width),
                  tech_summary == play_summary == research_summary == ['14px', '23.1px', True])
            title_button.focus()
            compact_page.keyboard.press('Enter')
            check('Shared Research card preserves keyboard dialog ' + compact_scheme + str(compact_width),
                  compact_page.locator('#detail').evaluate('el => el.open'))
            compact_page.locator('#close-detail').click()
            compact_page.goto(base + 'catalog-review.html')
            review_title = compact_page.locator('article.card > h3').first
            review_title.wait_for(state='visible', timeout=45000)
            review_gap = review_title.evaluate(heading_gap)
            review_inset = review_title.evaluate("el => [getComputedStyle(el.parentElement).paddingLeft, getComputedStyle(el.parentElement).paddingRight]")
            review_title.scroll_into_view_if_needed()
            compact_page.screenshot(path=str(out / f'compact-review-{compact_scheme}-{compact_width}.png'))
            compact_page.goto(base + 'index.html#/overview')
            compact_page.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
            discover_title = compact_page.locator('.story-body > h3').first
            discover_title.wait_for(state='visible', timeout=45000)
            discover_gap = discover_title.evaluate(heading_gap)
            discover_inset = discover_title.evaluate("el => [getComputedStyle(el.parentElement).paddingLeft, getComputedStyle(el.parentElement).paddingRight]")
            check('Shared card heading rhythm ' + compact_scheme + ' ' + str(compact_width),
                  tech_gap == play_gap == research_gap == review_gap == discover_gap == ['12px', '11px', '0px', 11])
            expected_inset = '20px' if compact_width <= 520 else '13px' if compact_width <= 650 else '16px' if compact_width <= 1150 else '17px'
            check('Shared editorial card inline inset ' + compact_scheme + ' ' + str(compact_width),
                  tech_inset == play_inset == research_inset == review_inset == discover_inset == [expected_inset, expected_inset])
        compact_context.close()
    # Check actual Discover-to-editorial transitions, not CSS similarity alone.
    for width in (320, 390, 768, 1280):
        page.set_viewport_size({'width':width, 'height':844})
        page.goto(base + 'index.html#/overview')
        # The menu handler is attached after the verified catalog hydrates.
        # Opening it before that point can hit a static, not-yet-bound button.
        page.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
        if width <= 650:
            # The visible compact workspace title is shared with standalone
            # pages; Discover must update it on SPA navigation and back links,
            # not show a stale "Discover" label for Research or Your notebook.
            for section, expected_label in (
                ('overview', 'Discover'),
                ('papers', 'Research library'),
                ('technologies', 'Technology profiles'),
                ('saved', 'Your notebook'),
                ('overview', 'Discover'),
            ):
                page.evaluate("(section) => { location.hash = '#/' + section; }", section)
                page.wait_for_function(
                    "(label) => document.querySelector('#discover-mobile-nav > summary')?.getAttribute('aria-label') === 'Toggle navigation · ' + label",
                    arg=expected_label)
                check('Discover compact workspace title follows ' + section + ' at ' + str(width),
                      page.locator('#discover-mobile-nav > summary').get_attribute('aria-label') == 'Toggle navigation · ' + expected_label
                      and page.locator('.discover-mobile-chrome').get_attribute('aria-label') == 'AI Updates mobile header · ' + expected_label
                      and page.locator('#navigation a.nav-link[aria-current="page"] span:not(.nav-count)').first.inner_text() == expected_label)
        if width > 650:
            # The SPA once updated only the attribute and mobile announcement,
            # leaving the actual desktop topbar title stuck on Discover.
            for chosen_theme in ('light', 'dark'):
                page.evaluate('(theme) => { document.documentElement.dataset.theme = theme; }', chosen_theme)
                for section, expected_label in (
                    ('papers', 'Research library'),
                    ('technologies', 'Technology profiles'),
                    ('saved', 'Your notebook'),
                    ('overview', 'Discover'),
                ):
                    page.evaluate('(route) => { location.hash = "#/" + route; }', section)
                    title = page.locator('#breadcrumb.site-mobile-chrome__title')
                    page.wait_for_function(
                        '(label) => document.getElementById("breadcrumb")?.textContent?.trim() === label',
                        arg=expected_label)
                    check('Discover visible desktop workspace title follows ' + section + ' at ' + str(width) + ' ' + chosen_theme,
                          title.is_visible()
                          and title.inner_text().strip() == expected_label
                          and page.locator('#navigation a.nav-link[aria-current="page"] span:not(.nav-count)').first.inner_text() == expected_label)
        if width <= 650:
            page.locator('#discover-mobile-nav > summary').click()
            check('Discover native mobile drawer opens at ' + str(width),
                  page.locator('#discover-mobile-nav').evaluate('(el) => el.open')
                  and page.locator('#discover-mobile-nav .site-mobile-chrome__menu').is_visible()
                  and not page.locator('#sidebar').is_visible())
            primary_links = page.locator('#discover-mobile-nav .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)')
            labels = primary_links.all_text_contents()
            about_link = primary_links.last
        else:
            primary_links = page.locator('#navigation > .site-chrome__links > a.nav-link')
            labels = primary_links.locator('span:not(.nav-count)').all_text_contents()
            about_link = page.locator('#navigation > .site-chrome__links > a[data-static="about"]')
        check('Discover shares seven-link primary order at ' + str(width),
              primary_links.count() == 7
              and all(link.is_visible() for link in primary_links.all())
              and labels == ['Discover', 'What’s New Today', 'Concept dictionary',
                             'Technology profiles', 'Games', 'Playbooks', 'About'])
        if width <= 650:
            # The existing eight desktop secondary routes are available in
            # the same mobile drawer, not a second separate menu.
            mobile_more = page.locator('#discover-mobile-nav .site-mobile-chrome__more')
            check('Discover mobile secondary disclosure at ' + str(width),
                  mobile_more.count() == 1 and mobile_more.locator('summary').is_visible())
            mobile_more.locator('summary').click()
            check('Discover mobile secondary routes match desktop at ' + str(width),
                  mobile_more.locator('a').all_inner_texts() == [
                      'Safety observatory', 'Research library', 'Compare tools',
                      'Your notebook', 'Sources & coverage', 'Guided professor demo',
                      'Concept encyclopedia', 'Offline demo download ↓']
                  and mobile_more.locator('a[href="#/safety"]').is_visible())
            mobile_more.locator('summary').focus()
            page.keyboard.press('Tab')
            check('Discover nested More summary keeps its first link keyboard reachable at ' + str(width),
                  mobile_more.locator('a').first.evaluate('el => document.activeElement === el'))
            mobile_more.locator('summary').click()
        about_link.click()
        page.wait_for_url('**/about.html')
        check('Discover-to-About uses shared navigation at ' + str(width),
              page.locator('.site-chrome__links a[aria-current="page"]').inner_text() == 'About'
              and page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        if width <= 650:
            page.locator('.site-mobile-chrome__nav > summary').click()
            native_more = page.locator('.site-mobile-chrome__menu .site-mobile-chrome__more')
            native_more.locator('summary').click()
            check('About mobile drawer reuses the same secondary destinations at ' + str(width),
                  native_more.locator('a').all_inner_texts() == [
                      'Safety observatory', 'Research library', 'Compare tools',
                      'Your notebook', 'Sources & coverage', 'Guided professor demo',
                      'Concept encyclopedia', 'Offline demo download ↓']
                  and native_more.locator('a[href="research.html"]').is_visible())
            if width == 390:
                native_more.locator('a[href="research.html"]').click()
                page.wait_for_url('**/research.html')
                page.wait_for_function(
                    "document.querySelector('.site-chrome__more a[href=\"research.html\"]')?.getAttribute('aria-current') === 'location'")
                check('About mobile secondary navigation reaches live Research library',
                      page.locator('.site-chrome__more a[href="research.html"][aria-current="location"]').count() == 1)
                # The older direct SPA deep link remains supported; the new
                # canonical native destination does not remove it.
                page.goto(base + 'index.html#/papers')
                page.wait_for_function(
                    "document.querySelector('#navigation a[data-view=papers]')?.getAttribute('aria-current') === 'page'")
                check('Legacy Research hash URL still opens its original catalog view',
                      page.locator('#navigation a[data-view="papers"][aria-current="page"]').count() == 1)

    # A native Research URL is a real secondary destination. Both native
    # navigation landmarks should mark only that destination as current,
    # preserving the Discover parent as an ordinary usable link.
    for width in (320, 390, 768, 1280):
        page.set_viewport_size({'width': width, 'height': 844 if width <= 650 else 900})
        page.goto(base + 'research.html')
        check('Research canonical secondary identity at ' + str(width),
              page.locator('.site-chrome__links a[aria-current]').count() == 0
              and page.locator('.site-chrome__more[open] a[aria-current="location"][href="research.html"]').count() == 1
              and page.locator('.site-mobile-chrome__more[open] a[aria-current="location"][href="research.html"]').count() == 1
              and page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        if width <= 650:
            page.locator('.site-mobile-chrome__nav > summary').click()
            check('Research opens with selected mobile secondary section at ' + str(width),
                  page.locator('.site-mobile-chrome__more a[aria-current="location"]').is_visible())
        else:
            check('Research shows selected desktop secondary section at ' + str(width),
                  page.locator('.site-chrome__more a[aria-current="location"]').is_visible())
        if width in (390, 1280):
            for theme in ('light', 'dark'):
                page.evaluate('(value) => { document.documentElement.dataset.theme = value; }', theme)
                page.screenshot(path=str(out / f'research-secondary-{width}-{theme}.png'))

    # Discover now exposes the very same native <details> structure as its
    # standalone neighbors, including when the JavaScript runtime is blocked.
    no_script = browser.new_context(java_script_enabled=False, viewport={'width':320, 'height':844})
    scriptless = no_script.new_page()
    scriptless.goto(base + 'index.html#/overview')
    # Mobile intentionally gives its limited header space to real search;
    # the workspace title is visible in the shared desktop top bar. Both
    # breakpoints must preserve the script-free page identity and menu label.
    for width in (320, 390, 768, 1280):
        scriptless.set_viewport_size({'width':width,'height':844})
        header = scriptless.locator('.discover-mobile-chrome')
        desktop_title = (header.evaluate(
            "(el) => getComputedStyle(el, '::before').content") == '"Discover"'
            if width > 650 else True)
        check('Script-free Discover section-aware header at ' + str(width),
              header.get_attribute('data-page-label') == 'Discover'
              and scriptless.locator('#discover-mobile-nav > summary').get_attribute('aria-label') == 'Toggle navigation · Discover'
              and desktop_title
              and (width > 650 or scriptless.locator('#discover-mobile-nav > summary').is_visible()))
        scriptless.screenshot(path=str(out / f'discover-first-paint-{width}-nojs.png'))
    # Resume the existing mobile-drawer journey after checking desktop widths.
    scriptless.set_viewport_size({'width':320,'height':844})
    scriptless.locator('#discover-mobile-nav > summary').click()
    check('Discover keeps seven script-free native drawer links',
          scriptless.locator('#discover-mobile-nav').evaluate('(el) => el.open')
          and scriptless.locator('#discover-mobile-nav .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').count() == 7)
    check('Discover no-script drawer preserves a real home wordmark link',
          scriptless.locator('#discover-mobile-nav a.site-mobile-chrome__brand').get_attribute('href') == '#/overview')
    scriptless.locator('#discover-mobile-nav .site-mobile-chrome__more > summary').click()
    check('Discover exposes eight secondary destinations even when scripts are disabled',
          scriptless.locator('#discover-mobile-nav .site-mobile-chrome__more-links a').count() == 8
          and scriptless.locator('#discover-mobile-nav .site-mobile-chrome__more-links a[href="#/safety"]').is_visible()
          and scriptless.locator('#discover-mobile-nav .site-mobile-chrome__more-links a[href="terms/index.html"]').is_visible())
    scriptless.locator('#discover-mobile-nav .site-mobile-chrome__menu > a[href="about.html"]').click()
    scriptless.wait_for_url('**/about.html')
    scriptless.locator('#about-mobile-nav > summary').click() if scriptless.locator('#about-mobile-nav > summary').count() else scriptless.locator('.site-mobile-chrome__nav > summary').click()
    check('No-JavaScript Discover to About transition preserves secondary navigation',
          scriptless.locator('.site-mobile-chrome__more-links a[href="research.html"]').count() == 1)

    # The A-Z concept and technology directory pages must share Discover's
    # secondary destinations with JavaScript disabled, not only after hydration.
    for route in ('terms/index.html', 'terms/MLD-0001-a-b-test.html', 'terms/MLD-0101-bayesian-inference.html', 'terms/MLD-0111-bernoulli-distribution.html', 'terms/MLD-0121-bidirectional-context.html', 'terms/MLD-0131-boosting.html', 'terms/MLD-0141-byte-pair-encoding.html', 'terms/MLD-0151-categorical-feature.html', 'terms/MLD-0161-chain-of-thought-prompting.html', 'terms/MLD-0171-circuit.html', 'terms/MLD-0181-cohen-s-kappa.html', 'terms/MLD-0192-condition-number.html', 'terms/MLD-0201-connectionist-temporal-classification.html', 'terms/MLD-0221-contrastive-loss.html', 'terms/MLD-0241-critic.html', 'terms/MLD-0251-cumulative-distribution-function.html', 'terms/MLD-0261-data-extraction.html', 'terms/MLD-0266-data-mixture.html', 'terms/MLD-0276-dbscan.html', 'terms/MLD-0286-decoder.html', 'terms/MLD-0296-denoising-diffusion-implicit-model.html', 'terms/MLD-0306-detokenization.html', 'terms/MLD-0316-discount-factor.html', 'terms/MLD-0324-distributed-learning.html', 'terms/MLD-0334-dot-product.html', 'terms/MLD-0344-dynamic-programming.html', 'terms/MLD-0354-elastic-net.html', 'terms/MLD-0364-encoder-decoder-model.html', 'terms/MLD-0384-evaluator-integrity.html', 'terms/MLD-0394-expert-parallelism.html', 'terms/MLD-0403-extrapolation.html', 'terms/MLD-0404-f-beta-score.html', 'terms/MLD-0423-feature-splitting.html', 'terms/MLD-0489-graph-neural-network.html', 'technology/index.html', 'technology/TECH-0216-pytorch.html'):
        scriptless.goto(base + route)
        scriptless.locator('#directory-mobile-nav > summary').click()
        more_menu = scriptless.locator('#directory-mobile-nav .site-mobile-chrome__more')
        # The encyclopedia is an actual secondary destination, so its shared
        # More sections disclosure starts open with aria-current even without JS.
        # Other reference pages keep the normal closed disclosure.
        if not more_menu.evaluate('(el) => el.open'):
            more_menu.locator('summary').click()
        if route == 'terms/index.html':
            check('Concept Encyclopedia is identified as the script-free active secondary section',
                  more_menu.locator('a[href="../terms/index.html"][aria-current="location"]').count() == 1
                  and more_menu.evaluate('(el) => el.open'))
        expected_research = '../research.html'
        check('A-Z directory script-free mobile secondary navigation: ' + route,
              scriptless.locator('#directory-mobile-nav .site-mobile-chrome__more-links a').count() == 8
              and scriptless.locator('#directory-mobile-nav .site-mobile-chrome__more-links a[href="' + expected_research + '"]').is_visible()
              and scriptless.locator('.site-mobile-chrome__search[href="../index.html#/search"]').count() == 1)
    scriptless.locator('#directory-mobile-nav .site-mobile-chrome__more-links a[href="../terms/index.html"]').click()
    scriptless.wait_for_url('**/terms/index.html')
    check('Technology-to-Concept script-free secondary route resolves',
          scriptless.locator('#directory-mobile-nav .site-mobile-chrome__more-links a[href="../index.html#/sources"]').count() == 1)
    no_script.close()
    # Compare a newly migrated concept with Discover and an established
    # technology profile at the same real viewport, with scripts disabled.
    for scheme in ('light', 'dark'):
        native_ctx = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        native_page = native_ctx.new_page()
        for width in (320, 390, 768, 1280):
            native_page.set_viewport_size({'width': width, 'height': 844})
            native_page.goto(base + 'index.html#/overview')
            native_page.goto(base + 'technology/TECH-0216-pytorch.html')
            shared_labels = native_page.locator('nav.site-chrome .site-chrome__links a').all_text_contents()
            native_page.goto(base + 'terms/MLD-1339-worst-group-accuracy.html')
            native_nav = native_page.locator('nav.site-chrome')
            lower = native_nav.locator('.sidebar-bottom.site-chrome__bottom')
            check('new concept first-paint rail matches technology and Discover ' +
                  scheme + ' ' + str(width),
                  native_nav.count() == 1
                  and native_nav.locator('.site-chrome__links a').all_text_contents() == shared_labels
                  and native_nav.locator('.site-chrome__links a[aria-current="page"]').inner_text() == 'Concept dictionary'
                  and lower.count() == 1
                  and lower.locator('a[href="../index.html#/sources"]').count() == 1
                  and native_page.locator('body > main.term-shell').count() == 1
                  and native_page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
            if width in (390, 1280):
                # The final six existing references now share the same rail.
                # Check both ends of the cohort rather than protecting the
                # former unmigrated boundary, with real no-script browsers.
                for route in ('terms/MLD-1340-xavier-initialization.html',
                              'terms/MLD-1345-zero-shot-prompting.html'):
                    native_page.goto(base + route)
                    final_nav = native_page.locator('nav.site-chrome')
                    final_bottom = final_nav.locator('.sidebar-bottom.site-chrome__bottom')
                    check('final reference cohort matches Discover and technology ' +
                          route + ' ' + scheme + ' ' + str(width),
                          final_nav.count() == 1
                          and final_nav.locator('.site-chrome__links a').all_text_contents() == shared_labels
                          and final_nav.locator('.site-chrome__links a[aria-current="page"]').inner_text() == 'Concept dictionary'
                          and final_bottom.count() == 1
                          and final_bottom.locator('a[href="../index.html#/sources"]').count() == 1
                          and native_page.locator('body > main.term-shell').count() == 1
                          and native_page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
                    native_page.screenshot(path=str(out / ('concept-first-paint-' +
                        route.rsplit('/', 1)[-1].split('-', 2)[1] + '-' + scheme + '-' + str(width) + '.png')))
                native_page.goto(base + 'terms/MLD-1339-worst-group-accuracy.html')
                native_page.screenshot(path=str(out / ('concept-first-paint-1339-' + scheme + '-' + str(width) + '.png')))
            if width == 390:
                native_page.locator('.site-mobile-chrome__nav > summary').click()
                native_page.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)[href="../index.html#/overview"]').click()
                native_page.wait_for_url('**/index.html#/overview')
                check('new concept mobile menu navigates to Discover without scripts ' + scheme,
                      native_page.locator('main h1').first.inner_text() == 'Discover')
        native_ctx.close()
    page.set_viewport_size({'width':1440, 'height':1000})
    page.goto(base + 'index.html#/overview')
    check('Discover keeps one desktop topbar and hides the native mobile disclosure',
          not page.locator('#discover-mobile-nav').is_visible()
          and page.locator('header.topbar').count() == 1
          and page.locator('#global-query').is_visible())
    # Native disclosure makes the long secondary list opt-in without losing direct-link access.
    check('secondary sidebar destinations start collapsed on the homepage',
          not page.locator('#additional-navigation').evaluate('(el) => el.open'))
    page.locator('#additional-navigation summary').click()
    page.locator('#additional-navigation summary').focus()
    page.keyboard.press('Escape')
    check('Discover desktop More closes on Escape and returns focus to its toggle',
          not page.locator('#additional-navigation').evaluate('(el) => el.open')
          and page.locator('#additional-navigation summary').evaluate('(el) => document.activeElement === el'))
    page.locator('#additional-navigation summary').click()
    check('disclosure reveals the original safety navigation link',
          page.locator('#navigation a[href="#/safety"]').is_visible())
    page.locator('#breadcrumb').click()
    check('Discover desktop More closes on outside pointer without navigating',
          not page.locator('#additional-navigation').evaluate('(el) => el.open'))
    page.locator('#additional-navigation summary').click()
    page.locator('#global-query').focus()
    check('Discover desktop More dismisses when keyboard focus moves to shared search',
          not page.locator('#additional-navigation').evaluate('(el) => el.open'))
    page.locator('#additional-navigation summary').click()
    page.locator('#navigation a[href="#/safety"]').click()
    page.wait_for_function("document.querySelector('#navigation a[data-view=safety]')?.getAttribute('aria-current') === 'page'")
    check('secondary workspace navigation keeps disclosure expanded',
          page.locator('#additional-navigation').evaluate('(el) => el.open'))
    page.goto(base + 'index.html#/papers')
    page.wait_for_function("document.querySelector('#navigation a[data-view=papers]')?.getAttribute('aria-current') === 'page'")
    check('deep linked secondary workspace auto-opens disclosure',
          page.locator('#additional-navigation').evaluate('(el) => el.open'))
    page.screenshot(path=str(out / 'overview.png'), full_page=True)
    page.goto(base + 'index.html#/dictionary?q=machine+learning')
    page.locator('#collection h3 a').first.wait_for()
    check('dictionary search ranks exact concept first', page.locator('#collection h3 a').first.inner_text() == 'Machine learning')
    page.locator('#collection h3 a').first.click()
    page.wait_for_url('**/terms/MLD-0691-machine-learning.html')
    check('direct term HTML route retains definition and worked example', page.locator('h1').inner_text() == 'Machine learning' and page.get_by_role('heading', name='Worked example', exact=True).is_visible())
    page.get_by_role('link', name='Overfitting', exact=True).first.click()
    page.wait_for_url('**/terms/MLD-0863-overfitting.html')
    check('relative term links resolve', page.locator('h1').inner_text() == 'Overfitting')
    page.goto(base + 'index.html#/technologies?record=TECH-0216')
    page.locator('#record-title').wait_for()
    check('technology profile deep link retains caveats and references', page.locator('#record-title').inner_text() == 'PyTorch' and page.get_by_role('heading', name='Tradeoffs & cautions', exact=True).is_visible())
    page.locator('[data-action=close-record]').click()
    # An interrupted archive-index fetch must never leave a usable keyword input:
    # there is no verified edition to search, even though the HTML controls exist.
    failed_archive = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    failed_archive.route('**/data/daily/index.json', lambda route: route.abort())
    failed_archive.goto(base + 'whats-new.html')
    failed_archive.wait_for_function(
        "document.getElementById('edition-content').getAttribute('aria-busy') === 'false'",
        timeout=45000)
    check('archive search cannot be used after an interrupted index request',
          failed_archive.locator('#edition-search').is_disabled()
          and 'Daily archive unavailable' in failed_archive.locator('#edition-status').inner_text())
    check('interrupted archive keeps its verified register and source-linked recovery visible',
          failed_archive.locator('#scriptfree-daily-archive').is_visible()
          and failed_archive.locator(
              '#scriptfree-daily-archive a[href="data/daily/index.json"]').is_visible())
    failed_archive.close()
    # Cross-page recovery: the shared theme/navigation script is allowed to
    # initialize even when the archive reader fails to load. That alone must
    # never hide script-free source links. A verified reader then replaces them.
    for scheme in ('light', 'dark'):
        for width in (390, 1280):
            broken_reader = browser.new_page(
                viewport={'width':width, 'height':844}, color_scheme=scheme,
                reduced_motion='reduce')
            broken_reader.route('**/whats-new.js', lambda route: route.abort())
            broken_reader.goto(base + 'whats-new.html')
            check('archive reader failure retains source-linked recovery ' +
                  scheme + ' ' + str(width),
                  broken_reader.locator('html.atlas-enhanced').count() == 1
                  and broken_reader.locator('html.atlas-daily-ready').count() == 0
                  and broken_reader.locator('#scriptfree-daily-archive').is_visible()
                  and broken_reader.locator(
                      '#scriptfree-daily-archive a[href="data/daily/index.json"]').is_visible())
            if width == 390:
                broken_reader.screenshot(
                    path=str(out / ('archive-recovery-' + scheme + '-390.png')))
            broken_reader.close()
            verified_reader = browser.new_page(
                viewport={'width':width, 'height':844}, color_scheme=scheme,
                reduced_motion='reduce')
            verified_reader.goto(base + 'whats-new.html')
            verified_reader.wait_for_function(
                "() => !document.getElementById('edition-search').disabled",
                timeout=45000)
            check('verified archive replaces recovery links after SHA-256 and render ' +
                  scheme + ' ' + str(width),
                  verified_reader.locator('html.atlas-daily-ready').count() == 1
                  and not verified_reader.locator('#scriptfree-daily-archive').is_visible()
                  and verified_reader.locator('#edition-content').is_visible())
            if width == 1280:
                verified_reader.screenshot(
                    path=str(out / ('archive-verified-' + scheme + '-1280.png')))
            verified_reader.close()
    # Shared desktop chrome: these pages previously used four different mastheads.
    # Confirm the same visible order, focus and active link without replacing mobile navigation.
    unified = [('whats-new.html', 'What’s New Today', 'page'), ('about.html', 'About', 'page'),
               ('technologies.html', 'Technology profiles', 'page'), ('playbooks.html', 'Playbooks', 'page'),
               ('games.html', 'Games', 'page'),
               ('catalog-review.html', 'What’s New Today', 'location'),
               ('hardware-review.html', 'What’s New Today', 'location')]
    primary_names = ['Discover', 'What’s New Today', 'Concept dictionary',
                     'Technology profiles', 'Games', 'Playbooks', 'About']
    for route, active, current_kind in unified:
        page.set_viewport_size({'width':1440, 'height':900})
        page.goto(base + route)
        nav = page.get_by_role('navigation', name='AI Updates primary navigation')
        check('shared desktop navigation visible on ' + route, nav.is_visible())
        check('site navigation order and current page on ' + route,
              nav.locator('.site-chrome__links a').all_inner_texts() == primary_names
              and nav.locator('.site-chrome__links a[aria-current="' + current_kind + '"]').inner_text() == active)
        check('shared wordmark has legible inherited foreground on ' + route,
              nav.locator('.site-chrome__name').evaluate('el => getComputedStyle(el).color === getComputedStyle(el.closest("a")).color'))
        desktop_search = page.locator('form.site-mobile-chrome__search')
        check('shared desktop workspace bar retains the real search destination on ' + route,
              desktop_search.is_visible()
              and desktop_search.evaluate('''el => {
                  const bar=el.closest('.site-mobile-chrome');
                  const r=bar.getBoundingClientRect();
                  return getComputedStyle(bar).position === 'fixed'
                      && Math.abs(r.top) < 2 && r.height >= 76 && r.height <= 80
                      && bar.dataset.pageLabel?.length > 0
                      && getComputedStyle(bar).borderBottomWidth !== '0px';
              }''')
              and not page.locator('details.site-mobile-chrome__nav').is_visible())

        # Native content pages now retain Discover's lower-priority desktop
        # destinations inside the same sidebar, not another floating header.
        more = nav.locator('details.site-chrome__more')
        check('shared secondary sidebar exists on ' + route,
              more.count() == 1 and more.locator('summary').is_visible())
        more.locator('summary').click()
        check('shared secondary sidebar matches Discover on ' + route,
              more.evaluate('(el) => el.open')
              and more.locator('a').all_inner_texts() == [
                  'Safety observatory', 'Research library', 'Compare tools',
                  'Your notebook', 'Sources & coverage', 'Guided professor demo',
                  'Concept encyclopedia', 'Offline demo download ↓'])
        more.locator('summary').focus()
        page.keyboard.press('Escape')
        check('native desktop More closes on Escape without losing keyboard focus on ' + route,
              not more.evaluate('(el) => el.open')
              and more.locator('summary').evaluate('(el) => document.activeElement === el'))
        more.locator('summary').click()
        check('secondary destinations navigate to real workspace routes on ' + route,
              more.locator('a').first.get_attribute('href') == 'index.html#/safety'
              and more.locator('a').last.get_attribute('href') == 'downloads/Atlas_Demo_Offline.html')
        page.locator('.site-mobile-chrome__title').click()
        check('shared native desktop More closes on outside pointer on ' + route,
              not more.evaluate('(el) => el.open'))
        more.locator('summary').click()
        desktop_search.locator('input').focus()
        check('shared native desktop More closes when keyboard leaves for search on ' + route,
              not more.evaluate('(el) => el.open'))

        if route == 'hardware-review.html':
            check('hardware article header stacks heading, lead and evidence note on desktop',
                  page.locator('.review-shell > header').evaluate(
                      "el => getComputedStyle(el).display === 'block'"))
        page.screenshot(path=str(out / ('shared-nav-' + route + '.png')), full_page=False)
        for width in (320, 390, 768):
            page.set_viewport_size({'width':width, 'height':844})
            if width <= 390:
                check('shared mobile drawer reuses the canonical brand on ' + route + ' ' + str(width),
                      page.locator('.site-mobile-chrome__menu > a.site-mobile-chrome__brand').count() == 1
                      and page.locator('.site-mobile-chrome__menu > a.site-mobile-chrome__brand')
                          .get_attribute('href') == 'index.html#/overview'
                      and page.locator('.site-mobile-chrome__menu > a.site-mobile-chrome__brand svg').count() == 1)
            check('shared navigation responsive ' + route + ' ' + str(width),
                  page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                  and nav.is_visible() == (width > 650))
    # Discover's topbar stays visible while scrolling; shared article chrome
    # must now do the same without losing its real search link or mobile menu.
    # Exercise the existing page families rather than opening one mock header.
    sticky_routes = ('about.html', 'whats-new.html', 'terms/index.html',
                     'technology/TECH-0216-pytorch.html', 'games.html')
    for mobile_width in (320, 390):
        for chosen_theme in ('light', 'dark'):
            sticky_context = browser.new_context(
                viewport={'width':mobile_width, 'height':600}, reduced_motion='reduce')
            sticky_context.add_init_script(
                "try { localStorage.setItem('atlas.theme', '" + chosen_theme +
                "'); } catch (_) {}")
            sticky_page = sticky_context.new_page()
            for route in sticky_routes:
                sticky_page.goto(base + route, wait_until='domcontentloaded')
                sticky_page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
                sticky_page.wait_for_timeout(80)
                check(f'{route} {mobile_width}px {chosen_theme} retains its shared mobile header after scrolling',
                      sticky_page.evaluate("""() => {
                          const bar = document.querySelector('.site-mobile-chrome');
                          const frame = document.querySelector('.games-header') || bar;
                          if (!bar || !frame || scrollY < 30) return false;
                          const rect = frame.getBoundingClientRect();
                          return getComputedStyle(frame).position === 'sticky' &&
                              Math.abs(rect.top) < 3 && rect.bottom >= 44 &&
                              bar.querySelector('.site-mobile-chrome__search')?.getClientRects().length > 0 &&
                              document.documentElement.scrollWidth <= innerWidth + 1;
                      }"""))
                menu = sticky_page.locator('details.site-mobile-chrome__nav')
                check(f'{route} {mobile_width}px {chosen_theme} announces the active workspace on its menu toggle',
                      menu.locator(':scope > summary').get_attribute('aria-label') ==
                      'Toggle navigation · ' +
                      sticky_page.locator('.site-mobile-chrome').get_attribute('data-page-label'))
                menu.locator(':scope > summary').click()
                check(f'{route} {mobile_width}px {chosen_theme} can navigate from the pinned mobile header',
                      menu.evaluate('el => el.open') and
                      menu.locator('.site-mobile-chrome__menu > a[href]').count() >= 7)
                check(f'{route} {mobile_width}px {chosen_theme} has the same nested secondary menu',
                      menu.locator('.site-mobile-chrome__more > summary').count() == 1)
                sticky_page.keyboard.press('Escape')
                check(f'{route} {mobile_width}px {chosen_theme} closes the pinned navigation accessibly',
                      not menu.evaluate('el => el.open'))
                if mobile_width == 390 and chosen_theme == 'dark' and route in ('about.html', 'terms/index.html'):
                    sticky_page.screenshot(
                        path=str(out / ('pinned-mobile-' + route.replace('/', '-') + '.png')),
                        full_page=False)
            sticky_context.close()
    # Progressive enhancement must never make the script-free fallback depend on JS.
    scriptless_sticky = browser.new_page(viewport={'width':390, 'height':600},
                                        java_script_enabled=False)
    scriptless_sticky.goto(base + 'terms/index.html')
    scriptless_sticky.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
    check('script-free concept directory retains its pinned nonmodal menu',
          scriptless_sticky.evaluate("""() => {
              const bar = document.querySelector('.site-mobile-chrome');
              return scrollY > 30 && getComputedStyle(bar).position === 'sticky' &&
                  Math.abs(bar.getBoundingClientRect().top) < 3;
          }"""))
    scriptless_sticky.locator('details.site-mobile-chrome__nav > summary').click()
    check('script-free pinned directory menu opens as a native dropdown',
          scriptless_sticky.locator('details.site-mobile-chrome__nav').evaluate('el => el.open') and
          scriptless_sticky.locator('.site-mobile-chrome__menu > a[href]').count() >= 7)
    scriptless_sticky.close()

    page.set_viewport_size({'width':1440,'height':900})
    page.goto(base + 'whats-new.html')
    page.get_by_role('navigation', name='AI Updates primary navigation').get_by_role(
        'link', name='Playbooks', exact=True).click()
    page.wait_for_url('**/playbooks.html')
    check('desktop news to playbooks retains consistent site navigation',
          page.locator('.site-chrome__links a[aria-current="page"]').inner_text() == 'Playbooks')
    # Search is already a first-class Discover control; standalone desktop
    # pages must expose the same real destination without inventing a fake input.
    page.locator('.site-mobile-chrome__search-submit').click()
    page.wait_for_url('**/index.html#/search')
    check('desktop shared search returns to live Discover search',
          page.locator('#global-query').is_visible())


    # Discover's field-guide Playbooks link used to open a second SPA catalog
    # while the canonical primary navigation opened the standalone, searchable
    # Playbooks workspace. Exercise the same destination via the actual CTA at
    # phone, tablet and desktop widths in BOTH themes, then navigate back.
    for playbook_scheme in ('light', 'dark'):
        for playbook_width in (320, 390, 768, 1280):
            playbook_probe = browser.new_page(
                viewport={'width':playbook_width,'height':844},
                color_scheme=playbook_scheme, reduced_motion='reduce')
            playbook_probe.goto(base + 'index.html')
            playbook_probe.locator('.rail-counts a').filter(
                has_text='Practical playbooks').click()
            playbook_probe.wait_for_url('**/playbooks.html')
            check('Discover-to-Playbooks canonical destination ' +
                  playbook_scheme + ' ' + str(playbook_width),
                  playbook_probe.locator(
                      '.site-chrome__links a[aria-current="page"]').text_content().strip()
                  == 'Playbooks'
                  and playbook_probe.locator('main.playbook-content').count() == 1)
            playbook_probe.screenshot(path=str(out / (
                'shared-playbooks-entry-' + playbook_scheme + '-' +
                str(playbook_width) + '.png')))
            playbook_probe.go_back()
            check('Playbooks-to-Discover browser history ' +
                  playbook_scheme + ' ' + str(playbook_width),
                  playbook_probe.url.split('#')[0].endswith('/index.html') and
                  playbook_probe.locator('.discover-heading h1').count() == 1)
            playbook_probe.close()

    # Compare Discover with news, Games and generated references in both
    # themes and at four responsive widths; actually submit and navigate.
    for scheme in ('light', 'dark'):
        live_ctx = browser.new_context(color_scheme=scheme, reduced_motion='reduce')
        live_page = live_ctx.new_page()
        for width in (320, 390, 768, 1280):
            live_page.set_viewport_size({'width':width,'height':844})
            live_page.goto(base + 'index.html')
            for route in ('whats-new.html','games.html','terms/MLD-0002-ablation-study.html'):
                live_page.goto(base + route)
                form = live_page.locator('form.site-mobile-chrome__search')
                field = form.locator('input[type="search"]')
                check('shared real search '+route+' '+scheme+' '+str(width),
                      form.count()==1 and form.is_visible() and field.is_visible()
                      and form.locator('button[type="submit"]').is_visible()
                      and live_page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
                if route == 'games.html' and width in (390,1280):
                    live_page.screenshot(path=str(out/('live-search-'+scheme+'-'+str(width)+'.png')))
            if width in (390,1280):
                field.fill('reward hacking')
                field.press('Enter')
                live_page.wait_for_url('**/index.html#/search?q=reward%20hacking')
                live_page.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
                check('native search reaches actual Discover results '+scheme+' '+str(width),
                      live_page.locator('#all-query').input_value() == 'reward hacking'
                      and live_page.locator('#global-query').is_visible())
        live_ctx.close()

    # The archive formerly showed a multi-row legacy masthead on a 320px
    # phone, unlike Discover's compact menu + search entry. Both should feel
    # like the same site without pretending the archive has global search.
    mobile_archive = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_archive.goto(base + 'whats-new.html')
    check('daily archive uses the compact mobile site header',
          mobile_archive.locator('.mobile-topbar').is_visible()
          and not mobile_archive.locator('.top').is_visible()
          and mobile_archive.locator('.archive-search-link').is_visible())
    check('daily archive mobile header fits a 320px viewport',
          mobile_archive.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    mobile_archive.locator('.archive-menu-toggle').click()
    check('mobile archive menu exposes working site navigation and current location',
          mobile_archive.locator('#archive-mobile-nav').evaluate('(el) => el.open')
          and mobile_archive.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='What’s New Today').get_attribute('aria-current') == 'page')
    mobile_archive.locator('.archive-menu-toggle').click()
    mobile_archive.screenshot(path=str(out / 'archive-mobile-header.png'), full_page=False)
    mobile_archive.locator('.archive-search-link .site-mobile-chrome__search-submit').click()
    mobile_archive.wait_for_url('**/index.html#/search')
    check('mobile archive search entry opens the actual site search',
          mobile_archive.locator('#global-query').is_visible())
    mobile_archive.close()

    # Standalone Games previously used a distinct arrow masthead and wrapping
    # navigation. Verify the same reusable site chrome, then follow real links.
    mobile_games = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_games.goto(base + 'games.html')
    check('standalone games shares compact site header without overflow',
          mobile_games.locator('.site-mobile-chrome').is_visible()
          and mobile_games.locator('.site-mobile-chrome__search').is_visible()
          and not mobile_games.locator('.games-site-chrome').is_visible()
          and mobile_games.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_games.locator('#games-mobile-nav > summary').click()
    mobile_brand = mobile_games.locator('#games-mobile-nav .site-mobile-chrome__brand')
    check('mobile Games drawer visibly reuses the desktop logo and wordmark',
          mobile_brand.count() == 1 and mobile_brand.is_visible()
          and mobile_brand.evaluate("""el =>
              el.innerHTML === document.querySelector('nav.site-chrome > a.site-chrome__brand').innerHTML""")
          and mobile_brand.locator('svg').count() == 1)
    mobile_games.screenshot(path=str(out / 'mobile-shared-wordmark.png'), full_page=False)
    menu_links = mobile_games.locator('#games-mobile-nav .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)')
    check('mobile games nav matches canonical labels, routes and active destination',
          menu_links.all_inner_texts() == primary_names
          and menu_links.filter(has_text='Games').get_attribute('aria-current') == 'page'
          and all(h >= 44 for h in menu_links.evaluate_all(
              '(els) => els.map(el => el.getBoundingClientRect().height)')))
    # This is the same fixed 260px mobile rail as Discover, not an
    # independent dropdown. Outside-pointer dismissal remains functional.
    check('shared native mobile menu uses the Discover off-canvas geometry',
          mobile_games.evaluate("""() => {
              const p=document.querySelector('#games-mobile-nav .site-mobile-chrome__menu').getBoundingClientRect();
              return Math.abs(p.left)<1 && Math.abs(p.width-260)<=1
                  && p.height>=innerHeight-2
                  && getComputedStyle(document.querySelector('#games-mobile-nav .site-mobile-chrome__menu')).position==='fixed';
          }"""))
    # A tabbing user should not escape into obscured page controls.
    check('shared drawer locks the underlying mobile page while open',
          mobile_games.evaluate("getComputedStyle(document.body).overflow === 'hidden'"))
    # Unlike scroll-lock alone, inert removes the obscured workspace and
    # header controls from screen-reader and pointer interaction.
    mobile_games.wait_for_function("document.querySelector('main').inert")
    check('shared mobile drawer excludes background from assistive technology',
          mobile_games.evaluate("""() => document.querySelector('main').inert
              && document.querySelector('.site-mobile-chrome__search').inert
              && !document.querySelector('#games-mobile-nav').inert"""))
    mobile_games.locator('#games-mobile-nav > summary').focus()
    mobile_games.keyboard.press('Shift+Tab')
    check('Shift-Tab wraps to the shared drawer appearance action',
          mobile_games.locator('#games-mobile-nav .site-chrome__theme-toggle').evaluate(
              '(el) => document.activeElement === el && el.getBoundingClientRect().height >= 44'))
    mobile_games.keyboard.press('Tab')
    check('Tab from final drawer action returns to its close control',
          mobile_games.locator('#games-mobile-nav > summary').evaluate(
              '(el) => document.activeElement === el'))
    mobile_games.mouse.click(310, 160)
    check('outside click dismisses the shared mobile drawer',
          not mobile_games.locator('#games-mobile-nav').evaluate('(el) => el.open'))
    mobile_games.wait_for_function("!document.querySelector('main').inert")
    check('outside click restores keyboard and screen-reader access',
          mobile_games.evaluate("""() => !document.querySelector('main').inert
              && !document.querySelector('.site-mobile-chrome__search').inert"""))
    # Native details must not secretly remain open across a mobile/tablet
    # breakpoint. Otherwise rotation back leaves the whole site blocked.
    mobile_games.locator('#games-mobile-nav > summary').click()
    mobile_games.wait_for_function("document.querySelector('main').inert")
    mobile_games.set_viewport_size({'width':768, 'height':720})
    # A viewport resize event can arrive after Playwright's layout update.
    # Wait for the actual enhanced disclosure state, not an animation delay.
    mobile_games.wait_for_function("""() =>
        !document.querySelector('#games-mobile-nav').open
        && !document.querySelector('main').inert""", timeout=10000)
    check('tablet resize closes a formerly open native mobile drawer',
          not mobile_games.locator('#games-mobile-nav').evaluate('(el) => el.open')
          and mobile_games.evaluate("!document.querySelector('main').inert")
          and mobile_games.evaluate("getComputedStyle(document.body).overflow !== 'hidden'"))
    mobile_games.set_viewport_size({'width':320, 'height':720})
    check('return to phone does not restore a stale hidden menu',
          not mobile_games.locator('#games-mobile-nav').evaluate('(el) => el.open')
          and mobile_games.evaluate("!document.querySelector('main').inert")
          and mobile_games.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    # Cached restoration can occur after focus is blurred by the browser.
    # Exercise the shared pageshow behavior on the native Games drawer.
    mobile_games.locator('#games-mobile-nav > summary').click()
    mobile_games.wait_for_function("document.querySelector('main').inert")
    mobile_games.evaluate("""() => {
        document.activeElement.blur();
        window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true}));
    }""")
    mobile_games.wait_for_function("""() =>
        !document.querySelector('#games-mobile-nav').open
        && !document.querySelector('main').inert""")
    check('restoring cached page closes drawer and restores visible keyboard focus',
          mobile_games.locator('#games-mobile-nav > summary').evaluate(
              '(el) => document.activeElement === el'))
    mobile_games.locator('#games-mobile-nav > summary').click()
    mobile_games.locator('#games-mobile-nav > summary').click()
    mobile_games.locator('.site-mobile-chrome__search-submit').click()
    mobile_games.wait_for_url('**/index.html#/search')
    check('standalone Games search points into the actual workspace',
          mobile_games.locator('#global-query').is_visible())
    mobile_games.close()

    theme_ctx = browser.new_context(viewport={'width':390, 'height':844}, color_scheme='dark')
    theme_page = theme_ctx.new_page()
    # Editorial standalone pages must honor the explicit Discover/Games theme.
    # The shared script runs before the body and never overwrites the saved choice.
    theme_page.goto(base + 'research.html')
    theme_page.evaluate("localStorage.setItem('atlas.theme', 'dark')")
    for route in ('research.html', 'playbooks.html', 'technologies.html',
                  'hardware-review.html', 'about.html'):
        theme_page.goto(base + route)
        check('stored dark theme survives navigation to ' + route,
              theme_page.evaluate("document.documentElement.dataset.theme === 'dark' && getComputedStyle(document.documentElement).colorScheme === 'dark'"))
    theme_page.evaluate("localStorage.setItem('atlas.theme', 'light')")
    for route in ('research.html', 'playbooks.html', 'technologies.html',
                  'hardware-review.html', 'about.html'):
        theme_page.goto(base + route)
        check('stored light theme overrides dark OS preference on ' + route,
              theme_page.evaluate("document.documentElement.dataset.theme === 'light' && getComputedStyle(document.documentElement).colorScheme === 'light'"))
    theme_page.goto(base + 'games.html')
    theme_page.evaluate("localStorage.setItem('atlas.theme', 'light')")
    theme_page.reload()
    check('Games honors explicitly saved light theme despite dark OS mode',
          theme_page.evaluate("document.documentElement.dataset.theme === 'light'"))
    check('Games uses the same two-control mobile header as Discover without dropping appearance settings',
          not theme_page.locator('#theme-toggle').is_visible()
          and theme_page.locator('#games-mobile-nav > summary').is_visible()
          and theme_page.locator('.site-mobile-chrome__search').is_visible())
    theme_page.locator('#games-mobile-nav > summary').click()
    games_drawer_theme = theme_page.locator('#games-mobile-nav .site-chrome__theme-toggle')
    check('Games drawer exposes the existing theme action with correct initial state',
          games_drawer_theme.is_visible()
          and games_drawer_theme.get_attribute('aria-pressed') == 'false')
    games_drawer_theme.click()
    theme_page.locator('#games-mobile-nav > summary').click()
    check('standalone Games mobile drawer theme action saves preference and switches native controls to dark',
          theme_page.evaluate("localStorage.getItem('atlas.theme') === 'dark' && "
                              "document.documentElement.dataset.theme === 'dark' && "
                              "getComputedStyle(document.documentElement).colorScheme === 'dark' && "
                              "document.documentElement.style.colorScheme === ''")
          and theme_page.locator('#theme-toggle').get_attribute('aria-pressed') == 'true'
          and games_drawer_theme.get_attribute('aria-pressed') == 'true')
    theme_page.goto(base + 'whats-new.html')
    check('Games to archive preserves selected dark theme and native controls',
          theme_page.evaluate("document.documentElement.dataset.theme === 'dark' && "
                              "getComputedStyle(document.documentElement).colorScheme === 'dark'"))
    theme_page.goto(base + 'games.html')
    theme_page.locator('#games-mobile-nav > summary').click()
    theme_page.locator('#games-mobile-nav .site-chrome__theme-toggle').click()
    theme_page.locator('#games-mobile-nav > summary').click()
    check('switching back to light through the shared drawer updates native controls without a reload',
          theme_page.evaluate("localStorage.getItem('atlas.theme') === 'light' && "
                              "document.documentElement.dataset.theme === 'light' && "
                              "getComputedStyle(document.documentElement).colorScheme === 'light'"))
    theme_page.goto(base + 'about.html')
    check('About inherits the new light preference and native controls',
          theme_page.evaluate("document.documentElement.dataset.theme === 'light' && "
                              "getComputedStyle(document.documentElement).colorScheme === 'light'"))

    # Discover's original sidebar toggle must announce its selected state,
    # just as native editorial and Games theme controls do across routes.
    theme_page.set_viewport_size({'width':1280, 'height':844})
    theme_page.goto(base + 'index.html#/overview')
    theme_page.locator('#catalog-loading').wait_for(state='detached')
    check('Discover sidebar theme announces the saved light selection',
          theme_page.locator('#theme-toggle').get_attribute('aria-pressed') == 'false')
    theme_page.locator('#theme-toggle').click()
    check('Discover sidebar theme announces newly selected dark state',
          theme_page.locator('#theme-toggle').get_attribute('aria-pressed') == 'true'
          and theme_page.evaluate("localStorage.getItem('atlas.theme') === 'dark'"))
    theme_page.goto(base + 'games.html')
    check('Games inherits Discover dark preference and pressed state',
          theme_page.locator('#theme-toggle').get_attribute('aria-pressed') == 'true'
          and theme_page.evaluate("document.documentElement.dataset.theme === 'dark'"))
    check('Games theme control occupies the shared desktop rail, not an overlapping topbar',
          theme_page.locator('.site-chrome .sidebar-actions > #theme-toggle.site-chrome__theme-toggle--rail').count() == 1
          and theme_page.locator('.site-chrome .sidebar-actions > #theme-toggle').is_visible()
          and theme_page.locator('.games-header__inner > #theme-toggle').count() == 0
          and theme_page.locator('.site-mobile-chrome__search-form').is_visible())
    theme_page.screenshot(path=str(out / 'games-unified-desktop-rail-1280-dark.png'))
    theme_page.goto(base + 'index.html#/overview')
    theme_page.locator('#catalog-loading').wait_for(state='detached')
    check('Discover restores dark pressed state after Games navigation',
          theme_page.locator('#theme-toggle').get_attribute('aria-pressed') == 'true')
    theme_page.locator('#theme-toggle').click()
    check('Discover returns to light pressed state without reloading',
          theme_page.locator('#theme-toggle').get_attribute('aria-pressed') == 'false'
          and theme_page.evaluate("localStorage.getItem('atlas.theme') === 'light'"))

    # One shared appearance action, in the same rail/drawer positions used by
    # Discover. Standalone articles previously had no way to change themes.
    theme_page.set_viewport_size({'width':1280, 'height':844})
    theme_page.goto(base + 'about.html')
    rail_theme = theme_page.locator('.site-chrome .sidebar-bottom .site-chrome__theme-toggle--rail')
    check('native rail uses Discover sidebar bottom and the real coverage route',
          theme_page.locator('.site-chrome .sidebar-bottom .snapshot').inner_text().startswith('Research snapshot')
          and theme_page.locator('.site-chrome .sidebar-bottom a[href="index.html#/sources"]').count() == 1
          and theme_page.locator('.site-chrome .sidebar-actions').count() == 1)
    check('editorial desktop rail exposes shared appearance action',
          rail_theme.is_visible() and
          rail_theme.get_attribute('aria-label') == 'Toggle color theme' and
          rail_theme.get_attribute('aria-pressed') == 'false')
    rail_theme.click()
    check('shared desktop theme switch saves dark choice',
          theme_page.evaluate("document.documentElement.dataset.theme === 'dark' && localStorage.getItem('atlas.theme') === 'dark'") and
          rail_theme.get_attribute('aria-pressed') == 'true')
    theme_page.goto(base + 'technologies.html')
    check('technology directory reuses the rail-bottom component',
          theme_page.locator('.site-chrome .sidebar-bottom a[href="index.html#/sources"]').count() == 1
          and theme_page.locator('.site-chrome .sidebar-bottom .site-chrome__theme-toggle--rail').count() == 1)
    check('technology directory preserves the theme chosen on About',
          theme_page.evaluate("document.documentElement.dataset.theme === 'dark'"))
    theme_page.set_viewport_size({'width':390, 'height':844})
    theme_page.locator('#tech-mobile-nav > summary').click()
    mobile_theme = theme_page.locator('.site-mobile-chrome__menu > .site-chrome__theme-toggle')
    check('mobile native drawer contains one keyboard-focusable appearance action',
          mobile_theme.is_visible() and
          mobile_theme.get_attribute('aria-pressed') == 'true' and
          theme_page.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').count() == 7)
    mobile_theme.click()
    check('native mobile appearance action persists light choice',
          theme_page.evaluate("document.documentElement.dataset.theme === 'light' && localStorage.getItem('atlas.theme') === 'light'") and
          mobile_theme.get_attribute('aria-pressed') == 'false')
    theme_page.goto(base + 'research.html')
    check('research retains the mobile theme choice across page families',
          theme_page.evaluate("document.documentElement.dataset.theme === 'light'"))

    theme_ctx.close()

    # The editorial-policy page formerly exposed a multirow legacy nav on
    # phones, while Discover and the daily archive use a compact menu/search.
    mobile_about = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_about.goto(base + 'about.html')
    check('about page uses the same compact mobile navigation as the archive',
          mobile_about.locator('.directory-mobile-topbar').is_visible()
          and not mobile_about.locator('.term-nav').is_visible()
          and mobile_about.locator('.site-mobile-chrome__search').is_visible())
    check('about mobile header fits a 320px viewport',
          mobile_about.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_about.locator('.site-mobile-chrome__toggle').click()
    check('about mobile menu exposes the current location',
          mobile_about.locator('#directory-mobile-nav').evaluate('(el) => el.open')
          and mobile_about.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='About', exact=True).get_attribute('aria-current') == 'page')
    mobile_about.locator('.site-mobile-chrome__toggle').click()
    mobile_about.screenshot(path=str(out / 'about-mobile-header.png'), full_page=False)
    mobile_about.locator('.site-mobile-chrome__search-submit').click()
    mobile_about.wait_for_url('**/index.html#/search')
    check('about mobile search entry opens the real collection search',
          mobile_about.locator('#global-query').is_visible())
    mobile_about.close()
    # The standalone technology directory previously used its own multirow
    # desktop text links on a phone rather than the shared compact header.
    mobile_tech = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_tech.goto(base + 'technologies.html')
    check('technology directory adopts the compact mobile site header',
          mobile_tech.locator('.tech-mobile-topbar').is_visible()
          and not mobile_tech.locator('.tech-top').is_visible()
          and mobile_tech.locator('.tech-search-link').is_visible())
    check('320px technology directory has no horizontal overflow',
          mobile_tech.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_tech.locator('.tech-menu-toggle').focus()
    mobile_tech.keyboard.press('Enter')
    check('technology directory menu opens from the keyboard and marks current page',
          mobile_tech.locator('#tech-mobile-nav').evaluate('(el) => el.open')
          and mobile_tech.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='Technology profiles').get_attribute('aria-current') == 'page')
    check('technology directory menu links offer 44px touch targets',
          mobile_tech.evaluate("""() => [...document.querySelectorAll('.tech-menu-panel > a')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_tech.locator('#tech-mobile-nav .site-mobile-chrome__more > summary').click()
    check('technology directory exposes eight touch-sized mobile secondary routes',
          mobile_tech.evaluate("""() => {
              const links = [...document.querySelectorAll('.tech-menu-panel .site-mobile-chrome__more-links a')];
              return links.length === 8 && links.every(a => a.getBoundingClientRect().height >= 44);
          }"""))
    mobile_tech.locator('.tech-menu-toggle').focus()
    mobile_tech.keyboard.press('Enter')
    mobile_tech.screenshot(path=str(out / 'technology-directory-mobile-header.png'), full_page=False)
    mobile_tech.set_viewport_size({'width':390,'height':844})
    check('390px technology directory remains within viewport',
          mobile_tech.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_tech.set_viewport_size({'width':1440,'height':900})
    check('desktop technology directory retains shared navigation and functional search',
          desktop_shared_navigation(mobile_tech)
          and mobile_tech.locator('.tech-top').is_visible())
    mobile_tech.set_viewport_size({'width':320,'height':720})
    mobile_tech.locator('.tech-search-link .site-mobile-chrome__search-submit').click()
    mobile_tech.wait_for_url('**/index.html#/search')
    check('technology directory search opens the actual workspace search',
          mobile_tech.locator('#global-query').is_visible())
    mobile_tech.close()
    # Playbooks used a multirow legacy header, unlike Discover.
    mobile_playbooks = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_playbooks.goto(base + 'playbooks.html')
    check('playbooks use the compact mobile site header',
          mobile_playbooks.locator('.playbook-mobile-topbar').is_visible()
          and not mobile_playbooks.locator('.playbook-top').is_visible()
          and mobile_playbooks.locator('.playbook-search-link').is_visible())
    check('320px playbooks fit without horizontal overflow',
          mobile_playbooks.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_playbooks.locator('.playbook-menu-toggle').focus()
    mobile_playbooks.keyboard.press('Enter')
    check('playbooks menu keyboard access marks the current page',
          mobile_playbooks.locator('#playbook-mobile-nav').evaluate('(el) => el.open')
          and mobile_playbooks.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='Playbooks', exact=True).get_attribute('aria-current') == 'page')
    check('playbooks mobile menu links have 44px touch targets',
          mobile_playbooks.evaluate("""() => [...document.querySelectorAll('.playbook-menu-panel > a')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_playbooks.locator('#playbook-mobile-nav .site-mobile-chrome__more > summary').click()
    check('playbooks expose eight touch-sized secondary routes in the mobile drawer',
          mobile_playbooks.evaluate("""() => {
              const links = [...document.querySelectorAll('.playbook-menu-panel .site-mobile-chrome__more-links a')];
              return links.length === 8 && links.every(a => a.getBoundingClientRect().height >= 44);
          }"""))
    mobile_playbooks.locator('.playbook-menu-toggle').focus()
    mobile_playbooks.keyboard.press('Enter')
    mobile_playbooks.screenshot(path=str(out / 'playbooks-mobile-header.png'), full_page=False)
    mobile_playbooks.set_viewport_size({'width':390, 'height':844})
    check('390px playbooks fit without horizontal overflow',
          mobile_playbooks.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_playbooks.set_viewport_size({'width':1440, 'height':900})
    check('desktop playbooks retain shared navigation and functional search',
          desktop_shared_navigation(mobile_playbooks)
          and mobile_playbooks.locator('.playbook-top').is_visible())
    mobile_playbooks.set_viewport_size({'width':320, 'height':720})
    mobile_playbooks.locator('.playbook-search-link .site-mobile-chrome__search-submit').click()
    mobile_playbooks.wait_for_url('**/index.html#/search')
    check('playbooks search opens the existing workspace search',
          mobile_playbooks.locator('#global-query').is_visible())
    mobile_playbooks.close()

    # Coherence regression: these three previously independent mobile menus
    # now use the same shared component, destinations and tap dimensions as
    # Games and the daily archive, in both OS themes on narrow phones.
    canonical_mobile = [
        'Discover', 'What’s New Today', 'Concept dictionary',
        'Technology profiles', 'Games', 'Playbooks', 'About']
    for width, theme in ((320,'light'), (390,'dark')):
        shared_mobile = browser.new_page(
            viewport={'width':width,'height':844}, color_scheme=theme,
            reduced_motion='reduce')
        for route in ('about.html','technologies.html','playbooks.html'):
            shared_mobile.goto(base + route)
            bar = shared_mobile.locator('.site-mobile-chrome')
            toggle = shared_mobile.locator('.site-mobile-chrome__toggle')
            search = shared_mobile.locator('.site-mobile-chrome__search')
            check(f'{route} shares common mobile controls at {width}px ({theme})',
                  bar.is_visible() and toggle.is_visible() and search.is_visible()
                  and shared_mobile.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                  and toggle.evaluate('(el) => el.getBoundingClientRect().height >= 44')
                  and search.evaluate('(el) => el.getBoundingClientRect().height >= 44'))
            toggle.click()
            menu_links = shared_mobile.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)')
            check(f'{route} follows shared seven-link order at {width}px ({theme})',
                  menu_links.all_inner_texts() == canonical_mobile
                  and sum(x == 'page' for x in
                          menu_links.evaluate_all("(nodes) => nodes.map(n => n.getAttribute('aria-current'))")) == 1
                  and menu_links.evaluate_all('(nodes) => nodes.every(n => n.getBoundingClientRect().height >= 44)'))
            toggle.click()
        shared_mobile.close()
    # The candidate-review page also had legacy multirow links at 320px.
    mobile_review = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_review.goto(base + 'catalog-review.html')
    check('catalog review uses the compact mobile site header',
          mobile_review.locator('.review-mobile-topbar').is_visible()
          and not mobile_review.locator('.shell > .nav').is_visible()
          and mobile_review.locator('.review-mobile-topbar .site-mobile-chrome__search').is_visible())
    check('review uses a level menu and search control row',
          mobile_review.evaluate("""() => Math.abs(
              document.querySelector('.review-mobile-topbar .site-mobile-chrome__toggle').getBoundingClientRect().top -
              document.querySelector('.review-mobile-topbar .site-mobile-chrome__search').getBoundingClientRect().top) <= 2"""))
    check('320px catalog review has no page-wide horizontal overflow',
          mobile_review.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_review.locator('.review-mobile-topbar .site-mobile-chrome__toggle').focus()
    mobile_review.keyboard.press('Enter')
    check('catalog review mobile menu matches the primary navigation order',
          mobile_review.locator('.review-mobile-topbar .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').all_inner_texts() == ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles', 'Games', 'Playbooks', 'About'])
    check('catalog review menu is keyboard operable with current-page indication',
          mobile_review.locator('#review-mobile-nav').evaluate('(el) => el.open')
          and mobile_review.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='What’s New Today', exact=True).get_attribute('aria-current') == 'location')
    check('catalog review current mobile section is visibly highlighted',
          mobile_review.evaluate("""() => {
            const a = document.querySelectorAll('.review-mobile-topbar .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)');
            return getComputedStyle(a[1]).backgroundColor !== getComputedStyle(a[0]).backgroundColor;
          }"""))
    check('catalog review mobile links meet 44px touch minimum',
          mobile_review.evaluate("""() => [...document.querySelectorAll('.review-mobile-topbar .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_review.keyboard.press('Enter')
    mobile_review.screenshot(path=str(out / 'catalog-review-mobile-header.png'), full_page=False)
    mobile_review.set_viewport_size({'width':390, 'height':844})
    check('390px catalog review has no page-wide horizontal overflow',
          mobile_review.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_review.set_viewport_size({'width':1440, 'height':900})
    check('desktop catalog review has shared navigation and functional search',
          desktop_shared_navigation(mobile_review)
          and mobile_review.locator('.shell > .nav').is_visible())
    mobile_review.set_viewport_size({'width':320, 'height':720})
    mobile_review.locator('.review-mobile-topbar .site-mobile-chrome__search-submit').click()
    mobile_review.wait_for_url('**/index.html#/search')
    check('catalog review search opens actual workspace search',
          mobile_review.locator('#global-query').is_visible())
    mobile_review.close()

    # Hardware evidence previously exposed a multirow legacy header on phones.
    mobile_hardware = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_hardware.goto(base + 'hardware-review.html')
    check('hardware review uses the compact mobile site header',
          mobile_hardware.locator('.hardware-mobile-topbar').is_visible()
          and not mobile_hardware.locator('body > .review-nav').is_visible()
          and mobile_hardware.locator('.hardware-mobile-topbar .site-mobile-chrome__search').is_visible())
    check('hardware uses a level menu and search control row',
          mobile_hardware.evaluate("""() => Math.abs(
              document.querySelector('.hardware-mobile-topbar .site-mobile-chrome__toggle').getBoundingClientRect().top -
              document.querySelector('.hardware-mobile-topbar .site-mobile-chrome__search').getBoundingClientRect().top) <= 2"""))
    check('320px hardware review has no page-wide horizontal overflow',
          mobile_hardware.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_hardware.locator('.hardware-mobile-topbar .site-mobile-chrome__toggle').focus()
    mobile_hardware.keyboard.press('Enter')
    check('hardware mobile menu matches the primary navigation order',
          mobile_hardware.locator('.hardware-mobile-topbar .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').all_inner_texts() == ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles', 'Games', 'Playbooks', 'About'])
    check('hardware review menu supports keyboard navigation and current-page indication',
          mobile_hardware.locator('#hardware-mobile-nav').evaluate('(el) => el.open')
          and mobile_hardware.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='What’s New Today', exact=True).get_attribute('aria-current') == 'location')
    check('hardware review current mobile section is visibly highlighted',
          mobile_hardware.evaluate("""() => {
            const a = document.querySelectorAll('.hardware-mobile-topbar .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)');
            return getComputedStyle(a[1]).backgroundColor !== getComputedStyle(a[0]).backgroundColor;
          }"""))
    check('hardware review mobile links meet 44px touch minimum',
          mobile_hardware.evaluate("""() => [...document.querySelectorAll('.hardware-mobile-topbar .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_hardware.keyboard.press('Enter')
    mobile_hardware.screenshot(path=str(out / 'hardware-review-mobile-header.png'), full_page=False)
    mobile_hardware.set_viewport_size({'width':390, 'height':844})
    check('390px hardware review has no page-wide horizontal overflow',
          mobile_hardware.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_hardware.set_viewport_size({'width':1440, 'height':900})
    check('desktop hardware review has shared navigation and functional search',
          desktop_shared_navigation(mobile_hardware)
          and mobile_hardware.locator('body > .review-nav').is_visible()
          and mobile_hardware.locator('main.review-shell nav.site-chrome').count() == 0)
    mobile_hardware.set_viewport_size({'width':320, 'height':720})
    mobile_hardware.locator('.hardware-mobile-topbar .site-mobile-chrome__search-submit').click()
    mobile_hardware.wait_for_url('**/index.html#/search')
    check('hardware review search opens the actual workspace search',
          mobile_hardware.locator('#global-query').is_visible())
    mobile_hardware.close()

    # Research uses the same mobile navigation classes and seven primary
    # destinations as Games, while keeping its own three research-view tabs.
    # Hold catalog hydration to verify actual first-paint Research tab styling.
    early_research = browser.new_page(viewport={'width':390, 'height':844}, reduced_motion='reduce')
    early_research.add_init_script("""(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (resource, options) =>
        String(resource).endsWith('publication.json')
          ? new Promise(() => {})
          : originalFetch(resource, options);
    })();""")
    early_research.goto(base + 'research.html#alerts', wait_until='domcontentloaded')
    for width in (320, 390, 768, 1280):
        early_research.set_viewport_size({'width': width, 'height': 844})
        for scheme in ('light', 'dark'):
            early_research.emulate_media(color_scheme=scheme)
            for section, label in (('coverage', 'Publication progress'), ('alerts', 'Safety observatory')):
                early_research.locator('.research-local-nav a[data-nav="' + section + '"]').click()
                early_research.wait_for_function("""([section, label]) => {
                    const links = [...document.querySelectorAll('.research-local-nav a[data-nav]')];
                    return document.title === label + ' | AI Updates' &&
                      links.filter(a => a.classList.contains('active')).length === 1 &&
                      links.find(a => a.classList.contains('active'))?.dataset.nav === section &&
                      links.find(a => a.getAttribute('aria-current') === 'page')?.dataset.nav === section;
                }""", arg=[section, label])
                check(f'Research {width}px {scheme} {section}: visible pending-catalog selection',
                      early_research.evaluate("""() => {
                        const active = document.querySelector('.research-local-nav a.active');
                        const other = document.querySelector('.research-local-nav a:not(.active)');
                        return !document.documentElement.classList.contains('atlas-research-ready') &&
                          getComputedStyle(active).backgroundColor !== getComputedStyle(other).backgroundColor &&
                          document.documentElement.scrollWidth <= innerWidth + 1;
                      }"""))
            if width in (390, 1280):
                early_research.screenshot(path=str(out / f'research-early-{width}-{scheme}.png'))
    early_research.close()
    mobile_research = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_research.goto(base + 'research.html')

    # Research had three prominent local-view pills ABOVE its page heading;
    # Discover/Playbooks introduce the page first. Preserve the same live hash
    # routes, but let the article heading lead on phones and desktop alike.
    for width in (320, 390, 768, 1280):
        mobile_research.set_viewport_size({'width': width, 'height': 900})
        for scheme in ('light', 'dark'):
            mobile_research.emulate_media(color_scheme=scheme)
            check(f'research {width}px {scheme}: heading precedes contextual views',
                  mobile_research.evaluate("""() => {
                    const heading = document.querySelector('#main h1');
                    const hero = document.querySelector('section.hero#main');
                    const tabs = document.querySelector('nav.research-local-nav');
                    return !!heading && !!tabs &&
                      hero.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING &&
                      hero.getBoundingClientRect().top < tabs.getBoundingClientRect().top &&
                      document.documentElement.scrollWidth <= innerWidth + 1;
                  }"""))
    mobile_research.set_viewport_size({'width': 320, 'height': 720})
    mobile_research.emulate_media(color_scheme='light')
    check('research uses the compact mobile navigation instead of the legacy sidebar',
          mobile_research.locator('.research-mobile-topbar').is_visible()
          and not mobile_research.locator('.shell > aside').is_visible()
          and mobile_research.locator('.research-search-link').is_visible())
    check('320px research page has no horizontal overflow',
          mobile_research.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    check('research views reuse the single-row Discover topic strip at 320px',
          mobile_research.evaluate("""() => {
            const tabs = document.querySelector('nav.research-local-nav.discovery-topics');
            if (!tabs) return false;
            const links = [...tabs.querySelectorAll('a[href]')];
            return links.length === 3 &&
              getComputedStyle(tabs).overflowX === 'auto' &&
              tabs.scrollWidth > tabs.clientWidth &&
              new Set(links.map(a => Math.round(a.getBoundingClientRect().top))).size === 1 &&
              links.every(a => a.getBoundingClientRect().height >= 44);
          }"""))
    check('research primary mobile menu matches the other standalone pages',
          mobile_research.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').all_text_contents()
          == ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles',
              'Games', 'Playbooks', 'About'])
    mobile_research.wait_for_function(
        """document.querySelector('.research-local-nav a[href="#papers"]').getAttribute('aria-current') === 'page'""")
    mobile_research.locator('.research-menu-toggle').focus()
    mobile_research.keyboard.press('Enter')
    check('research mobile menu is keyboard operable and local view is identified',
          mobile_research.locator('#research-mobile-nav').evaluate('(el) => el.open')
          and mobile_research.locator('.research-local-nav a[href="#papers"]').get_attribute('aria-current') == 'page')
    check('research navigation links meet the 44px touch target minimum',
          mobile_research.evaluate("""() => [...document.querySelectorAll('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_research.keyboard.press('Enter')
    mobile_research.locator('.research-local-nav a[href="#alerts"]').click()
    mobile_research.wait_for_function("""() => location.hash === '#alerts'
        && document.querySelector('.research-local-nav a[href="#alerts"]').getAttribute('aria-current') === 'page'
        && document.querySelector('#section-label').textContent === 'SAFETY OBSERVATORY'""")
    check('research view tabs switch the original catalog route and selected state',
          mobile_research.locator('.research-local-nav a[href="#alerts"]').get_attribute('aria-current') == 'page'
          and mobile_research.locator('#section-label').inner_text() == 'SAFETY OBSERVATORY')
    # The shared rail and script-free mobile drawer must agree with the
    # Research hash route, rather than keeping Papers selected on Safety.
    for width in (320, 390, 768, 1280):
        mobile_research.set_viewport_size({'width': width, 'height': 844 if width <= 650 else 900})
        check('Research safety hash synchronizes shared chrome '+str(width),
              mobile_research.locator('.site-chrome__more a[aria-current="location"][href="index.html#/safety"]').count() == 1
              and mobile_research.locator('.site-mobile-chrome__more a[aria-current="location"][href="index.html#/safety"]').count() == 1
              and mobile_research.locator('.site-chrome__more a[aria-current="location"][href="research.html"]').count() == 0
              and mobile_research.locator('.site-mobile-chrome__more a[aria-current="location"][href="research.html"]').count() == 0
              and mobile_research.locator('.research-mobile-topbar .site-mobile-chrome__title').inner_text() == 'Safety observatory'
              and mobile_research.evaluate("document.title === 'Safety observatory | AI Updates' && document.documentElement.scrollWidth <= innerWidth + 1"))
    mobile_research.locator('.research-local-nav a[href="#papers"]').click()
    mobile_research.wait_for_function("""() => document.querySelector('.site-chrome__more a[href="research.html"]').getAttribute('aria-current') === 'location'""")
    check('Research return restores shared section and site title',
          mobile_research.locator('.site-chrome__more a[aria-current="location"][href="index.html#/safety"]').count() == 0
          and mobile_research.locator('.site-mobile-chrome__more a[aria-current="location"][href="research.html"]').count() == 1
          and mobile_research.locator('.research-mobile-topbar .site-mobile-chrome__title').inner_text() == 'Research library'
          and mobile_research.evaluate("document.title === 'Research library | AI Updates'"))
    mobile_research.set_viewport_size({'width': 320, 'height': 720})
    mobile_research.screenshot(path=str(out / 'research-mobile-header.png'), full_page=False)
    mobile_research.set_viewport_size({'width':390, 'height':844})
    check('390px research page fits without horizontal overflow',
          mobile_research.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_research.set_viewport_size({'width':680, 'height':900})
    check('tablet research uses shared sidebar, working search and contextual tabs',
          desktop_shared_navigation(mobile_research)
          and mobile_research.locator('.research-site-chrome').is_visible()
          and mobile_research.locator('.research-local-nav').is_visible()
          and mobile_research.locator('.shell > aside').count() == 0
          and mobile_research.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_research.set_viewport_size({'width':1440, 'height':900})
    mobile_research.locator('.research-mobile-topbar .site-mobile-chrome__title').click()
    check('Research active secondary rail remains visible after desktop content interaction',
          mobile_research.locator('.research-site-chrome .site-chrome__more').evaluate('(el) => el.open'))
    check('desktop research primary navigation matches AI Updates sections',
          mobile_research.locator('.research-site-chrome').is_visible()
          and mobile_research.locator('.site-chrome__links a').all_text_contents()
          == ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles',
              'Games', 'Playbooks', 'About']
          and mobile_research.locator('.research-local-nav').is_visible()
          and mobile_research.locator('.research-site-chrome .site-chrome__links [aria-current]').count() == 0
          and mobile_research.locator('.research-site-chrome .site-chrome__more a[aria-current="location"]').inner_text() == 'Research library'
          and mobile_research.locator('.shell > aside').count() == 0)
    check('Research global rail remains outside the article landmark at desktop width',
          mobile_research.locator('.shell > nav.site-chrome.research-site-chrome').count() == 1
          and mobile_research.locator('.shell > main > section.hero#main').count() == 1
          and mobile_research.locator('main nav.site-chrome').count() == 0)
    published_counts = mobile_research.request.get(base + 'publication.json').json()['published_counts']
    check('research tabs retain accurate record counts and notice matches publication manifest',
          mobile_research.locator('#papers-count').inner_text() == str(published_counts['papers'])
          and mobile_research.locator('#alerts-count').inner_text() == str(published_counts['alerts'])
          and f"all {published_counts['technologies']} technologies" in mobile_research.locator('.notice').inner_text())
    mobile_research.screenshot(path=str(out / 'research-unified-desktop.png'), full_page=False)
    mobile_research.locator('.research-site-chrome .site-chrome__links a[href="whats-new.html"]').click()
    mobile_research.wait_for_url('**/whats-new.html')
    check('research global navigation opens archive with the same shared chrome',
          mobile_research.locator('.site-chrome').is_visible()
          and mobile_research.locator('.site-chrome__brand').is_visible())
    mobile_research.goto(base + 'research.html')
    mobile_research.set_viewport_size({'width':320, 'height':720})
    # Research exposes native modal record details. The shared '/' shortcut
    # must not leave that dialog or create a stale focus handoff.
    mobile_research.locator('button.title-button').first.click(timeout=45000)
    check('Research details open as a native modal',
          mobile_research.locator('#detail').evaluate('el => el.open'))
    mobile_research.keyboard.press('/')
    check('shared search shortcut respects Research modal keyboard scope',
          mobile_research.locator('#detail').evaluate('el => el.open')
          and mobile_research.evaluate("location.pathname.endsWith('/research.html')")
          and mobile_research.evaluate("sessionStorage.getItem('atlas.searchShortcutPending') !== '1'"))
    mobile_research.locator('#close-detail').click()
    mobile_research.locator('.research-search-link .site-mobile-chrome__search-submit').click()
    mobile_research.wait_for_url('**/index.html#/search')
    mobile_research.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
    check('research search opens the existing workspace and focuses its real input',
          mobile_research.locator('#global-query').is_visible()
          and mobile_research.evaluate("document.activeElement?.id === 'global-query'"))
    # Slash now focuses the real local shared search field first, without
    # another page load; Enter preserves the query in Discover search.
    mobile_research.goto(base + 'research.html')
    mobile_research.keyboard.press('/')
    check('Research slash focuses shared live search in place',
          mobile_research.locator('.site-mobile-chrome__search-input').is_visible()
          and mobile_research.evaluate(
              "document.activeElement?.classList.contains('site-mobile-chrome__search-input') === true")
          and mobile_research.evaluate("location.pathname.endsWith('/research.html')"))
    mobile_research.locator('.site-mobile-chrome__search-input').fill('reward hacking')
    mobile_research.locator('.site-mobile-chrome__search-input').press('Enter')
    mobile_research.wait_for_url('**/index.html#/search?q=reward%20hacking')
    mobile_research.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
    check('shared search submits a real query to Discover',
          mobile_research.locator('#all-query').input_value() == 'reward hacking'
          and mobile_research.locator('#global-query').input_value() == 'reward hacking'
          and mobile_research.evaluate("document.activeElement?.id === 'global-query'"))
    mobile_research.close()
    # Desktop hides the native mobile search row, but its real destination
    # must remain available via the same '/' shortcut as Discover. Previously
    # enhancing the link into a hidden form orphaned the desktop keyboard path.
    for route, scheme, width in (
        ('whats-new.html', 'light', 1280),
        ('research.html', 'dark', 768),
        ('playbooks.html', 'light', 1280),
        ('technologies.html', 'dark', 768),
        ('games.html', 'light', 1280),
        ('terms/index.html', 'dark', 1280),
        ('technology/index.html', 'light', 768),
    ):
        desktop_search = browser.new_page(
            viewport={'width':width, 'height':844},
            color_scheme=scheme, reduced_motion='reduce')
        desktop_search.goto(base + route)
        # A few existing editorial headers deliberately keep the shared
        # search input visible at desktop widths; those should focus locally.
        # Script-free generated references hide theirs, so / must travel to
        # Discover rather than silently failing after link enhancement.
        input_visible = desktop_search.locator('.site-mobile-chrome__search-input').is_visible()
        desktop_search.keyboard.press('/')
        if input_visible:
            check('visible desktop shared search is focused in place '+route+' '+scheme,
                  desktop_search.evaluate(
                      "document.activeElement?.classList.contains('site-mobile-chrome__search-input') === true"))
            desktop_search.locator('.site-mobile-chrome__search-input').fill('reward hacking')
            desktop_search.locator('.site-mobile-chrome__search-input').press('Enter')
            desktop_search.wait_for_url('**/index.html#/search?q=reward%20hacking', timeout=20000)
        else:
            desktop_search.wait_for_url('**/index.html#/search', timeout=20000)
        desktop_search.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
        check('native desktop slash reaches functional Discover search '+route+' '+scheme,
              desktop_search.evaluate("document.activeElement?.id === 'global-query'")
              and desktop_search.locator('#global-query').is_visible()
              and desktop_search.locator('#global-query').input_value() ==
                  ('reward hacking' if input_visible else ''))
        desktop_search.close()
    # Direct concept detail pages share the same native, script-free menu
    # and current-section indication as the dictionary and technology directories.
    for reference in ('terms/MLD-0002-ablation-study.html', 'terms/MLD-0957-prompt-injection.html'):
        mobile_reference = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
        mobile_reference.goto(base + reference)
        menu = mobile_reference.locator('#directory-mobile-nav')
        check(reference + ' has the shared native mobile header and search',
              mobile_reference.locator('.directory-mobile-topbar').is_visible()
              and mobile_reference.locator('.site-mobile-chrome__search').is_visible()
              and not mobile_reference.locator('.site-chrome').is_visible())
        menu.locator(':scope > summary').click()
        check(reference + ' exposes the seven shared navigation links with current section',
              menu.evaluate('el => el.open')
              and menu.locator('nav > a:not(.site-mobile-chrome__brand)').count() == 7
              and menu.locator('nav > a.site-mobile-chrome__brand').count() == 1
              and menu.locator('nav a[aria-current="page"]').count() == 1
              and menu.locator('nav a[aria-current="page"]').inner_text() == 'Concept dictionary')
        mobile_reference.wait_for_function("document.querySelector('.site-mobile-chrome__search').inert")
        check(reference + ' shares background isolation while drawer is open',
              mobile_reference.evaluate("""() => document.querySelector('.site-mobile-chrome__search').inert
                  && !document.querySelector('#directory-mobile-nav').inert"""))
        check(reference + ' has keyboard-reachable 44px navigation links',
              mobile_reference.evaluate("""() => [...document.querySelectorAll('#directory-mobile-nav nav > a:not(.site-mobile-chrome__brand)')]
                  .every(a => a.getBoundingClientRect().height >= 44)"""))
        # Check geometry, not merely the number of DOM links: checkpoint.css
        # also styles generic navs and previously compressed this menu into a
        # horizontally scrolling two-link strip.
        check(reference + ' stacks all seven links in one visible vertical menu',
              mobile_reference.evaluate("""() => {
                  const menu = document.querySelector('#directory-mobile-nav nav');
                  const links = [...menu.querySelectorAll(':scope > a:not(.site-mobile-chrome__brand)')].map(a => a.getBoundingClientRect());
                  const box = menu.getBoundingClientRect();
                  return getComputedStyle(menu).display === 'grid'
                      && box.left >= -1 && box.right <= innerWidth + 1
                      && links.length === 7
                      && links.every((r, i) => i === 0 ||
                          (r.top >= links[i - 1].bottom - 1 && Math.abs(r.left - links[0].left) < 2));
              }"""))
        check(reference + ' fits the 320px viewport',
              mobile_reference.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        # Test actual keyboard modality: programmatic .focus() after a
        # mouse click need not activate the browser's :focus-visible state.
        menu.locator(':scope > summary').focus()
        mobile_reference.keyboard.press('Tab')
        check(reference + ' retains visible keyboard focus',
              mobile_reference.evaluate("""() => {
                  const a = document.activeElement;
                  return a.matches('#directory-mobile-nav nav a')
                      && a.matches(':focus-visible')
                      && getComputedStyle(a).outlineStyle === 'solid'
                      && parseFloat(getComputedStyle(a).outlineWidth) >= 2;
              }"""))
        mobile_reference.screenshot(path=str(out / ('concept-' + Path(reference).stem + '-mobile.png')), full_page=False)
        menu.locator(':scope > summary').click()
        mobile_reference.set_viewport_size({'width':390, 'height':844})
        check(reference + ' fits the 390px viewport',
              mobile_reference.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        mobile_reference.set_viewport_size({'width':768, 'height':900})
        check(reference + ' has the shared tablet navigation',
              mobile_reference.locator('.site-chrome').is_visible()
              and mobile_reference.locator('.site-chrome__links a').count() == 7)
        mobile_reference.set_viewport_size({'width':1440, 'height':900})
        check(reference + ' preserves desktop wordmark and current-section navigation',
              mobile_reference.locator('.site-chrome__brand').is_visible()
              and mobile_reference.locator('.site-chrome__links a[aria-current="page"]').inner_text() == 'Concept dictionary')
        mobile_reference.screenshot(path=str(out / ('concept-' + Path(reference).stem + '-desktop.png')), full_page=False)
        mobile_reference.close()
    nojs_reference = browser.new_page(viewport={'width':320, 'height':720},
                                      java_script_enabled=False, reduced_motion='reduce')
    nojs_reference.goto(base + 'terms/MLD-0002-ablation-study.html')
    nojs_reference.locator('#directory-mobile-nav > summary').click()
    check('concept detail remains readable and navigable without JavaScript',
          nojs_reference.get_by_role('heading', name='Ablation study').is_visible()
          and nojs_reference.locator('#directory-mobile-nav nav a.site-mobile-chrome__brand').count() == 1
          and nojs_reference.locator('#directory-mobile-nav nav a.site-mobile-chrome__brand').get_attribute('href') == '../index.html#/overview'
          and nojs_reference.locator('#directory-mobile-nav nav > a:not(.site-mobile-chrome__brand)').count() == 7
          and nojs_reference.locator('#directory-mobile-nav nav > a').count() == 8
          and nojs_reference.locator('#directory-mobile-nav nav > a').last.is_visible()
          and nojs_reference.locator('#directory-mobile-nav details.site-mobile-chrome__more > .site-mobile-chrome__more-links > a').count() == 8)
    nojs_reference.close()
    page.goto(base + 'whats-new.html')
    check('daily archive uses the same Atlas logo and quiet wordmark',
          page.locator('nav.site-chrome .site-chrome__name small').inner_text() == 'THE FRONTIER, IN CONTEXT')
    check('daily archive places verified briefing and articles before reporting metrics',
          page.evaluate("""() => {
              const ids = ['edition-status','edition-summary','edition-content','edition-snapshot','edition-metadata'];
              const nodes = ids.map(id => document.getElementById(id));
              return nodes.every((node,i) => node && (!i || (nodes[i-1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)));
          }"""))
    # The first paint must not falsely say there have been no editions while
    # the latest archive index is still being fetched and verified.
    page.wait_for_function("document.getElementById('edition-content').getAttribute('aria-busy') === 'false'", timeout=45000)
    check('daily archive removes its loading placeholder after verification',
          'Checking published editions' not in page.locator('#edition-content').inner_text())
    # The CI host may start in dark mode. Explicitly test both theme variants,
    # then restore the original selection without altering persistent preferences.
    initial_theme = page.locator('html').get_attribute('data-theme')
    page.evaluate("document.documentElement.dataset.theme='light'")
    check('daily archive light palette matches the Atlas workspace',
          page.evaluate("getComputedStyle(document.body).backgroundColor") == 'rgb(246, 246, 242)')
    page.evaluate("document.documentElement.dataset.theme='dark'")
    check('daily archive dark palette matches the Atlas workspace',
          page.evaluate("getComputedStyle(document.body).backgroundColor") == 'rgb(24, 33, 30)')
    page.evaluate("""(theme) => theme === null
        ? document.documentElement.removeAttribute('data-theme')
        : document.documentElement.dataset.theme = theme""", initial_theme)
    # A stale but verified archive edition must not be presented as today's news,
    # visually or to users navigating by screen-reader region labels.
    check('archive heading is truthful for current and historic editions',
          page.get_by_role('heading', name="What's new in AI.", exact=True).is_visible())
    check('summary landmark identifies the selected edition rather than today',
          page.locator('#edition-summary').get_attribute('aria-label') == 'Selected edition summary')
    # Fragment navigation must move keyboard focus past the header, not just scroll.
    # Without tabindex=-1, Chromium leaves focus on BODY after activating Skip.
    page.locator('a.skip').focus()
    page.keyboard.press('Enter')
    check('archive skip link moves keyboard focus into main content',
          page.evaluate("location.hash === '#main' && document.activeElement.id === 'main'"))
    page.keyboard.press('Tab')
    check('Tab after archive skip continues inside main instead of header links',
          page.evaluate("!!document.activeElement.closest('main')"))
    # Keyboard focus on muted archive controls was almost indistinguishable
    # from the control fill (old amber outline < 3:1 in both themes).
    # Test the real computed focus style, not just the presence of :focus-visible.
    focus_outline_contrast = r"""() => {
        const el = document.querySelector('#reset-filters');
        if (document.activeElement !== el || !el.matches(':focus-visible')) return 0;
        const style = getComputedStyle(el);
        if (style.outlineStyle !== 'solid' || parseFloat(style.outlineWidth) < 3) return 0;
        const luminance = css => {
            const values = (css.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
            if (values.length !== 3) return NaN;
            const linear = values.map(x => {
                const c = x / 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
            return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        };
        const a = luminance(style.outlineColor);
        const b = luminance(style.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }"""
    page.locator('#edition-search').focus()
    page.keyboard.press('Tab')
    check('archive reset control focus ring contrasts 3:1 or better in light mode',
          page.evaluate(focus_outline_contrast) >= 3)
    page.emulate_media(color_scheme='dark')
    check('archive reset control focus ring contrasts 3:1 or better in dark mode',
          page.evaluate(focus_outline_contrast) >= 3)
    page.emulate_media(color_scheme='light')
    index = json.loads((ROOT / 'data/daily/index.json').read_bytes())
    if not index['editions']:
        page.wait_for_function("!document.getElementById('edition-status').textContent.includes('Checking')")
        check('daily archive truthfully displays awaiting-first-edition', 'Awaiting' in page.locator('#edition-content').inner_text())
    else:
        # The archive stays disabled while it fetches and hashes edition bytes. The
        # earlier "not Checking" probe raced against the legitimate "Loading" state.
        page.wait_for_function("""() => {
            const select = document.getElementById('edition-select');
            const status = document.getElementById('edition-status').textContent;
            return !select.disabled || /failed|unavailable|cannot display/i.test(status);
        }""", timeout=45000)
        check('search unlocks only after a verified archive edition is displayed',
              page.locator('#edition-search').is_enabled())
        check('daily archive renders its verified edition and permanent link',
              page.locator('#edition-select').is_enabled()
              and page.locator('#edition-permalink-wrap').is_visible()
              and page.locator('#edition-content article.item').count() >= 1)
        check('news stories visually distinguish Why it matters from the summary',
              page.locator('#edition-content article.item .why').count() >= 1)
        # Generic repeated "Original source" links were indistinguishable in
        # screen-reader link navigation. Accessible names must identify each card.
        check('archive record links have meaningful, destination-specific accessible names',
              page.evaluate("""() => {
                  const links = [...document.querySelectorAll('#edition-content article.item .links a')];
                  return links.length > 2 && links.every(a => {
                      const title = a.closest('article.item')?.querySelector('h3')?.textContent;
                      const name = a.getAttribute('aria-label');
                      return !!title && !!name && name.includes(title)
                          && (a.target !== '_blank' || name.includes('opens in new tab'));
                  });
              }"""))
        # The revision diff previously repeated 'Source' and 'Catalog record'
        # for every changed entry; link-list navigation could not distinguish them.
        newest = index['editions'][-1]
        if not any(e['date'] == newest['date'] and e['revision'] < newest['revision']
                   for e in index['editions']):
            check('a first dated revision cannot fabricate previous revision links',
                  page.locator('#revision-history').is_hidden()
                  and page.locator('#revision-history-content .revision-group li a').count() == 0)
        # Verify previous-release comparisons on a real multi-revision date.
        if any(e['date'] == '2026-11-03' and e['revision'] == 6 for e in index['editions']):
            page.goto(base + 'whats-new.html?date=2026-11-03&revision=6')
            page.wait_for_function("!document.getElementById('edition-select').disabled", timeout=45000)
            page.locator('#revision-history-content .revision-group li a').first.wait_for(timeout=45000)
            check('revision comparison links identify changed records in screen-reader link lists',
                  page.evaluate("""() => {
                      const links = [...document.querySelectorAll('#revision-history-content .revision-group li a')];
                      const names = links.map(a => a.getAttribute('aria-label') || '');
                      return links.length >= 2 && names.every((name, i) => {
                          const a = links[i];
                          const title = a.closest('li')?.childNodes[1]?.textContent?.trim();
                          return title && name.includes(title) &&
                              (a.target !== '_blank' || name.includes('opens in new tab'));
                      }) && new Set(names).size === names.length;
                  }"""))
        page.set_viewport_size({'width':320,'height':720})
        check('verified archive fits 320px mobile without horizontal scroll',
              page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        page.set_viewport_size({'width':1440,'height':1000})
        audit = page.locator('#source-coverage .source-audit').inner_text()
        # The coverage disclosure uses a native summary control. Keyboard users
        # need the same clear focus ring as the archive's buttons and selects.
        source_toggle = page.locator('#source-coverage .source-audit summary')
        source_toggle.focus()
        page.keyboard.press('Tab')
        page.keyboard.press('Shift+Tab')
        check('source-coverage summary has a visible keyboard focus ring',
              source_toggle.evaluate("""(el) => document.activeElement === el
                  && el.matches(':focus-visible')
                  && getComputedStyle(el).outlineStyle === 'solid'
                  && Number.parseFloat(getComputedStyle(el).outlineWidth) >= 3"""))
        check('source-coverage focus ring contrasts against the light surface',
              source_toggle.evaluate("(el) => getComputedStyle(el).outlineColor === 'rgb(164, 107, 28)'"))
        page.emulate_media(color_scheme='dark')
        check('source-coverage focus ring stays visible in dark mode',
              source_toggle.evaluate("(el) => getComputedStyle(el).outlineColor === 'rgb(242, 189, 116)'"))
        page.emulate_media(color_scheme='light')
        if any(e['date'] == '2026-11-03' for e in index['editions']):
            check('new November 3 edition discloses exactly three source failures and partial scope',
                  'Source coverage (partial) · 14 checked · 3 failed' in audit
                  and 'Collection context:' in audit
                  and ('Three source fetches failed' in audit or 'three failed lookups' in audit))
            check('new source audit preserves actual failed-source reasons, statuses and checked times',
                  'Checked Nov 3, 2026' in audit
                  and 'Status: open error' in audit and 'Status: cache miss' in audit
                  and 'article open failed' in audit and 'pinned README fetch missed' in audit)
        else:
            check('historical source audit explains partial coverage and both failed lookups',
                  'Collection context:' in audit
                  and 'Direct model metadata API was not available' in audit
                  and 'Previously surfaced press URL returned no page' in audit)
            check('historical source audit distinguishes checked times and failure status',
                  'Checked Nov 2, 2026' in audit
                  and 'Status: inaccessible' in audit and 'Status: not found' in audit)
    if any(e['date'] == '2026-11-03' and e['revision'] == 3 for e in index['editions']):
        # A date-filtered view must retain the SHA-verified edition and preserve
        # publisher dates separately from event, discovery and site-change dates.
        page.goto(base + 'whats-new.html?date=2026-11-03&revision=3&published=catch-up')
        page.wait_for_function("!document.getElementById('edition-select').disabled", timeout=45000)
        check('Nov 3 share link isolates exactly four source-dated catch-up reports',
              page.locator('#publication-filter').input_value() == 'catch-up'
              and page.locator('#edition-content article.item').count() == 4
              and 'published=catch-up' in page.url)
        with page.expect_download() as archived_download:
            page.locator('#export-verified').click()
        with open(archived_download.value.path(), encoding='utf-8-sig', newline='') as downloaded_csv:
            catchup_rows = list(csv.DictReader(downloaded_csv))
        check('catch-up CSV exports only the four visible news records',
              len(catchup_rows) == 4
              and all(row['section'] == 'news' and row['source_publication_date'] < '2026-11-03'
                      for row in catchup_rows))
        page.locator('#publication-filter').select_option('same-day')
        check('source publication date reveals four actual Nov 3 reports',
              page.locator('#edition-content article.item').count() == 4
              and 'published=same-day' in page.url)
        page.locator('#reset-filters').click()
        check('source-date reset returns the entire verified Nov 3 edition',
              page.locator('#publication-filter').input_value() == 'all'
              and page.locator('#edition-content article.item').count() >= 12
              and 'published=' not in page.url)
    page.locator('#section-filter').select_option('news')
    page.locator('#topic-filter').select_option('research')
    check('daily filters remain usable', page.locator('#topic-filter').input_value() == 'research')
    # Exercise the newly shipped search against an immutable, date-pinned edition,
    # not against a possibly newer daily collection.
    if any(e['date'] == '2026-11-02' and e['revision'] == 7 for e in index['editions']):
        page.goto(base + 'whats-new.html?date=2026-11-02&revision=7')
        page.wait_for_function("!document.getElementById('edition-select').disabled", timeout=45000)
        page.locator('#section-filter').select_option('news')
        page.locator('#edition-search').fill('Reuters')
        check('keyword search narrows the verified edition to four Reuters reports',
              page.locator('#edition-content article.item').count() == 4
              and 'Showing 4 of' in page.locator('#filter-results').inner_text())
        page.locator('#reset-filters').click()
        check('keyword search reset restores the reviewed archive and accessible count',
              page.locator('#edition-search').input_value() == ''
              and page.locator('#edition-content article.item').count() >= 9
              and 'Showing ' in page.locator('#filter-results').inner_text())
    if any(e['date'] == '2026-11-02' and e['revision'] == 8 for e in index['editions']):
        # Share links must restore filters only after the immutable file passes
        # size/digest/schema validation; the URL may be shared without JS state.
        page.goto(base + 'whats-new.html?date=2026-11-02&revision=8&section=news&q=Reuters')
        page.wait_for_function("!document.getElementById('edition-select').disabled", timeout=45000)
        check('shared dated edition restores query and collection after integrity validation',
              page.locator('#section-filter').input_value() == 'news'
              and page.locator('#edition-search').input_value() == 'Reuters'
              and page.locator('#edition-content article.item').count() == 4
              and 'revision=8' in page.locator('#edition-permalink').get_attribute('href'))
        page.locator('#topic-filter').select_option('policy')
        check('topic change updates both share permalink and browser address',
              'topic=policy' in page.url
              and 'topic=policy' in page.locator('#edition-permalink').get_attribute('href'))
        page.locator('#reset-filters').click()
        check('reset removes optional filters but preserves verified archive revision',
              'revision=8' in page.url and 'q=' not in page.url and 'topic=' not in page.url
              and page.locator('#section-filter').input_value() == 'all'
              and page.locator('#edition-search').input_value() == '')
        page.locator('#edition-select').select_option('data/daily/editions/2026-11-02-v7.json')
        page.wait_for_function("window.location.search.includes('revision=7')", timeout=45000)
        check('manual revision change replaces URL only after verified selection',
              page.locator('#edition-select').input_value().endswith('-v7.json')
              and 'revision=7' in page.locator('#edition-permalink').get_attribute('href'))
        # A failed manual revision switch previously only reported the error
        # above the controls. On a small screen the picker silently jumped
        # back to the verified revision, with no local explanation.
        page.goto(base + 'whats-new.html?date=2026-11-02&revision=18')
        page.wait_for_function("!document.getElementById('edition-select').disabled", timeout=45000)
        blocked_path = '**/data/daily/editions/2026-11-02-v17.json'
        page.route(blocked_path, lambda route: route.abort())
        archive_picker = page.locator('#edition-select')
        archive_picker.focus()
        archive_picker.select_option('data/daily/editions/2026-11-02-v17.json')
        page.wait_for_function("""() => document.getElementById('edition-content').getAttribute('aria-busy') === 'false'
            && !document.getElementById('edition-selection-error').hidden""", timeout=45000)
        check('failed revision preserves verified articles and keyboard focus while showing a nearby explanation',
              archive_picker.input_value().endswith('-v18.json')
              and 'revision=18' in page.url
              and page.locator('#edition-content article.item').count() > 0
              and 'Still showing the previously verified edition' in page.locator('#edition-selection-error').inner_text()
              and page.evaluate("document.activeElement.id === 'edition-select'"))
        page.unroute(blocked_path)
        archive_picker.select_option('data/daily/editions/2026-11-02-v17.json')
        page.wait_for_function("location.search.includes('revision=17')", timeout=45000)
        check('successful retry clears the previous inline revision failure',
              page.locator('#edition-selection-error').is_hidden()
              and archive_picker.input_value().endswith('-v17.json'))
    # A filter interaction with the previously verified edition can happen while
    # a newly selected revision is still downloading. It must not prematurely
    # clear aria-busy and mislead assistive technology into announcing completion.
    if any(e['date'] == '2026-11-02' and e['revision'] == 17 for e in index['editions']) and any(
            e['date'] == '2026-11-02' and e['revision'] == 18 for e in index['editions']):
        page.goto(base + 'whats-new.html?date=2026-11-02&revision=18')
        page.wait_for_function(
            "location.search.includes('revision=18') && document.getElementById('edition-content').getAttribute('aria-busy') === 'false'",
            timeout=45000)
        page.evaluate("""() => {
            const originalFetch = window.fetch.bind(window);
            window.fetch = (input, options) => {
                if (String(input).includes('2026-11-02-v17.json')) {
                    return new Promise(resolve => {
                        window.__releaseRevisionRequest = () => resolve(originalFetch(input, options));
                    });
                }
                return originalFetch(input, options);
            };
        }""")
        page.locator('#edition-select').select_option('data/daily/editions/2026-11-02-v17.json')
        page.wait_for_function("typeof window.__releaseRevisionRequest === 'function'")
        check('archive announces revision verification in progress',
              page.locator('#edition-content').get_attribute('aria-busy') == 'true')
        page.locator('#edition-search').fill('Reuters')
        check('filtering the previous edition does not end pending revision loading state',
              page.locator('#edition-content').get_attribute('aria-busy') == 'true'
              and 'revision=18' in page.url)
        page.evaluate("window.__releaseRevisionRequest()")
        page.wait_for_function(
            "location.search.includes('revision=17') && document.getElementById('edition-content').getAttribute('aria-busy') === 'false'",
            timeout=45000)
        check('verified revision completes and clears loading state',
              page.locator('#edition-select').input_value().endswith('-v17.json'))
    # Exercise actual browser downloads from a pinned, SHA-checked archive revision.
    # The test never assumes tomorrow's collection exists or updates these records.
    if any(e['date'] == '2026-11-02' and e['revision'] == 18 for e in index['editions']):
        page.goto(base + 'whats-new.html?date=2026-11-02&revision=18&section=news&q=Reuters')
        page.wait_for_function("!document.getElementById('export-verified').disabled", timeout=45000)
        visible_titles = page.locator('#edition-content article.item h3').all_inner_texts()
        check('pinned verified edition restores the four Reuters news matches',
              len(visible_titles) == 4
              and page.locator('#edition-search').input_value() == 'Reuters'
              and page.locator('#section-filter').input_value() == 'news')
        # Exactly reported review statuses, never guessed confidence buckets.
        review_options = page.locator('#evidence-filter option').all_text_contents()
        check('evidence label control populated only from verified edition records',
              len(review_options) > 1 and review_options[0] == 'All review labels')
        first_review = page.locator('#edition-content article.item .tags .tag').first.inner_text()
        page.locator('#evidence-filter').select_option(first_review)
        check('review label narrows news and updates shareable research URL',
              0 < page.locator('#edition-content article.item').count() <= 4
              and all(x == first_review for x in
                      page.locator('#edition-content article.item > .tags:first-child > .tag:first-child').all_inner_texts())
              and 'review=' in page.url)
        share_url = page.url
        page.goto(share_url)
        page.wait_for_function("!document.getElementById('export-verified').disabled", timeout=45000)
        check('review label restores from URL only after verified archive read',
              page.locator('#evidence-filter').input_value() == first_review)
        with page.expect_download() as review_download:
            page.locator('#export-verified').click()
        review_path = out / 'review-label-evidence.csv'
        review_download.value.save_as(review_path)
        filtered_rows = list(csv.DictReader(io.StringIO(review_path.read_text(encoding='utf-8-sig'))))
        check('download preserves exactly the visible review-label subset',
              len(filtered_rows) == page.locator('#edition-content article.item').count()
              and all(row['review_status'] == first_review for row in filtered_rows))
        review_path.unlink()
        page.locator('#evidence-filter').select_option('all')
        source_options = page.locator('#source-filter option').all_text_contents()
        check('source domains are populated from reviewed source URLs',
              'www.reuters.com' in source_options and source_options[0] == 'All sources')
        page.locator('#source-filter').select_option('www.reuters.com')
        check('exact source URL filter limits Reuters reports and updates share link',
              page.locator('#edition-content article.item').count() == 4
              and 'source=www.reuters.com' in page.url)
        page.goto(page.url)
        page.wait_for_function("!document.getElementById('export-verified').disabled", timeout=45000)
        check('source domain restores after dated SHA-verified permalink',
              page.locator('#source-filter').input_value() == 'www.reuters.com'
              and page.locator('#edition-content article.item').count() == 4)
        with page.expect_download() as source_download:
            page.locator('#export-verified').click()
        source_path = out / 'source-domain-evidence.csv'
        source_download.value.save_as(source_path)
        domain_rows = list(csv.DictReader(io.StringIO(source_path.read_text(encoding='utf-8-sig'))))
        check('browser CSV includes exactly the filtered citation host records',
              len(domain_rows) == 4
              and all(row['source_url'].startswith('https://www.reuters.com/') for row in domain_rows))
        source_path.unlink()
        page.locator('#source-filter').select_option('all')
        with page.expect_download() as received:
            page.locator('#export-verified').click()
        download = received.value
        check('verified CSV filename includes exact edition and revision',
              download.suggested_filename == 'ai-updates-2026-11-02-v18-evidence.csv')
        saved = out / 'verified-evidence.csv'
        download.save_as(saved)
        raw = saved.read_bytes()
        records = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
        check('download bytes include four visible filtered headlines and correct provenance',
              raw.startswith(bytes([239, 187, 191])) and bytes([13, 10]) in raw
              and len(records) == 4
              and set(row['title'] for row in records) == set(visible_titles)
              and all(row['edition_date'] == '2026-11-02' and row['revision'] == '18'
                      and row['section'] == 'news' and row['collection_status'] == 'partial'
                      for row in records))
        check('actual CSV retains original URLs, evidence labels and distinct date columns',
              all(row['source_url'].startswith('https://')
                  and row['review_status'] and row['source_publication_date']
                  and row['discovered_at'] and row['record_id']
                  for row in records)
              and {'event_date','added_to_atlas_at','caveat','atlas_page'} <= set(records[0]))
        saved.unlink()
        # Export must reflect changed filters, not just the initially downloaded rows.
        page.locator('#section-filter').select_option('site_changes')
        page.locator('#edition-search').fill('CSV')
        expected = page.locator('#edition-content article.item h3').all_inner_texts()
        check('site-change filter finds only the Atlas CSV improvement',
              len(expected) == 1 and 'CSV' in expected[0])
        with page.expect_download() as received:
            page.locator('#export-verified').click()
        received.value.save_as(saved)
        changes = list(csv.DictReader(io.StringIO(saved.read_text(encoding='utf-8-sig'))))
        check('second browser download honors amended filters rather than exporting news',
              len(changes) == 1 and changes[0]['section'] == 'site_changes'
              and changes[0]['title'] == expected[0]
              and changes[0]['record_id'] == 'site-verified-evidence-csv-export-20261103')
        saved.unlink()
    page.goto(base + 'index.html#/sources')
    link = page.locator('[data-original-file="ML_DL_SLM_LLM_Dictionary.xlsx"]')
    link.wait_for()
    with page.expect_download() as received:
        link.click()
    saved = out / 'dictionary.xlsx'
    received.value.save_as(saved)
    check('actual workbook download matches source bytes', hashlib.sha256(saved.read_bytes()).digest() == hashlib.sha256((ROOT / 'downloads/ML_DL_SLM_LLM_Dictionary.xlsx').read_bytes()).digest())
    saved.unlink()
    # Six archive filters used to stack into a long single column even on
    # 768px tablets. Keep a compact two-column layout there, but preserve
    # comfortable one-column controls on narrow phones.
    filter_columns = """() => getComputedStyle(
        document.querySelector('.controls')
    ).gridTemplateColumns.trim().split(' ').length"""
    page.set_viewport_size({'width':768,'height':1024})
    page.goto(base + 'whats-new.html')
    page.locator('#edition-search').wait_for()
    check('768px archive filters form two legible columns without horizontal scrolling',
          page.evaluate(filter_columns) == 2
          and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.screenshot(path=str(out / 'daily-tablet-768.png'), full_page=True)
    page.set_viewport_size({'width':560,'height':840})
    check('560px archive filters return to one column without horizontal scrolling',
          page.evaluate(filter_columns) == 1
          and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    # iOS Safari zooms the viewport when focusing form controls below 16px.
    # Check real computed styles and tap heights at both compact-phone widths.
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base + 'whats-new.html')
    page.locator('#edition-search').wait_for()
    # The archive date picker and live edition search remain visible on phones,
    # while advanced filters use one native keyboard-operable disclosure.
    if index['editions']:
        page.locator('#edition-content article.item').first.wait_for(timeout=45000)
        compact_panel = page.locator('main > .panel').bounding_box()
        check('390px daily stories are reachable without stacked advanced controls',
              not page.locator('#edition-refine').evaluate('(el) => el.open')
              and page.locator('#edition-select').is_visible()
              and page.locator('#edition-search').is_visible()
              and page.locator('#edition-content article.item').first.is_visible())
    page.screenshot(path=str(out / 'daily-mobile-390-compact.png'), full_page=True)
    page.locator('#edition-refine > summary').click()
    check('390px native disclosure reveals real archive filters and export',
          page.locator('#edition-refine').evaluate('(el) => el.open')
          and page.locator('#topic-filter').is_visible()
          and page.locator('#export-verified').is_visible())
    expanded_panel = page.locator('main > .panel').bounding_box()
    check('390px news disclosure saves substantial vertical space before opening',
          compact_panel is not None and expanded_panel is not None
          and expanded_panel['height'] - compact_panel['height'] >= 120)
    mobile_readability_check = """() => [
        '#edition-select', '#section-filter', '#topic-filter',
        '#publication-filter', '#evidence-filter', '#source-filter',
        '#edition-search', '#reset-filters', '#export-verified'
    ].every(selector => {
        const element = document.querySelector(selector);
        return element &&
            Number.parseFloat(getComputedStyle(element).fontSize) >= 16 &&
            element.getBoundingClientRect().height >= 44;
    })"""
    # The archive now follows Discover's compact mobile shell. Check both
    # always-visible controls and all links revealed by its native menu.
    mobile_nav_targets = """() => {
        const menu = document.querySelector('#archive-mobile-nav');
        const toggle = document.querySelector('.archive-menu-toggle');
        const search = document.querySelector('.archive-search-link');
        if (!menu || !toggle || !search) return false;
        const wasOpen = menu.open;
        menu.open = true;
        const links = [...menu.querySelectorAll('.archive-menu-panel > a')];
        const valid = links.length >= 5 && [toggle, search, ...links].every(el => {
            const rect = el.getBoundingClientRect();
            return rect.height >= 44 && rect.width >= 44;
        });
        menu.open = wasOpen;
        return valid;
    }"""
    check('390px archive mobile menu and search have 44px touch targets', page.evaluate(mobile_nav_targets))
    # Long, unbroken metadata tags previously pushed the archive 249px wider
    # than a 390px screen. Assert they wrap inside the existing cards.
    if index['editions']:
        page.locator('#edition-content article.item').first.wait_for(timeout=45000)
    tag_containment = """() => {
        const tags = [...document.querySelectorAll('#edition-content .item .tag')];
        return tags.length > 0 && tags.every(tag => {
            const rect = tag.getBoundingClientRect();
            const card = tag.closest('.item').getBoundingClientRect();
            return rect.left >= card.left - 1 && rect.right <= card.right + 1;
        });
    }"""
    if index['editions']:
        check('390px archive metadata tags wrap within their cards', page.evaluate(tag_containment))
    check('390px archive header fits without horizontal scrolling',
          page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    check('390px daily filters and search use legible, touch-friendly sizing', page.evaluate(mobile_readability_check))
    if index['editions']:
        source_toggle_mobile = page.locator('#source-coverage .source-audit summary')
        source_toggle_mobile.wait_for(timeout=45000)
        check('390px source-coverage summary is an accessible touch target',
              source_toggle_mobile.evaluate("(el) => el.getBoundingClientRect().height >= 44"))
    page.set_viewport_size({'width':320,'height':700})
    check('320px archive mobile menu and search have 44px touch targets', page.evaluate(mobile_nav_targets))
    if index['editions']:
        check('320px archive metadata tags wrap within their cards', page.evaluate(tag_containment))
    check('320px archive header fits without horizontal scrolling',
          page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    check('320px daily filters and search avoid iOS focus zoom', page.evaluate(mobile_readability_check))
    if index['editions']:
        source_toggle_mobile.wait_for(timeout=45000)
        check('320px source-coverage summary is an accessible touch target',
              source_toggle_mobile.evaluate("(el) => el.getBoundingClientRect().height >= 44"))
    # The expanded disclosure stays operable after resizing instead of hiding
    # keyboard focus in a removed or decorative control.
    check('320px advanced edition filters remain keyboard-accessible',
          page.locator('#edition-refine').evaluate('(el) => el.open')
          and page.locator('#section-filter').is_visible()
          and page.locator('#edition-refine > summary').evaluate(
              '(el) => el.getBoundingClientRect().height >= 44'))
    # Tapping Reset on a phone used to refocus Search, opening the software
    # keyboard again and obscuring the just-restored archive results.
    if index['editions']:
        page.locator('#edition-search').fill('unlikely-no-match-qa-query-zzzz')
        check('320px archive search can show an honest empty state',
              page.locator('#edition-content .empty').count() > 0)
        page.locator('#reset-filters').click()
        check('320px reset restores results without reopening mobile search keyboard',
              page.evaluate("""() => document.querySelector('#edition-search').value === ''
                  && document.activeElement.id !== 'edition-search'
                  && ['section-filter','topic-filter','publication-filter','evidence-filter','source-filter']
                     .every(id => document.getElementById(id).value === 'all')
                  && document.querySelectorAll('#edition-content article.item').length > 0"""))
    page.screenshot(path=str(out / 'daily-mobile-320.png'), full_page=True)
    # Reference documents have no JS theme switcher. Dark OS settings must
    # therefore yield readable article surfaces, not pale boxes with light text.
    page.emulate_media(color_scheme='dark')
    for reference_path in ('terms/MLD-0002-ablation-study.html',
                           'technology/TECH-0216-pytorch.html'):
        page.goto(base + reference_path)
        check('OS dark theme reaches script-free reference ' + reference_path,
              page.evaluate("""() => {
                  const root = getComputedStyle(document.documentElement);
                  const notice = getComputedStyle(document.querySelector('.term-shell .notice'));
                  return root.colorScheme === 'dark'
                      && root.backgroundColor === 'rgb(24, 33, 30)'
                      && notice.backgroundColor === 'rgb(45, 64, 51)'
                      && document.documentElement.scrollWidth <= innerWidth + 1;
              }"""))
    page.goto(base + 'terms/MLD-0002-ablation-study.html')
    check('dark concept cards, caveats and links avoid light-only colors',
          page.evaluate("""() => {
              const card = getComputedStyle(document.querySelector('.term-shell .detail-block'));
              const caveat = getComputedStyle(document.querySelector('.term-shell .detail-block.caveat'));
              const link = getComputedStyle(document.querySelector('.term-shell .detail-block a'));
              return card.backgroundColor === 'rgb(34, 45, 39)'
                  && caveat.backgroundColor === 'rgb(45, 64, 51)'
                  && link.color === 'rgb(177, 213, 189)';
          }"""))
    page.emulate_media(color_scheme='light')
    page.reload()
    check('light OS preference restores original paper and white reference cards',
          page.evaluate("""() => getComputedStyle(document.documentElement).backgroundColor === 'rgb(246, 246, 242)'
              && getComputedStyle(document.querySelector('.term-shell .detail-block')).backgroundColor === 'rgb(255, 255, 255)'"""))
    # The workspace theme toggle persists in atlas.theme. Switching to the
    # standalone archive must not silently revert to OS colors.
    # The workspace theme button belongs to the desktop sidebar.
    page.set_viewport_size({'width':1440,'height':900})
    page.goto(base + 'index.html#/overview')
    page.locator('#catalog-loading').wait_for(state='detached')
    page.get_by_role('button', name='Toggle color theme', exact=True).click()
    check('workspace dark theme choice persists to local storage',
          page.evaluate("localStorage.getItem('atlas.theme') === 'dark'"))
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base + 'whats-new.html')
    check('archive retains the selected dark palette despite light OS mode',
          page.evaluate("""() => document.documentElement.dataset.theme === 'dark'
              && getComputedStyle(document.documentElement).colorScheme === 'dark'
              && getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)'"""))
    page.emulate_media(color_scheme='dark')
    page.set_viewport_size({'width':1440,'height':900})
    page.goto(base + 'index.html#/overview')
    page.locator('#catalog-loading').wait_for(state='detached')
    page.get_by_role('button', name='Toggle color theme', exact=True).click()
    check('workspace light theme choice persists to local storage',
          page.evaluate("localStorage.getItem('atlas.theme') === 'light'"))
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base + 'whats-new.html')
    check('archive retains explicitly selected light palette despite dark OS mode',
          page.evaluate("""() => document.documentElement.dataset.theme === 'light'
              && getComputedStyle(document.documentElement).colorScheme === 'light'
              && getComputedStyle(document.body).backgroundColor !== 'rgb(34, 45, 39)'"""))
    page.emulate_media(color_scheme='light')
    # Discover and standalone pages now share a fixed left rail on tablets as
    # well as desktop, while retaining the native mobile menu below 651px.
    for theme in ('light', 'dark'):
        page.evaluate("(chosen) => localStorage.setItem('atlas.theme', chosen)", theme)
        for width in (651, 768, 1175, 1280):
            page.set_viewport_size({'width':width, 'height':900})
            page.goto(base + 'index.html#/overview')
            page.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
            reference_rail_width = page.locator('#sidebar').evaluate('el => el.getBoundingClientRect().width')
            check(f'Discover has canonical desktop rail width at {width}px in {theme}',
                  abs(reference_rail_width - (215 if width <= 1200 else 242)) <= 1)
            # The former 1151–1200px breakpoint disagreement and wrapping
            # catalog-count rows made the primary rail jump between pages.
            rail_row_metrics = """selector => [...document.querySelectorAll(selector)].map(a => {
                const s = getComputedStyle(a);
                return [s.fontSize, s.lineHeight, s.gap, s.padding, a.offsetHeight];
            })"""
            discover_rows = page.evaluate(rail_row_metrics, '#navigation > .site-chrome__links > a.nav-link')
            check(f'Discover primary rail has seven uniform readable rows at {width}px in {theme}',
                  len(discover_rows) == 7 and all(row[-1] == 44 for row in discover_rows))
            for route in ('about.html', 'technologies.html', 'playbooks.html', 'research.html'):
                page.goto(base + route)
                check(f'{route} primary rail matches Discover row rhythm at {width}px in {theme}',
                      page.evaluate(rail_row_metrics, 'nav.site-chrome .site-chrome__links > a') == discover_rows)
                if theme == 'light' and width == 651 and route == 'about.html':
                    print('TABLET NAV DIAGNOSTICS', page.evaluate("""() => {
                        const nav=document.querySelector('.site-chrome');
                        const links=[...nav.querySelectorAll('.site-chrome__links a')];
                        return {height:nav.getBoundingClientRect().height,
                            direction:getComputedStyle(nav).flexDirection,
                            display:getComputedStyle(nav).display,
                            tops:links.map(x=>Math.round(x.getBoundingClientRect().top)),
                            heights:links.map(x=>x.getBoundingClientRect().height),
                            overflow:document.documentElement.scrollWidth-innerWidth,
                            width:nav.getBoundingClientRect().width,
                            linkWidth:nav.querySelector('.site-chrome__links').getBoundingClientRect().width};
                    }"""), flush=True)
                check(f'shared {theme} rail wordmark fits at {width}px on {route}',
                      page.evaluate("""() => {
                          const nav=document.querySelector('.site-chrome');
                          const text=nav.querySelector('.site-chrome__name');
                          const tagline=text.querySelector('small');
                          return text.getBoundingClientRect().right <= nav.getBoundingClientRect().right - 4
                              && tagline.scrollWidth <= tagline.clientWidth + 1;
                      }"""))
                check(f'shared {theme} navigation has no orphan link at {width}px on {route}',
                      page.evaluate("""(referenceWidth) => {
                          const nav = document.querySelector('.site-chrome');
                          if (!nav) return false;
                          const links = [...nav.querySelectorAll('.site-chrome__links a')];
                          const tops = links.map(el => Math.round(el.getBoundingClientRect().top));
                          const sidebar = innerWidth >= 651;
                          const rect = nav.getBoundingClientRect();
                          if (sidebar) {
                              const main=document.querySelector('main');
                              return getComputedStyle(nav).position === 'fixed'
                                  && getComputedStyle(nav).flexDirection === 'column'
                                  && rect.left === 0 && Math.abs(rect.width - referenceWidth) <= 1
                                  && !!main && main.getBoundingClientRect().left >= referenceWidth - 1
                                  && (location.pathname.endsWith('/about.html')
                                      ? (nav.parentElement === document.body && !main.contains(nav))
                                      : location.pathname.endsWith('/research.html')
                                      ? (nav.parentElement === document.querySelector('.shell')
                                         && main.parentElement === nav.parentElement && !main.contains(nav))
                                      : (nav.parentElement === main.parentElement && !main.contains(nav)))
                                  && getComputedStyle(nav.querySelector('.site-chrome__links')).flexDirection === 'column'
                                  && links.length === 7
                                  && Math.max(...tops) - Math.min(...tops) > 200
                                  && links.every(el => el.getBoundingClientRect().height >= 44)
                                  && document.documentElement.scrollWidth <= innerWidth + 1;
                          }
                          return getComputedStyle(nav).display !== 'none'
                              && getComputedStyle(nav).flexDirection === (innerWidth <= 850 ? 'column' : 'row')
                              && rect.height <= (innerWidth <= 850 ? 140 : 100)
                              && links.length === 7
                              && Math.max(...tops) - Math.min(...tops) <= 2
                              && links.every(el => el.getBoundingClientRect().height >= 44)
                              && document.documentElement.scrollWidth <= innerWidth + 1;
                      }""", reference_rail_width))
    # The real News/Research/Playbooks tablet title must remain readable while
    # preserving Discover's functional native search, not a decorative field.
    for scheme in ('light', 'dark'):
        page.evaluate("(chosen) => localStorage.setItem('atlas.theme', chosen)", scheme)
        for tablet_width in (651, 768):
            page.set_viewport_size({'width':tablet_width, 'height':900})
            for native_route in ('whats-new.html', 'research.html', 'playbooks.html'):
                page.goto(base + native_route)
                check(f'{native_route} {tablet_width}px {scheme} shows entire workspace title beside live search',
                      page.evaluate("""() => {
                          const chrome=document.querySelector('.site-mobile-chrome');
                          const title=chrome?.querySelector(':scope > .site-mobile-chrome__title');
                          const search=chrome?.querySelector('form.site-mobile-chrome__search-form');
                          return !!title && title.getClientRects().length > 0
                              && title.scrollWidth <= title.clientWidth + 1
                              && !!search && search.getClientRects().length > 0
                              && search.getBoundingClientRect().width >= 130
                              && !!search.querySelector('input[type="search"]')
                              && document.documentElement.scrollWidth <= innerWidth + 1;
                      }"""))

    page.evaluate("localStorage.setItem('atlas.theme', 'light')")
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base + 'index.html#/games')
    page.locator('#start-quiz').wait_for()
    check('mobile Games route fits original workspace', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.locator('#discover-mobile-nav > summary').click()
    page.locator('#discover-mobile-nav .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)[href="#/overview"]').click()
    page.wait_for_function("location.hash === '#/overview' && !document.getElementById('discover-mobile-nav').open")
    check('mobile drawer navigates and closes', page.locator('#daily-panel-title').is_visible())

    # The two large generated directories previously looked like separate
    # sites with inconsistent five/six-link navigation. Compare their shared
    # header with Discover's editorial navigation at mobile and desktop sizes.
    for route, selected in (('terms/index.html', 'Concept encyclopedia'),
                            ('about.html', 'About'),
                            ('technology/index.html', 'Technology profiles'),
                            ('technology/TECH-0216-pytorch.html', 'Technology profiles')):
        for width in (320, 390, 768, 1280):
            page.set_viewport_size({'width': width, 'height': 844})
            page.goto(base + route)
            if route in ('terms/index.html', 'about.html', 'technology/index.html'):
                check(f'{route} separates navigation from main landmark at {width}px',
                      page.evaluate("""() => {
                          const main=document.querySelector('main.term-shell');
                          const desktop=document.querySelector('nav.site-chrome.term-nav');
                          const mobile=document.querySelector('.directory-mobile-topbar.site-mobile-chrome');
                          return !!main && !!desktop && !!mobile
                            && !main.contains(desktop) && !main.contains(mobile)
                            && !!main.querySelector('header.hero#main')
                            && document.querySelectorAll('main').length === 1;
                      }"""))
            check(f'{route} has seven shared navigation links without overflow at {width}px',
                  page.evaluate("""() => {
                      const nav=document.querySelector(innerWidth <= 650
                          ? '.site-mobile-chrome__menu' : '.site-chrome__links');
                      return !!nav && nav.querySelectorAll(innerWidth <= 650 ? ':scope > a:not(.site-mobile-chrome__brand)' : 'a:not(.site-mobile-chrome__brand)').length === 7
                          && (innerWidth > 650 || nav.querySelectorAll('a.site-mobile-chrome__brand').length === 1)
                          && document.documentElement.scrollWidth <= innerWidth + 1;
                  }"""))
            if width <= 650:
                page.locator('#directory-mobile-nav > summary').click()
                active = page.locator('.site-mobile-chrome__menu a[aria-current]')
                check(f'{route} exposes one selected mobile section at {width}px',
                      active.count() == 1 and active.inner_text() == selected)
            else:
                active = page.locator('.site-chrome a[aria-current]')
                check(f'{route} keeps one active desktop destination at {width}px',
                      active.count() == 1 and active.inner_text() == selected)
    # Compare the anchored desktop frame with Discover while checking the
    # same page families at mobile/tablet widths in both saved themes.
    page.set_viewport_size({'width': 1280, 'height': 900})
    page.goto(base + 'index.html#/overview')
    check('Discover anchors the baseline 242px desktop sidebar',
          page.evaluate("""() => {
              const rect = document.querySelector('#sidebar').getBoundingClientRect();
              return rect.left === 0 && Math.abs(rect.width - 242) <= 1;
          }"""))
    # Regression: navigating between Discover and a standalone article must not
    # shift the rail's wordmark, first link, active surface or drawer width.
    # Inspect real computed styles, not only the shared CSS source.
    for theme in ('light', 'dark'):
        page.evaluate("(chosen) => localStorage.setItem('atlas.theme', chosen)", theme)
        for width in (320, 390, 768, 1280):
            page.set_viewport_size({'width':width, 'height':900})
            page.goto(base + 'index.html#/overview')
            page.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
            if width <= 650:
                page.locator('#discover-mobile-nav > summary').click()
                baseline = page.locator('#discover-mobile-nav .site-mobile-chrome__menu').evaluate('el => el.getBoundingClientRect().width')
            else:
                baseline = page.evaluate("""() => {
                    const link = document.querySelector('#navigation > .site-chrome__links > a.nav-link');
                    return {
                        width:document.querySelector('#sidebar').getBoundingClientRect().width,
                        firstTop:link.getBoundingClientRect().top,
                        linkFont:getComputedStyle(link).fontSize,
                        brandFont:getComputedStyle(document.querySelector('.brand')).fontSize,
                        activeBg:getComputedStyle(link).backgroundColor
                    };
                }""")
            page.goto(base + 'about.html')
            if width <= 650:
                page.locator('.site-mobile-chrome__toggle').click()
                check(f'{theme} {width}px shared drawer has Discover width',
                      abs(page.locator('.site-mobile-chrome__menu').evaluate(
                          'el => el.getBoundingClientRect().width') - baseline) <= 1)
            else:
                if width == 1280 and theme == 'light':
                    print('RAIL FRAME DIAGNOSTICS', page.evaluate("""(expected) => {
                        const rail=document.querySelector('.site-chrome');
                        const first=rail.querySelector('.site-chrome__links a');
                        const active=rail.querySelector('[aria-current]');
                        return {expected,actual:{
                            width:rail.getBoundingClientRect().width,
                            firstTop:first.getBoundingClientRect().top,
                            linkFont:getComputedStyle(first).fontSize,
                            brandFont:getComputedStyle(rail.querySelector('.site-chrome__name')).fontSize,
                            activeBg:getComputedStyle(active).backgroundColor,
                            overflow:document.documentElement.scrollWidth-innerWidth
                        }};
                    }""", baseline), flush=True)
                check(f'{theme} {width}px shared rail matches Discover geometry and type',
                      page.evaluate("""(expected) => {
                          const rail=document.querySelector('.site-chrome');
                          const first=rail.querySelector('.site-chrome__links a');
                          const active=rail.querySelector('[aria-current]');
                          return Math.abs(rail.getBoundingClientRect().width-expected.width)<=1
                              && Math.abs(first.getBoundingClientRect().top-expected.firstTop)<=12
                              && getComputedStyle(first).fontSize===expected.linkFont
                              && getComputedStyle(rail.querySelector('.site-chrome__name')).fontSize===expected.brandFont
                              && getComputedStyle(active).backgroundColor===expected.activeBg
                              && document.documentElement.scrollWidth<=innerWidth+1;
                      }""", baseline))
    for theme in ('light', 'dark'):
        page.evaluate("(chosen) => localStorage.setItem('atlas.theme', chosen)", theme)
        for width in (320, 390, 768, 1080, 1280):
            page.set_viewport_size({'width': width, 'height': 900})
            for route in ('about.html', 'terms/index.html',
                          'technology/TECH-0216-pytorch.html', 'playbooks.html',
                           'whats-new.html', 'research.html', 'catalog-review.html',
                           'hardware-review.html', 'games.html'):
                page.goto(base + route)
                check(f'{route} retains saved {theme} mode at {width}px',
                      page.evaluate("(chosen) => document.documentElement.dataset.theme === chosen", theme))
                check(f'{route} uses one responsive navigation system at {width}px',
                      page.evaluate("""() => {
                          const large = innerWidth >= 651;
                          const mobile = innerWidth <= 650;
                          const nav = document.querySelector(mobile
                              ? '.site-mobile-chrome__nav' : '.site-chrome');
                          if (!nav) return false;
                          const links = nav.querySelectorAll(mobile
                              ? '.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)' : '.site-chrome__links a');
                          const computed = getComputedStyle(nav);
                          const rect = nav.getBoundingClientRect();
                          return links.length === 7
                              && document.documentElement.scrollWidth <= innerWidth + 1
                              && (mobile ? computed.display !== 'none'
                                  : large ? computed.position === 'fixed'
                                      && computed.flexDirection === 'column'
                                      && Math.abs(rect.width - (innerWidth <= 1200 ? 215 : 242)) <= 1
                                      && rect.left === 0
                                      : computed.position !== 'fixed');
                      }"""))
                if width == 1280 and route in ('about.html', 'terms/index.html',
                                                   'whats-new.html', 'research.html',
                                                   'hardware-review.html', 'games.html'):
                    page.screenshot(path=str(out / f'shared-rail-{theme}-{route.replace("/", "-")}.png'),
                                    full_page=False)
    # A hovered link is not another selected section. Compare the real pointer
    # state against the current link across Discover and native page families,
    # in both themes at tablet and desktop widths. Mobile has no visible rail.
    for theme in ('light', 'dark'):
        for width in (768, 1280):
            page.set_viewport_size({'width': width, 'height': 900})
            for route in ('index.html#/overview', 'whats-new.html', 'research.html'):
                page.goto(base + route)
                page.evaluate("(value) => localStorage.setItem('atlas.theme', value)", theme)
                page.reload()
                if route.startswith('index.html'):
                    root = '#navigation'
                    hovered = page.locator('#navigation a[href="#/games"]')
                else:
                    root = '.site-chrome'
                    hovered = page.locator('.site-chrome__links a[href="index.html#/games"]')
                hovered.hover()
                check('hover never impersonates active section ' + route + ' ' + theme + ' ' + str(width),
                      page.evaluate("""(rootSelector) => {
                          const root = document.querySelector(rootSelector);
                          const hovered = [...root.querySelectorAll('a')].find(
                              a => a.matches(':hover') && /#\/games$/.test(a.getAttribute('href') || ''));
                          const active = root.querySelector('a[aria-current]');
                          if (!hovered || !active || hovered === active) return false;
                          const hoverStyle = getComputedStyle(hovered);
                          const activeStyle = getComputedStyle(active);
                          const hoverTransparent = hoverStyle.backgroundColor === 'rgba(0, 0, 0, 0)';
                          const marked = hoverStyle.textDecorationLine.includes('underline');
                          return hoverTransparent && marked
                              && activeStyle.backgroundColor !== hoverStyle.backgroundColor;
                      }""", root))
                if width == 1280:
                    page.screenshot(path=str(out / ('rail-hover-distinction-' +
                        route.split('.')[0].replace('/', '-') + '-' + theme + '.png')),
                        full_page=False)

    # Exercise a real Discover -> archive -> About transition at tablet size.
    # Match rail geometry and theme across page families, not only on reload.
    for theme in ('light', 'dark'):
        page.set_viewport_size({'width': 768, 'height': 900})
        page.goto(base + 'index.html#/overview')
        page.evaluate("(value) => localStorage.setItem('atlas.theme', value)", theme)
        discover_width = page.locator('#sidebar').evaluate('el => el.getBoundingClientRect().width')
        page.locator('#navigation a[href="whats-new.html"]').click()
        page.wait_for_url('**/whats-new.html')
        for route in ('whats-new.html', 'about.html'):
            check(f'tablet {theme} retains Discover rail on {route}',
                  page.evaluate("""(expected) => {
                      const nav = document.querySelector('.site-chrome');
                      const r = nav.getBoundingClientRect();
                      return getComputedStyle(nav).position === 'fixed'
                          && Math.abs(r.width - expected) <= 1 && r.left === 0
                          && document.documentElement.scrollWidth <= innerWidth + 1;
                  }""", discover_width))
            check(f'tablet {theme} persists theme across navigation to {route}',
                  page.evaluate("(value) => document.documentElement.dataset.theme === value", theme))
            page.screenshot(path=str(out / f'tablet-rail-{theme}-{route}.png'), full_page=False)
            if route == 'whats-new.html':
                page.locator('.site-chrome__links a[href="about.html"]').click()
                page.wait_for_url('**/about.html')

    # Cross the former horizontal-to-sidebar boundary through real navigation.
    page.set_viewport_size({'width': 1280, 'height': 900})
    page.goto(base + 'whats-new.html')
    page.locator('.site-chrome__links a[href="about.html"]').click()
    page.wait_for_url('**/about.html')
    check('archive to About retains the shared fixed sidebar',
          page.url.endswith('/about.html') and page.evaluate("""() => {
              const nav = document.querySelector('.site-chrome');
              return nav && nav.getBoundingClientRect().left === 0
                  && getComputedStyle(nav).position === 'fixed';
          }"""))
    page.goto(base + 'terms/index.html')
    page.locator('.site-chrome__links a[href="../playbooks.html"]').click()
    check('shared sidebar preserves cross-page Playbooks navigation',
          page.url.split('?')[0].endswith('/playbooks.html'))
    page.locator('.site-chrome__links a[href="about.html"]').click()
    check('sidebar navigation continues across standalone page templates',
          page.url.split('?')[0].endswith('/about.html'))
    page.locator('.site-chrome__links a[href="index.html#/dictionary"]').click()
    check('shared sidebar preserves the existing dictionary hash route',
          page.url.endswith('/index.html#/dictionary'))
    page.locator('#catalog-loading').wait_for(state='detached')

    # The shared desktop topbar used to have no title until DOMContentLoaded:
    # when JS was blocked, every editorial and reference family showed a blank bar.
    # Suppress only the enhancer to inspect CSS first paint with real Chromium.
    first_paint = browser.new_page(viewport={'width':1280, 'height':900}, reduced_motion='reduce')
    first_paint.route('**/site-theme.js',
                      lambda route: route.fulfill(status=200, content_type='application/javascript',
                                                   body='/* intentionally suppressed for first-paint QA */'))
    for route, expected, from_selected_link in (
        ('whats-new.html', 'What’s New Today', False),
        ('about.html', 'About', False),
        ('terms/index.html', 'Concept encyclopedia', False),
        ('terms/MLD-1179-structured-output.html', 'Structured output', False),
        ('technology/TECH-0216-pytorch.html', 'PyTorch', False),
    ):
        first_paint.goto(base + route)
        check('unenhanced shared topbar has its expected visible title on ' + route,
              first_paint.locator('.site-mobile-chrome').is_visible()
              and first_paint.locator('.site-mobile-chrome').evaluate('''(el, data) => {
                  const {expected, fromSelectedLink} = data;
                  const title = getComputedStyle(el, '::before');
                  const realTitle = el.querySelector(':scope > .site-mobile-chrome__title');
                  const active = el.parentElement?.querySelector(
                      '.site-chrome__links a[aria-current="page"]');
                  const sourceMatches = fromSelectedLink
                      ? (!el.hasAttribute('data-page-label') &&
                         active?.textContent.trim() === expected)
                      : el.getAttribute('data-page-label') === expected;
                  const visualMatches = realTitle
                      ? (realTitle.textContent.trim() === expected &&
                         getComputedStyle(realTitle).display !== 'none' &&
                         title.display === 'none')
                      : (title.content === JSON.stringify(expected) &&
                         title.display !== 'none');
                  return sourceMatches && visualMatches &&
                         el.getBoundingClientRect().height >= 76;
              }''', {'expected': expected, 'fromSelectedLink': from_selected_link}))
        first_paint.screenshot(path=str(out / ('first-paint-' + route.replace('/', '-') + '.png')),
                               full_page=False)
    first_paint.close()

    script_free = browser.new_page(viewport={'width': 320, 'height': 720},
                                   java_script_enabled=False)
    script_free.goto(base + 'terms/index.html')
    script_free.locator('#directory-mobile-nav > summary').click()
    check('catalog directory menu remains usable with JavaScript disabled',
          script_free.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').first.is_visible()
          and script_free.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').count() == 7)
    # Standalone, directory and generated detail pages all render the same
    # real SVG home link at build time. Verify every family without scripts;
    def check_no_script_brand(label, *, real_link):
        menu = script_free.locator('.site-mobile-chrome__menu')
        check(label + ' keeps the shared AI Updates wordmark without scripts',
              menu.count() == 1 and menu.evaluate("""(el, realLink) => {
                  const anchors = [...el.querySelectorAll('a.site-mobile-chrome__brand')];
                  const fallback = getComputedStyle(el, '::after');
                  const sections = el.querySelectorAll(':scope > a:not(.site-mobile-chrome__brand)');
                  if (sections.length !== 7) return false;
                  if (realLink) {
                      if (anchors.length !== 1) return false;
                      const anchor = anchors[0];
                      return anchor.textContent.includes('AI Updates')
                          && anchor.getAttribute('aria-label') === 'AI Updates home'
                          && anchor.getAttribute('href').endsWith('index.html#/overview')
                          && anchor.querySelector('svg') !== null
                          && anchor.getBoundingClientRect().height > 0
                          && fallback.content === 'none';
                  }
                  return anchors.length === 0
                      && fallback.content === '"AI Updates"'
                      && fallback.position === 'absolute'
                      && fallback.backgroundImage.includes('favicon.svg');
              }""", real_link))
    check_no_script_brand('Concept directory', real_link=True)
    script_free.goto(base + 'about.html')
    script_free.locator('#directory-mobile-nav > summary').click()
    check('About uses the generated shared menu without JavaScript',
          script_free.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').count() == 7
          and script_free.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)[aria-current="page"]').inner_text() == 'About')
    check_no_script_brand('About', real_link=True)
    script_free.screenshot(path=str(out / 'no-script-about-branded-mobile.png'), full_page=False)
    script_free.goto(base + 'technology/TECH-0216-pytorch.html')
    script_free.locator('#directory-mobile-nav > summary').click()
    check('technology detail uses the shared mobile menu without JavaScript',
          script_free.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').count() == 7
          and script_free.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)[aria-current="page"]').inner_text() == 'Technology profiles')
    check_no_script_brand('Technology profile', real_link=True)
    script_free.goto(base + 'terms/MLD-0002-ablation-study.html')
    script_free.locator('#directory-mobile-nav > summary').click()
    check_no_script_brand('Concept detail', real_link=True)
    script_free.close()

    # Generated A-Z directories must expose the same eight secondary destinations
    # before hydration. JS must not be needed to open the native disclosure.
    reference_nav = browser.new_page(viewport={'width':1280, 'height':844},
                                     java_script_enabled=False, reduced_motion='reduce')
    for theme in ('light', 'dark'):
        reference_nav.emulate_media(color_scheme=theme)
        for route in ('terms/index.html', 'terms/MLD-0001-a-b-test.html', 'terms/MLD-0101-bayesian-inference.html', 'terms/MLD-0121-bidirectional-context.html', 'terms/MLD-0131-boosting.html', 'terms/MLD-0141-byte-pair-encoding.html', 'terms/MLD-0151-categorical-feature.html', 'terms/MLD-0161-chain-of-thought-prompting.html', 'terms/MLD-0171-circuit.html', 'terms/MLD-0181-cohen-s-kappa.html', 'terms/MLD-0192-condition-number.html', 'terms/MLD-0201-connectionist-temporal-classification.html', 'terms/MLD-0221-contrastive-loss.html', 'terms/MLD-0241-critic.html', 'terms/MLD-0251-cumulative-distribution-function.html', 'terms/MLD-0261-data-extraction.html', 'terms/MLD-0266-data-mixture.html', 'terms/MLD-0276-dbscan.html', 'terms/MLD-0286-decoder.html', 'terms/MLD-0296-denoising-diffusion-implicit-model.html', 'terms/MLD-0306-detokenization.html', 'terms/MLD-0324-distributed-learning.html', 'terms/MLD-0424-feature-store.html', 'terms/MLD-0434-float16.html', 'terms/MLD-0444-frequency-penalty.html', 'terms/MLD-0453-gaussian-naive-bayes.html', 'terms/MLD-0639-learning-to-rank.html', 'terms/MLD-0640-learning-rate-schedule.html', 'technology/index.html', 'technology/TECH-0216-pytorch.html'):
            for width in (320, 390, 768, 1280):
                reference_nav.set_viewport_size({'width':width, 'height':844})
                reference_nav.goto(base + route)
                rail = reference_nav.locator('nav.site-chrome')
                more = rail.locator('details.site-chrome__more')
                mobile = reference_nav.locator('#directory-mobile-nav')
                check('reference directory shared navigation before JS ' + route + ' ' + theme + ' ' + str(width),
                      more.count() == 1 and mobile.count() == 1 and
                      (rail.is_visible() if width >= 768 else mobile.is_visible()))
                if route in ('terms/MLD-0101-bayesian-inference.html', 'terms/MLD-0121-bidirectional-context.html', 'terms/MLD-0131-boosting.html', 'terms/MLD-0141-byte-pair-encoding.html', 'terms/MLD-0151-categorical-feature.html', 'terms/MLD-0161-chain-of-thought-prompting.html', 'terms/MLD-0171-circuit.html', 'terms/MLD-0181-cohen-s-kappa.html', 'terms/MLD-0241-critic.html', 'terms/MLD-0261-data-extraction.html', 'terms/MLD-0266-data-mixture.html', 'terms/MLD-0306-detokenization.html', 'terms/MLD-0324-distributed-learning.html', 'terms/MLD-0424-feature-store.html', 'terms/MLD-0434-float16.html', 'terms/MLD-0444-frequency-penalty.html', 'terms/MLD-0453-gaussian-naive-bayes.html', 'terms/MLD-0639-learning-to-rank.html'):
                    check('newly migrated concept has one native first-paint rail bottom ' + theme + ' ' + str(width),
                          rail.locator('.sidebar-bottom.site-chrome__bottom').count() == 1 and
                          rail.locator('a[href="../index.html#/sources"]').count() >= 1)
                if width >= 768:
                    # The selected encyclopedia secondary page starts expanded.
                    # All other native reference routes start closed.
                    expected_open = route == 'terms/index.html'
                    check('reference directory More sections has the correct script-free state ' + route + ' ' + theme + ' ' + str(width),
                          more.locator('summary').is_visible() and
                          more.evaluate('el => el.open') == expected_open)
                    if not expected_open:
                        more.locator('summary').click()
                    check('reference directory keeps all eight destinations ' + route + ' ' + theme + ' ' + str(width),
                          more.evaluate('el => el.open') and
                          more.locator('a').all_inner_texts() == [
                              'Safety observatory', 'Research library', 'Compare tools',
                              'Your notebook', 'Sources & coverage', 'Guided professor demo',
                              'Concept encyclopedia', 'Offline demo download ↓'] and
                          more.locator('a').first.get_attribute('href') == '../index.html#/safety')
                    if width == 1280:
                        reference_nav.screenshot(
                            path=str(out / ('no-js-reference-nav-' + route.replace('/', '-') + '-' + theme + '.png')),
                            full_page=False)
                    more.locator('summary').click()
                else:
                    check('reference directory mobile search remains a real route ' + route + ' ' + theme + ' ' + str(width),
                          not rail.is_visible() and
                          reference_nav.locator('a.site-mobile-chrome__search').get_attribute('href') == '../index.html#/search')
                    mobile.locator('> summary').click()
                    secondary = mobile.locator('.site-mobile-chrome__more')
                    check('reference mobile disclosure exists before JS ' + route + ' ' + theme + ' ' + str(width),
                          secondary.count() == 1 and secondary.locator('summary').is_visible())
                    if route == 'terms/index.html':
                        check('reference encyclopedia is the active native mobile secondary destination',
                              secondary.locator('a[href="../terms/index.html"][aria-current="location"]').count() == 1
                              and secondary.evaluate('el => el.open'))
                    else:
                        secondary.locator('summary').click()
                    expected_research = '../research.html'
                    check('reference native mobile secondary routes before JS ' + route + ' ' + theme + ' ' + str(width),
                          secondary.locator('a').count() == 8 and
                          secondary.locator('a[href="' + expected_research + '"]').is_visible())
    reference_nav.close()
    # Follow the actual shared Research destination from BOTH generated detail
    # families, not just examine href strings. This remains usable without JS
    # on mobile and desktop, in light and dark OS schemes, and preserves URLs.
    for scheme in ('light', 'dark'):
        nav_context = browser.new_context(java_script_enabled=False,
                                          color_scheme=scheme, reduced_motion='reduce')
        nav_page = nav_context.new_page()
        for width in (390, 1280):
            nav_page.set_viewport_size({'width':width, 'height':844})
            for route in ('terms/MLD-0001-a-b-test.html',
                          'technology/TECH-0001-adversarial-robustness-toolbox.html'):
                # These published reference pages have no client-side content to await.
                # Waiting for every external asset's load event intermittently timed out
                # after the exact HTML already arrived. Still require a successful HTTP
                # response, the real article heading and complete shared navigation.
                response = nav_page.goto(base + route, wait_until='domcontentloaded')
                check('script-free reference response and article load '
                      + route + ' ' + scheme + ' ' + str(width),
                      response is not None and response.status == 200 and
                      nav_page.locator('main.term-shell h1').count() == 1 and
                      nav_page.locator('nav.site-chrome .site-chrome__links a').count() == 7 and
                      nav_page.locator('details.site-mobile-chrome__nav').count() == 1)
                if width < 651:
                    nav_page.locator('details.site-mobile-chrome__nav > summary').click()
                    disclosure = nav_page.locator('details.site-mobile-chrome__more')
                else:
                    disclosure = nav_page.locator('details.site-chrome__more')
                disclosure.locator(':scope > summary').click()
                disclosure.locator('a[href="../research.html"]').click()
                check('script-free generated reference enters the SAME native Research layout '
                      + route + ' ' + scheme + ' ' + str(width),
                      nav_page.url.split('?', 1)[0].endswith('/research.html') and
                      nav_page.locator('main').count() == 1)
                if width == 390:
                    nav_page.screenshot(path=str(out / ('reference-to-research-' +
                        route.split('/')[0] + '-' + scheme + '.png')), full_page=False)
        nav_context.close()
    # Generated concepts retain usable script-free navigation, but enhanced
    # article landmarks must match technology profiles without extra controls.
    enhanced_concept = browser.new_page(viewport={'width':390, 'height':844},
                                        reduced_motion='reduce')
    for color in ('light', 'dark'):
        enhanced_concept.emulate_media(color_scheme=color)
        for width in (320, 390, 768, 1280):
            enhanced_concept.set_viewport_size({'width':width, 'height':844})
            for route in ('terms/MLD-0001-a-b-test.html', 'terms/MLD-0101-bayesian-inference.html', 'terms/MLD-0121-bidirectional-context.html', 'terms/MLD-0131-boosting.html', 'terms/MLD-0141-byte-pair-encoding.html', 'terms/MLD-0151-categorical-feature.html', 'terms/MLD-0171-circuit.html', 'terms/MLD-0181-cohen-s-kappa.html', 'terms/MLD-0192-condition-number.html', 'technology/TECH-0216-pytorch.html'):
                enhanced_concept.goto(base + route)
                check('generated detail shared sibling landmarks ' + route + ' ' + color + ' ' + str(width),
                      enhanced_concept.evaluate("""() => {
                          const mobile = document.querySelector('body > .directory-mobile-topbar.site-mobile-chrome');
                          const rail = document.querySelector('body > nav.site-chrome.term-nav');
                          const main = document.querySelector('body > main.term-shell');
                          const hero = main?.querySelector(':scope > header.hero#main[tabindex="-1"]');
                          return !!(mobile && rail && main && hero) &&
                              mobile.nextElementSibling === rail &&
                              rail.nextElementSibling === main &&
                              main.querySelector('.site-chrome,.site-mobile-chrome') === null &&
                              document.querySelectorAll('nav.site-chrome.term-nav').length === 1 &&
                              document.querySelectorAll('details.site-mobile-chrome__nav').length === 1;
                      }"""))
                if width <= 390:
                    check('generated detail mobile header stays within viewport '
                          + route + ' ' + color + ' ' + str(width),
                          enhanced_concept.evaluate("""() => {
                              const header = document.querySelector('body > .directory-mobile-topbar.site-mobile-chrome');
                              const box = header?.getBoundingClientRect();
                              return !!box && box.left >= -1 && box.right <= innerWidth + 1 &&
                                  box.height >= 44 && getComputedStyle(header).display !== 'none';
                          }"""))
                if width == 390:
                    enhanced_concept.screenshot(
                        path=str(out / ('generated-sibling-' + route.replace('/', '-') + '-' + color + '.png')),
                        full_page=False)
    enhanced_concept.close()

    # Native keyboard skip must focus content, not only scroll beneath the rail.
    # Keep this usable with JavaScript off in both mobile and desktop layouts.
    skip_ctx = browser.new_context(java_script_enabled=False, viewport={'width':390, 'height':844})
    skip_page = skip_ctx.new_page()
    for width in (390, 1280):
        skip_page.set_viewport_size({'width':width, 'height':844})
        for route, destination in [('about.html', 'main'), ('research.html', 'main'),
                                    ('demo.html', 'main'), ('terms/index.html', 'main'),
                                    ('technology/index.html', 'main'),
                                    ('technology/TECH-0216-pytorch.html', 'main')]:
            skip_page.goto(base + route)
            skip_page.locator('a.skip').focus()
            skip_page.keyboard.press('Enter')
            check('native skip focuses content: ' + route + ' at ' + str(width),
                  skip_page.evaluate('document.activeElement.id') == destination
                  and skip_page.evaluate('window.location.hash') == '#' + destination
                  and (route not in ('demo.html', 'terms/index.html', 'technology/index.html')
                       or skip_page.evaluate('document.activeElement.tagName') == 'HEADER'))
    skip_ctx.close()
    # Existing standalone families expose their secondary mobile destinations
    # at build time. Verify script-free disclosure and working download links.
    script_free_more = browser.new_page(viewport={'width':390, 'height':844},
                                        java_script_enabled=False, reduced_motion='reduce')
    for color in ('light', 'dark'):
        script_free_more.emulate_media(color_scheme=color)
        for width in (320, 390):
            script_free_more.set_viewport_size({'width':width, 'height':844})
            for route in ('whats-new.html', 'research.html', 'playbooks.html', 'games.html'):
                script_free_more.goto(base + route)
                menu = script_free_more.locator('details.site-mobile-chrome__nav')
                menu.locator(':scope > summary').click()
                more = menu.locator('details.site-mobile-chrome__more')
                check('script-free secondary mobile disclosure '+route+' '+color+' '+str(width),
                      more.count() == 1 and more.locator('summary').is_visible())
                if route == 'research.html':
                    check('Research script-free current secondary link '+color+' '+str(width),
                          more.evaluate("""el => el.open &&
                              el.querySelectorAll('a[aria-current="location"]').length === 1 &&
                              el.querySelector('a[aria-current="location"]')?.textContent.trim() === 'Research library'"""))
                else:
                    check('non-secondary pages keep More collapsed '+route+' '+color+' '+str(width),
                          not more.evaluate('el => el.open'))
                    more.locator('summary').click()
                check('script-free secondary routes and download '+route+' '+color+' '+str(width),
                      more.evaluate("""(el) => el.open
                          && el.querySelectorAll('a').length === 8
                          && [...el.querySelectorAll('a')].map(a => a.textContent.trim()).join('|') ===
                            'Safety observatory|Research library|Compare tools|Your notebook|Sources & coverage|Guided professor demo|Concept encyclopedia|Offline demo download ↓'
                          && el.querySelector('a[download]')?.getAttribute('href') === 'downloads/Atlas_Demo_Offline.html'"""))
    script_free_more.close()

    # Expanded concept guides now have the same eight native mobile links as
    # technology profiles and directories, with no JavaScript whatsoever.
    for color in ('light', 'dark'):
        for width in (320, 390):
            guide_context = browser.new_context(java_script_enabled=False,
                color_scheme=color, viewport={'width':width, 'height':844},
                reduced_motion='reduce')
            guide_page = guide_context.new_page()
            guide_page.goto(base + 'terms/MLD-0002-ablation-study.html')
            menu = guide_page.locator('details.site-mobile-chrome__nav')
            menu.locator(':scope > summary').click()
            extras = menu.locator('details.site-mobile-chrome__more')
            check('expanded guide script-free More at ' + color + ' ' + str(width),
                  extras.count() == 1 and extras.locator('summary').is_visible())
            extras.locator('summary').click()
            check('expanded guide script-free eight secondary routes at ' + color + ' ' + str(width),
                  extras.evaluate("(el) => el.open && el.querySelectorAll('a').length === 8")
                  and extras.locator('a[href="../terms/index.html"]').is_visible())
            guide_page.screenshot(path=str(out / ('guide-static-more-' + color + '-' + str(width) + '.png')))
            guide_context.close()

    # Generated individual references render the shared desktop rail at
    # DOMContentLoaded. Their mobile drawer must clone it AFTER it exists:
    # earlier ordering silently omitted all eight routes on both families.
    detail_mobile = browser.new_page(viewport={'width':390, 'height':844},
                                     reduced_motion='reduce')
    detail_mobile.on('pageerror', lambda e: errors.append(str(e)))
    for color in ('light', 'dark'):
        detail_mobile.emulate_media(color_scheme=color)
        for width in (320, 390):
            detail_mobile.set_viewport_size({'width':width, 'height':844})
            for route in ('terms/MLD-0002-ablation-study.html',
                          'technology/TECH-0288-vllm.html'):
                detail_mobile.goto(base + route)
                menu = detail_mobile.locator('details.site-mobile-chrome__nav')
                menu.locator(':scope > summary').click()
                more = menu.locator('details.site-mobile-chrome__more')
                check('generated detail mobile More exists ' + route + ' ' + color + ' ' + str(width),
                      more.count() == 1 and more.locator('summary').is_visible())
                more.locator('summary').click()
                links = more.locator('a')
                check('generated detail secondary routes complete ' + route + ' ' + color + ' ' + str(width),
                      links.count() == 8 and
                      links.all_inner_texts() == [
                          'Safety observatory', 'Research library', 'Compare tools',
                          'Your notebook', 'Sources & coverage', 'Guided professor demo',
                          'Concept encyclopedia', 'Offline demo download ↓'] and
                      more.locator('a[href="../terms/index.html"]').is_visible())
                more.locator('a[href="../terms/index.html"]').click()
                # The production edge may canonicalize /terms/index.html to
                # /terms/. Wait for the actual encyclopedia heading, rather
                # than accepting any unrelated <h1> at the clicked destination.
                encyclopedia_heading = detail_mobile.get_by_role(
                    'heading', name='Follow the connections.', exact=True)
                encyclopedia_heading.wait_for(state='visible', timeout=20000)
                destination = detail_mobile.evaluate('location.pathname')
                check('generated detail secondary links navigate ' + route + ' ' + color + ' ' + str(width),
                      (destination.endswith('/terms/index.html') or
                       destination.endswith('/terms/')) and
                      encyclopedia_heading.is_visible())
    detail_mobile.close()

    # Discover's nested secondary navigation must reflect the current hash
    # workspace. Primary and secondary mobile links share one active indication.
    secondary_active = browser.new_page(viewport={'width':390,'height':844},
                                        reduced_motion='reduce')
    secondary_active.on('pageerror', lambda e: errors.append(str(e)))
    for section in ('safety','papers','compare','saved','sources'):
        secondary_active.goto(base+'index.html#/'+section)
        secondary_active.locator(
            '#navigation a.nav-link[data-view="'+section+'"][aria-current="page"]'
        ).wait_for(state='attached',timeout=20000)
        nested = secondary_active.locator('#discover-mobile-nav details.site-mobile-chrome__more')
        # A direct legacy #/papers URL still selects Research, while its
        # visible mobile link now opens the native shared Research workspace.
        selected = nested.locator('a[href="research.html"]' if section == 'papers'
                                  else 'a[href="#/'+section+'"]')
        check('Discover secondary mobile active '+section,
              selected.get_attribute('aria-current') == 'page'
              and nested.evaluate('(el) => el.open')
              and nested.locator('a[aria-current="page"]').count() == 1)
    secondary_active.goto(base+'index.html#/overview')
    secondary_active.locator(
        '#navigation a.nav-link[data-view="overview"][aria-current="page"]'
    ).wait_for(state='attached',timeout=20000)
    check('Discover clears stale secondary active after returning home',
          secondary_active.locator(
              '#discover-mobile-nav .site-mobile-chrome__more-links a[aria-current="page"]'
          ).count() == 0)
    # Route changes inside the same document must not leave an automatically
    # expanded More section open when the active destination is primary.
    for width in (390, 1280):
        secondary_active.set_viewport_size({'width':width,'height':844})
        secondary_active.goto(base+'index.html#/safety')
        # A hash-only goto can reuse the previous width's manually expanded
        # disclosure. Each width must begin with a fresh, unmodified page.
        secondary_active.reload()
        secondary_active.locator(
            '#navigation a.nav-link[data-view="safety"][aria-current="page"]'
        ).wait_for(state='attached',timeout=20000)
        mobile_more = secondary_active.locator(
            '#discover-mobile-nav details.site-mobile-chrome__more')
        desktop_more = secondary_active.locator('#additional-navigation')
        check('Secondary disclosure auto-revealed at '+str(width),
              mobile_more.evaluate('(el) => el.open')
              and desktop_more.evaluate('(el) => el.open'))
        secondary_active.evaluate("location.hash='#/overview'")
        secondary_active.locator(
            '#navigation a.nav-link[data-view="overview"][aria-current="page"]'
        ).wait_for(state='attached',timeout=20000)
        # aria-current updates before both disclosures in the same renderNav()
        # call; synchronize on the completed transition, not the first mutation.
        secondary_active.wait_for_function("""() =>
            !document.querySelector('#discover-mobile-nav details.site-mobile-chrome__more').open
            && !document.querySelector('#additional-navigation').open
        """, timeout=5000)
        check('Secondary disclosure resets on primary hash route at '+str(width),
              not mobile_more.evaluate('(el) => el.open')
              and not desktop_more.evaluate('(el) => el.open'))
        mobile_more.evaluate('(el) => {el.open=true}')
        desktop_more.evaluate('(el) => {el.open=true}')
        secondary_active.evaluate("location.hash='#/dictionary'")
        secondary_active.locator(
            '#navigation a.nav-link[data-view="dictionary"][aria-current="page"]'
        ).wait_for(state='attached',timeout=20000)
        # A manually opened mobile disclosure stays open. On desktop the
        # shared focus-away behavior intentionally dismisses an INACTIVE More
        # as soon as section navigation transfers focus into the workspace.
        # This is a real interaction difference, not a weaker assertion.
        if width > 650:
            # Explicit keyboard focus-away is the actual desktop dismissal
            # interaction; programmatically setting .open does not focus the
            # summary, and focusing an already-focused main emits no focusin.
            secondary_active.locator('#global-query').focus()
            secondary_active.wait_for_function("""() =>
                !document.querySelector('#additional-navigation').open
            """, timeout=5000)
        check('Manual More follows mobile persistence / desktop focus-away at '+str(width),
              mobile_more.evaluate('(el) => el.open')
              and desktop_more.evaluate('(el) => el.open') == (width <= 650))
        # Auto-revealed More is different from More deliberately re-opened
        # by a person. The second must survive leaving a secondary section.
        secondary_active.goto(base+'index.html#/safety')
        secondary_active.reload()
        secondary_active.locator(
            '#navigation a.nav-link[data-view="safety"][aria-current="page"]'
        ).wait_for(state='attached',timeout=20000)
        selected_more = mobile_more if width <= 650 else desktop_more
        if width <= 650:
            secondary_active.locator('#discover-mobile-nav > summary').click()
        check('Auto-reveal marks its own disclosure at '+str(width),
              selected_more.evaluate('(el) => el.open && el.dataset.atlasAutoOpened === "true"'))
        selected_more.locator('summary').first.click()
        selected_more.locator('summary').first.click()
        check('Explicit re-open clears auto state at '+str(width),
              selected_more.evaluate('(el) => el.open && !el.dataset.atlasAutoOpened'))
        secondary_active.evaluate("location.hash='#/overview'")
        secondary_active.locator(
            '#navigation a.nav-link[data-view="overview"][aria-current="page"]'
        ).wait_for(state='attached',timeout=20000)
        if width > 650:
            # Explicit keyboard focus-away is the actual desktop dismissal
            # interaction; programmatically setting .open does not focus the
            # summary, and focusing an already-focused main emits no focusin.
            secondary_active.locator('#global-query').focus()
            secondary_active.wait_for_function("""() =>
                !document.querySelector('#additional-navigation').open
            """, timeout=5000)
        check('Explicit re-open respects mobile persistence / desktop focus-away at '+str(width),
              selected_more.evaluate('(el) => el.open') == (width <= 650)
              and selected_more.evaluate(
                  '(el) => el.dataset.atlasManualTouched === "true"'))
    # Escape from an automatically revealed desktop rail must have the same
    # ownership as clicking its summary, including a later same-section render.
    secondary_active.set_viewport_size({'width':1280,'height':844})
    secondary_active.goto(base+'index.html#/safety')
    secondary_active.reload()
    secondary_active.locator('#local-query').wait_for(state='visible',timeout=20000)
    escape_more = secondary_active.locator('#additional-navigation')
    escape_more.locator('summary').focus()
    secondary_active.keyboard.press('Escape')
    check('Desktop Escape explicitly dismisses auto-revealed More',
          escape_more.evaluate('(el) => !el.open && el.dataset.atlasManualTouched === "true"'))
    secondary_active.evaluate("location.hash='#/safety?q=alignment'")
    secondary_active.wait_for_function("""() =>
        document.querySelector('#local-query')?.value === 'alignment'
    """, timeout=10000)
    check('Desktop Escape dismissal survives same-section render',
          escape_more.evaluate('(el) => !el.open && !el.dataset.atlasAutoOpened')
          and secondary_active.locator(
              '#discover-mobile-nav details.site-mobile-chrome__more'
          ).evaluate('(el) => el.open'))
    secondary_active.close()

    # A rotated mobile drawer must focus its actual active secondary destination
    # on the shared desktop rail, not the primary parent. This catches keyboard
    # context loss across the guided-demo and concept-encyclopedia page families.
    secondary_resize = browser.new_page(viewport={'width':390,'height':844},
                                        reduced_motion='reduce')
    secondary_resize.on('pageerror', lambda e: errors.append(str(e)))
    for route, active_href in (
        ('demo.html', 'demo.html'),
        ('terms/index.html', '../terms/index.html'),
    ):
        secondary_resize.set_viewport_size({'width':390,'height':844})
        secondary_resize.goto(base + route)
        drawer = secondary_resize.locator('details.site-mobile-chrome__nav')
        drawer.locator(':scope > summary').click()
        check('active secondary drawer opens on ' + route,
              drawer.evaluate('(el) => el.open'))
        secondary_resize.set_viewport_size({'width':768,'height':844})
        secondary_resize.wait_for_function("""() => {
          const active = document.querySelector('.site-chrome__more a[aria-current="location"]');
          return active && document.activeElement === active;
        }""", timeout=10000)
        active = secondary_resize.locator('.site-chrome__more a[aria-current="location"]')
        check('desktop focus follows actual secondary destination on ' + route,
              active.get_attribute('href') == active_href
              and active.is_visible()
              and not drawer.evaluate('(el) => el.open'))
    secondary_resize.close()

    # If a visitor explicitly collapses More, its aria-current child remains
    # semantically selected but is hidden. Rotating with the mobile drawer open
    # must focus the visible desktop summary, not the hidden link or <body>.
    for scheme in ('light', 'dark'):
        collapsed_context = browser.new_context(
            color_scheme=scheme, viewport={'width':390, 'height':844},
            reduced_motion='reduce')
        collapsed_page = collapsed_context.new_page()
        collapsed_page.on('pageerror', lambda e: errors.append(str(e)))
        for route in ('research.html', 'demo.html', 'terms/index.html'):
            # Each route must begin at the mobile breakpoint: the previous
            # iteration has already resized this same page to desktop.
            collapsed_page.set_viewport_size({'width':390, 'height':844})
            collapsed_page.goto(base + route)
            more = collapsed_page.locator('details.site-chrome__more')
            more.evaluate('(el) => {el.open=false}')
            drawer = collapsed_page.locator('details.site-mobile-chrome__nav')
            drawer.locator(':scope > summary').click()
            check('mobile drawer opens before collapsed desktop handoff ' + route + ' ' + scheme,
                  drawer.evaluate('(el) => el.open'))
            collapsed_page.set_viewport_size({'width':768, 'height':844})
            collapsed_page.wait_for_function("""() => {
                const more=document.querySelector('details.site-chrome__more');
                return more && !more.open &&
                  document.activeElement === more.querySelector(':scope > summary');
            }""", timeout=10000)
            check('closed desktop More preserves visible focus on ' + route + ' ' + scheme,
                  not drawer.evaluate('(el) => el.open')
                  and not more.evaluate('(el) => el.open')
                  and more.locator(':scope > summary').is_visible()
                  and more.locator('a[aria-current="location"]').count()==1
                  and not more.locator('a[aria-current="location"]').is_visible())
            if scheme=='dark' and route=='research.html':
                collapsed_page.screenshot(
                    path=str(out/'collapsed-more-keyboard-research-768-dark.png'))
        collapsed_context.close()

    # Discover's brand and appearance control are siblings of #navigation,
    # unlike native rails. All of them must transfer focus when hidden by a
    # responsive resize, without automatically opening the mobile drawer.
    for scheme in ('light', 'dark'):
        rail_context = browser.new_context(color_scheme=scheme,
            viewport={'width':1280, 'height':844}, reduced_motion='reduce')
        rail_page = rail_context.new_page()
        rail_page.on('pageerror', lambda e: errors.append(str(e)))
        for route, controls in (
            ('index.html', ('#sidebar .brand', '#sidebar #theme-toggle')),
            ('research.html', ('.site-chrome .site-chrome__brand',
                               '.site-chrome .site-chrome__theme-toggle--rail')),
        ):
            rail_page.set_viewport_size({'width':1280,'height':844})
            rail_page.goto(base + route)
            toggle = rail_page.locator('details.site-mobile-chrome__nav > summary')
            for desktop_width, mobile_width in ((1280, 320), (768, 390)):
                for selector in controls:
                    rail_page.set_viewport_size({'width':desktop_width,'height':844})
                    control = rail_page.locator(selector)
                    control.wait_for(state='visible')
                    control.focus()
                    check('Desktop rail control receives focus ' + route + ' ' + selector,
                          control.evaluate('(el) => document.activeElement === el'))
                    rail_page.set_viewport_size({'width':mobile_width,'height':844})
                    rail_page.wait_for_function("""() => {
                        const toggle = document.querySelector('details.site-mobile-chrome__nav > summary');
                        return toggle && document.activeElement === toggle;
                    }""", timeout=10000)
                    check('Whole desktop rail transfers focus to closed mobile toggle ' +
                          route + ' ' + selector + ' ' + scheme + ' ' + str(mobile_width),
                          toggle.is_visible() and not toggle.evaluate('(el) => el.parentElement.open'))
                    if route == 'index.html' and scheme == 'dark' and mobile_width == 390:
                        rail_page.screenshot(path=str(out/'discover-rail-resize-focus-390-dark.png'))
        rail_context.close()

    # Search controls that disappear when rotating must hand keyboard focus
    # back to a real visible control, without submitting the current draft.
    for scheme in ('light', 'dark'):
        search_context = browser.new_context(color_scheme=scheme,
            viewport={'width':390, 'height':844}, reduced_motion='reduce')
        search_page = search_context.new_page()
        search_page.on('pageerror', lambda e: errors.append(str(e)))
        for route in ('index.html', 'research.html', 'terms/MLD-0002-ablation-study.html'):
            for mobile_width, desktop_width in ((320, 768), (390, 1280)):
                search_page.set_viewport_size({'width':mobile_width,'height':844})
                search_page.goto(base + route)
                submit = search_page.locator('.site-mobile-chrome__search-submit')
                field = search_page.locator('#global-query, .site-mobile-chrome__search-input')
                field.fill('unsubmitted draft')
                submit.focus()
                initial_url = search_page.url
                check('Shared mobile search submit receives focus ' + route + ' ' + scheme,
                      submit.evaluate('(el) => document.activeElement === el'))
                search_page.set_viewport_size({'width':desktop_width,'height':844})
                search_page.wait_for_function("""() => {
                    const submit=document.querySelector('.site-mobile-chrome__search-submit');
                    const field=document.querySelector('#global-query, .site-mobile-chrome__search-input');
                    const focused=document.activeElement;
                    if (submit.getClientRects().length) return focused===submit;
                    if (field.getClientRects().length) return focused===field;
                    return !!focused?.closest('.site-chrome,#sidebar') && !!focused.getClientRects().length;
                }""", timeout=10000)
                check('Responsive search focus and draft survive ' + route + ' ' + scheme + ' ' + str(desktop_width),
                      search_page.url == initial_url and field.input_value() == 'unsubmitted draft')
                if route == 'index.html' and scheme == 'dark' and desktop_width == 1280:
                    search_page.screenshot(path=str(out/'shared-search-resize-focus-1280-dark.png'))
        search_context.close()

    # Verify actual cross-page introduction rhythm at mobile and desktop
    # widths in both OS themes, before any JavaScript can apply a patch.
    lead_routes = (
        ('research.html', '.shell > main > section.hero > p'),
        ('playbooks.html', '.playbook-shell > main > section.playbook-hero > p'),
        ('technologies.html', '.tech-shell > main > section.tech-hero > p'),
        ('whats-new.html', '.shell > main > header .lead'),
    )
    for scheme in ('light','dark'):
        lead_context = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        lead_page = lead_context.new_page()
        for width in (320,390,768,1280):
            lead_page.set_viewport_size({'width':width,'height':844})
            lead_page.goto(base+'index.html')
            if width <= 650:
                lead_page.locator('#discover-mobile-nav > summary').click()
                lead_page.locator('#discover-mobile-nav a[href="playbooks.html"]').click()
            else:
                lead_page.goto(base+'playbooks.html')
            check('Discover to Playbooks shared frame '+scheme+' '+str(width),
                  lead_page.locator('.playbook-shell .site-chrome__links a').count()==7
                  and lead_page.locator('.playbook-shell > main > section.playbook-hero > p').is_visible())
            for route, selector in lead_routes:
                lead_page.goto(base+route)
                paragraph = lead_page.locator(selector).first
                check('Shared introduction '+route+' '+scheme+' '+str(width),
                      paragraph.count()==1 and paragraph.is_visible()
                      and paragraph.evaluate("""el => {
                        const s=getComputedStyle(el), w=document.documentElement.clientWidth;
                        const target=w<=650?16:17;
                        return Math.abs(parseFloat(s.fontSize)-target)<.2
                          && parseFloat(s.lineHeight)>=target*1.6
                          && s.maxWidth!=='none'
                          && el.getBoundingClientRect().width<=w
                      }"""))
                if width in (390,1280):
                    lead_page.screenshot(path=str(out/('intro-'+route.split('.')[0]+'-'+scheme+'-'+str(width)+'.png')))
        # On phones, the archive and Catalog Review must share the same
        # shell-owned gutter. Exercise the actual links before measuring.
        for width in (320,390):
            lead_page.set_viewport_size({'width':width,'height':844})
            lead_page.goto(base+'index.html', wait_until='load')
            discover_left = lead_page.locator('h1').first.evaluate(
                'el => el.getBoundingClientRect().left')
            lead_page.locator('#discover-mobile-nav > summary').click()
            lead_page.locator('#discover-mobile-nav a[href="whats-new.html"]').click()
            lead_page.wait_for_load_state('load')
            for route in ('whats-new.html','catalog-review.html'):
                heading = lead_page.locator('h1').first
                left = heading.evaluate('el => el.getBoundingClientRect().left')
                check('Shared mobile reading gutter '+route+' '+scheme+' '+str(width),
                      lead_page.url == base+route and heading.is_visible()
                      and abs(left-discover_left)<=2
                      and lead_page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                lead_page.screenshot(path=str(out/('mobile-reading-gutter-'+route+'-'+scheme+'-'+str(width)+'.png')))
                if route == 'whats-new.html':
                    review_link = lead_page.locator('#catalog-review-notice a[href="catalog-review.html"]')
                    check('Script-free archive review link visible '+scheme+' '+str(width),
                          review_link.count()==1 and review_link.is_visible())
                    review_link.click()
                    lead_page.wait_for_load_state('load')
            lead_page.locator('.site-mobile-chrome__nav > summary').click()
            lead_page.locator('.site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)[href="index.html#/overview"]').click()
            lead_page.wait_for_load_state('load')
            check('Catalog Review mobile return to Discover '+scheme+' '+str(width),
                  lead_page.locator('h1').first.inner_text().strip()=='Discover')
        # A native workspace must begin at the same Discover inset below the
        # fixed bar; legacy hero/shell spacing must not stack on navigation.
        for width in (768,1280):
            lead_page.set_viewport_size({'width':width,'height':844})
            for route in ('playbooks.html','whats-new.html','catalog-review.html',
                          'hardware-review.html','demo.html'):
                # DOMContentLoaded alone does not guarantee linked CSS has
                # loaded in this script-free context. Measure the rendered page,
                # not a partially styled response, on slower production hosts.
                response = lead_page.goto(base+route, wait_until='load')
                label = route+' '+scheme+' '+str(width)
                check('Editorial document HTTP 200 '+label,
                      response is not None and response.status == 200)
                geometry = lead_page.locator('#main').evaluate("""el => {
                  const bar = document.querySelector('.site-mobile-chrome');
                  const top = el.getBoundingClientRect().top;
                  const padding = parseFloat(getComputedStyle(el).paddingTop);
                  const bottom = bar ? bar.getBoundingClientRect().bottom : null;
                  const missing = [...document.querySelectorAll('link[rel="stylesheet"]')]
                    .filter(link => !link.sheet).map(link => link.getAttribute('href'));
                  return {top, padding, bottom, inset: bottom === null ? null : top + padding - bottom,
                          missing, ready: document.readyState};
                }""")
                # Preserve the failing frame as well as passing frames.
                lead_page.screenshot(path=str(out/('editorial-inset-'+route.split('.')[0]+'-'+scheme+'-'+str(width)+'.png')))
                check('Editorial stylesheets ready '+label+' '+json.dumps(geometry),
                      geometry['ready']=='complete' and not geometry['missing'])
                check('Editorial first-content inset '+label+' '+json.dumps(geometry),
                      geometry['inset'] is not None and abs(geometry['inset'] - (30 if width <= 1150 else 37)) <= 2)
        # Cross the actual primary links, rather than comparing disconnected
        # screenshots: the desktop heading origin must not jump sideways.
        for width in (768,1280):
            lead_page.set_viewport_size({'width':width,'height':844})
            lead_page.goto(base+'index.html', wait_until='load')
            reference = lead_page.locator('h1').first.evaluate(
                'el => el.getBoundingClientRect().left')
            reference_type = """el => {
                const s=getComputedStyle(el);
                return [s.fontFamily.split(',')[0].replaceAll(String.fromCharCode(34),'').replaceAll(String.fromCharCode(39),'').trim().toLowerCase(),s.fontWeight,s.fontSize,s.lineHeight,s.letterSpacing];
            }"""
            discover_type = lead_page.locator('h1').first.evaluate(reference_type)
            lead_page.screenshot(path=str(out/('reading-gutter-discover-'+scheme+'-'+str(width)+'.png')))
            for route in ('playbooks.html','whats-new.html','research.html','technologies.html'):
                if route == 'research.html':
                    lead_page.locator('#additional-navigation > summary').click()
                    lead_page.locator('#additional-navigation a[href="research.html"]').click()
                elif route == 'technologies.html':
                    lead_page.locator('#navigation > .site-chrome__links a[href="#/technologies"]').click()
                    lead_page.locator('section[id="/technologies"] a[data-nojs-static="technologies"]').click()
                    lead_page.locator('a[href="../technologies.html"]').click()
                else:
                    lead_page.locator('#navigation > .site-chrome__links a[href="'+route+'"]').click()
                lead_page.wait_for_load_state('load')
                heading = lead_page.locator('h1').first
                left = heading.evaluate('el => el.getBoundingClientRect().left')
                lead_page.screenshot(path=str(out/('reading-gutter-'+route.split('.')[0]+'-'+scheme+'-'+str(width)+'.png')))
                check('Shared editorial reading gutter '+route+' '+scheme+' '+str(width)+' '+str((reference,left)),
                      heading.is_visible() and abs(left-reference)<=2)
                lead_page.locator('.site-chrome .site-chrome__links a[href="index.html#/overview"]').click()
                lead_page.wait_for_load_state('load')
                check('Editorial return to Discover '+route+' '+scheme+' '+str(width),
                      lead_page.locator('h1').first.inner_text().strip()=='Discover')
            # Follow actual native primary and directory links to reference
            # articles, then return to Discover without JavaScript.
            for section, directory_link, detail_link in (
                ('about.html', None, None),
                ('#/dictionary', 'concepts', 'MLD-0002-ablation-study.html'),
                ('#/technologies', 'technologies', 'TECH-0216-pytorch.html'),
            ):
                lead_page.locator('#navigation > .site-chrome__links a[href="'+section+'"]').click()
                if directory_link:
                    lead_page.locator('section[id="'+section[1:]+'"] a[data-nojs-static="'+directory_link+'"]').click()
                    # Expanded guides intentionally occur in both the featured
                    # list and the complete A–Z directory. Preserve both links
                    # and exercise the canonical directory, not an ambiguous
                    # page-wide selector (which fails Playwright strict mode).
                    detail_selector = 'a[href="'+detail_link+'"]'
                    if directory_link == 'concepts':
                        featured = lead_page.locator('section.detail-block').filter(
                            has=lead_page.get_by_role('heading',
                                name='Start with an expanded guide', exact=True))
                        directory = lead_page.locator('section.detail-block').filter(
                            has=lead_page.get_by_role('heading',
                                name='All concepts, A–Z', exact=True))
                        check('Featured concept retains its direct link '+scheme+' '+str(width),
                              featured.locator(detail_selector).count()==1 and
                              featured.locator(detail_selector).is_visible())
                    else:
                        directory = lead_page.locator('main .reference-grid')
                    detail = directory.locator(detail_selector)
                    check('Canonical directory exposes one visible detail link '+
                          detail_link+' '+scheme+' '+str(width),
                          detail.count()==1 and detail.is_visible())
                    detail.click()
                    lead_page.wait_for_load_state('load')
                    expected_detail = ('terms/' if directory_link == 'concepts'
                                       else 'technology/') + detail_link
                    check('Native directory reaches the expected detail route '+expected_detail,
                          lead_page.url == base+expected_detail)
                lead_page.wait_for_load_state('load')
                heading = lead_page.locator('h1').first
                left = heading.evaluate('el => el.getBoundingClientRect().left')
                label = detail_link or section
                lead_page.screenshot(path=str(out/('reference-gutter-'+label+'-'+scheme+'-'+str(width)+'.png')))
                if directory_link:
                    actual_type = heading.evaluate(reference_type)
                    check('Shared reference heading typography '+label+' '+scheme+' '+str(width)+' '+str((discover_type,actual_type)),
                          actual_type==discover_type)
                check('Shared reference reading gutter '+label+' '+scheme+' '+str(width)+' '+str((reference,left)),
                      heading.is_visible() and abs(left-reference)<=2 and
                      lead_page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                lead_page.locator('.site-chrome .site-chrome__links a[href$="index.html#/overview"]').click()
                lead_page.wait_for_load_state('load')
                check('Reference return to Discover '+label+' '+scheme+' '+str(width),
                      lead_page.locator('h1').first.inner_text().strip()=='Discover')
        lead_context.close()


    # Without scripting, the same shared native catalogs must never present
    # an indefinite loading state or controls that cannot work. Readable
    # source links remain available at 320px through desktop in both themes.
    for scheme in ('light','dark'):
        static_context = browser.new_context(java_script_enabled=False, color_scheme=scheme)
        static_page = static_context.new_page()
        for width in (320,390,768,1280):
            static_page.set_viewport_size({'width':width,'height':844})
            static_page.goto(base+'index.html')
            for route, linked_resource in (
                ('research.html','data/papers-01.json'),
                ('playbooks.html','data/playbooks-01.json'),
                ('technologies.html','technology/index.html'),
            ):
                static_page.goto(base+route)
                fallback=static_page.locator('section.site-static-fallback')
                check('Published script-free fallback '+route+' '+scheme+' '+str(width),
                      fallback.count()==1 and fallback.is_visible()
                      and not static_page.locator('.site-js-only').first.is_visible()
                      and (static_page.locator('.site-chrome__brand').is_visible() if width>650
                           else static_page.locator('details.site-mobile-chrome__nav > summary').is_visible())
                      and fallback.locator('a[href="'+linked_resource+'"]').is_visible()
                      and fallback.evaluate("""el => {
                        const r=el.getBoundingClientRect(), body=document.documentElement.clientWidth;
                        return r.width>0 && r.left>=-1 && r.right<=body+1;
                      }"""))
                if width in (390,1280):
                    static_page.screenshot(path=str(out/('scriptless-'+route.split('.')[0]+'-'+scheme+'-'+str(width)+'.png')))
                if width==390:
                    response=static_page.goto(base+linked_resource)
                    check('Script-free published resource reachable '+route+' '+scheme,
                          response is not None and response.status < 400)
        static_context.close()

    # Enhancement must still expose fully functional search interfaces.
    for route, search_control in (
        ('research.html','.controls #query'),
        ('playbooks.html','.playbook-tools #search'),
        ('technologies.html','.tech-controls #tech-search'),
    ):
        live_page=browser.new_page(viewport={'width':390,'height':844})
        live_page.goto(base+route)
        live_page.locator(search_control).wait_for(state='visible')
        if route == 'research.html':
            live_page.wait_for_function("document.documentElement.classList.contains('atlas-research-ready')")
        check('Enhanced catalog keeps real search '+route,
              live_page.locator('html.atlas-enhanced').count()==1
              and live_page.locator(search_control).is_visible()
              and (live_page.locator('#scriptfree-research-catalog').is_hidden()
                   if route == 'research.html'
                   else live_page.locator('section.site-static-fallback').count()==0))
        live_page.close()

    # A keyboard skip on mobile must land below the same shared sticky header
    # on Discover, news, article, Games and generated reference routes. Verify
    # real no-JavaScript navigation at both phone widths in both OS themes.
    for scheme in ('light', 'dark'):
        skip_context = browser.new_context(java_script_enabled=False, color_scheme=scheme,
                                           reduced_motion='reduce')
        skip_page = skip_context.new_page()
        for width in (320, 390):
            skip_page.set_viewport_size({'width':width, 'height':844})
            skip_page.goto(base + 'index.html')
            for route in (
                'index.html', 'whats-new.html', 'research.html', 'games.html',
                'terms/MLD-0001-a-b-test.html',
                'technology/TECH-0001-adversarial-robustness-toolbox.html'
            ):
                skip_page.goto(base + route)
                native_skip = skip_page.locator('a[href="#main"]').first
                native_skip.focus()
                skip_page.keyboard.press('Enter')
                skip_page.wait_for_function('window.location.hash === "#main"')
                geometry = skip_page.locator('#main').evaluate("""el => {
                    const topbar=document.querySelector('.site-mobile-chrome');
                    return {top:el.getBoundingClientRect().top,
                            bottom:topbar?.getBoundingClientRect().bottom,
                            margin:getComputedStyle(el).scrollMarginTop};
                }""")
                check('Skip clears sticky header '+route+' '+scheme+' '+str(width),
                      geometry['margin']=='80px' and geometry['bottom'] is not None
                      and geometry['top']>=geometry['bottom']-2)
                if width==390 and route in ('whats-new.html','research.html'):
                    skip_page.screenshot(path=str(out/('skip-'+route.split('.')[0]+'-'+scheme+'.png')))
        skip_context.close()

    # Native pages already use the shared root-scroll offset. Discover's
    # separate app-shell lacked that same clearance on desktop. Exercise both
    # frames, deep links and keyboard Skip without introducing doubled margins.
    for scheme in ('light', 'dark'):
        desktop_skip_context = browser.new_context(
            java_script_enabled=False, color_scheme=scheme, reduced_motion='reduce')
        desktop_skip_page = desktop_skip_context.new_page()
        for width in (768, 1280):
            desktop_skip_page.set_viewport_size({'width':width, 'height':844})
            for route in (
                'index.html', 'whats-new.html', 'research.html',
                'playbooks.html', 'games.html',
                'terms/MLD-0001-a-b-test.html',
                'technology/TECH-0001-adversarial-robustness-toolbox.html'
            ):
                desktop_skip_page.goto(base + route)
                desktop_skip_page.locator('a[href="#main"]').first.focus()
                desktop_skip_page.keyboard.press('Enter')
                desktop_skip_page.wait_for_function('location.hash === "#main"')
                desktop_skip_page.locator('#main').evaluate(
                    'el => el.scrollIntoView({block: "start", behavior: "instant"})')
                clearance = desktop_skip_page.locator('#main').evaluate("""el => {
                    const header=[...document.querySelectorAll(
                        '.topbar, .site-mobile-chrome')].find(node =>
                        getComputedStyle(node).display !== 'none' &&
                        node.getBoundingClientRect().height >= 50);
                    return {top:el.getBoundingClientRect().top,
                            headerBottom:header?.getBoundingClientRect().bottom,
                            rootPadding:getComputedStyle(
                                document.documentElement).scrollPaddingTop,
                            margin:getComputedStyle(el).scrollMarginTop};
                }""")
                check('Desktop skip clears shared bar '+route+' '+scheme+' '+str(width),
                      clearance['rootPadding']=='96px'
                      and clearance['margin']=='0px'
                      and clearance['headerBottom'] is not None
                      and clearance['top']>=clearance['headerBottom']-2)
        desktop_skip_context.close()

    # Source-reviewed concept guides now use the existing global footer
    # without hydration, matching technology profiles across all viewports.
    for scheme in ('light', 'dark'):
        guide_context = browser.new_context(java_script_enabled=False, color_scheme=scheme,
                                            reduced_motion='reduce')
        guide_page = guide_context.new_page()
        for width in (320, 390, 768, 1280):
            guide_page.set_viewport_size({'width':width, 'height':844})
            for route in ('terms/MLD-0002-ablation-study.html',
                          'terms/MLD-0957-prompt-injection.html'):
                guide_page.goto(base + route)
                footer = guide_page.locator('footer.site-chrome__footer')
                check('expanded guide shared global footer ' + route + ' ' + scheme + ' ' + str(width),
                      footer.count()==1 and footer.is_visible()
                      and guide_page.get_by_role('contentinfo').count()==1
                      and guide_page.locator('main footer').count()==0
                      and footer.locator('a[href="../about.html"]').count()==1
                      and footer.evaluate('el => el.getBoundingClientRect().right <= innerWidth + 1'))
                if width==390 and scheme=='dark':
                    guide_page.screenshot(path=str(out/('expanded-guide-'+route.split('/')[1].split('.')[0]+'-390-dark.png')))
        guide_context.close()

    # Discover's 76px/off-white workspace bar and the 78px/white native bar
    # visibly changed height, reading origin and title type on each page jump.
    # Compare the *rendered* shared frame, not just declared CSS or one page.
    for scheme in ('light', 'dark'):
        bar_context = browser.new_context(color_scheme=scheme, reduced_motion='reduce')
        bar_page = bar_context.new_page()
        for width in (768, 1280):
            bar_page.set_viewport_size({'width':width, 'height':844})
            baseline = None
            for route in (
                'index.html', 'whats-new.html', 'research.html',
                'playbooks.html', 'technology/index.html', 'terms/index.html',
                'games.html'
            ):
                bar_page.goto(base + route)
                frame = bar_page.evaluate("""() => {
                    const el=[...document.querySelectorAll('.topbar,.site-mobile-chrome')]
                        .find(node => getComputedStyle(node).display !== 'none' &&
                              node.getBoundingClientRect().height > 40);
                    if (!el) return null;
                    const style=getComputedStyle(el);
                    const title=el.querySelector('#breadcrumb,.site-mobile-chrome__title');
                    const search=el.querySelector('.global-search,.site-mobile-chrome__search');
                    return {height:Math.round(el.getBoundingClientRect().height),
                            padding:Math.round(parseFloat(style.paddingLeft)),
                            background:style.backgroundColor,
                            border:style.borderBottomColor,
                            titleSize:title?getComputedStyle(title).fontSize:null,
                            searchHeight:search?Math.round(search.getBoundingClientRect().height):null};
                }""")
                expected_padding = 26 if width == 768 else 38
                check('Shared desktop workspace bar '+route+' '+scheme+' '+str(width),
                      frame is not None and frame['height']==78
                      and frame['padding']==expected_padding
                      and frame['titleSize']=='13px'
                      and frame['searchHeight'] is not None
                      and frame['searchHeight']>=40
                      and (baseline is None or
                           all(frame[key]==baseline[key]
                               for key in ('height','padding','background','border','titleSize'))))
                if baseline is None:
                    baseline = frame
                if route in ('index.html','research.html','technology/index.html'):
                    bar_page.screenshot(path=str(out/(
                        'shared-workspace-bar-'+route.replace('/','-')+'-'+
                        scheme+'-'+str(width)+'.png')))
        bar_context.close()

    # News collection headings and long-form reference subsections have the
    # same narrative role. Compare actual rendered type, not card headlines.
    for scheme in ('light', 'dark'):
        heading_context = browser.new_context(color_scheme=scheme, reduced_motion='reduce')
        heading_page = heading_context.new_page()
        for width in (320, 390, 768, 1280):
            heading_page.set_viewport_size({'width': width, 'height': 844})
            styles = """el => {
                const s = getComputedStyle(el);
                return [s.fontFamily, s.fontSize, s.fontWeight, s.lineHeight, s.letterSpacing];
            }"""
            spacing = """el => {
                const s = getComputedStyle(el);
                return [s.marginTop, s.marginBottom];
            }"""
            heading_page.goto(base + 'index.html#/overview', wait_until='load')
            # The initial script-free feed is replaced when the catalog hydrates.
            # Measure and capture the enhanced feed only after that replacement.
            heading_page.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
            feed_heading = heading_page.locator('.feed-heading').first
            expect(feed_heading).to_be_visible(timeout=20000)
            feed_spacing = feed_heading.evaluate(spacing)
            expected_spacing = ['26px', '16px'] if width <= 650 else ['25px', '17px']
            check('Discover feed section rhythm ' + scheme + ' ' + str(width),
                  feed_spacing == expected_spacing)
            feed_heading.scroll_into_view_if_needed()
            heading_page.screenshot(path=str(out / (
                'shared-discover-feed-rhythm-' + scheme + '-' + str(width) + '.png')))
            heading_page.goto(base + 'terms/index.html', wait_until='load')
            reference = heading_page.locator('.term-shell > .detail-block > h2').first
            expect(reference).to_be_visible()
            baseline = reference.evaluate(styles)
            heading_page.goto(base + 'technology/TECH-0216-pytorch.html', wait_until='load')
            profile = heading_page.locator('.term-shell > .profile-section > h2').first
            expect(profile).to_be_visible()
            check('Reference subsection type ' + scheme + ' ' + str(width),
                  profile.evaluate(styles) == baseline)
            heading_page.goto(base + 'whats-new.html', wait_until='load')
            heading = heading_page.locator('#edition-content > section > .heading > h2').first
            expect(heading).to_be_visible(timeout=20000)
            check('Shared news/reference subsection type ' + scheme + ' ' + str(width),
                  heading.evaluate(styles) == baseline)
            check('Shared Discover/news collection spacing ' + scheme + ' ' + str(width),
                  heading.locator('..').evaluate(spacing) == feed_spacing)
            heading.scroll_into_view_if_needed()
            heading_page.screenshot(path=str(out / (
                'shared-news-subsection-' + scheme + '-' + str(width) + '.png')))
            # The long-form reading pages share the feed's section cadence,
            # but keep heading margins inside their own content surfaces.
            for route, selector in (
                ('about.html', '.term-shell > .profile-section'),
                ('technology/TECH-0001-adversarial-robustness-toolbox.html', '.term-shell > .profile-section'),
                ('terms/MLD-0724-memory-bandwidth.html', '.term-shell > .detail-block'),
                ('hardware-review.html', '.review-shell > section'),
                ('catalog-review.html', '.shell > main > section'),
            ):
                heading_page.goto(base + route, wait_until='load')
                section = heading_page.locator(selector).first
                expect(section).to_be_visible()
                subsection = section.locator('h2').first
                expect(subsection).to_be_visible()
                check('Shared reading-section rhythm ' + route + ' ' + scheme + ' ' + str(width),
                      section.evaluate(spacing) == [feed_spacing[0], '0px']
                      and subsection.evaluate(spacing) == ['0px', '12px']
                      and section.evaluate("""el => {
                          const next = el.nextElementSibling;
                          return next && Math.round(next.getBoundingClientRect().top -
                              el.getBoundingClientRect().bottom) === parseInt(getComputedStyle(el).marginTop);
                      }"""))
                section.scroll_into_view_if_needed()
                heading_page.screenshot(path=str(out / (
                    'shared-reading-rhythm-' + route.replace('/', '-') + '-' +
                    scheme + '-' + str(width) + '.png')))
            # Readable card overlines use one shared rule, independently of badges.
            metadata_style = """el => {
                const s = getComputedStyle(el);
                return [s.fontSize, s.fontWeight, s.lineHeight,
                        s.letterSpacing, s.textTransform];
            }"""
            expected_metadata = ['12px', '700', '18px', '0.48px', 'uppercase']
            heading_page.goto(base + 'index.html#/overview', wait_until='load')
            # The initial script-free feed is replaced when the catalog hydrates.
            # Measure and capture the enhanced feed only after that replacement.
            heading_page.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
            discover_overline = heading_page.locator('.story-body .story-kicker').first
            expect(discover_overline).to_be_visible(timeout=20000)
            discover_metadata = discover_overline.evaluate(metadata_style)
            featured = heading_page.locator('.featured-copy .story-kicker').first
            expect(featured).to_be_visible()
            check('Discover overline and featured distinction ' + scheme + ' ' + str(width),
                  discover_metadata == expected_metadata
                  and featured.evaluate("el => getComputedStyle(el).fontSize") == '10px')
            discover_overline.scroll_into_view_if_needed()
            heading_page.screenshot(path=str(out / (
                'shared-metadata-discover-' + scheme + '-' + str(width) + '.png')))
            heading_page.goto(base + 'catalog-review.html', wait_until='load')
            review_overline = heading_page.locator('article.card > .label').first
            expect(review_overline).to_be_visible()
            check('Shared card overline typography ' + scheme + ' ' + str(width),
                  review_overline.evaluate(metadata_style) == discover_metadata
                  and review_overline.evaluate("el => el.scrollWidth <= el.clientWidth")
                  and heading_page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
            review_overline.scroll_into_view_if_needed()
            heading_page.screenshot(path=str(out / (
                'shared-metadata-review-' + scheme + '-' + str(width) + '.png')))
        heading_context.close()

    check('no application runtime exceptions', not errors)
    browser.close()
(out / 'report.json').write_text(json.dumps({'base':base, 'checks':checks, 'checks_passed':len(checks), 'errors':errors}, indent=2), encoding='utf-8')
