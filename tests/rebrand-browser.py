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
    check('canonical points to the primary domain', page.locator('link[rel=canonical]').get_attribute('href')=='https://aiupdates.app/')
    page.get_by_role('link',name='Read PyTorch',exact=True).click()
    check('technology profile works without JavaScript', page.locator('h1').inner_text()=='PyTorch' and page.get_by_role('heading',name='Tradeoffs & cautions',exact=True).is_visible())
    page.get_by_role('navigation',name='Site navigation').get_by_role('link',name='Technologies',exact=True).click()
    check('technology directory exposes all 300 crawlable profiles', page.locator('.reference-grid a').count()==300)
    static.close()
    context=browser.new_context(viewport={'width':1440,'height':1050},reduced_motion='reduce')
    page=context.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base)
    page.locator('#catalog-loading').wait_for(state='detached')
    check('new brand and requested palette render', page.get_by_role('link',name='AI Updates home',exact=True).is_visible() and page.evaluate("getComputedStyle(document.body).backgroundColor")=='rgb(246, 246, 242)')
    page.screenshot(path=str(out/'desktop.png'),full_page=True)
    page.get_by_role('navigation',name='Discover topics').get_by_role('link',name='Tools & models',exact=True).click()
    page.wait_for_function("document.querySelectorAll('.discovery-card').length===2")
    check('topic tabs filter the editorial collection', page.locator('.discovery-card').count()==2 and 'topic=tools' in page.url)
    page.reload();page.locator('#catalog-loading').wait_for(state='detached')
    check('topic survives direct reload', page.locator('.discovery-card').count()==2)
    page.get_by_role('navigation',name='Discover topics').get_by_role('link',name='Research',exact=True).click()
    page.wait_for_function("document.querySelectorAll('.discovery-card').length===1")
    check('research tab displays the relevant reference', 'model doing inside' in page.locator('.discovery-card h3').inner_text())
    page.get_by_role('button',name='Toggle color theme',exact=True).click()
    check('dark theme uses deep evergreen and fits the page', page.evaluate("getComputedStyle(document.body).backgroundColor")=='rgb(24, 33, 30)' and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.get_by_role('button',name='Toggle color theme',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base)
    page.locator('#catalog-loading').wait_for(state='detached')
    check('mobile discovery has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.screenshot(path=str(out/'mobile.png'),full_page=True)
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
