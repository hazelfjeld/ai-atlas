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
    check('all 14 sidebar destinations are present at first paint',len(initial_nav)==14)
    check('dictionary, technology and Games links use workspace routes before hydration',
          page.locator('#navigation a[data-view="dictionary"]').get_attribute('href')=='#/dictionary'
          and page.locator('#navigation a[data-view="technologies"]').get_attribute('href')=='#/technologies'
          and page.locator('#navigation a[data-view="games"]').get_attribute('href')=='#/games')

    check('canonical points to the primary domain', page.locator('link[rel=canonical]').get_attribute('href')=='https://aiupdates.app/')
    page.get_by_role('link',name='Read PyTorch',exact=True).click()
    check('technology profile works without JavaScript', page.locator('h1').inner_text()=='PyTorch' and page.get_by_role('heading',name='Tradeoffs & cautions',exact=True).is_visible())
    page.get_by_role('navigation',name='Site navigation').get_by_role('link',name='Technologies',exact=True).click()
    expected_profiles=json.loads((Path(__file__).resolve().parents[1]/'publication.json').read_text())['published_counts']['technologies']
    check('technology directory exposes every checksummed crawlable profile', expected_profiles>=300 and page.locator('.reference-grid a').count()==expected_profiles)
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
          page.evaluate("document.activeElement.id === 'main' && !location.hash.includes('record=')"))
    page.locator('.paper-row h3 a').first.click()
    page.wait_for_function("document.getElementById('record-dialog').open")
    page.get_by_role('button',name='Close record',exact=True).click()
    check('record close button restores visible-page keyboard focus',
          page.evaluate("!document.getElementById('record-dialog').open && document.activeElement.id === 'main'"))
    page.locator('.paper-row h3 a').first.click()
    page.wait_for_function("document.getElementById('record-dialog').open")
    page.go_back()
    page.wait_for_function("!document.getElementById('record-dialog').open")
    check('Back closes a record and places focus in the active section',
          page.evaluate("document.activeElement.id === 'main' && location.hash.startsWith('#/papers')"))

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
    page.locator('#menu-toggle').focus()
    page.keyboard.press('Tab')
    check('Tab bypasses the closed mobile drawer',
          page.evaluate("!document.activeElement.closest('#sidebar')"))
    page.locator('#menu-toggle').click()
    check('opening the drawer focuses its first navigation link and isolates the page',
          page.evaluate("document.activeElement.matches('#sidebar .brand') && document.querySelector('.workspace').inert"))
    page.keyboard.press('Shift+Tab')
    check('Shift-Tab wraps inside the open drawer',
          page.evaluate("!!document.activeElement.closest('#sidebar')"))
    page.keyboard.press('Escape')
    check('Escape closes drawer and returns focus to the menu button',
          page.evaluate("document.activeElement.id==='menu-toggle' && document.getElementById('mobile-overlay').hidden && !document.querySelector('.workspace').inert && document.getElementById('menu-toggle').getAttribute('aria-expanded')==='false'"))
    page.locator('#menu-toggle').click()
    page.locator('#navigation a[href="#/games"]').click()
    page.locator('#start-quiz').wait_for()
    check('mobile navigation retains native Quiz and Match',page.locator('#start-match').is_visible() and page.locator('#menu-toggle').get_attribute('aria-expanded')=='false')
    page.goto(base+'terms/MLD-1039-reward-hacking.html')
    check('rebranded expanded guide retains primary citations',page.locator('h1').inner_text()=='Reward hacking' and page.get_by_role('heading',name='Sources for the expanded explanation',exact=True).is_visible())
    check('mobile term guide fits the viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    check('no application runtime exceptions',not errors)
    browser.close()
(out/'results.json').write_text(json.dumps({'checks_passed':len(checks),'checks':checks,'base':base},indent=2))
