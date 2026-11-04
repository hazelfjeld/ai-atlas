"""Browser smoke test. Pass a local or hosted base URL; no app-only test backdoors."""
import argparse, json, os, time, re
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser();parser.add_argument('--base', default='http://127.0.0.1:8765/');parser.add_argument('--fixture',action='store_true');parser.add_argument('--output', default='games-validation');args=parser.parse_args()
base=args.base.rstrip('/')+'/';root=Path(__file__).resolve().parents[1];out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
checks=[]
def open_page(page, failure=False):
    if not args.fixture:
        if failure:
            page.route('**/catalog-loader.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body="window.ATLAS_READY=Promise.reject(new Error('Integrity mismatch: fixture'));window.ATLAS_READY.catch(()=>{});"))
        page.goto(base+'games.html')
        return
    html=(root/'games.html').read_text()
    html=re.sub(r'<script[^>]*>.*?</script>', '', html)
    html=html.replace('<link rel="stylesheet" href="games.css">', '<style>'+(root/'games.css').read_text()+'</style>')
    page.set_content(html)
    if failure:
        setup="window.ATLAS_READY=Promise.reject(new Error('Integrity mismatch: fixture'));window.ATLAS_READY.catch(()=>{});"
    else:
        setup='window.ATLAS_READY=Promise.resolve({terms:'+ (root/'data/terms.fixture.json').read_text()+',publication:{snapshot_date:"2026-11-01"}});'
    page.add_script_tag(content=setup)
    for name in ['core.js','games-core.js','games.js']:page.add_script_tag(content=(root/name).read_text())
def check(name, value):
    if not value: raise AssertionError(name)
    checks.append(name)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    open_page(page);page.locator('#games').wait_for(state='visible');check('dictionary loads',int(page.locator('#catalog-count').inner_text().replace(',',''))>1000)
    # A fragment skip target needs programmatic focus so Tab stays in game content.
    # Without tabindex=-1 on main, the fragment can scroll while focus stays in the header.
    if not args.fixture:
        page.locator('a.skip').focus()
        page.keyboard.press('Enter')
        check('Games skip link focuses main',
              page.evaluate("location.hash === '#main' && document.activeElement.id === 'main'"))
        page.keyboard.press('Tab')
        check('Tab after Games skip stays within main',
              page.evaluate("!!document.activeElement.closest('main')"))
    page.screenshot(path=str(out/'games-desktop.png'),full_page=True)
    rows=page.evaluate('async()=> (await window.ATLAS_READY).terms');by_definition={r['definition']:r for r in rows};by_id={r['id']:r for r in rows}
    technique_ids = set(page.evaluate('Array.from(window.AtlasGames.techniqueIds)'))
    check('standalone Games offers Techniques', page.locator('#topic option[value="Techniques"]').count()==1)
    page.locator('#topic').select_option('Techniques')
    check('standalone Techniques deck is curated', 100 <= int(page.locator('#pool-count').inner_text().split()[0].replace(',', '')) <= len(technique_ids))
    page.locator('#start-match').click()
    tile_ids = page.locator('[data-key]').evaluate_all("(els)=>els.map(el=>el.dataset.key.split(':')[0])")
    check('standalone Technique Match avoids unrelated words', len(tile_ids)==12 and all(i in technique_ids for i in tile_ids))
    page.locator('[data-action=menu]').click()
    page.locator('#start-flashcards').click()
    card_name = page.locator('#flashcard-front strong').inner_text()
    check('standalone Technique Flashcards stay curated', card_name in [r['term'] for r in rows if r['id'] in technique_ids])
    page.locator('[data-action=menu]').click()
    page.locator('#reset-filters').click()
    page.locator('#query').fill('xxxx-no-concept');check('empty filters disable both start buttons',page.locator('#start-quiz').is_disabled() and page.locator('#start-match').is_disabled())
    page.locator('#reset-filters').click();page.locator('#tag').select_option('Safety');check('field filter narrows deck','1,345' not in page.locator('#pool-count').inner_text());page.locator('#reset-filters').click()
    page.locator('#quiz-count').select_option('5');page.locator('#start-quiz').click();seen=set()
    for i in range(5):
        prompt=page.locator('#question-title').evaluate('(el)=>el.lastChild.textContent');record=by_definition[prompt];check(f'quiz unique question {i+1}',record['id'] not in seen);seen.add(record['id'])
        answer=page.locator(f'[data-answer="{record["id"]}"]') if i else page.locator(f'[data-answer]:not([data-answer="{record["id"]}"])').first
        answer.click();check(f'feedback shown {i+1}',page.locator('#feedback').is_visible());check(f'answers locked {i+1}',all(page.locator('[data-answer]').nth(n).is_disabled() for n in range(page.locator('[data-answer]').count())))
        if i==0: page.screenshot(path=str(out/'quiz-desktop.png'),full_page=True)
        page.locator('[data-action=next]').click()
    check('quiz score is four of five','4 / 5' in page.locator('.result-score').inner_text());check('missed review has one concept',page.locator('.review-item').count()==1)
    page.locator('[data-action=retry-missed]').click();check('retry keeps four options',page.locator('[data-answer]').count()==4);page.locator('[data-action=menu]').click()
    page.locator('#answer-mode').select_option('typed');check('typed mode locks direction',page.locator('#direction').is_disabled());page.locator('#start-quiz').click()
    prompt=page.locator('#question-title').evaluate('(el)=>el.lastChild.textContent');record=by_definition[prompt];answer=record['aliases'][0] if record['aliases'] else record['term']
    page.locator('#typed-answer').fill(answer.upper());page.locator('#typed-answer').press('Enter');check('typed canonical/alias accepted',page.locator('#feedback h3').inner_text().startswith('Correct.'));page.locator('[data-action=menu]').click()
    page.locator('#answer-mode').select_option('choice');page.locator('#direction').select_option('term');page.locator('#start-quiz').click();term=page.locator('#question-title').evaluate('(el)=>el.lastChild.textContent');record=next(r for r in rows if r['term']==term);check('reverse quiz choices are definitions',page.locator(f'[data-answer="{record["id"]}"]').inner_text().endswith(record['definition']));page.locator('[data-action=menu]').click()
    page.locator('#start-match').click();check('match twelve tiles',page.locator('.tile').count()==12)
    tiles=page.locator('.tile').evaluate_all('(els)=>els.map(e=>({key:e.dataset.key,text:e.textContent}))');first=tiles[0];second=next(t for t in tiles if t['key'].split(':')[0]!=first['key'].split(':')[0])
    page.locator(f'[data-key="{first["key"]}"]').click();page.locator(f'[data-key="{second["key"]}"]').click();check('mismatch announces penalty','+1 second' in page.locator('#match-status').inner_text());page.wait_for_timeout(500)
    check('timer includes penalty',float(page.locator('#match-time').inner_text().rstrip('s'))>=1)
    page.screenshot(path=str(out/'match-desktop.png'),full_page=True)
    ids=list(dict.fromkeys(t['key'].split(':')[0] for t in tiles))
    for n,id in enumerate(ids):
        page.locator(f'[data-key="{id}:term"]').click();page.locator(f'[data-key="{id}:definition"]').click()
        if n<5: check(f'pair disappears {n+1}',not page.locator(f'[data-key="{id}:term"]').is_visible())
    check('match completed','Board cleared' in page.locator('#round-title').inner_text());check('one second penalty in final score','1.0s penalties' in page.locator('.result-panel').inner_text());check('all matched concepts linked',page.locator('.review-item a').count()==6)
    page.locator('[data-action=match-again]').click();page.locator('.tile').first.click();check('fresh board resets selection and score','0 / 6' in page.locator('#pairs-count').inner_text());page.locator('[data-action=menu]').click()
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'games-mobile.png'),full_page=True);check('mobile setup has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.locator('#start-match').click();page.screenshot(path=str(out/'match-mobile.png'),full_page=True);check('mobile match has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'));check('mobile full definitions untruncated',page.locator('.tile').evaluate_all('(els)=>els.every(el=>el.scrollHeight<=el.clientHeight+1)'))
    page.locator('[data-action=menu]').click();page.locator('#theme-toggle').click();page.screenshot(path=str(out/'games-dark.png'),full_page=True)
    check('no runtime errors',not errors)
    # An actual rejected catalog promise must give a recoverable UI, not a partial deck.
    fail=browser.new_page();open_page(fail,True);fail.get_by_role('button',name='Retry',exact=True).wait_for();check('load failure shows retry and hides deck',not fail.locator('#games').is_visible())
    browser.close()
report={'checks_passed':len(checks),'checks':checks,'base':'in-memory original-catalog fixture' if args.fixture else base,'errors':errors,'note':'Uses actual page UI. Local run uses original dictionary fixture; hosted run uses the production loader.'}
(out/'browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
