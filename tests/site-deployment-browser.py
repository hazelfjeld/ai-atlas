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

    # The editorial-policy page formerly exposed a multirow legacy nav on
    # phones, while Discover and the daily archive use a compact menu/search.
    mobile_about = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_about.goto(base + 'about.html')
    check('about page uses the same compact mobile navigation as the archive',
          mobile_about.locator('.about-mobile-topbar').is_visible()
          and not mobile_about.locator('.term-nav').is_visible()
          and mobile_about.locator('.about-search-link').is_visible())
    check('about mobile header fits a 320px viewport',
          mobile_about.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_about.locator('.about-menu-toggle').click()
    check('about mobile menu exposes the current location',
          mobile_about.locator('#about-mobile-nav').evaluate('(el) => el.open')
          and mobile_about.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='About', exact=True).get_attribute('aria-current') == 'page')
    mobile_about.locator('.about-menu-toggle').click()
    mobile_about.screenshot(path=str(out / 'about-mobile-header.png'), full_page=False)
    mobile_about.locator('.about-search-link').click()
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
    check('desktop technology directory keeps its existing navigation',
          mobile_tech.locator('.tech-top').is_visible()
          and not mobile_tech.locator('.tech-mobile-topbar').is_visible())
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
    check('desktop playbooks retain original navigation',
          mobile_playbooks.locator('.playbook-top').is_visible()
          and not mobile_playbooks.locator('.playbook-mobile-topbar').is_visible())
    mobile_playbooks.set_viewport_size({'width':320, 'height':720})
    mobile_playbooks.locator('.playbook-search-link').click()
    mobile_playbooks.wait_for_url('**/index.html#/search')
    check('playbooks search opens the existing workspace search',
          mobile_playbooks.locator('#global-query').is_visible())
    mobile_playbooks.close()
    # The candidate-review page also had legacy multirow links at 320px.
    mobile_review = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_review.goto(base + 'catalog-review.html')
    check('catalog review uses the compact mobile site header',
          mobile_review.locator('.review-mobile-topbar').is_visible()
          and not mobile_review.locator('.shell > .nav').is_visible()
          and mobile_review.locator('.review-search-link').is_visible())
    check('320px catalog review has no page-wide horizontal overflow',
          mobile_review.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_review.locator('.review-menu-toggle').focus()
    mobile_review.keyboard.press('Enter')
    check('catalog review menu is keyboard operable with current-page indication',
          mobile_review.locator('#review-mobile-nav').evaluate('(el) => el.open')
          and mobile_review.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='Catalog review', exact=True).get_attribute('aria-current') == 'page')
    check('catalog review mobile links meet 44px touch minimum',
          mobile_review.evaluate("""() => [...document.querySelectorAll('.review-menu-panel a')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_review.keyboard.press('Enter')
    mobile_review.screenshot(path=str(out / 'catalog-review-mobile-header.png'), full_page=False)
    mobile_review.set_viewport_size({'width':390, 'height':844})
    check('390px catalog review has no page-wide horizontal overflow',
          mobile_review.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_review.set_viewport_size({'width':1440, 'height':900})
    check('desktop catalog review keeps its original navigation',
          mobile_review.locator('.shell > .nav').is_visible()
          and not mobile_review.locator('.review-mobile-topbar').is_visible())
    mobile_review.set_viewport_size({'width':320, 'height':720})
    mobile_review.locator('.review-search-link').click()
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
          and mobile_hardware.locator('.hardware-search-link').is_visible())
    check('320px hardware review has no page-wide horizontal overflow',
          mobile_hardware.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_hardware.locator('.hardware-menu-toggle').focus()
    mobile_hardware.keyboard.press('Enter')
    check('hardware review menu supports keyboard navigation and current-page indication',
          mobile_hardware.locator('#hardware-mobile-nav').evaluate('(el) => el.open')
          and mobile_hardware.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='Hardware evidence', exact=True).get_attribute('aria-current') == 'page')
    check('hardware review mobile links meet 44px touch minimum',
          mobile_hardware.evaluate("""() => [...document.querySelectorAll('.hardware-menu-panel a')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_hardware.keyboard.press('Enter')
    mobile_hardware.screenshot(path=str(out / 'hardware-review-mobile-header.png'), full_page=False)
    mobile_hardware.set_viewport_size({'width':390, 'height':844})
    check('390px hardware review has no page-wide horizontal overflow',
          mobile_hardware.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_hardware.set_viewport_size({'width':1440, 'height':900})
    check('desktop hardware review retains original navigation',
          mobile_hardware.locator('.review-shell > .review-nav').is_visible()
          and not mobile_hardware.locator('.hardware-mobile-topbar').is_visible())
    mobile_hardware.set_viewport_size({'width':320, 'height':720})
    mobile_hardware.locator('.hardware-search-link').click()
    mobile_hardware.wait_for_url('**/index.html#/search')
    check('hardware review search opens the actual workspace search',
          mobile_hardware.locator('#global-query').is_visible())
    mobile_hardware.close()

    # Research still used a stacked legacy sidebar and horizontal link strip
    # on phones; its navigation now matches Discover and the other static pages.
    mobile_research = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
    mobile_research.goto(base + 'research.html')
    check('research uses the compact mobile navigation instead of the legacy sidebar',
          mobile_research.locator('.research-mobile-topbar').is_visible()
          and not mobile_research.locator('.shell > aside').is_visible()
          and mobile_research.locator('.research-search-link').is_visible())
    check('320px research page has no horizontal overflow',
          mobile_research.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_research.locator('.research-menu-toggle').focus()
    mobile_research.keyboard.press('Enter')
    check('research mobile navigation is keyboard operable and identifies the current section',
          mobile_research.locator('#research-mobile-nav').evaluate('(el) => el.open')
          and mobile_research.get_by_role('navigation', name='AI Updates sections')
              .get_by_role('link', name='Research library', exact=True).get_attribute('aria-current') == 'page')
    check('research navigation links meet the 44px touch target minimum',
          mobile_research.evaluate("""() => [...document.querySelectorAll('.research-menu-panel a')]
              .every(a => a.getBoundingClientRect().height >= 44)"""))
    mobile_research.keyboard.press('Enter')
    mobile_research.screenshot(path=str(out / 'research-mobile-header.png'), full_page=False)
    mobile_research.set_viewport_size({'width':390, 'height':844})
    check('390px research page fits without horizontal overflow',
          mobile_research.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    mobile_research.set_viewport_size({'width':1440, 'height':900})
    check('desktop research keeps the existing sidebar',
          mobile_research.locator('.shell > aside').is_visible()
          and not mobile_research.locator('.research-mobile-topbar').is_visible())
    published_tech_count = mobile_research.request.get(base + 'publication.json').json()['published_counts']['technologies']
    check('research desktop sidebar and mobile notice agree with the published technology count',
          f'{published_tech_count} ↗' in mobile_research.locator('.shell > aside a[href="index.html#/technologies"]').inner_text()
          and f'all {published_tech_count} technologies' in mobile_research.locator('.notice').inner_text())
    mobile_research.set_viewport_size({'width':320, 'height':720})
    mobile_research.locator('.research-search-link').click()
    mobile_research.wait_for_url('**/index.html#/search')
    check('research search opens the existing workspace search',
          mobile_research.locator('#global-query').is_visible())
    mobile_research.close()
    # Generated term/technology references are still script-free. Their formerly
    # tiny inline links now share a usable compact, two-column mobile nav.
    for reference in ('terms/MLD-0002-ablation-study.html', 'technology/index.html'):
        mobile_reference = browser.new_page(viewport={'width':320, 'height':720}, reduced_motion='reduce')
        mobile_reference.goto(base + reference)
        nav = mobile_reference.locator('.term-shell .term-nav')
        check(reference + ' uses a two-column compact mobile navigation',
              nav.evaluate("""el => getComputedStyle(el).display === 'grid'
                  && getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length === 2"""))
        check(reference + ' has keyboard-reachable 44px navigation links',
              mobile_reference.evaluate("""() => [...document.querySelectorAll('.term-shell .term-nav a')]
                  .every(a => a.getBoundingClientRect().height >= 44)"""))
        check(reference + ' fits the 320px viewport',
              mobile_reference.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        mobile_reference.locator('.term-nav a').nth(1).focus()
        check(reference + ' has a visible keyboard focus indication',
              mobile_reference.evaluate("""() => {
                  const a = document.activeElement;
                  return a.matches('.term-nav a') && getComputedStyle(a).outlineStyle === 'solid'
                      && parseFloat(getComputedStyle(a).outlineWidth) >= 2;
              }"""))
        mobile_reference.set_viewport_size({'width':390, 'height':844})
        check(reference + ' fits the 390px viewport',
              mobile_reference.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        mobile_reference.set_viewport_size({'width':1440, 'height':900})
        check(reference + ' preserves desktop navigation',
              nav.evaluate("el => getComputedStyle(el).display === 'flex'"))
        mobile_reference.close()
    page.goto(base + 'whats-new.html')
    check('daily archive uses the same Atlas logo and quiet wordmark',
          page.locator('.brand-wordmark small').inner_text() == 'THE FRONTIER, IN CONTEXT')
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
        if any(e['date'] == '2026-11-03' and e['revision'] > 1 for e in index['editions']):
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
