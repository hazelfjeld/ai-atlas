"""Exercise the packaged or deployed Atlas with real browser navigation and downloads."""
import argparse
import hashlib
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


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'), headless=True)
    page = browser.new_page(viewport={'width':1440, 'height':1000}, reduced_motion='reduce')
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base)
    page.locator('#navigation a[href="#/games"]').wait_for()
    check('homepage retains original Atlas shell and native Games tab', page.locator('.app-shell').count() == 1)
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
    page.goto(base + 'whats-new.html')
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
        check('daily archive renders its verified edition and permanent link',
              page.locator('#edition-select').is_enabled()
              and page.locator('#edition-permalink-wrap').is_visible()
              and page.locator('#edition-content article.item').count() >= 1)
        audit = page.locator('#source-coverage .source-audit').inner_text()
        check('source audit explains partial coverage and both failed lookups',
              'Collection context:' in audit
              and 'Direct model metadata API was not available' in audit
              and 'Previously surfaced press URL returned no page' in audit)
        check('source audit distinguishes checked times and failure status',
              'Checked Nov 2, 2026' in audit
              and 'Status: inaccessible' in audit and 'Status: not found' in audit)
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
    page.goto(base + 'index.html#/sources')
    link = page.locator('[data-original-file="ML_DL_SLM_LLM_Dictionary.xlsx"]')
    link.wait_for()
    with page.expect_download() as received:
        link.click()
    saved = out / 'dictionary.xlsx'
    received.value.save_as(saved)
    check('actual workbook download matches source bytes', hashlib.sha256(saved.read_bytes()).digest() == hashlib.sha256((ROOT / 'downloads/ML_DL_SLM_LLM_Dictionary.xlsx').read_bytes()).digest())
    saved.unlink()
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base + 'index.html#/games')
    page.locator('#start-quiz').wait_for()
    check('mobile Games route fits original workspace', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.locator('#menu-toggle').click()
    page.locator('#navigation a[href="#/overview"]').click()
    page.wait_for_function("location.hash === '#/overview' && document.getElementById('menu-toggle').getAttribute('aria-expanded') === 'false'")
    check('mobile drawer navigates and closes', page.locator('#daily-panel-title').is_visible())
    check('no application runtime exceptions', not errors)
    browser.close()
(out / 'report.json').write_text(json.dumps({'base':base, 'checks':checks, 'checks_passed':len(checks), 'errors':errors}, indent=2), encoding='utf-8')
