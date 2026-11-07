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

    check('no application runtime exceptions',not errors)
    browser.close()
(out/'results.json').write_text(json.dumps({'checks_passed':len(checks),'checks':checks,'base':base},indent=2))
