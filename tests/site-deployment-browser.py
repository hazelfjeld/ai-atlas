"""Exercise the packaged or deployed Atlas with real browser navigation and downloads."""
import argparse
import csv
import hashlib
import io
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

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
    search = page.locator('a.site-mobile-chrome__search[href="index.html#/search"]')
    return (nav.count() == 1 and nav.is_visible()
            and nav.locator('.site-chrome__links a').count() == 7
            and search.count() == 1 and search.is_visible()
            and search.evaluate('el => getComputedStyle(el.closest(".site-mobile-chrome")).position === "fixed"')
            and not page.locator('details.site-mobile-chrome__nav').is_visible())


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'), headless=True)
    page = browser.new_page(viewport={'width':1440, 'height':1000}, reduced_motion='reduce')
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base)
    page.locator('#navigation a[href="#/games"]').wait_for()
    check('homepage retains original Atlas shell and native Games tab', page.locator('.app-shell').count() == 1)
    # Check actual Discover-to-editorial transitions, not CSS similarity alone.
    for width in (320, 390, 768, 1280):
        page.set_viewport_size({'width':width, 'height':844})
        page.goto(base + 'index.html#/overview')
        # The menu handler is attached after the verified catalog hydrates.
        # Opening it before that point can hit a static, not-yet-bound button.
        page.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
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
            primary_links = page.locator('#navigation > a.nav-link')
            labels = primary_links.locator('span:not(.nav-count)').all_text_contents()
            about_link = page.locator('#navigation > a[data-static="about"]')
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
                  and native_more.locator('a[href="index.html#/papers"]').is_visible())
            if width == 390:
                native_more.locator('a[href="index.html#/papers"]').click()
                page.wait_for_url('**/index.html#/papers')
                page.wait_for_function(
                    "document.querySelector('#navigation a[data-view=papers]')?.getAttribute('aria-current') === 'page'")
                check('About mobile secondary navigation reaches live Research library',
                      page.locator('#navigation a[data-view="papers"][aria-current="page"]').count() == 1)

    # Discover now exposes the very same native <details> structure as its
    # standalone neighbors, including when the JavaScript runtime is blocked.
    no_script = browser.new_context(java_script_enabled=False, viewport={'width':320, 'height':844})
    scriptless = no_script.new_page()
    scriptless.goto(base + 'index.html#/overview')
    scriptless.locator('#discover-mobile-nav > summary').click()
    check('Discover keeps seven script-free native drawer links',
          scriptless.locator('#discover-mobile-nav').evaluate('(el) => el.open')
          and scriptless.locator('#discover-mobile-nav .site-mobile-chrome__menu > a:not(.site-mobile-chrome__brand)').count() == 7)
    check('Discover no-script drawer preserves a real home wordmark link',
          scriptless.locator('#discover-mobile-nav a.site-mobile-chrome__brand').get_attribute('href') == '#/overview')
    no_script.close()
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
    check('disclosure reveals the original safety navigation link',
          page.locator('#navigation a[href="#/safety"]').is_visible())
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
    failed_archive.close()
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
        desktop_search = page.locator('a.site-mobile-chrome__search[href="index.html#/search"]')
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
        check('secondary destinations navigate to real workspace routes on ' + route,
              more.locator('a').first.get_attribute('href') == 'index.html#/safety'
              and more.locator('a').last.get_attribute('href') == 'downloads/Atlas_Demo_Offline.html')
        more.locator('summary').click()

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
                menu.locator(':scope > summary').click()
                check(f'{route} {mobile_width}px {chosen_theme} can navigate from the pinned mobile header',
                      menu.evaluate('el => el.open') and
                      menu.locator('.site-mobile-chrome__menu a[href]').count() >= 7)
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
          scriptless_sticky.locator('.site-mobile-chrome__menu a[href]').count() >= 7)
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
    page.locator('a.site-mobile-chrome__search').click()
    page.wait_for_url('**/index.html#/search')
    check('desktop shared search returns to live Discover search',
          page.locator('#global-query').is_visible())


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
    mobile_archive.locator('.archive-search-link').click()
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
    menu_links = mobile_games.locator('#games-mobile-nav .site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)')
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
    mobile_games.locator('.site-mobile-chrome__search').click()
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
    rail_theme = theme_page.locator('.site-chrome > .site-chrome__theme-toggle')
    check('editorial desktop rail exposes the existing theme action',
          rail_theme.is_visible() and
          rail_theme.get_attribute('aria-label') == 'Toggle color theme' and
          rail_theme.get_attribute('aria-pressed') == 'false')
    rail_theme.click()
    check('shared desktop theme switch saves dark choice',
          theme_page.evaluate("document.documentElement.dataset.theme === 'dark' && localStorage.getItem('atlas.theme') === 'dark'") and
          rail_theme.get_attribute('aria-pressed') == 'true')
    theme_page.goto(base + 'technologies.html')
    check('technology directory preserves the theme chosen on About',
          theme_page.evaluate("document.documentElement.dataset.theme === 'dark'"))
    theme_page.set_viewport_size({'width':390, 'height':844})
    theme_page.locator('#tech-mobile-nav > summary').click()
    mobile_theme = theme_page.locator('.site-mobile-chrome__menu > .site-chrome__theme-toggle')
    check('mobile native drawer contains one keyboard-focusable appearance action',
          mobile_theme.is_visible() and
          mobile_theme.get_attribute('aria-pressed') == 'true' and
          theme_page.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)').count() == 7)
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
    mobile_about.locator('.site-mobile-chrome__search').click()
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
          mobile_tech.evaluate("""() => [...document.querySelectorAll('.tech-menu-panel a')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
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
    mobile_tech.locator('.tech-search-link').click()
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
          mobile_playbooks.evaluate("""() => [...document.querySelectorAll('.playbook-menu-panel a')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
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
    mobile_playbooks.locator('.playbook-search-link').click()
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
            menu_links = shared_mobile.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)')
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
          mobile_review.locator('.review-mobile-topbar .site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)').all_inner_texts() == ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles', 'Games', 'Playbooks', 'About'])
    check('catalog review menu is keyboard operable with current-page indication',
          mobile_review.locator('#review-mobile-nav').evaluate('(el) => el.open')
          and mobile_review.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='What’s New Today', exact=True).get_attribute('aria-current') == 'location')
    check('catalog review current mobile section is visibly highlighted',
          mobile_review.evaluate("""() => {
            const a = document.querySelectorAll('.review-mobile-topbar .site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)');
            return getComputedStyle(a[1]).backgroundColor !== getComputedStyle(a[0]).backgroundColor;
          }"""))
    check('catalog review mobile links meet 44px touch minimum',
          mobile_review.evaluate("""() => [...document.querySelectorAll('.review-mobile-topbar .site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)')]
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
    mobile_review.locator('.review-mobile-topbar .site-mobile-chrome__search').click()
    mobile_review.wait_for_url('**/index.html#/search')
    check('catalog review search opens actual workspace search',
          mobile_review.locator('#global-query').is_visible())
    mobile_review.close()

    # Hardware evidence previously exposed a multirow legacy header on phones.
    mobile_hardware = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_hardware.goto(base + 'hardware-review.html')
    check('hardware review uses the compact mobile site header',
          mobile_hardware.locator('.hardware-mobile-topbar').is_visible()
          and not mobile_hardware.locator('.review-shell > .review-nav').is_visible()
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
          mobile_hardware.locator('.hardware-mobile-topbar .site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)').all_inner_texts() == ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles', 'Games', 'Playbooks', 'About'])
    check('hardware review menu supports keyboard navigation and current-page indication',
          mobile_hardware.locator('#hardware-mobile-nav').evaluate('(el) => el.open')
          and mobile_hardware.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='What’s New Today', exact=True).get_attribute('aria-current') == 'location')
    check('hardware review current mobile section is visibly highlighted',
          mobile_hardware.evaluate("""() => {
            const a = document.querySelectorAll('.hardware-mobile-topbar .site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)');
            return getComputedStyle(a[1]).backgroundColor !== getComputedStyle(a[0]).backgroundColor;
          }"""))
    check('hardware review mobile links meet 44px touch minimum',
          mobile_hardware.evaluate("""() => [...document.querySelectorAll('.hardware-mobile-topbar .site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_hardware.keyboard.press('Enter')
    mobile_hardware.screenshot(path=str(out / 'hardware-review-mobile-header.png'), full_page=False)
    mobile_hardware.set_viewport_size({'width':390, 'height':844})
    check('390px hardware review has no page-wide horizontal overflow',
          mobile_hardware.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_hardware.set_viewport_size({'width':1440, 'height':900})
    check('desktop hardware review has shared navigation and functional search',
          desktop_shared_navigation(mobile_hardware)
          and mobile_hardware.locator('.review-shell > .review-nav').is_visible())
    mobile_hardware.set_viewport_size({'width':320, 'height':720})
    mobile_hardware.locator('.hardware-mobile-topbar .site-mobile-chrome__search').click()
    mobile_hardware.wait_for_url('**/index.html#/search')
    check('hardware review search opens the actual workspace search',
          mobile_hardware.locator('#global-query').is_visible())
    mobile_hardware.close()

    # Research uses the same mobile navigation classes and seven primary
    # destinations as Games, while keeping its own three research-view tabs.
    mobile_research = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_research.goto(base + 'research.html')
    check('research uses the compact mobile navigation instead of the legacy sidebar',
          mobile_research.locator('.research-mobile-topbar').is_visible()
          and not mobile_research.locator('.shell > aside').is_visible()
          and mobile_research.locator('.research-search-link').is_visible())
    check('320px research page has no horizontal overflow',
          mobile_research.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    check('research primary mobile menu matches the other standalone pages',
          mobile_research.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)').all_text_contents()
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
          mobile_research.evaluate("""() => [...document.querySelectorAll('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_research.keyboard.press('Enter')
    mobile_research.locator('.research-local-nav a[href="#alerts"]').click()
    mobile_research.wait_for_function("""() => location.hash === '#alerts'
        && document.querySelector('.research-local-nav a[href="#alerts"]').getAttribute('aria-current') === 'page'
        && document.querySelector('#section-label').textContent === 'SAFETY OBSERVATORY'""")
    check('research view tabs switch the original catalog route and selected state',
          mobile_research.locator('.research-local-nav a[href="#alerts"]').get_attribute('aria-current') == 'page'
          and mobile_research.locator('#section-label').inner_text() == 'SAFETY OBSERVATORY')
    mobile_research.locator('.research-local-nav a[href="#papers"]').click()
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
    check('desktop research primary navigation matches AI Updates sections',
          mobile_research.locator('.research-site-chrome').is_visible()
          and mobile_research.locator('.site-chrome__links a').all_text_contents()
          == ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles',
              'Games', 'Playbooks', 'About']
          and mobile_research.locator('.research-local-nav').is_visible()
          and mobile_research.locator('.research-site-chrome .site-chrome__links [aria-current="location"]').count() == 1
          and mobile_research.locator('.research-site-chrome .site-chrome__links [aria-current="location"]').inner_text() == 'Discover'
          and mobile_research.locator('.shell > aside').count() == 0)
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
    mobile_research.locator('.research-search-link').click()
    mobile_research.wait_for_url('**/index.html#/search')
    mobile_research.locator('#catalog-loading').wait_for(state='detached', timeout=45000)
    check('research search opens the existing workspace and focuses its real input',
          mobile_research.locator('#global-query').is_visible()
          and mobile_research.evaluate("document.activeElement?.id === 'global-query'"))
    mobile_research.close()
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
              and menu.locator('nav a:not(.site-mobile-chrome__brand)').count() == 7
              and menu.locator('nav > a.site-mobile-chrome__brand').count() == 1
              and menu.locator('nav a[aria-current="page"]').count() == 1
              and menu.locator('nav a[aria-current="page"]').inner_text() == 'Concept dictionary')
        mobile_reference.wait_for_function("document.querySelector('.site-mobile-chrome__search').inert")
        check(reference + ' shares background isolation while drawer is open',
              mobile_reference.evaluate("""() => document.querySelector('.site-mobile-chrome__search').inert
                  && !document.querySelector('#directory-mobile-nav').inert"""))
        check(reference + ' has keyboard-reachable 44px navigation links',
              mobile_reference.evaluate("""() => [...document.querySelectorAll('#directory-mobile-nav nav a:not(.site-mobile-chrome__brand)')]
                  .every(a => a.getBoundingClientRect().height >= 44)"""))
        # Check geometry, not merely the number of DOM links: checkpoint.css
        # also styles generic navs and previously compressed this menu into a
        # horizontally scrolling two-link strip.
        check(reference + ' stacks all seven links in one visible vertical menu',
              mobile_reference.evaluate("""() => {
                  const menu = document.querySelector('#directory-mobile-nav nav');
                  const links = [...menu.querySelectorAll('a:not(.site-mobile-chrome__brand)')].map(a => a.getBoundingClientRect());
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
          and nojs_reference.locator('#directory-mobile-nav nav a:not(.site-mobile-chrome__brand)').count() == 7
          and nojs_reference.locator('#directory-mobile-nav nav a').count() == 8
          and nojs_reference.locator('#directory-mobile-nav nav a').last.is_visible())
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
        const links = [...menu.querySelectorAll('.archive-menu-panel a')];
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
        for width in (651, 768, 1280):
            page.set_viewport_size({'width':width, 'height':900})
            for route in ('about.html', 'technologies.html', 'research.html'):
                page.goto(base + route)
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
                      page.evaluate("""() => {
                          const nav = document.querySelector('.site-chrome');
                          if (!nav) return false;
                          const links = [...nav.querySelectorAll('.site-chrome__links a')];
                          const tops = links.map(el => Math.round(el.getBoundingClientRect().top));
                          const sidebar = innerWidth >= 651;
                          const rect = nav.getBoundingClientRect();
                          if (sidebar) {
                              return getComputedStyle(nav).position === 'fixed'
                                  && getComputedStyle(nav).flexDirection === 'column'
                                  && rect.left === 0 && Math.abs(rect.width - (innerWidth <= 1150 ? 204 : 224)) <= 1
                                  && nav.closest('main').getBoundingClientRect().left >= (innerWidth <= 1150 ? 203 : 223)
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
                      }"""))
    page.evaluate("localStorage.setItem('atlas.theme', 'light')")
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base + 'index.html#/games')
    page.locator('#start-quiz').wait_for()
    check('mobile Games route fits original workspace', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.locator('#discover-mobile-nav > summary').click()
    page.locator('#discover-mobile-nav .site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)[href="#/overview"]').click()
    page.wait_for_function("location.hash === '#/overview' && !document.getElementById('discover-mobile-nav').open")
    check('mobile drawer navigates and closes', page.locator('#daily-panel-title').is_visible())

    # The two large generated directories previously looked like separate
    # sites with inconsistent five/six-link navigation. Compare their shared
    # header with Discover's editorial navigation at mobile and desktop sizes.
    for route, selected in (('terms/index.html', 'Concept dictionary'),
                            ('about.html', 'About'),
                            ('technology/index.html', 'Technology profiles'),
                            ('technology/TECH-0216-pytorch.html', 'Technology profiles')):
        for width in (320, 390, 768, 1280):
            page.set_viewport_size({'width': width, 'height': 844})
            page.goto(base + route)
            check(f'{route} has seven shared navigation links without overflow at {width}px',
                  page.evaluate("""() => {
                      const nav=document.querySelector(innerWidth <= 650
                          ? '.site-mobile-chrome__menu' : '.site-chrome__links');
                      return !!nav && nav.querySelectorAll('a:not(.site-mobile-chrome__brand)').length === 7
                          && (innerWidth > 650 || nav.querySelectorAll('a.site-mobile-chrome__brand').length === 1)
                          && document.documentElement.scrollWidth <= innerWidth + 1;
                  }"""))
            if width <= 650:
                page.locator('#directory-mobile-nav > summary').click()
                check(f'{route} exposes the selected mobile section at {width}px',
                      page.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)[aria-current="page"]').inner_text() == selected)
            else:
                check(f'{route} keeps active desktop navigation at {width}px',
                      page.locator('.site-chrome__links a[aria-current="page"]').inner_text() == selected)
    # Compare the anchored desktop frame with Discover while checking the
    # same page families at mobile/tablet widths in both saved themes.
    page.set_viewport_size({'width': 1280, 'height': 900})
    page.goto(base + 'index.html#/overview')
    check('Discover anchors the baseline 224px desktop sidebar',
          page.evaluate("""() => {
              const rect = document.querySelector('#sidebar').getBoundingClientRect();
              return rect.left === 0 && Math.abs(rect.width - (innerWidth <= 1150 ? 204 : 224)) <= 1;
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
                    const link = document.querySelector('#navigation > a.nav-link');
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
                              ? '.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)' : '.site-chrome__links a');
                          const computed = getComputedStyle(nav);
                          const rect = nav.getBoundingClientRect();
                          return links.length === 7
                              && document.documentElement.scrollWidth <= innerWidth + 1
                              && (mobile ? computed.display !== 'none'
                                  : large ? computed.position === 'fixed'
                                      && computed.flexDirection === 'column'
                                      && Math.abs(rect.width - (innerWidth <= 1150 ? 204 : 224)) <= 1
                                      && rect.left === 0
                                      : computed.position !== 'fixed');
                      }"""))
                if width == 1280 and route in ('about.html', 'terms/index.html',
                                                   'whats-new.html', 'research.html',
                                                   'hardware-review.html', 'games.html'):
                    page.screenshot(path=str(out / f'shared-rail-{theme}-{route.replace("/", "-")}.png'),
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
        ('terms/index.html', 'Concept dictionary', True),
        ('technology/TECH-0216-pytorch.html', 'Technology profiles', True),
    ):
        first_paint.goto(base + route)
        check('unenhanced shared topbar has its expected visible title on ' + route,
              first_paint.locator('.site-mobile-chrome').is_visible()
              and first_paint.locator('.site-mobile-chrome').evaluate('''(el, data) => {
                  const {expected, fromSelectedLink} = data;
                  const title = getComputedStyle(el, '::before');
                  const active = el.parentElement?.querySelector(
                      '.site-chrome__links a[aria-current="page"]');
                  const sourceMatches = fromSelectedLink
                      ? (!el.hasAttribute('data-page-label') &&
                         active?.textContent.trim() === expected)
                      : el.getAttribute('data-page-label') === expected;
                  return sourceMatches && title.content === JSON.stringify(expected) &&
                         title.display !== 'none' &&
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
          script_free.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)').first.is_visible()
          and script_free.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)').count() == 7)
    # Standalone, directory and generated detail pages all render the same
    # real SVG home link at build time. Verify every family without scripts;
    def check_no_script_brand(label, *, real_link):
        menu = script_free.locator('.site-mobile-chrome__menu')
        check(label + ' keeps the shared AI Updates wordmark without scripts',
              menu.count() == 1 and menu.evaluate("""(el, realLink) => {
                  const anchors = [...el.querySelectorAll('a.site-mobile-chrome__brand')];
                  const fallback = getComputedStyle(el, '::after');
                  const sections = el.querySelectorAll('a:not(.site-mobile-chrome__brand)');
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
          script_free.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)').count() == 7
          and script_free.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)[aria-current="page"]').inner_text() == 'About')
    check_no_script_brand('About', real_link=True)
    script_free.screenshot(path=str(out / 'no-script-about-branded-mobile.png'), full_page=False)
    script_free.goto(base + 'technology/TECH-0216-pytorch.html')
    script_free.locator('#directory-mobile-nav > summary').click()
    check('technology detail uses the shared mobile menu without JavaScript',
          script_free.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)').count() == 7
          and script_free.locator('.site-mobile-chrome__menu a:not(.site-mobile-chrome__brand)[aria-current="page"]').inner_text() == 'Technology profiles')
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
        for route in ('terms/index.html', 'technology/index.html'):
            for width in (320, 390, 768, 1280):
                reference_nav.set_viewport_size({'width':width, 'height':844})
                reference_nav.goto(base + route)
                rail = reference_nav.locator('nav.site-chrome')
                more = rail.locator('details.site-chrome__more')
                mobile = reference_nav.locator('#directory-mobile-nav')
                check('reference directory shared navigation before JS ' + route + ' ' + theme + ' ' + str(width),
                      more.count() == 1 and mobile.count() == 1 and
                      (rail.is_visible() if width >= 768 else mobile.is_visible()))
                if width >= 768:
                    check('reference directory More sections is available without JS ' + route + ' ' + theme + ' ' + str(width),
                          more.locator('summary').is_visible() and not more.evaluate('el => el.open'))
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
    reference_nav.close()
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
    check('no application runtime exceptions', not errors)
    browser.close()
(out / 'report.json').write_text(json.dumps({'base':base, 'checks':checks, 'checks_passed':len(checks), 'errors':errors}, indent=2), encoding='utf-8')
