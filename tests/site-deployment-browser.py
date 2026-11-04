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


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'), headless=True)
    page = browser.new_page(viewport={'width':1440, 'height':1000}, reduced_motion='reduce')
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base)
    page.locator('#navigation a[href="#/games"]').wait_for()
    check('homepage retains original Atlas shell and native Games tab', page.locator('.app-shell').count() == 1)
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
    page.goto(base + 'whats-new.html')
    # Fragment navigation must move keyboard focus past the header, not just scroll.
    # Without tabindex=-1, Chromium leaves focus on BODY after activating Skip.
    page.locator('a.skip').focus()
    page.keyboard.press('Enter')
    check('archive skip link moves keyboard focus into main content',
          page.evaluate("location.hash === '#main' && document.activeElement.id === 'main'"))
    page.keyboard.press('Tab')
    check('Tab after archive skip continues inside main instead of header links',
          page.evaluate("!!document.activeElement.closest('main')"))
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
    # The five archive header links used 13px inline text with only ~21px hit areas.
    # Give touch users real 44px targets without altering the desktop navigation.
    mobile_nav_targets = """() => {
        const links = [...document.querySelectorAll('.toplinks a')];
        return links.length === 5 && links.every(link =>
            link.getBoundingClientRect().height >= 44);
    }"""
    check('390px archive header links have 44px touch targets', page.evaluate(mobile_nav_targets))
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
    check('320px archive header links have 44px touch targets', page.evaluate(mobile_nav_targets))
    if index['editions']:
        check('320px archive metadata tags wrap within their cards', page.evaluate(tag_containment))
    check('320px archive header fits without horizontal scrolling',
          page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    check('320px daily filters and search avoid iOS focus zoom', page.evaluate(mobile_readability_check))
    if index['editions']:
        source_toggle_mobile.wait_for(timeout=45000)
        check('320px source-coverage summary is an accessible touch target',
              source_toggle_mobile.evaluate("(el) => el.getBoundingClientRect().height >= 44"))
    page.screenshot(path=str(out / 'daily-mobile-320.png'), full_page=True)
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
