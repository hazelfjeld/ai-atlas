"""Critical discovery, static SEO, direct profile and theme paths for AI Updates."""
import argparse
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser()
p.add_argument('--base', required=True)
p.add_argument('--output', default='deployment-validation/rebrand')
args=p.parse_args()
base=args.base.rstrip('/')+'/'
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
checks=[]


def check(name, condition):
    assert condition, name
    checks.append(name)
    print('PASS', name, flush=True)


with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True)
    static=browser.new_context(java_script_enabled=False)
    page=static.new_page()
    page.goto(base)
    check('discovery content is readable without JavaScript', page.locator('h1').inner_text()=='Discover' and page.locator('.discovery-card').count()==6)
    initial_nav=page.locator('#navigation a.nav-link').evaluate_all(
        "(els)=>els.map(a=>[a.getAttribute('href'),a.textContent.replace(/\\s+/g,' ').trim()])")
    check('all 15 sidebar destinations are present at first paint',
          len(initial_nav)==15
          and sum(href=='playbooks.html' for href, _ in initial_nav)==1
          and sum(href=='about.html' for href, _ in initial_nav)==1
          and len(set(href for href, _ in initial_nav))==15)
    check('dictionary, technology and Games links use workspace routes before hydration',
          page.locator('#navigation a[data-view="dictionary"]').get_attribute('href')=='#/dictionary'
          and page.locator('#navigation a[data-view="technologies"]').get_attribute('href')=='#/technologies'
          and page.locator('#navigation a[data-view="games"]').get_attribute('href')=='#/games')

    check('canonical points to the primary domain', page.locator('link[rel=canonical]').get_attribute('href')=='https://aiupdates.app/')
    page.get_by_role('link',name='Read PyTorch',exact=True).click()
    check('technology profile works without JavaScript', page.locator('h1').inner_text()=='PyTorch' and page.get_by_role('heading',name='Tradeoffs & cautions',exact=True).is_visible())
    check('profile uses shared accessible navigation without JavaScript',
          page.locator('.site-chrome__links a').count() == 7
          and page.locator('.site-chrome__links a[aria-current="page"]').inner_text() == 'Technology profiles')
    page.locator('.breadcrumb-links').get_by_role('link',name='Technologies',exact=True).click()
    expected_profiles=json.loads((Path(__file__).resolve().parents[1]/'publication.json').read_text())['published_counts']['technologies']
    check('technology directory exposes every checksummed crawlable profile', expected_profiles>=300 and page.locator('.reference-grid a').count()==expected_profiles)
    # Research has no seven-item primary selection; its workspace label must
    # still be meaningful before JavaScript, not the editorial hero headline.
    page.set_viewport_size({'width':768,'height':900})
    page.goto(base+'research.html')
    check('Research section label is present without JavaScript',
          page.locator('.research-mobile-topbar').get_attribute('data-page-label')=='Research library'
          and 'Research library' in page.locator('.research-mobile-topbar').evaluate(
              "el => getComputedStyle(el, '::before').content"))

    # The standalone native drawer must expose the same *real*, clickable
    # wordmark as Discover even before hydration or with scripts disabled.
    # A CSS ::after fallback looks branded but is not a navigable home link.
    for width in (320, 390):
        page.set_viewport_size({'width': width, 'height': 844})
        for route in ('about.html', 'whats-new.html', 'playbooks.html',
                      'terms/index.html', 'technology/index.html',
                      'terms/MLD-0002-ablation-study.html', 'technology/TECH-0216-pytorch.html'):
            page.goto(base + route)
            page.locator('details.site-mobile-chrome__nav summary').click()
            brand = page.locator('details.site-mobile-chrome__nav .site-mobile-chrome__brand')
            check(f'{route} {width}px no-JS drawer has one clickable Discover wordmark',
                  brand.count() == 1 and brand.is_visible()
                  and brand.get_attribute('href') ==
                      ('../index.html#/overview' if '/' in route else 'index.html#/overview')
                  and brand.locator('svg').count() == 1
                  and page.locator('details.site-mobile-chrome__nav nav a').count() == 8)
            if width == 390 and route in ('about.html', 'terms/index.html'):
                page.screenshot(path=str(out / f'no-script-wordmark-{route.replace("/", "-")}.png'))
            brand.click()
            check(f'{route} {width}px logo opens Discover without scripts',
                  page.url.endswith('index.html#/overview')
                  and page.locator('main h1').first.inner_text() == 'Discover')

    # These desktop workspace labels were previously the generic "AI Updates"
    # until hydration; compare first paint with JavaScript disabled at 768px.
    page.set_viewport_size({'width': 768, 'height': 900})
    for route, expected in (
        ('about.html', 'About'),
        ('research.html', 'Research library'),
        ('catalog-review.html', 'Catalog review'),
        ('hardware-review.html', 'Hardware evidence'),
        ('games.html', 'Games'),
        ('technologies.html', 'Technology profiles'),
        ('playbooks.html', 'Playbooks'),
        ('whats-new.html', 'What’s New Today'),
    ):
        page.goto(base + route)
        header = page.locator('.site-mobile-chrome')
        check(f'{route} no-JS desktop title matches shared navigation',
              header.get_attribute('data-page-label') == expected
              and expected in header.evaluate("el => getComputedStyle(el,'::before').content")
              and page.locator('.site-chrome__links a').count() == 7)

    # Editorial subpages belong to the daily section without inheriting the
    # daily archive's workspace title. This is a single shared header mapping.
    for route in ('catalog-review.html', 'hardware-review.html'):
        page.goto(base + route)
        check(f'{route} retains the canonical selected parent section',
              page.locator('.site-chrome__links a[aria-current="location"]').count() == 1
              and page.locator('.site-chrome__links a[aria-current="location"]').text_content() == 'What’s New Today')

    # The generated directories and 1,648 detail pages already mark their
    # canonical desktop rail section. Before hydration (or with JS disabled),
    # the fixed topbar must display that section rather than "AI Updates".
    for width in (768, 1280):
        page.set_viewport_size({'width': width, 'height': 900})
        for theme in ('light', 'dark'):
            page.emulate_media(color_scheme=theme)
            for route, expected in (
                ('terms/index.html', 'Concept dictionary'),
                ('terms/MLD-0002-ablation-study.html', 'Concept dictionary'),
                ('technology/index.html', 'Technology profiles'),
                ('technology/TECH-0216-pytorch.html', 'Technology profiles'),
            ):
                page.goto(base + route)
                header = page.locator('main.term-shell > .site-mobile-chrome')
                active = page.locator('main.term-shell > .site-chrome .site-chrome__links a[aria-current="page"]')
                label = header.evaluate("el => getComputedStyle(el, '::before').content")
                check(f'{route} {width}px {theme} uses the selected no-JS section title',
                      header.is_visible() and expected in label
                      and active.count() == 1 and active.inner_text() == expected)
                if width == 1280 and theme == 'light' and route in (
                        'terms/MLD-0002-ablation-study.html',
                        'technology/TECH-0216-pytorch.html'):
                    page.screenshot(path=str(out / f'no-script-detail-label-{route.replace("/", "-")}.png'))
    page.emulate_media(color_scheme='light')

    static.close()
    context=browser.new_context(viewport={'width':1440,'height':1050},reduced_motion='reduce')
    page=context.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base)
    page.locator('#catalog-loading').wait_for(state='detached')
    hydrated_nav=page.locator('#navigation a.nav-link').evaluate_all(
        "(els)=>els.map(a=>[a.getAttribute('href'),a.textContent.replace(/\\s+/g,' ').trim()])")
    check('sidebar links and order stay stable after hydration',hydrated_nav==initial_nav)
    # A keyboard-activated sidebar link used to keep focus in the old navigation,
    # rather than placing the user at the newly rendered workspace content.
    check('initial hydration does not steal keyboard focus',
          page.evaluate('document.activeElement === document.body'))
    page.locator('#navigation a[data-view="dictionary"]').focus()
    page.keyboard.press('Enter')
    page.locator('#collection h3 a').first.wait_for()
    check('dictionary link opens the native searchable tab',page.url.endswith('#/dictionary'))
    check('keyboard route moves focus into newly rendered main content',
          page.evaluate("document.activeElement.id === 'main'"))
    page.locator('#local-query').fill('transformer')
    check('typing within a catalog preserves the search field focus',
          page.evaluate("document.activeElement.id === 'local-query'"))
    page.locator('#navigation a[data-view="technologies"]').click()
    # The previous dictionary already has #collection links, so waiting for the
    # selector alone can race the async hashchange/route handler.
    page.wait_for_function("""() =>
        document.querySelector('#navigation a[data-view="technologies"]').getAttribute('aria-current') === 'page'
        && document.activeElement.id === 'main'""")
    check('technology link opens the native searchable tab',page.url.endswith('#/technologies'))
    check('changing main sections keeps focus in the active landmark',
          page.evaluate("document.activeElement.id === 'main'"))
    # Opening a hash-linked record replaces the card that originally held
    # keyboard focus. Closing that modal must not strand users on BODY.
    page.goto(base+'#/papers')
    page.locator('#catalog-loading').wait_for(state='detached')
    paper_link=page.locator('.paper-row h3 a').first
    paper_link.focus()
    page.keyboard.press('Enter')
    page.wait_for_function("document.getElementById('record-dialog').open")
    check('keyboard-opened paper shows an accessible modal',
          page.evaluate("document.activeElement.closest('#record-dialog') !== null"))
    page.keyboard.press('Escape')
    page.wait_for_function("!document.getElementById('record-dialog').open")
    check('Escape from a record restores focus to the main landmark',
          page.evaluate("document.activeElement.id === 'main' && location.hash.startsWith('#/papers') && !location.hash.includes('record=')"))
    # Removing a comparison from the floating dock previously detached the
    # focused button and returned keyboard users to the document body.
    page.goto(base+'#/technologies')
    page.locator('#catalog-loading').wait_for(state='detached')
    comparisons=page.locator('.tech-grid .card button[data-compare]')
    comparisons.nth(0).click()
    comparisons.nth(1).click()
    dock_remove=page.locator('#compare-dock button[data-compare]')
    check('comparison dock starts with two selected tools',dock_remove.count()==2)
    dock_remove.first.focus()
    page.keyboard.press('Enter')
    check('removing a tool keeps focus on the remaining dock control',
          dock_remove.count()==1 and
          page.evaluate("document.activeElement === document.querySelector('#compare-dock button[data-compare]')"))
    page.keyboard.press('Enter')
    check('removing the last tool returns focus to main content',
          page.evaluate("document.querySelector('#compare-dock').hidden && document.activeElement.id === 'main'"))
    page.locator('#navigation a[data-view="overview"]').click()
    page.locator('#daily-panel-title').wait_for()

    check('new brand and requested palette render', page.get_by_role('link',name='AI Updates home',exact=True).is_visible() and page.evaluate("getComputedStyle(document.body).backgroundColor")=='rgb(246, 246, 242)')
    # The input's native outline is intentionally suppressed; the enclosing search
    # control must provide a visible full-field focus indicator instead.
    focus_ring = """() => {
        const input = document.querySelector('#global-query');
        const shell = document.querySelector('.global-search');
        const style = getComputedStyle(shell);
        return document.activeElement === input && shell.matches(':focus-within')
            && style.outlineStyle === 'solid'
            && parseFloat(style.outlineWidth) >= 3
            && parseFloat(style.outlineOffset) >= 2;
    }"""
    page.locator('#global-query').focus()
    check('global search has a visible full-field focus ring in light theme', page.evaluate(focus_ring))
    page.screenshot(path=str(out/'desktop.png'),full_page=True)
    page.get_by_role('navigation',name='Discover topics').get_by_role('link',name='Tools & models',exact=True).click()
    page.wait_for_function("document.querySelectorAll('.discovery-card').length===2")
    check('topic tabs filter the editorial collection', page.locator('.discovery-card').count()==2 and 'topic=tools' in page.url)
    check('re-rendering discovery topics does not strand focus on a removed link',
          page.evaluate("document.activeElement.id === 'main'"))
    page.reload();page.locator('#catalog-loading').wait_for(state='detached')
    check('topic survives direct reload', page.locator('.discovery-card').count()==2)
    page.get_by_role('navigation',name='Discover topics').get_by_role('link',name='Research',exact=True).click()
    page.wait_for_function("document.querySelectorAll('.discovery-card').length===1")
    check('research tab displays the relevant reference', 'model doing inside' in page.locator('.discovery-card h3').inner_text())
    page.get_by_role('button',name='Toggle color theme',exact=True).click()
    page.locator('#global-query').focus()
    check('global search focus indicator remains visible in dark theme', page.evaluate(focus_ring))
    check('dark theme uses deep evergreen and fits the page', page.evaluate("getComputedStyle(document.body).backgroundColor")=='rgb(24, 33, 30)' and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.get_by_role('button',name='Toggle color theme',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base)
    page.locator('#catalog-loading').wait_for(state='detached')
    check('mobile discovery has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    # Compact catalog inputs were below 16px and triggered viewport zoom on iOS Safari.
    # Assert computed styles and touch geometry on actual phone-sized browser layouts.
    for mobile_width, mobile_height in ((390, 844), (320, 700)):
        page.set_viewport_size({'width':mobile_width, 'height':mobile_height})
        page.goto(base+'index.html#/dictionary')
        page.locator('#local-query').wait_for()
        check(f'{mobile_width}px catalog search/filter controls prevent focus zoom', page.evaluate("""() => {
            const selectors = ['#global-query', '#local-query', '.filter-row select'];
            const controls = selectors.map(selector => document.querySelector(selector));
            return controls.every(el => el && Number.parseFloat(getComputedStyle(el).fontSize) >= 16)
                && document.querySelector('.global-search').getBoundingClientRect().height >= 44
                && controls.slice(1).every(el => el.getBoundingClientRect().height >= 44)
                && document.documentElement.scrollWidth <= innerWidth;
        }"""))
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base)
    page.locator('#catalog-loading').wait_for(state='detached')
    page.locator('#global-query').focus()
    check('global search focus ring fits 390px mobile view', page.evaluate(focus_ring) and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.screenshot(path=str(out/'mobile.png'),full_page=True)
    check('closed mobile drawer is hidden from keyboard and accessibility tree',
          not page.locator('#sidebar').is_visible())
    page.locator('#discover-mobile-nav summary').focus()
    page.keyboard.press('Tab')
    check('Tab bypasses the closed mobile drawer',
          page.evaluate("!document.activeElement.closest('#sidebar')"))
    page.locator('#discover-mobile-nav summary').click()
    # Native <details> toggle dispatch is queued after the click's default
    # action. Wait for the shared isolation handler instead of racing that task;
    # a broken handler still fails this assertion at the bounded timeout.
    page.wait_for_function("""() => document.querySelector('#main').inert
        && document.activeElement.matches('#discover-mobile-nav summary')""", timeout=3000)
    check('native drawer keeps its trigger focused and isolates background content',
          page.evaluate("document.activeElement.matches('#discover-mobile-nav summary') && document.querySelector('#main').inert"))
    page.keyboard.press('Shift+Tab')
    check('Shift-Tab wraps inside the open drawer',
          page.evaluate("!!document.activeElement.closest('#discover-mobile-nav')"))
    page.keyboard.press('Escape')
    page.wait_for_function("""() => !document.getElementById('discover-mobile-nav').open
        && !document.querySelector('#main').inert
        && document.activeElement.matches('#discover-mobile-nav summary')""", timeout=3000)
    check('Escape closes shared native drawer and restores trigger focus',
          page.evaluate("document.activeElement.matches('#discover-mobile-nav summary') && !document.getElementById('discover-mobile-nav').open && !document.querySelector('#main').inert"))
    page.locator('#discover-mobile-nav summary').click()
    page.locator('#discover-mobile-nav .site-mobile-chrome__menu a[href="#/games"]').click()
    page.locator('#start-quiz').wait_for()
    check('mobile navigation retains native Quiz and Match',page.locator('#start-match').is_visible() and page.locator('#discover-mobile-nav').evaluate('el => !el.open'))
    # Discover used to hide its only theme button inside the desktop sidebar.
    # Its shared native mobile drawer should expose the same functional action
    # as the standalone pages, with persistence across direct page navigation.
    page.evaluate("document.documentElement.dataset.theme='dark';localStorage.setItem('atlas.theme','dark')")
    page.locator('#discover-mobile-nav summary').click()
    discover_theme = page.locator('#discover-mobile-nav .site-chrome__theme-toggle')
    check('Discover shares one visible mobile drawer theme action',
          discover_theme.count() == 1 and discover_theme.is_visible())
    discover_theme.click()
    check('Discover native drawer switches and saves light theme',
          page.evaluate("document.documentElement.dataset.theme==='light' && localStorage.getItem('atlas.theme')==='light'"))
    page.goto(base+'about.html')
    check('standalone About preserves Discover mobile appearance selection',
          page.evaluate("document.documentElement.dataset.theme==='light'"))
    page.locator('details.site-mobile-chrome__nav summary').click()
    about_theme = page.locator('.site-mobile-chrome__menu .site-chrome__theme-toggle')
    check('About exposes the same shared mobile appearance action',
          about_theme.count() == 1 and about_theme.is_visible())
    about_theme.click()
    check('About switches back to dark and persists across pages',
          page.evaluate("document.documentElement.dataset.theme==='dark' && localStorage.getItem('atlas.theme')==='dark'"))
    page.goto(base+'index.html#/games')
    page.locator('#start-quiz').wait_for()
    check('returning to Discover retains the theme selected on About',
          page.evaluate("document.documentElement.dataset.theme==='dark'"))
    # Native mobile drawers used to leave focused links hidden after tapping
    # outside; BFCache could also restore an open menu with inert surroundings.
    # Exercise the actual shared chrome on editorial and generated pages.
    for width,height in ((320,700),(390,844)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            for route in ('about.html','technology/TECH-0216-pytorch.html'):
                page.goto(base+route)
                page.evaluate("t => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
                drawer=page.locator('details.site-mobile-chrome__nav')
                trigger=drawer.locator('summary')
                trigger.click()
                page.wait_for_function("document.querySelector('.site-mobile-chrome__search').inert")
                drawer.locator('.site-mobile-chrome__menu a[href]').last.focus()
                # Dispatch on the document outside the modal; real background
                # nodes are inert and browser hit testing retargets their events.
                page.evaluate("document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))")
                check(f'{route} {width}px {theme} outside dismissal restores visible trigger and content',
                      not drawer.evaluate('el=>el.open')
                      and page.evaluate("document.activeElement.matches('details.site-mobile-chrome__nav summary')")
                      and not page.locator('.site-mobile-chrome__search').evaluate('el=>el.inert')
                      and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                trigger.click()
                page.wait_for_function("document.querySelector('.site-mobile-chrome__search').inert")
                page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
                check(f'{route} {width}px {theme} restored page clears stale modal isolation',
                      not drawer.evaluate('el=>el.open')
                      and not page.locator('.site-mobile-chrome__search').evaluate('el=>el.inert')
                      and page.evaluate("document.activeElement.matches('details.site-mobile-chrome__nav summary')"))
                if width==390 and theme=='dark':
                    page.screenshot(path=str(out/f'drawer-dismissed-{route.replace("/", "-")}.png'))
    # BFCache may resurrect a stale theme after a visitor changes appearance
    # elsewhere. Verify shared buttons and the restored theme in both modes.
    for width,height in ((320,700),(390,844),(768,900),(1280,900)):
        page.set_viewport_size({'width':width,'height':height})
        for route in ('about.html','technology/TECH-0216-pytorch.html'):
            page.goto(base+route)
            for saved in ('dark','light'):
                page.evaluate("""(saved) => {
                    document.documentElement.dataset.theme = saved === 'dark' ? 'light' : 'dark';
                    localStorage.setItem('atlas.theme', saved);
                    window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true}));
                }""", saved)
                buttons=page.locator('.site-chrome__theme-toggle')
                observed_theme = page.evaluate('document.documentElement.dataset.theme')
                observed_buttons = [(b.get_attribute('aria-pressed'), b.text_content())
                                    for b in buttons.all()]
                correct = (observed_theme == saved and len(observed_buttons) >= 1
                           and all(pressed == str(saved == 'dark').lower()
                                   and saved.title() + ' theme' in (label or '')
                                   for pressed, label in observed_buttons))
                if not correct:
                    print(f'BFCache theme diagnostic: {route} {width}px expected={saved} got={observed_theme}, controls={observed_buttons}', flush=True)
                check(f'{route} {width}px cached page restores {saved} appearance', correct)
    # Real Back/Forward navigation must preserve the canonical destination and
    # leave the returning page navigable, regardless of BFCache eligibility.
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base+'about.html')
    page.locator('details.site-mobile-chrome__nav summary').click()
    page.locator('details.site-mobile-chrome__nav nav a[href$="playbooks.html"]').click()
    page.wait_for_url('**/playbooks.html')
    page.go_back()
    page.wait_for_url('**/about.html')
    check('browser Back restores a usable standalone workspace after drawer navigation',
          not page.locator('details.site-mobile-chrome__nav').evaluate('el=>el.open')
          and not page.locator('.site-mobile-chrome__search').evaluate('el=>el.inert'))

    # On standalone and reference routes, / used to navigate to Search but
    # leave focus behind. Compare its real input handoff across screen sizes.
    for width, height in ((320,700),(390,844),(768,900),(1280,900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            for route in ('about.html','technology/TECH-0216-pytorch.html'):
                page.goto(base+route)
                page.evaluate("t => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
                page.keyboard.press('/')
                page.wait_for_url('**/index.html#/search')
                page.wait_for_function("() => document.activeElement?.id === 'global-query'", timeout=10000)
                check(f'{route} {width}px {theme} slash opens functional search ready for typing',
                      page.locator('#global-query').is_visible()
                      and page.evaluate("document.activeElement?.id === 'global-query'")
                      and page.evaluate("document.documentElement.dataset.theme") == theme
                      and page.evaluate("sessionStorage.getItem('atlas.searchShortcutPending') === null"))
                if (width,theme,route)==(390,'dark','about.html'):
                    page.locator('#global-query').fill('reward hacking')
                    page.locator('#global-query').press('Enter')
                    page.wait_for_url('**/index.html#/search?q=reward+hacking')
                    check('cross-page slash handoff submits an actual catalog query',
                          page.locator('#page h1').inner_text()=='Search the whole atlas.')
                    page.screenshot(path=str(out/'cross-page-slash-search-390-dark.png'))
    # Activating the existing mobile search link must focus the hydrated
    # Discover input, not merely navigate to the Search workspace.
    for width,height in ((320,700),(390,844)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            for route in ('about.html','technology/TECH-0216-pytorch.html'):
                page.goto(base+route)
                page.evaluate("t => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
                page.locator('.site-mobile-chrome__search').click()
                page.wait_for_url('**/index.html#/search')
                page.wait_for_function("() => document.activeElement?.id === 'global-query'", timeout=10000)
                check(f'{route} {width}px {theme} search-link click focuses actual input',
                      page.locator('#global-query').is_visible()
                      and page.evaluate("document.documentElement.dataset.theme") == theme
                      and page.evaluate("sessionStorage.getItem('atlas.searchShortcutPending') === null"))

    page.goto(base+'terms/MLD-1039-reward-hacking.html')
    check('rebranded expanded guide retains primary citations',page.locator('h1').inner_text()=='Reward hacking' and page.get_by_role('heading',name='Sources for the expanded explanation',exact=True).is_visible())
    check('mobile term guide fits the viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    # Shared desktop header comparisons must survive cross-page navigation at
    # representative phone, tablet, and desktop widths in both saved themes.
    for width, height in ((320, 700), (390, 844), (768, 900), (1280, 900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'research.html')
            page.evaluate("(theme) => { localStorage.setItem('atlas.theme', theme); document.documentElement.dataset.theme = theme; }",theme)
            check(f'Research {width}px {theme} header keeps its section identity',
                  page.locator('.research-mobile-topbar').get_attribute('data-page-label')=='Research library'
                  and page.evaluate("document.documentElement.dataset.theme") == theme)
            if (width,theme) in ((390,'dark'),(1280,'light')):
                page.screenshot(path=str(out/f'research-{width}-{theme}.png'))
            page.goto(base+'about.html')
            check(f'About {width}px {theme} keeps the shared section and saved appearance',
                  page.locator('.directory-mobile-topbar').get_attribute('data-page-label')=='About'
                  and page.evaluate("document.documentElement.dataset.theme") == theme)
    # Cross-page interaction check in both themes and at phone/tablet/desktop
    # sizes: real archive links must still work and return to the right subpage.
    for width, height in ((320, 700), (390, 844), (768, 900), (1280, 900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'about.html')
            page.evaluate('(t) => localStorage.setItem("atlas.theme", t)', theme)
            for route, label in (('catalog-review.html','Catalog review'),
                                 ('hardware-review.html','Hardware evidence')):
                page.goto(base+route)
                header=page.locator('.site-mobile-chrome')
                check(f'{route} {width}px {theme} shows its own identity under the daily section',
                      header.get_attribute('data-page-label')==label
                      and page.locator('.site-chrome__links a[aria-current="location"]').text_content()=='What’s New Today'
                      and page.evaluate('document.documentElement.dataset.theme')==theme
                      and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                if (width,theme)==(1280,'light'):
                    page.screenshot(path=str(out/f'editorial-subpage-{route}-desktop-light.png'))
                if width<=650:
                    page.locator('details.site-mobile-chrome__nav summary').click()
                    page.locator('details.site-mobile-chrome__nav a[href="whats-new.html"]').click()
                else:
                    page.locator('.site-chrome__links a[aria-current="location"]').click()
                check(f'{route} {width}px {theme} navigates to the actual daily archive',
                      page.url.split('?')[0].endswith('/whats-new.html')
                      and page.locator('.site-mobile-chrome').get_attribute('data-page-label')=='What’s New Today')
                page.go_back()
                # Back/Forward Cache can restore the history entry before the
                # browser has committed the old document's visible frame.
                # Wait for the same observable route and header, not a timeout.
                page.wait_for_function("""([target, name]) =>
                    location.pathname.endsWith('/' + target) &&
                    document.querySelector('.site-mobile-chrome')?.dataset.pageLabel === name
                """, arg=[route, label], timeout=10000)
                check(f'{route} {width}px {theme} Back restores editorial identity',
                      page.url.split('?')[0].endswith('/'+route)
                      and page.locator('.site-mobile-chrome').get_attribute('data-page-label')==label)

    # Existing landing-page hero spacing used unrelated 38-56px offsets, so
    # moving between Discover and the archive/directories changed the vertical
    # reading frame. Compare actual first content, not just CSS declarations.
    landing_intros = (
        ('about.html', 'main.term-shell > header.hero .eyebrow'),
        ('terms/index.html', 'main.term-shell > header.hero .eyebrow'),
        ('technology/index.html', 'main.term-shell > header.hero .eyebrow'),
        ('technologies.html', '.tech-shell > section.tech-hero .eyebrow'),
        ('playbooks.html', '.playbook-shell > section.playbook-hero .eyebrow'),
        ('whats-new.html', '.shell > main > header > div:first-child > .eyebrow'),
    )
    for width, height in ((768, 900), (1280, 900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.locator('.discover-heading .eyebrow').wait_for()
            page.evaluate("(theme) => { localStorage.setItem('atlas.theme', theme); document.documentElement.dataset.theme = theme; }",theme)
            discover_top=page.locator('.discover-heading .eyebrow').evaluate(
                'el => el.getBoundingClientRect().top')
            if (width,theme) == (1280,'light'):
                page.screenshot(path=str(out/'intro-discover-1280-light.png'),full_page=False)
            for route, selector in landing_intros:
                page.goto(base+route)
                intro=page.locator(selector)
                intro.wait_for()
                intro_top=intro.evaluate('el => el.getBoundingClientRect().top')
                check(f'{route} {width}px {theme} intro aligns with Discover workspace',
                      abs(intro_top-discover_top) <= 36
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                      and page.evaluate('document.documentElement.dataset.theme') == theme)
                if width==1280 and theme=='light' and route in ('about.html','playbooks.html','whats-new.html'):
                    page.screenshot(path=str(out/('intro-'+route.replace('.html','')+'-1280-light.png')),full_page=False)

    # Three standalone page families now adopt Discover's existing heading
    # component rather than copying its type rules into page-specific CSS.
    # Check computed typography and lack of horizontal clipping in both themes.
    heading_routes = (
        ('research.html', 'section.hero h1'),
        ('technologies.html', 'section.tech-hero h1'),
        ('playbooks.html', 'section.playbook-hero h1'),
    )
    for width, height in ((320, 700), (390, 844), (768, 900), (1280, 900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.evaluate("(t) => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
            baseline=page.locator('.discover-heading h1').evaluate(
                "el => ({family:getComputedStyle(el).fontFamily,weight:getComputedStyle(el).fontWeight})")
            for route, heading in heading_routes:
                page.goto(base+route)
                title=page.locator(heading)
                title.wait_for()
                actual=title.evaluate(
                    "el => ({family:getComputedStyle(el).fontFamily,weight:getComputedStyle(el).fontWeight})")
                check(f'{route} {width}px {theme} reuses Discover heading typography without clipping',
                      actual==baseline
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                      and page.evaluate('document.documentElement.dataset.theme')==theme)
                if width==1280 and theme=='light':
                    page.screenshot(path=str(out/f'heading-{route.replace(".html","")}-{width}-{theme}.png'))

    # Three remaining editorial/reference pages previously used independent h1
    # sizing; keep their first-paint hero typography aligned with Discover.
    # Browser engines serialize equivalent fallback font stacks differently;
    # compare the actual primary face (Georgia), exact weight/size/line-height,
    # rather than treating Georgia,serif and Georgia,Times,serif as different.
    editorial_titles = (
        ('about.html', 'header.hero .discover-heading h1'),
        ('hardware-review.html', 'header .discover-heading h1'),
        ('catalog-review.html', 'main > header .discover-heading h1'),
    )
    for width, height in ((320, 700), (390, 844), (768, 900), (1280, 900)):
        page.set_viewport_size({'width':width, 'height':height})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.evaluate("t => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
            baseline = page.locator('.discover-heading h1').evaluate(
                "el => {const s=getComputedStyle(el);return {face:s.fontFamily.split(',')[0].trim().replaceAll(String.fromCharCode(34),'').replaceAll(String.fromCharCode(39),'').toLowerCase(),weight:s.fontWeight,size:s.fontSize,lineHeight:s.lineHeight}}")
            for route, selector in editorial_titles:
                page.goto(base+route)
                title = page.locator(selector)
                title.wait_for()
                actual = title.evaluate(
                    "el => {const s=getComputedStyle(el);return {face:s.fontFamily.split(',')[0].trim().replaceAll(String.fromCharCode(34),'').replaceAll(String.fromCharCode(39),'').toLowerCase(),weight:s.fontWeight,size:s.fontSize,lineHeight:s.lineHeight}}")
                check(f'{route} {width}px {theme} editorial hero matches Discover and fits',
                      actual == baseline and title.is_visible()
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                      and page.evaluate('document.documentElement.dataset.theme') == theme)
                if (width,theme) in ((390,'dark'),(1280,'light')):
                    page.screenshot(path=str(out/f'editorial-heading-{route}-{width}-{theme}.png'))


    # Every migrated page uses one real SVG brand rather than waiting for
    # DOMContentLoaded to clone it or rendering a second dynamic logo.
    for width in (320, 390):
        page.set_viewport_size({'width':width,'height':844})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.evaluate("t => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
            for route in ('about.html','whats-new.html','research.html',
                          'technologies.html','playbooks.html',
                          'terms/index.html','technology/index.html'):
                page.goto(base+route)
                menu=page.locator('details.site-mobile-chrome__nav .site-mobile-chrome__menu')
                check(f'{route} {width}px {theme} drawer reuses one brand after hydration',
                      menu.locator('a.site-mobile-chrome__brand').count()==1
                      and menu.locator('a[href]').count()==8
                      and page.evaluate('document.documentElement.dataset.theme')==theme
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                if width==390 and theme=='dark' and route in ('about.html','terms/index.html'):
                    page.locator('details.site-mobile-chrome__nav summary').click()
                    page.screenshot(path=str(out/f'mobile-brand-{route.replace("/", "-")}-390-dark.png'))


    # The prior screenshots revealed iconless standalone desktop navigation
    # beside Discover's icon-led rail. Verify the SAME seven visible icons
    # on reference, editorial, news and Games pages in both saved themes.
    for width in (768, 1280):
        page.set_viewport_size({'width':width,'height':900})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.evaluate("t => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
            check(f'Discover {width}px {theme} keeps native SVG primary icons',
                  page.locator('#navigation a.nav-link svg').count() >= 7)
            for route in ('about.html','whats-new.html','terms/index.html',
                          'technology/TECH-0216-pytorch.html','games.html'):
                page.goto(base+route)
                icons=page.locator('.site-chrome .site-chrome__links a').evaluate_all("""els => els.map(a => {
                    const s=getComputedStyle(a,'::before');
                    return {width:s.width, height:s.height,
                            icon:s.webkitMaskImage||s.maskImage,
                            current:a.hasAttribute('aria-current')};
                })""")
                # A declared mask URL can still render a blank icon if its
                # external SVG lacks an XML namespace. Decode every real image.
                decoded=page.locator('.site-chrome .site-chrome__links a').evaluate_all("""async els => Promise.all(els.map(async a => {
                    const s=getComputedStyle(a,'::before');
                    const uri=(s.webkitMaskImage||s.maskImage).match(/data:image\\/svg\\+xml,[^")]+/)?.[0];
                    if(!uri)return false;
                    const img=new Image();img.src=uri;
                    try {await img.decode();return img.naturalWidth>0 && img.naturalHeight>0;}
                    catch {return false;}
                }))""")
                check(f'{route} {width}px {theme} shares seven rendered desktop SVG icons',
                      len(icons)==7 and all(decoded)
                      and all(icon['width']=='16px' and icon['height']=='16px'
                              and 'data:image/svg+xml,' in icon['icon'] for icon in icons)
                      and sum(icon['current'] for icon in icons)<=1
                      and page.evaluate('document.documentElement.dataset.theme')==theme
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                if width==1280 and theme=='light' and route in ('about.html','whats-new.html','terms/index.html'):
                    page.screenshot(path=str(out/f'rail-icons-{route.replace("/", "-")}.png'))
            if width==1280 and theme=='light':
                page.goto(base+'about.html')
                page.locator('.site-chrome .site-chrome__links a[href$="#/overview"]').click()
                check('shared desktop rail returns from About to actual Discover',
                      page.locator('.discover-heading h1').inner_text()=='Discover')

    # Compare actual editorial subsection type against the existing Discover
    # reading desk; navigation, reading widths and content remain untouched.
    for width in (320, 390, 768, 1280):
        page.set_viewport_size({'width': width, 'height': 900})
        for theme in ('light', 'dark'):
            page.goto(base)
            page.evaluate("(theme) => { localStorage.setItem('atlas.theme', theme); document.documentElement.dataset.theme = theme; }", theme)
            discover_type = page.locator('.reading-link h2').evaluate(
                "el => ({family:getComputedStyle(el).fontFamily,weight:getComputedStyle(el).fontWeight})")
            for route, selector in (
                ('about.html', '.term-shell > .profile-section > h2'),
                ('catalog-review.html', '.shell > main > section > h2'),
                ('hardware-review.html', '.review-shell > section > h2'),
                ('terms/MLD-0002-ablation-study.html', '.term-shell > .detail-block > h2'),
                ('technology/TECH-0216-pytorch.html', '.term-shell > .profile-section > h2'),
            ):
                page.goto(base + route)
                heading = page.locator(selector).first
                styling = heading.evaluate("""el => {
                    const s=getComputedStyle(el);
                    return {family:s.fontFamily,weight:s.fontWeight,size:parseFloat(s.fontSize),color:s.color};
                }""")
                check(f'{route} {width}px {theme} uses shared editorial section typography',
                      heading.is_visible() and styling['family'].lower().startswith('georgia')
                      and discover_type['family'].lower().startswith('georgia')
                      and styling['weight'] == discover_type['weight'] == '400'
                      and 21 <= styling['size'] <= 25.1
                      and page.evaluate('document.documentElement.dataset.theme') == theme
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                if width == 1280 and theme == 'light' and route in ('about.html','catalog-review.html'):
                    page.screenshot(path=str(out / f'editorial-heading-{route}.png'),full_page=True)


    # One editorial reading frame is used across existing page families, while
    # the daily archive and playable Games retain their own content layouts.
    # Compare first-content position to Discover at real phone/tablet/desktop
    # sizes and verify that theme/navigation survive every page transition.
    reading_routes = (
        ('about.html', '.term-shell'),
        ('terms/MLD-0002-ablation-study.html', '.term-shell'),
        ('technology/TECH-0216-pytorch.html', '.term-shell'),
        ('technologies.html', '.tech-shell'),
        ('playbooks.html', '.playbook-shell'),
        ('hardware-review.html', '.review-shell'),
        ('catalog-review.html', '.shell:has(> .site-chrome.nav)'),
        ('research.html', '.shell:has(> main > .site-chrome.research-site-chrome)'),
    )
    for width, height in ((320,700),(390,844),(768,900),(1280,900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.locator('.discover-heading h1').wait_for()
            page.evaluate("t => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
            discover_x = page.locator('.discover-heading h1').evaluate('el => el.getBoundingClientRect().left')
            for route, selector in reading_routes:
                page.goto(base+route)
                el = page.locator(selector).first
                metrics = el.evaluate("""el => {
                    const r=el.getBoundingClientRect(), s=getComputedStyle(el);
                    return {max:s.maxWidth,padding:parseFloat(s.paddingLeft),
                            contentLeft:r.left+parseFloat(s.paddingLeft)};
                }""")
                aligned = (width < 651 or
                           (metrics['max']=='1120px' and
                            24 <= metrics['padding'] <= 36 and
                            abs(metrics['contentLeft']-discover_x) <= 16))
                check(f'{route} {width}px {theme} shares Discover reading frame without overflow',
                      aligned and page.evaluate('document.documentElement.scrollWidth <= innerWidth') and
                      page.evaluate('document.documentElement.dataset.theme')==theme)
                if (width,theme)==(1280,'light') and route in ('about.html','playbooks.html','hardware-review.html','catalog-review.html'):
                    page.screenshot(path=str(out/f'reading-frame-{route}-1280-light.png'))


    # Cards from seven established page families should read as one workspace,
    # rather than alternating between independent white/cream panels and radii.
    # Use Discover's actual computed surface/border as the reference.
    card_routes = (
        ('about.html', '.term-shell > .profile-section'),
        ('terms/MLD-0002-ablation-study.html', '.term-shell > .detail-block'),
        ('technology/TECH-0216-pytorch.html', '.term-shell > .profile-section'),
        ('playbooks.html', '.playbook-shell .playbook'),
        ('technologies.html', '.tech-shell .tech-card'),
        ('catalog-review.html', '.shell:has(> .site-chrome.nav) article.card'),
        ('whats-new.html', '.shell:has(> .site-chrome.top) .panel'),
    )
    for width, height in ((320,700),(390,844),(768,900),(1280,900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.locator('.discovery-card').first.wait_for(state='visible')
            page.evaluate("t => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
            discover_surface=page.locator('.discovery-card').first.evaluate("""el => {
                const s=getComputedStyle(el);
                return {background:s.backgroundColor,border:s.borderTopColor,
                        width:s.borderTopWidth,radius:s.borderTopLeftRadius};
            }""")
            for route, selector in card_routes:
                page.goto(base+route)
                card=page.locator(selector).first
                card.wait_for(state='visible',timeout=15000)
                style=card.evaluate("""el => {
                    const s=getComputedStyle(el);
                    return {background:s.backgroundColor,border:s.borderTopColor,
                            width:s.borderTopWidth,radius:s.borderTopLeftRadius,
                            padding:parseFloat(s.paddingLeft),borderStyle:s.borderTopStyle};
                }""")
                check(f'{route} {width}px {theme} shares Discover editorial card surface',
                      style['background']==discover_surface['background']
                      and style['border']==discover_surface['border']
                      and style['width']==discover_surface['width']=='1px'
                      and style['radius']==discover_surface['radius']=='11px'
                      and style['borderStyle']=='solid'
                      and 18<=style['padding']<=24.1
                      and page.evaluate('document.documentElement.dataset.theme')==theme
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                if (width,theme) in ((1280,'light'),(390,'dark')) and route in ('about.html','playbooks.html','catalog-review.html','whats-new.html'):
                    page.screenshot(path=str(out/f'editorial-cards-{route}-{width}-{theme}.png'))


    # A single real footer rhythm should carry across the standalone families.
    # Compare Discover's computed footer, not just class names or CSS text.
    # Section-specific copy and links remain intact and functional.
    footer_routes = (
        'about.html','whats-new.html','terms/index.html',
        'terms/MLD-0002-ablation-study.html','technologies.html',
        'technology/TECH-0216-pytorch.html','research.html',
        'playbooks.html','catalog-review.html','hardware-review.html',
        'games.html',
    )
    for width, height in ((320,700),(390,844),(768,900),(1280,900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.locator('.main-footer').wait_for(state='attached')
            page.evaluate("t => {localStorage.setItem('atlas.theme',t);document.documentElement.dataset.theme=t}",theme)
            reference=page.locator('.main-footer').evaluate("""el => {
                const s=getComputedStyle(el);
                return {border:s.borderTopWidth,padding:s.paddingTop,margin:s.marginTop,
                        font:s.fontSize,line:s.lineHeight,color:s.color,rule:s.borderTopColor};
            }""")
            for route in footer_routes:
                page.goto(base+route)
                foot=page.locator('footer').last
                foot.wait_for(state='attached',timeout=15000)
                values=foot.evaluate("""el => {
                    const s=getComputedStyle(el);
                    return {border:s.borderTopWidth,padding:s.paddingTop,margin:s.marginTop,
                            font:s.fontSize,line:s.lineHeight,color:s.color,rule:s.borderTopColor,
                            linkCount:el.querySelectorAll('a[href]').length,
                            width:el.getBoundingClientRect().width};
                }""")
                check(f'{route} {width}px {theme} shares Discover footer rhythm',
                      all(values[k]==reference[k] for k in ('border','padding','margin','font','line','color','rule'))
                      and values['border']=='1px' and values['linkCount'] >= (0 if route=='research.html' else 1)
                      and values['width']>0
                      and page.evaluate('document.documentElement.dataset.theme')==theme
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                if (width,theme) in ((1280,'light'),(390,'dark')) and route in ('about.html','whats-new.html','games.html'):
                    foot.scroll_into_view_if_needed()
                    page.screenshot(path=str(out/f'shared-footer-{route}-{width}-{theme}.png'))


    # Shared cross-page search/filter fields: native controls, not fake search
    # decorations. Compare each page family at the same viewport and theme,
    # and exercise existing Reset behavior rather than merely checking CSS text.
    filter_routes = (
        ('technologies.html', '.tech-controls #tech-search', '#tech-reset'),
        ('playbooks.html', '.playbook-tools #search', '#reset'),
        ('research.html', '.controls #query', '#reset'),
        ('games.html', '.filters #query', '#reset-filters'),
        ('whats-new.html', '.search-controls #edition-search', '#reset-filters'),
    )
    for width, height in ((320,700),(390,844),(768,900),(1280,900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.evaluate("(t) => localStorage.setItem('atlas.theme',t)",theme)
            for route, selector, reset_selector in filter_routes:
                page.goto(base+route)
                field=page.locator(selector).first
                field.wait_for(state='visible', timeout=20000)
                appearance=field.evaluate("""el => {
                    const style=getComputedStyle(el), rect=el.getBoundingClientRect();
                    return {height:rect.height, width:rect.width,
                      radius:style.borderTopLeftRadius, border:style.borderTopStyle,
                      font:style.fontSize, background:style.backgroundColor,
                      color:style.color, margin:style.marginTop};
                }""")
                expected_bg='rgb(34, 45, 39)' if theme=='dark' else 'rgb(255, 255, 255)'
                check(f'{route} {width}px {theme} shares native filter controls',
                      appearance['radius']=='7px' and appearance['border']=='solid'
                      and appearance['width']>0 and appearance['height'] >= (44 if width<=650 else 42)
                      and appearance['background']==expected_bg
                      and float(appearance['font'].replace('px','')) >= (16 if width<=650 else 13)
                      and page.evaluate('document.documentElement.dataset.theme')==theme
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                if width==1280 and theme=='light' and route!='whats-new.html':
                    field.fill('atlas-qa-unfindable-term')
                    page.locator(reset_selector).click()
                    check(f'{route} original Reset clears search after filtering',
                          field.input_value()=='')
                if (width,theme) in ((1280,'light'),(390,'dark')):
                    field.scroll_into_view_if_needed()
                    page.screenshot(path=str(out/f'shared-filters-{route}-{width}-{theme}.png'))


    # Actual dark-theme screenshot audit exposed unreadable pale research-scope
    # callouts on Technology and Playbooks. Contrast-test their original content
    # in both themes without replacing or hiding the caveats.
    for width, height in ((390,844),(1280,900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.evaluate("(t) => localStorage.setItem('atlas.theme',t)",theme)
            for route, selector in (('technologies.html','.tech-warning'),
                                    ('playbooks.html','.playbook-note')):
                page.goto(base+route)
                card=page.locator(selector)
                card.wait_for(state='visible')
                contrast=card.evaluate("""el => {
                    const s=getComputedStyle(el);
                    const rgb=t => [...t.matchAll(/[0-9]+(?:\\.[0-9]+)?/g)].slice(0,3).map(v=>Number(v[0]));
                    const lum=values => values.reduce((sum,x,i) => {
                        const u=x/255, linear=u<=0.04045?u/12.92:((u+0.055)/1.055)**2.4;
                        return sum+linear*[0.2126,0.7152,0.0722][i];
                    },0);
                    const a=lum(rgb(s.color)), b=lum(rgb(s.backgroundColor));
                    return {ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05),
                            bg:s.backgroundColor,text:s.color};
                }""")
                check(f'{route} {width}px {theme} keeps scope note readable',
                      contrast['ratio']>=7
                      and (contrast['bg']=='rgb(49, 65, 56)' if theme=='dark'
                           else contrast['bg'] in ('rgb(246, 238, 224)','rgb(247, 239, 223)'))
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                if theme=='dark':
                    card.scroll_into_view_if_needed()
                    page.screenshot(path=str(out/f'scope-note-{route}-{width}-{theme}.png'))


    # Compare semantic information notices across actual rendered page families.
    # Research's old fixed light-gold background made dark-theme body text nearly
    # unreadable; the shared tokens must render consistently in both themes.
    info_notes=(
        ('research.html','.shell .notice'),
        ('catalog-review.html','.shell .notice'),
        ('hardware-review.html','.review-shell .review-callout'),
        ('terms/MLD-0002-ablation-study.html','.term-shell .notice'),
        ('technology/TECH-0216-pytorch.html','.term-shell .notice'),
    )
    for width,height in ((320,700),(390,844),(768,900),(1280,900)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'index.html#/overview')
            page.evaluate("(t) => localStorage.setItem('atlas.theme',t)",theme)
            for route,selector in info_notes:
                page.goto(base+route)
                note=page.locator(selector).first
                note.wait_for(state='visible',timeout=20000)
                computed=note.evaluate("""el=>{
                    const s=getComputedStyle(el), box=el.getBoundingClientRect();
                    const rgb=text=>[...text.matchAll(/[0-9]+/g)].slice(0,3).map(x=>Number(x[0]));
                    const lum=arr=>arr.reduce((v,c,i)=>{
                        const n=c/255,z=n<=.04045?n/12.92:((n+.055)/1.055)**2.4;
                        return v+z*[.2126,.7152,.0722][i]},0);
                    const a=lum(rgb(s.color)),b=lum(rgb(s.backgroundColor));
                    return {background:s.backgroundColor,
                            contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),
                            border:s.borderLeftWidth,width:box.width};
                }""")
                check(f'{route} {width}px {theme} shares readable information note',
                      computed['background']==('rgb(45, 64, 51)' if theme=='dark'
                                                else 'rgb(233, 238, 231)')
                      and computed['contrast']>=7
                      and computed['border']=='4px'
                      and computed['width']>0
                      and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                if (width,theme) in ((390,'dark'),(1280,'light')) and route in ('research.html','catalog-review.html','hardware-review.html'):
                    note.scroll_into_view_if_needed()
                    page.screenshot(path=str(out/f'info-note-{route}-{width}-{theme}.png'))

    # Generated directory footnotes contain one longer search link. It must
    # wrap rather than widen the document after adopting the shared info panel.
    page.set_viewport_size({'width':320,'height':700})
    page.goto(base+'terms/index.html')
    check('concept directory remains within narrow mobile viewport',
          page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.goto(base+'technology/index.html')
    link=page.locator('.term-shell .notice a').first
    check('technology directory long note link wraps without mobile overflow',
          link.count()==1
          and link.evaluate("el=>getComputedStyle(el).whiteSpace")=='normal'
          and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))



    # The actual Discover input was only 12px on narrow phones, unlike the
    # 16px mobile search control elsewhere. Match the native frame without
    # replacing the real search form with a fake link.
    for width,height in ((320,700),(390,844)):
        page.set_viewport_size({'width':width,'height':height})
        for theme in ('light','dark'):
            page.goto(base+'about.html')
            page.evaluate("(t) => localStorage.setItem('atlas.theme',t)",theme)
            page.reload()
            search_link=page.locator('.site-mobile-chrome__search').first
            search_link.wait_for(state='visible')
            reference=search_link.evaluate("""el=>{
                const s=getComputedStyle(el),r=el.getBoundingClientRect();
                return {height:r.height,padding:s.paddingLeft,
                        border:s.borderTopWidth,radius:s.borderTopLeftRadius,
                        background:s.backgroundColor};
            }""")
            page.goto(base+'index.html#/overview')
            field=page.locator('#global-query')
            field.wait_for(state='visible')
            live=page.locator('.topbar .global-search').evaluate("""el=>{
                const s=getComputedStyle(el),r=el.getBoundingClientRect();
                const input=el.querySelector('input');
                return {height:r.height,padding:s.paddingLeft,
                        border:s.borderTopWidth,radius:s.borderTopLeftRadius,
                        background:s.backgroundColor,
                        inputFont:getComputedStyle(input).fontSize};
            }""")
            check(f'Discover and About share mobile search framing at {width}px {theme}',
                  live['height']>=44 and reference['height']>=44
                  and all(live[k]==reference[k] for k in ('padding','border','radius','background'))
                  and live['inputFont']=='16px'
                  and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            # Search is initialized asynchronously after the catalog verifies.
            # Wait for the existing ready marker, then exercise real submission;
            # merely finding the painted input does not prove it is hydrated.
            page.locator('#catalog-loading').wait_for(state='detached', timeout=20000)
            field.fill('reward hacking')
            field.press('Enter')
            page.wait_for_function("location.hash.startsWith('#/search')")
            check(f'Discover live search still submits at {width}px {theme}',
                  'reward' in page.evaluate('location.hash').lower()
                  and 'hacking' in page.evaluate('location.hash').lower())

    # Crossing from an open phone drawer to a desktop rail must restore visible
    # keyboard focus on every shared page family, without stale inert content.
    for theme in ('light', 'dark'):
        page.set_viewport_size({'width':390,'height':844})
        page.goto(base+'index.html#/overview')
        page.evaluate("(t)=>localStorage.setItem('atlas.theme',t)",theme)
        for route in ('index.html#/overview','about.html','whats-new.html',
                      'technology/TECH-0216-pytorch.html','games.html'):
            page.set_viewport_size({'width':390,'height':844})
            page.goto(base+route)
            drawer=page.locator('details.site-mobile-chrome__nav').first
            drawer.locator('summary').click()
            drawer.locator('.site-mobile-chrome__menu a[href]').last.focus()
            check(f'{route} {theme} menu holds focus before viewport change',
                  drawer.evaluate('el=>el.open && el.contains(document.activeElement)'))
            if theme=='dark' and route in ('about.html','technology/TECH-0216-pytorch.html'):
                page.screenshot(path=str(out/f'drawer-before-resize-{route.split("/")[-1]}-390-dark.png'))
            page.set_viewport_size({'width':768,'height':900})
            page.wait_for_function("""() => {
                const drawer=document.querySelector('details.site-mobile-chrome__nav');
                return drawer && !drawer.open;
            }""")
            focus=page.evaluate("""() => {
                const selected=document.querySelector(
                    '.site-chrome__links a[aria-current], #navigation a[aria-current]');
                const main=document.querySelector('main');
                return {selected: selected?.textContent.trim() || null,
                        active: document.activeElement?.outerHTML.slice(0,160) || null,
                        activeMatch: !!selected && document.activeElement===selected,
                        visible: !!selected && getComputedStyle(selected).display!=='none' &&
                                 selected.getClientRects().length>0,
                        mainInert: !!main && main.inert,
                        overflow:document.documentElement.scrollWidth>innerWidth};
            }""")
            print('RESIZE-FOCUS',route,theme,json.dumps(focus),flush=True)
            check(f'{route} {theme} desktop rail restores visible keyboard focus',
                  focus['activeMatch'] and focus['visible'] and
                  not focus['mainInert'] and not focus['overflow'])
            if theme=='dark' and route in ('about.html','technology/TECH-0216-pytorch.html'):
                page.screenshot(path=str(out/f'drawer-after-resize-{route.split("/")[-1]}-768-dark.png'))

    # When desktop CSS hides its focused rail, Chromium blurs it before the
    # resize event. The shared helper must restore focus to a visible mobile
    # toggle rather than marooning keyboard users on the document body.
    for desktop_width in (768,1280):
        for theme in ('light','dark'):
            for route in ('index.html#/overview','about.html',
                          'technology/TECH-0216-pytorch.html'):
                page.set_viewport_size({'width':desktop_width,'height':900})
                page.goto(base+route)
                page.evaluate("""t => {
                    localStorage.setItem('atlas.theme',t);
                    document.documentElement.dataset.theme=t;
                }""",theme)
                rail=page.locator('#navigation a[aria-current="page"]') if route.startswith('index.html') else page.locator('.site-chrome__links a[aria-current]')
                rail.first.wait_for(state='visible')
                rail.first.focus()
                check(f'{route} {desktop_width}px {theme} rail is focused before shrink',
                      rail.first.evaluate('(el)=>document.activeElement===el'))
                page.set_viewport_size({'width':390,'height':844})
                page.wait_for_function("""() =>
                    document.activeElement === document.querySelector('details.site-mobile-chrome__nav summary')""")
                toggle=page.locator('details.site-mobile-chrome__nav summary').first
                check(f'{route} {desktop_width}->390px {theme} restores visible mobile toggle focus',
                      toggle.evaluate("""el => document.activeElement===el &&
                          el.getClientRects().length>0""")
                      and page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                      and page.evaluate('document.documentElement.dataset.theme')==theme)
                if desktop_width==1280 and theme=='dark':
                    page.screenshot(path=str(out/f'rail-to-mobile-{route.split("/")[-1]}-390-dark.png'))
                page.set_viewport_size({'width':320,'height':700})
                check(f'{route} 390->320px {theme} leaves mobile toggle focus undisturbed',
                      toggle.evaluate('el=>document.activeElement===el && el.getClientRects().length>0'))

    # A closed mobile drawer's toggle is still a focusable navigation control.
    # Desktop CSS hides it after rotation; focus must move to the visible rail
    # even if Chromium has already blurred the summary to <body>.
    for mobile_width, desktop_width in ((320,768),(390,1280)):
        for theme in ('light','dark'):
            for route in ('index.html#/overview','about.html',
                          'technology/TECH-0216-pytorch.html'):
                page.set_viewport_size({'width':mobile_width,'height':844})
                page.goto(base+route)
                page.evaluate("""t => {
                    localStorage.setItem('atlas.theme',t);
                    document.documentElement.dataset.theme=t;
                }""",theme)
                toggle=page.locator('details.site-mobile-chrome__nav summary').first
                toggle.focus()
                check(f'{route} {mobile_width}px {theme} closed mobile toggle takes focus',
                      toggle.evaluate('el=>document.activeElement===el && el.getClientRects().length>0'))
                page.set_viewport_size({'width':desktop_width,'height':900})
                page.wait_for_function("""() => {
                    const rail=document.querySelector('.site-chrome__links a[aria-current]') ||
                        document.querySelector('#navigation a[aria-current]');
                    return !!rail && document.activeElement===rail;
                }""")
                check(f'{route} {mobile_width}->{desktop_width}px {theme} closed drawer focus handoff',
                      page.evaluate("""() => {
                          const rail=document.querySelector('.site-chrome__links a[aria-current]') ||
                              document.querySelector('#navigation a[aria-current]');
                          return !!rail && document.activeElement===rail &&
                              rail.getClientRects().length>0 &&
                              document.documentElement.scrollWidth<=innerWidth;
                      }"""))
                if mobile_width==390 and theme=='dark' and route=='about.html':
                    page.screenshot(path=str(out/'closed-mobile-to-desktop-about-1280-dark.png'))

    # Resizing while editing real content must not unexpectedly move focus.
    page.set_viewport_size({'width':768,'height':900})
    page.goto(base+'about.html')
    page.evaluate("""() => {
        const main=document.querySelector('main');
        main.setAttribute('tabindex','-1');
        main.focus();
    }""")
    page.set_viewport_size({'width':390,'height':844})
    check('responsive shrink does not steal focus from the main content',
          page.evaluate('document.activeElement===document.querySelector("main")'))

    # The existing guided-demo reference used its own wordmark/navigation and
    # forced light-theme cards. It now inherits the canonical Discover rail,
    # mobile menu/search and saved appearance without replacing tour links.
    page.set_viewport_size({'width':1280,'height':900})
    page.goto(base+'index.html#/overview')
    canonical=[s.strip() for s in page.locator('#navigation > a.nav-link > span:first-of-type').all_text_contents()]
    for width in (320,390,768,1280):
        for theme in ('light','dark'):
            page.set_viewport_size({'width':width,'height':844})
            page.goto(base+'demo.html')
            page.evaluate('(theme)=>localStorage.setItem("atlas.theme",theme)',theme)
            page.reload()
            frame=page.evaluate("""() => ({
                desktop: [...document.querySelectorAll('.site-chrome__links a')].map(a=>a.textContent.trim()),
                activeDesktop: document.querySelector('.site-chrome__links a[aria-current]')?.textContent.trim(),
                activeMobile: document.querySelector('.site-mobile-chrome__menu a[aria-current]')?.textContent.trim(),
                pageLabel: document.querySelector('.site-mobile-chrome')?.dataset.pageLabel,
                theme: document.documentElement.dataset.theme,
                card: getComputedStyle(document.querySelector('#quick-tour article')).backgroundColor,
                body: getComputedStyle(document.body).backgroundColor,
                menuVisible: !!document.querySelector('.site-mobile-chrome__nav summary')?.getClientRects().length,
                railVisible: !!document.querySelector('.site-chrome')?.getClientRects().length,
                overflow: document.documentElement.scrollWidth>innerWidth
            })""")
            check(f'guided demo {width}px {theme} reuses Discover primary navigation',
                  frame['desktop']==canonical and frame['activeDesktop']=='Discover'
                  and frame['activeMobile']=='Discover' and frame['pageLabel']=='Guided demo'
                  and frame['theme']==theme and frame['menuVisible']==(width<=650)
                  and frame['railVisible']==(width>650) and not frame['overflow'])
            check(f'guided demo {width}px {theme} honors saved theme on real content',
                  frame['card']!=frame['body'])
            if (width==390 and theme=='dark') or (width==1280 and theme=='light'):
                page.screenshot(path=str(out/f'guided-demo-{width}-{theme}.png'))
            if width<=650:
                page.locator('#demo-mobile-nav summary').click()
                page.locator('#demo-mobile-nav .site-mobile-chrome__menu a[href="index.html#/overview"]').click()
            else:
                page.locator('.demo-site-chrome .site-chrome__links a[href="index.html#/overview"]').click()
            page.wait_for_url('**/index.html#/overview')
            check(f'guided demo {width}px {theme} navigates into Discover',
                  page.evaluate('document.documentElement.dataset.theme')==theme)
            page.go_back()
            check(f'guided demo {width}px {theme} browser Back keeps page identity',
                  page.locator('.site-mobile-chrome').get_attribute('data-page-label')=='Guided demo'
                  and page.evaluate('document.documentElement.dataset.theme')==theme)

    check('no application runtime exceptions',not errors)
    browser.close()
(out/'results.json').write_text(json.dumps({'checks_passed':len(checks),'checks':checks,'base':base},indent=2))
