'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');

test('generated reference profiles expose real workspace title text after enhancement', () => {
  const runtime = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(runtime.includes("titleNode.className = 'site-mobile-chrome__title'"),
    'Details must use the existing accessible shared workspace title class');
  assert.ok(runtime.includes("drawer.insertAdjacentElement('afterend', titleNode)"),
    'The real heading must occupy the same slot as directory and Discover headings');
  assert.ok(runtime.includes('titleNode.textContent = title'),
    'The heading must be DOM text, not interpolated HTML or a CSS pseudo-element');
  assert.ok(offline.includes(runtime.replaceAll('</script', '<\\/script')),
    'The offline fallback must embed exactly the updated shared runtime');
  for (const route of ['terms/MLD-1179-structured-output.html',
                       'technology/TECH-0216-pytorch.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.ok(html.includes('src="../site-theme.js"'), route + ' must run the shared enhancement');
    assert.ok(html.includes('id="main" tabindex="-1"'),
      route + ' must preserve the native article skip target');
  }
});


test('Guided demo and hardware evidence use Discover\'s sibling navigation landmarks', () => {
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  assert.ok(generator.includes('migrate_legacy_article_landmark(normalized, path)'),
    'The shared builder must preserve the migration on repeat builds');
  for (const [route, mainTag, mobileClass, railClass, cssClass] of [
    ['demo.html', '<main>', 'site-mobile-chrome', 'demo-site-chrome', '.site-mobile-chrome'],
    ['hardware-review.html', '<main class="review-shell">', 'hardware-mobile-topbar site-mobile-chrome', 'review-nav', '.hardware-mobile-topbar'],
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const mobile = html.indexOf('<div class="' + mobileClass + '"');
    const rail = html.indexOf('<nav class="site-chrome ' + railClass + '"');
    const railEnd = html.indexOf('</nav>', rail) + '</nav>'.length;
    const main = html.indexOf(mainTag);
    const article = html.indexOf('<header id="main" tabindex="-1">', main);
    const footer = html.indexOf('<footer>', article);
    const mainEnd = html.indexOf('</main>', main);
    assert.ok(mobile > 0 && mobile < rail && rail < railEnd && railEnd < main &&
      main < article && article < footer && footer < mainEnd,
      route + ' must separate the native navigation from the article landmark');
    assert.equal((html.match(/<main\b/g) || []).length, 1, route + ' must retain one main');
    assert.equal((html.match(/<nav class="site-chrome /g) || []).length, 1, route + ' must retain one desktop rail');
    assert.ok(!html.slice(main, mainEnd).includes('site-chrome__links'),
      route + ' must not nest the global rail inside main');
    assert.ok(html.includes('<a class="skip" href="#main">'),
      route + ' must preserve the native skip link');
    assert.ok(html.includes(cssClass + '{margin:0;padding:14px 20px'),
      route + ' must not overflow at mobile widths after moving the header out of the shell');
  }
});



test('Playbooks and Technology separate the shared navigation from main', () => {
  // Both native directories share Discover's build-time rail but previously
  // announced their entire navigation as part of the article landmark.
  for (const [route, shell, hero, rail] of [
    ['playbooks.html', 'playbook', 'playbook-hero', 'playbook-top'],
    ['technologies.html', 'tech', 'tech-hero', 'tech-top'],
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const shellAt = html.indexOf('<div class="' + shell + '-shell">');
    const mobile = html.indexOf('class="' + shell + '-mobile-topbar');
    const railAt = html.indexOf('<nav class="site-chrome ' + rail + '"');
    const railEnd = html.indexOf('</nav>', railAt);
    const main = html.indexOf('<main class="' + shell + '-content">');
    const heroAt = html.indexOf('<section class="' + hero + '" id="main" tabindex="-1">');
    const footerAt = html.indexOf('<footer>', heroAt);
    const mainEnd = html.indexOf('</main>', main);
    assert.ok(shellAt > 0 && shellAt < mobile && mobile < railAt &&
      railEnd < main && main < heroAt && heroAt < footerAt && footerAt < mainEnd,
      route + ' must place shared navigation before the article landmark');
    assert.equal((html.match(/<main\b/g) || []).length, 1, route + ' must have one main landmark');
    assert.equal((html.match(/<nav class="site-chrome /g) || []).length, 1,
      route + ' must retain one desktop rail');
    assert.ok(!html.slice(main, mainEnd).includes('site-chrome__links'),
      route + ' must not nest shared navigation in main');
    assert.ok(html.slice(main, mainEnd).includes('site-static-fallback'),
      route + ' must retain native script-free record access in main');
    assert.ok(html.includes('<a class="skip" href="#main">'),
      route + ' must keep native keyboard skip links');
    const intro = '.' + shell + '-shell>main>.' + hero + '>p';
    assert.ok(html.includes(intro + '{max-width:70ch;font-size:17px;line-height:1.65'),
      route + ' must preserve the shared desktop reading rhythm');
    assert.ok(html.includes(intro + '{font-size:16px}'),
      route + ' must preserve the shared mobile reading scale');
  }
  // The shell already owns page gutters. After migrating <main>, generic
  // Discover main padding used to add a second inset at every breakpoint.
  assert.ok(css.includes(':is(.tech-shell,.playbook-shell)>main{padding:0}'),
    'standalone workspace content does not double Discover main padding');
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  assert.ok(brand.includes('main{padding:'),
    'guard against silently removing the Discover baseline instead');

  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8');
  assert.ok(builder.includes('normalize_standalone_chrome(page.read_text('),
    'Build must still normalize navigation from the canonical generator');
});



test('Research uses the same separate site navigation and content landmark as editorial landings', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'research.html'), 'utf8');
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  const siteNav = html.indexOf('<nav class="site-chrome research-site-chrome"');
  const siteNavEnd = html.indexOf('</nav>', siteNav);
  const main = html.indexOf('<main>', siteNav);
  const hero = html.indexOf('<section class="hero" id="main" tabindex="-1">', siteNav);
  assert.ok(siteNav > 0 && siteNavEnd > siteNav && main > siteNavEnd && hero > main,
    'Research navigation must precede, not live inside, the content landmark');
  assert.equal(html.match(/<main>/g)?.length, 1);
  assert.ok(!html.slice(main, hero).includes('site-chrome'),
    'The main landmark should not contain a second navigation rail');
  assert.ok(!generator.includes("markup.replace('</div><nav class=\"site-chrome', '</div><main><nav class=\"site-chrome'"),
    'Build-time shared chrome must not insert the article landmark inside navigation');
  assert.ok(css.includes('.shell:has(> .site-chrome.research-site-chrome)'),
    'Shared reading-frame styles must continue to cover Research after landmark migration');
  const news = fs.readFileSync(path.join(__dirname, '..', 'whats-new.html'), 'utf8');
  assert.ok(news.indexOf('<nav class="site-chrome top"') < news.indexOf('<main>'),
    'Daily archive remains the existing sibling-nav pattern');
});

test('standalone workspace headings are real shared DOM text, not CSS-only labels', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  assert.ok(source.includes('page_label=page_title, topbar_title=page_title'),
    'Visible and accessible workspace titles must share one build-time source');
  const titles = {
    'demo.html':'Guided demo', 'research.html':'Research library',
    'catalog-review.html':'Catalog review', 'hardware-review.html':'Hardware evidence',
    'games.html':'Games', 'technologies.html':'Technology profiles',
    'playbooks.html':'Playbooks', 'whats-new.html':'What’s New Today'
  };
  for (const [route, expected] of Object.entries(titles)) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const title = '<span class="site-mobile-chrome__title">' + expected + '</span>';
    assert.equal(html.split(title).length - 1, 1, route + ' needs one real workspace title');
    const searchAt = html.indexOf('site-mobile-chrome__search');
    assert.ok(html.indexOf(title) > html.indexOf('site-mobile-chrome__nav')
      && html.indexOf(title) < searchAt, route + ' title must precede functional search');
    assert.ok(html.includes('data-page-label="' + expected + '"'), route + ' label drift');
    assert.ok(html.includes('site-chrome__links'), route + ' lost primary navigation');
  }
  assert.match(css, /\.site-mobile-chrome:has\(> \.site-mobile-chrome__title\)::before\{display:none\}/);
  assert.match(css, /\.site-mobile-chrome__title\{[\s\S]*?display:block;flex:1/);
  assert.match(css, /@media \(max-width:650px\)\{[\s\S]*?\.site-mobile-chrome__title\{display:none\}/);
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Update the exact offline shared stylesheet');
});

test('daily archive shares script-free collection fallback instead of trapping readers in loading states', () => {
  const archive = fs.readFileSync(path.join(__dirname, '..', 'whats-new.html'), 'utf8');
  const published = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/daily/index.json'), 'utf8'));
  const start = archive.indexOf('<noscript><section class="site-static-fallback" id="scriptfree-daily-archive"');
  const end = archive.indexOf('</section></noscript>', start);
  assert.ok(start >= 0 && end > start, 'Archive must expose the shared script-free collection fallback');
  const block = archive.slice(start, end + '</section></noscript>'.length);
  assert.ok(block.includes('href="data/daily/index.json"'), 'Always-current edition register is available');
  assert.ok(block.includes('not a live news feed'), 'Do not present older snapshots as fresh news');
  assert.ok(block.includes('href="about.html"'), 'Coverage and editorial policy stay available');
  // The static fallback must follow the actual immutable register after each
  // future daily publication, not freeze on the November 7–9 examples.
  const newestByDate = new Map();
  for (const edition of published.editions) {
    const old = newestByDate.get(edition.date);
    if (!old || edition.revision > old.revision) newestByDate.set(edition.date, edition);
  }
  const expected = [...newestByDate.values()]
    .sort((a,b) => b.date.localeCompare(a.date)).slice(0, 3).map(e => e.path);
  const links = [...block.matchAll(/<a href="(data\/daily\/editions\/[^"]+)"[^>]*>/g)]
    .map(match => match[1]);
  assert.deepEqual(links, expected, 'No-JS links must be the latest three published dates');
  for (const item of expected) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', item)),
      'Script-free edition cannot point at a missing immutable file: ' + item);
  }
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8')
    .includes('def sync_scriptfree_daily_archive(html):'),
    'The latest dated links must have a shared build-time source of truth');
  const styleStart = archive.indexOf('<noscript><style>');
  const styleEnd = archive.indexOf('</style></noscript>', styleStart);
  assert.ok(styleStart >= 0 && styleEnd > styleStart, 'No-JS styles must have a native noscript boundary');
  const style = archive.slice(styleStart, styleEnd);
  for (const selector of ['#edition-status', '#edition-content', 'main > .panel', '.edition-footnotes'])
    assert.ok(style.includes(selector), 'Do not leave fake loading state or dead controls: ' + selector);
  assert.ok(!style.includes('.site-chrome') && !style.includes('.site-mobile-chrome'),
    'Keep shared navigation and its real search route usable');
});


test('native Research and demo navigation expose one current secondary route, not two competing active links', () => {
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  assert.ok(generator.includes('secondary_current = {"demo.html": "demo", "research.html": "papers"}.get(path)'));
  assert.ok(generator.includes('None if secondary_current else selected'),
    'The common generator must leave Discover clickable, not mark it current on secondary destinations');
  for (const [route, label, href] of [
    ['research.html', 'Research library', 'index.html#/papers'],
    ['demo.html', 'Guided professor demo', 'demo.html']
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    for (const navClass of ['site-chrome', 'site-mobile-chrome__menu']) {
      const start = navClass === 'site-chrome'
        ? html.indexOf('<nav class="site-chrome ')
        : html.indexOf('site-mobile-chrome__menu" aria-label="AI Updates sections">');
      assert.ok(start > 0, route + ' missing ' + navClass);
      const end = html.indexOf('</nav>', start);
      const nav = html.slice(start, end);
      const currents = [...nav.matchAll(/<a href="([^"]+)" aria-current="([^"]+)">([^<]+)<\/a>/g)];
      assert.equal(currents.length, 1, route + ' ' + navClass + ' must expose exactly one current destination');
      assert.deepEqual([currents[0][1], currents[0][2], currents[0][3]],
        [href, 'location', label], route + ' current section mismatch');
      assert.match(nav, /<a href="index\.html#\/overview">Discover<\/a>/,
        'Discover must remain a usable parent link');
    }
  }
});

test('Research shares the heading-first reading order of Discover and Playbooks', () => {
  const research = fs.readFileSync(path.join(__dirname, '..', 'research.html'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const playbooks = fs.readFileSync(path.join(__dirname, '..', 'playbooks.html'), 'utf8');
  const hero = research.indexOf('<section class="hero" id="main" tabindex="-1">');
  const nav = research.indexOf('<nav class="research-local-nav discovery-topics" aria-label="Research views">');
  const notice = research.indexOf('<div class="notice">', nav);
  assert.ok(hero > 0 && hero < nav && nav < notice,
    'Research must introduce the view before offering contextual navigation, like other landings');
  assert.ok(home.includes('<h1>Discover</h1>'),
    'Discover retains its pre-rendered semantic heading');
  assert.ok(playbooks.indexOf('class="playbook-hero"') < playbooks.indexOf('class="playbook-tools"'),
    'Playbooks introduces its content before local filters');
  const links = research.slice(nav, notice);
  assert.deepEqual([...links.matchAll(/data-nav="([^"]+)"/g)].map(m => m[1]),
    ['papers', 'alerts', 'coverage'], 'Keep all existing native research hash routes');
  assert.match(links, /id="papers-count"/);
  assert.match(links, /id="alerts-count"/);
});

test('Playbooks, Technology, Research and editorial reviews reuse Discover card type', () => {
  const block = css.split('/* atlas-editorial-card-copy:begin */')[1]
    ?.split('/* atlas-editorial-card-copy:end */')[0];
  assert.ok(block, 'Missing shared card typography implementation');
  for (const selector of [
    '.playbook-shell .playbook > h2',
    '.tech-shell .tech-card > h3',
    '.shell:has(> .site-chrome.nav) article.card > h3',
    '.shell:has(> .site-chrome.research-site-chrome) .cards > .card > h3'
  ]) assert.ok(block.includes(selector), 'Missing card family: ' + selector);
  assert.match(block, /font:400 clamp\(20px,2vw,23px\)\/1\.25 Georgia/);
  assert.match(block, /color:var\(--ink\)/);
  assert.match(block, /\.playbook-shell \.playbook > p,[\s\S]*?color:var\(--muted\)/);
  assert.ok(!block.includes('display:none'), 'Do not hide page navigation or cards');
});

test('script-free dark OS palette is shared across every native navigation family', () => {
  const block = css.split('/* atlas-scriptfree-dark-chrome:begin */')[1]
    ?.split('/* atlas-scriptfree-dark-chrome:end */')[0];
  assert.ok(block, 'Missing shared no-JavaScript OS theme fallback');
  assert.ok(block.includes(':root:not([data-theme]):has(.site-chrome)'),
    'Explicit saved light/dark must win; do not scope the fallback to one article type');
  for (const variable of ['--bg:#18211E','--surface:#222D27','--ink:#F6F6F2',
                          '--line:#3B4A40','--paper:#222D27','color-scheme:dark'])
    assert.ok(block.includes(variable), 'Incomplete shared dark palette: ' + variable);
  assert.ok(!block.includes('display:none'), 'Do not hide content to fix dark contrast');
  for (const route of ['whats-new.html','research.html','technologies.html',
                       'playbooks.html','games.html','technology/TECH-0216-pytorch.html']) {
    const html=fs.readFileSync(path.join(__dirname,'..',route),'utf8');
    assert.ok(html.includes('site-chrome.css'), route + ' must share the theme source');
  }
  const offline=fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8');
  assert.ok(offline.includes(css),'Offline fallback must embed the exact shared CSS');
});

test('shared editorial cards match Discover hover and expose keyboard focus in either theme', () => {
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  const block = css.split('/* atlas-card-interactions:begin */')[1]
    ?.split('/* atlas-card-interactions:end */')[0];
  assert.ok(block, 'Missing single shared card interaction rule');
  assert.ok(brand.includes('.discovery-card:hover{border-color:#9AAD9C}'));
  for (const selector of [
    '.playbook-shell .playbook',
    '.tech-shell .tech-card',
    '.shell:has(> .site-chrome.nav) article.card',
    '.shell:has(> .site-chrome.research-site-chrome) .cards > .card'
  ]) assert.ok(block.includes(selector), 'Missing card family: ' + selector);
  assert.ok(block.includes(':is(:hover,:focus-within)'));
  assert.ok(block.includes(':root[data-theme="dark"]') && block.includes('prefers-color-scheme:dark'));
  assert.ok(!block.includes('pointer-events:none') && !block.includes('display:none'));
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline demo must embed the exact updated CSS');
});

test('generated concept and technology article headlines reuse Discover typography in both themes and mobile widths', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  const block = css.split('/* atlas-shared-headlines:begin */')[1]
    ?.split('/* atlas-shared-headlines:end */')[0];
  assert.ok(block, 'Missing shared reference-heading source');
  assert.ok(brand.includes('.discover-heading h1{font:400 clamp(40px,4.2vw,56px)/1.08 Georgia'), 'Discover desktop heading token changed');
  assert.ok(block.includes('font:400 clamp(40px,4.2vw,56px)/1.08 Georgia'), 'Reference desktop title must match Discover');
  assert.ok(block.includes('@media(max-width:650px)') && block.includes('h1{font-size:43px}'),
    'Reference mobile title must match Discover, including 320px');
  assert.ok(block.includes(':not(:has(.discover-heading))'), 'Do not override existing directory landing headings');
  assert.ok(!block.includes('display:none'), 'Do not conceal native article headings');
  for (const route of ['terms/MLD-0001-a-b-test.html', 'technology/TECH-0288-vllm.html']) {
    const html=fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.match(html, /<header class="hero"[^>]*><p class="eyebrow">/);
    assert.ok(html.includes('<h1>') && html.includes('</h1>'), route + ' keeps a semantic article title');
    assert.match(html, /<a class="skip" href="#main">/, route + ' retains native skip');
  }
  const offline=fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline fallback must embed the exact shared CSS');
});

test('native mobile header shares Discover height across directories, news, editorials and Games', () => {
  const block = css.split('/* atlas-mobile-chrome-rhythm:begin */')[1]
    ?.split('/* atlas-mobile-chrome-rhythm:end */')[0];
  assert.ok(block, 'Shared native mobile header rhythm missing');
  assert.match(block, /@media\(max-width:650px\)/);
  assert.ok(block.includes('.site-mobile-chrome:not(.discover-mobile-chrome)'));
  assert.ok(block.includes('padding-block:12px!important'));
  assert.ok(block.includes('min-height:68px'));
  assert.ok(block.includes('.games-header .site-mobile-chrome') && block.includes('padding-block:0!important'),
    'Do not duplicate Games containing-header padding');
  for (const route of ['terms/index.html','technology/index.html','whats-new.html',
                       'research.html','playbooks.html','games.html','about.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.match(html, /class="[^"]*site-mobile-chrome/);
  }
  const offline = fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8');
  assert.ok(offline.includes(css),'Offline workspace must carry exact shared styling');
});

test('Discover first paint keeps its useful content stable without perpetual loading', () => {
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const theme = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const block = css.split('/* atlas-discover-first-paint:begin */')[1]
    ?.split('/* atlas-discover-first-paint:end */')[0];
  assert.ok(block, 'Missing shared first-paint correction');
  assert.match(home, /id="catalog-loading" class="catalog-loading" role="status"/,
    'Preserve the hydration sentinel for readiness tests and assistive technology');
  assert.match(home, /<div id="page"><!-- discovery:start -->/,
    'Preserve the server-rendered Discover preview');
  assert.ok(css.includes('.shell:has(> .site-chrome.top){padding-top:0!important}'),
    'Archive and Discover should share the same first-content workspace frame');
  assert.ok(block.includes('#catalog-loading{display:none}'),
    'Without JavaScript, never present a perpetual loading notice');
  assert.ok(block.includes('html.atlas-enhanced #catalog-loading') &&
    block.includes('position:absolute') && block.includes('clip-path:inset(50%)'),
    'Scripted status must announce loading without moving the article');
  assert.ok(theme.includes("classList?.add('atlas-enhanced')"),
    'Only enhanced pages announce pending catalog loading');
  assert.ok(app.includes("document.getElementById('catalog-loading').remove()"),
    'Remove the status when catalog hydration succeeds');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline demo must embed the exact shared stylesheet');
});

test('theme preference stays synchronized across open editorial and reference tabs', () => {
  const theme = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  assert.ok(theme.includes("window.addEventListener('storage', (event) =>"));
  assert.ok(theme.includes("event.key === 'atlas.theme'"));
  assert.ok(theme.includes('syncSharedStoredTheme(event.newValue)'));
  assert.ok(theme.includes('syncSharedStoredTheme(savedTheme)'),
    'BFCache restoration and cross-tab updates must reuse the same theme state');
  assert.ok(theme.includes("button.setAttribute('aria-pressed'"),
    'Cross-tab updates must synchronize the visible theme controls');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes("window.addEventListener('storage', (event) =>"),
    'The offline fallback must embed the current shared theme script');
});


test('mobile news intro uses the same editorial content-start rhythm as directory landings',()=>{
  const block=css.split('/* atlas-mobile-news-intro-rhythm:begin */')[1]
    ?.split('/* atlas-mobile-news-intro-rhythm:end */')[0];
  assert.ok(block,'Shared news landing intro rhythm missing');
  assert.match(block,/@media \(max-width:650px\)/);
  assert.match(block,/\.shell:has\(> \.site-chrome\.top\) > main > header\{padding-top:8px\}/);
  const archive=fs.readFileSync(path.join(__dirname,'..','whats-new.html'),'utf8');
  const terms=fs.readFileSync(path.join(__dirname,'..','terms/index.html'),'utf8');
  const playbooks=fs.readFileSync(path.join(__dirname,'..','playbooks.html'),'utf8');
  assert.match(archive,/<nav class="site-chrome top"/);
  assert.match(archive,/<main>\s*<header id="main" tabindex="-1">/);
  assert.match(terms,/<header class="hero" id="main" tabindex="-1">/);
  assert.match(playbooks,/<section class="playbook-hero"/);
  assert.ok(!block.includes('display:none')&&!block.includes('pointer-events:none'));
  const offline=fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8');
  assert.ok(offline.includes(css),'Offline snapshot must embed the exact shared chrome CSS');
});

test('script-free daily archive and catalog review skip links focus the editorial heading, not the main wrapper', () => {
  for (const route of ['whats-new.html', 'catalog-review.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.match(html, /<a class="skip" href="#main">/);
    assert.match(html, /<main>\s*<header id="main" tabindex="-1">/);
    assert.doesNotMatch(html, /<main id="main"/);
    assert.equal((html.match(/id="main"/g) || []).length, 1, route + ' has one skip target');
    assert.match(html, /<header id="main" tabindex="-1">[\s\S]*?<h1[\s>]/);
  }
});


test('About and both A-Z landing pages separate shared navigation from the main landmark', () => {
  const shared = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  assert.ok(shared.includes('def wrap_reference_shell(nav, content, path, main_id):'));
  for (const route of ['about.html', 'terms/index.html', 'technology/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const desktop = html.indexOf('<nav class="site-chrome term-nav"');
    const mobile = html.indexOf('class="directory-mobile-topbar site-mobile-chrome"');
    const main = html.indexOf('<main class="term-shell">');
    const hero = html.indexOf('<header class="hero" id="main" tabindex="-1">');
    assert.ok(desktop > 0 && mobile > 0 && desktop < main && mobile < main && hero > main, route);
    assert.equal((html.match(/<main[^>]*>/g) || []).length, 1, route);
    assert.equal((html.match(/id="main"/g) || []).length, 1, route);
    assert.equal((html.match(/aria-label="AI Updates primary navigation"/g) || []).length, 1, route);
    assert.ok(html.indexOf('</nav>', desktop) < main, route + ' nests site navigation within main');
    assert.ok(html.includes('href="#main"') && html.includes('@media(min-width:651px){.term-shell>.hero{margin-top:8px}}@media(max-width:650px){.term-shell>.hero{margin-top:18px}body>.directory-mobile-topbar{margin:0;padding-inline:20px}}'), route);
  }
  // Detailed articles remain unchanged until a future complete generated build.
  for (const route of ['terms/MLD-0001-a-b-test.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.ok(html.indexOf('<main class="term-shell">') < html.indexOf('<nav class="site-chrome term-nav"'), route);
  }
});

test('all concept pages use the technology-profile native article skip, without duplicating navigation', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'terms/manifest.json'), 'utf8'));
  const publication = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'publication.json'), 'utf8'));
  const entries = Object.values(manifest);
  assert.equal(Object.keys(manifest).length, publication.published_counts.terms);
  assert.equal(entries.filter(entry => entry.expanded).length, publication.encyclopedia.detailed_page_count);
  for (const entry of entries) {
    const html = fs.readFileSync(path.join(__dirname, '..', entry.path), 'utf8');
    assert.match(html, /<a class="skip" href="#main">/, entry.path);
    assert.match(html, /<main class="term-shell">/, entry.path);
    assert.doesNotMatch(html, /<main class="term-shell" id="main"/, entry.path);
    assert.match(html, /<header class="hero" id="main" tabindex="-1"><p class="eyebrow">/, entry.path);
    assert.equal((html.match(/id="main"/g) || []).length, 1, entry.path);
    assert.ok(html.indexOf('<nav class="site-chrome term-nav"') <
              html.indexOf('<header class="hero" id="main" tabindex="-1">'), entry.path);
    assert.equal((html.match(/aria-label="AI Updates primary navigation"/g) || []).length, 1,
                 entry.path + ' must not duplicate desktop navigation');
  }
});


test('Discover and Games primary appearance controls share pressed state with editorial theme buttons', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const games = fs.readFileSync(path.join(__dirname, '..', 'games.html'), 'utf8');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.match(home, /id="theme-toggle"/);
  assert.match(games, /id="theme-toggle"[^>]*aria-pressed="false"/);
  assert.ok(script.includes("document.getElementById?.('theme-toggle')?.setAttribute('aria-pressed'"));
  assert.ok(script.includes('syncPrimaryThemeButton(theme);'));
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').includes("if(typeof syncSharedStoredTheme==='function')syncSharedStoredTheme(theme)"),
    'Discover invokes the shared theme synchronizer after its own click handler changes the theme');
  assert.ok(script.includes('queueMicrotask(syncThemeButtons)'),
    'Shared controls must read final state after the existing app click handler');
  assert.ok(offline.includes(script), 'The offline workspace must embed the exact current shared theme behavior');
});


test('shared editorial card links, disclosures and descriptions follow Discover in both color schemes', () => {
  const block = css.split('/* atlas-card-copy-contrast:begin */')[1]
    ?.split('/* atlas-card-copy-contrast:end */')[0];
  assert.ok(block, 'Shared editorial contrast block missing');
  for (const selector of [
    '.playbook-shell .playbook a',
    '.playbook-shell .playbook summary',
    '.playbook-shell .playbook p',
    '.tech-shell .tech-card .card-actions a',
    '.tech-shell .tech-card details > summary',
    '.tech-shell .tech-card dd',
    '.shell:has(> .site-chrome.research-site-chrome) .cards .card a',
    '.shell:has(> .site-chrome.research-site-chrome) .cards .card p'
  ]) assert.ok(block.includes(selector), 'Uncovered card copy: ' + selector);
  assert.match(block, /color:var\(--accent,#27664e\)/);
  assert.match(block, /color:var\(--muted,#5d6861\)/);
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  assert.match(brand, /--accent:#B1D5BD/, 'Dark mode needs a legible interactive foreground');
  assert.match(brand, /--muted:#AFBEB2/, 'Dark mode needs a legible body foreground');
  assert.match(brand, /--accent:#27664E/, 'Light mode must retain its original foreground');
  for (const page of ['playbooks.html', 'technologies.html', 'research.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /href="site-chrome\.css"/, page + ' must share live contrast tokens');
    assert.match(html, /site-chrome/, page + ' must keep the canonical navigation');
  }
  assert.ok(!block.includes('display:none') && !block.includes('pointer-events:none'),
    'Contrast fixes must not hide cards or disable links');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline fallback must embed the same shared CSS');
});


test('Research, Playbooks, news, editorial reviews and reference directories reuse one evidence callout', () => {
  const block = css.split('/* atlas-shared-evidence-callouts:begin */')[1]
    ?.split('/* atlas-shared-evidence-callouts:end */')[0];
  assert.ok(block, 'Missing shared evidence callout component');
  for (const sel of ['.shell .notice', '.tech-shell .tech-warning', '.playbook-shell .playbook-note',
    '.review-shell .review-callout', '.term-shell .notice']) {
    assert.ok(block.includes(sel), 'Missing callout family: ' + sel);
  }
  for (const property of ['background:var(--accent-soft', 'border:1px solid var(--line',
    'border-left:4px solid var(--accent', 'color:var(--ink',
    'a:focus-visible', 'white-space:normal', '@media (max-width:650px)']) {
    assert.ok(block.includes(property), 'Missing shared surface/accessibility treatment: ' + property);
  }
  assert.ok(!block.includes('display:none') && !block.includes('pointer-events:none'),
    'All evidence notes and links must remain usable');
  const pages = {
    'research.html': 'class="notice"',
    'playbooks.html': 'class="playbook-note"',
    'technologies.html': 'class="tech-warning"',
    'hardware-review.html': 'class="review-callout"',
    'catalog-review.html': 'class="notice"',
    'whats-new.html': 'class="notice"',
    'technology/index.html': 'class="notice"'
  };
  for (const [route, marker] of Object.entries(pages)) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.ok(html.includes(marker), route + ' retains real evidence copy');
    assert.ok(html.includes('href="site-chrome.css"') || html.includes('href="../site-chrome.css"'),
      route + ' loads the shared callout');
    assert.ok(/<a href=/.test(html), route + ' retains source navigation');
  }
  const brand=fs.readFileSync(path.join(__dirname,'..','brand.css'),'utf8');
  assert.ok(brand.includes(':root[data-theme=dark]') && brand.includes('--accent:#B1D5BD'),
    'Shared callouts inherit the readable dark-theme accent');
  const offline=fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8');
  assert.ok(offline.includes(css), 'Offline fallback must embed the exact shared stylesheet');
});

test('Discover and all standalone families share footer flow while preserving evidence and Games content', () => {
  const block = css.split('/* atlas-shared-footer-layout:begin */')[1]
    ?.split('/* atlas-shared-footer-layout:end */')[0];
  assert.ok(block, 'Missing shared footer layout');
  for (const rule of ['@media (min-width:851px)', 'display:flex', 'flex-wrap:wrap',
    'justify-content:space-between', 'gap:8px 20px', 'footer > p',
    'flex:1 1 100%', '@media (max-width:850px)', 'display:block'])
    assert.ok(block.includes(rule), 'Shared footer is missing ' + rule);
  assert.ok(!block.includes('display:none') && !block.includes('pointer-events:none'));
  const appCss = fs.readFileSync(path.join(__dirname, '..', 'app.css'), 'utf8');
  assert.match(appCss, /\.main-footer\{[^}]*display:flex;justify-content:space-between/);
  for (const page of ['whats-new.html', 'research.html', 'about.html',
    'technologies.html', 'playbooks.html', 'games.html', 'catalog-review.html',
    'hardware-review.html', 'terms/index.html', 'technology/index.html',
    'terms/MLD-0001-a-b-test.html', 'technology/TECH-0288-vllm.html']) {
    const html=fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /<footer\b[^>]*>[\s\S]*?<\/footer>/, page + ' must keep its native footer');
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1] || '';
    assert.match(footer, /<a\b[^>]*href=/, page + ' retains real source/policy links');
    if (page === 'research.html') {
      assert.match(footer, /Curated snapshot.*not every paper or incident/, 'Research keeps its existing coverage disclaimer');
      assert.match(footer, /href="about\.html"/, 'Research shares the editorial policy destination');
      assert.match(footer, /href="index\.html#\/sources"/, 'Research shares the working source-register destination');
    }
    assert.match(html, /href="(?:\.\/|\.\.\/)?site-chrome\.css"/,
      page + ' must load shared footer styling');
  }
  const games=fs.readFileSync(path.join(__dirname, '..', 'games.html'), 'utf8');
  assert.match(games, /<footer>[\s\S]*?<p>[\s\S]*?<p>/);
  const offline=fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline edition must use the exact shared footer component');
});

test('all standalone page families expose the same real policy and source destinations without scripts', () => {
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  assert.match(builder, /def ensure_footer_resources\(html, path\):/);
  assert.match(builder, /return ensure_skip_destination_focusable\(migrate_legacy_article_landmark\(normalized, path\), path\)/);
  const build = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8');
  assert.match(build, /ensure_footer_resources\(normalize_standalone_chrome\(page.read_text\(encoding="utf-8"\), route\), route\)/);
  for (const route of [
    'demo.html', 'research.html', 'catalog-review.html', 'hardware-review.html',
    'games.html', 'technologies.html', 'playbooks.html', 'whats-new.html',
    'about.html', 'terms/index.html', 'technology/index.html',
    'terms/MLD-0001-a-b-test.html', 'technology/TECH-0288-vllm.html'
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0];
    assert.ok(footer, route + ' has a usable footer without hydration');
    const prefix = route.startsWith('terms/') || route.startsWith('technology/') ? '../' : '';
    const required = route === 'games.html'
      ? [prefix + 'index.html#/sources']
      : [prefix + 'about.html', prefix + 'index.html#/sources'];
    for (const href of required) {
      assert.equal(footer.split('href="' + href + '"').length - 1, 1,
        route + ' must link exactly once to canonical ' + href);
    }
    assert.ok(!/onclick\s*=/.test(footer), route + ' resources require no script');
  }
  const games = fs.readFileSync(path.join(__dirname, '..', 'games.html'), 'utf8');
  assert.match(games, /<footer><p>Built from AI Updates/);
  assert.match(games, /Scores and missed concepts stay in this tab/);
});

test('native desktop rails expose Discover secondary destinations from one shared enhancement', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  const discoverMore = home.split('<details class="nav-more" id="additional-navigation">')[1]?.split('</details>')[0];
  assert.ok(discoverMore, 'Discover must retain its script-free secondary menu');
  const existing = [...discoverMore.matchAll(/<a class="nav-link" data-(?:view|static)="[^"]+" href="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g)]
    .map(match => [match[1].startsWith('#/') ? 'index.html' + match[1] : match[1], match[2]]);
  const generated = script.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  assert.ok(generated, 'Every native page must share one secondary source');
  const rendered = [...generated.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(m => [m[1], m[2]]);
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  const source = generator.split('SECONDARY_DESTINATIONS = (')[1]?.split('\n)')[0];
  assert.ok(source, 'Canonical secondary navigation definitions must be present');
  const canonical = [...source.matchAll(/\("([^"]+)", "(?:view|static)", "([^"]+)", "([^"]+)"\),/g)]
    .map(m => [m[2], m[3]]);
  assert.equal(canonical.length, 8, 'Do not invent or remove secondary destinations');
  assert.deepEqual(rendered, canonical, 'Native desktop rails must use the Python build-time source');
  const seoBuild = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8');
  assert.match(seoBuild, /sync_secondary_navigation_script\(theme\)/);
  assert.match(generator, /secondary = sync_discover_secondary\(secondary\)/);
  assert.match(script, /atlas-secondary-data:begin/);
  assert.match(script, /atlas-secondary-data:end/);
  assert.equal(rendered.length, 8, 'Keep existing eight destinations, without expanding the catalog');
  assert.deepEqual(rendered, existing, 'Secondary destinations and order must match Discover');
  assert.ok(script.includes("desktopRail?.querySelector?.('.site-chrome__links')"));
  assert.ok(script.includes("!desktopRail.querySelector('.site-chrome__more')"),
    'Do not duplicate disclosure on repeated enhancement');
  assert.ok(script.includes("homeLink.endsWith('index.html#/overview')"),
    'Use actual native brand link for nested catalog path prefixes');
  const block = styles.split('/* atlas-secondary-navigation:begin */')[1]?.split('/* atlas-secondary-navigation:end */')[0];
  assert.ok(block && block.includes('@media(min-width:651px)'), 'Enhance desktop rail only');
  assert.ok(block.includes('min-height:44px') && block.includes('focus-visible'));
  const linkRule = block.split('.site-chrome__more-links a{')[1]?.split('}')[0];
  const triggerRule = block.split('.site-chrome__more > summary{')[1]?.split('}')[0];
  assert.ok(linkRule && triggerRule && !linkRule.includes('display:none') &&
    !triggerRule.includes('display:none') && !block.includes('pointer-events:none'),
    'Visible links and disclosure toggle remain keyboard-interactive');
  assert.ok(block.includes('summary::-webkit-details-marker{display:none}'),
    'Only the duplicate browser marker may be hidden');
  assert.ok(block.includes('@media print{.site-chrome__more{display:none!important}}'),
    'Print must not include navigation chrome');
  assert.ok(offline.includes(styles) && offline.includes(script),
    'Single-file demo must carry the exact same shared styles and enhancement');
});

test('one shared mobile disclosure exposes the existing secondary routes with keyboard access', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.match(js, /#additional-navigation \.nav-more-links, \.site-chrome__more-links/,
    'Mobile More sections must reuse actual desktop links rather than duplicate route definitions');
  assert.match(js, /sourceLinks\.querySelectorAll\('a\[href\]'\)/);
  assert.match(js, /source\.hasAttribute\('download'\)/,
    'Offline download must retain its native download behavior');
  assert.match(js, /querySelectorAll\('a\[href\],button:not\(\[disabled\]\),summary'\)/,
    'Keyboard trapping must include the nested More sections summary');
  assert.match(css, /\.site-mobile-chrome__more>summary:focus-visible|\.site-mobile-chrome summary:focus-visible/,
    'Nested disclosure has visible keyboard focus');
  assert.match(css, /\.site-mobile-chrome__more>summary\{[^}]*min-height:44px/,
    'Nested summary needs a touch-sized target');
  assert.ok(offline.includes(js) && offline.includes(css),
    'The single-file offline demo must include both updated shared components');
});


test('Discover mobile drawer exposes the canonical eight secondary destinations without JavaScript', () => {
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  const theme = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  assert.ok(generator.includes('render_mobile_secondary_nav("").replace('),
    'Discover must reuse the existing shared mobile link generator, not maintain a copied list');
  assert.ok(theme.includes("if (menu && !menu.querySelector('.site-mobile-chrome__more'))"),
    'Hydration must not add a duplicate disclosure to the script-free drawer');
  const raw = theme.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  const canonical = [...raw.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(m => [m[1], m[2]]);
  assert.equal(canonical.length, 8);
  for (const [route, offline] of [['index.html', false], ['downloads/Atlas_Demo_Offline.html', true]]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const drawer = html.match(/<nav class="site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav><\/details><\/div>/)?.[1];
    assert.ok(drawer, route + ' has the native drawer and brand');
    assert.equal((drawer.match(/<details class="site-mobile-chrome__more"(?: open)?>/g) || []).length, 1,
      route + ' must have exactly one script-free secondary disclosure');
    assert.equal((drawer.split('<details class="site-mobile-chrome__more">')[0].match(/<a href="[^"]+"(?: aria-current="page")?>/g) || []).length, 7,
      route + ' keeps the seven top-level primary links');
    const secondary = drawer.match(/<details class="site-mobile-chrome__more"(?: open)?><summary>More sections<\/summary><div class="site-mobile-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(secondary, route + ' retains native nested keyboard disclosure');
    const actual = [...secondary.matchAll(/<a href="([^"]+)"(?: aria-current="location")?( download)?>([^<]+)<\/a>/g)]
      .map(m => [m[1], m[3].replaceAll('&amp;', '&')]);
    const expected = canonical.map(([href, label]) => {
      let local = href.replace(/^index\.html(?=#\/)/, '');
      if (offline && local === 'demo.html') local = '#/overview';
      if (offline && local === 'terms/index.html') local = '#/dictionary';
      return [local, label];
    });
    assert.deepEqual(actual, expected, route + ' retains working canonical destinations');
    assert.match(secondary, /href="downloads\/Atlas_Demo_Offline\.html" download>/,
      'Keep the original downloadable offline fallback');
  }
});

test('native editorial, archive, technology, research and Games pages keep Discover secondary navigation without JS', () => {
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const py = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'site_chrome.py'), 'utf8');
  const build = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build_seo.py'), 'utf8');
  const data = js.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  assert.ok(data, 'Shared secondary destinations must exist');
  const expected = [...data.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(m => [m[1], m[2]]);
  assert.equal(expected.length, 8);
  assert.match(home, /<details class="nav-more" id="additional-navigation">/);
  assert.match(py, /def render_secondary_nav\(prefix, current=None\):/);
  assert.match(py, /native_secondary=True/);
  assert.match(build, /page_label='About', topbar_title='About', native_secondary=True, mobile_secondary=True/);
  for (const name of ['about.html', 'demo.html', 'research.html', 'catalog-review.html',
    'hardware-review.html', 'games.html', 'technologies.html', 'playbooks.html', 'whats-new.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    const rail = html.match(/<nav class="site-chrome [^"]+" aria-label="AI Updates primary navigation">[\s\S]*?<\/nav>/)?.[0];
    assert.ok(rail, name + ' has the shared native desktop rail');
    assert.equal((rail.match(/class="site-chrome__more"/g) || []).length, 1,
      name + ' must have one script-free disclosure, not a duplicate');
    const details = rail.match(/<details class="site-chrome__more"(?: open)?><summary>More sections<\/summary><div class="site-chrome__more-links">([\s\S]*?)<\/div><\/details>/);
    assert.ok(details, name + ' exposes the same native disclosure as Discover');
    const anchors = [...details[1].matchAll(/<a href="([^"]+)"(?: aria-current="location")?( download)?>([^<]+)<\/a>/g)]
      .map(m => [m[1], m[3].replaceAll('&amp;', '&')]);
    assert.deepEqual(anchors, expected, name + ' secondary routes and labels must not drift');
    assert.ok(details[1].includes('href="downloads/Atlas_Demo_Offline.html" download>'),
      name + ' must preserve the native offline download');
    assert.equal((rail.match(/class="site-chrome__links"/g) || []).length, 1,
      name + ' retains its original primary navigation');
    assert.match(html, /class="[^"]*site-mobile-chrome__nav"/,
      name + ' retains its native keyboard-usable mobile menu');
  }
  assert.ok(js.includes("!desktopRail.querySelector('.site-chrome__more')"),
    'JS enhancement must not insert a second disclosure over static navigation');
});

test('generated concept and technology directories expose shared secondary routes without JavaScript', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const data = js.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  assert.ok(data, 'Canonical Discover secondary routes must exist');
  const expected = [...data.matchAll(/\["([^"]+)", "([^"]+)"\]/g)]
    .map(m => ['../' + m[1], m[2]]);
  assert.equal(expected.length, 8);
  const termBuild = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_term_pages.py'), 'utf8');
  const seoBuild = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8');
  assert.ok(termBuild.includes("native_secondary=True"));
  assert.ok(seoBuild.includes("native_secondary=True"));
  for (const route of ['terms/index.html', 'technology/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const rail = html.match(/<nav class="site-chrome term-nav" aria-label="AI Updates primary navigation">[\s\S]*?<\/nav>/)?.[0];
    assert.ok(rail, route + ' keeps its shared primary navigation');
    assert.equal((rail.match(/class="site-chrome__more"/g) || []).length, 1,
      route + ' must have exactly one script-free secondary disclosure');
    const menu = rail.match(/<details class="site-chrome__more"(?: open)?><summary>More sections<\/summary><div class="site-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(menu, route + ' uses the shared native disclosure');
    const links = [...menu.matchAll(/<a href="([^"]+)"(?: aria-current="location")?( download)?>([^<]+)<\/a>/g)]
      .map(m => [m[1], m[3].replaceAll('&amp;', '&')]);
    assert.deepEqual(links, expected, route + ' must match Discover including nested URL prefixes');
    assert.ok(menu.includes('href="../downloads/Atlas_Demo_Offline.html" download>'),
      route + ' retains the real offline download');
    assert.equal((rail.match(/class="site-chrome__links"/g) || []).length, 1,
      route + ' retains one primary link group');
    assert.match(html, /href="\.\.\/index\.html#\/search"/,
      route + ' keeps working shared search navigation');
    assert.match(html, /id="directory-mobile-nav"/,
      route + ' preserves native mobile navigation');
  }
});


test('standalone mobile drawers expose eight shared secondary routes without JavaScript', () => {
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  assert.match(builder, /def render_mobile_secondary_nav\(prefix, current=None\):/);
  assert.match(builder, /mobile_brand=True, native_secondary=True, mobile_secondary=True/);
  assert.match(builder, /for key, _, route, label in SECONDARY_DESTINATIONS/);
  const source = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const data = source.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  const expected = [...data.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(m => [m[1], m[2]]);
  assert.equal(expected.length, 8);
  for (const route of ['about.html', 'demo.html', 'research.html', 'catalog-review.html',
                       'hardware-review.html', 'games.html', 'technologies.html',
                       'playbooks.html', 'whats-new.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const menu = html.match(/<nav class="[^"]*site-mobile-chrome__menu"[^>]*>([\s\S]*?)<\/nav><\/details>/)?.[1];
    assert.ok(menu, route + ' keeps native primary links and mobile drawer');
    assert.equal((menu.match(/<details class="site-mobile-chrome__more"(?: open)?>/g) || []).length, 1,
                 route + ' has exactly one static secondary disclosure');
    const secondaries = menu.match(/<details class="site-mobile-chrome__more"(?: open)?><summary>More sections<\/summary><div class="site-mobile-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(secondaries, route + ' preserves the shared native disclosure');
    const found = [...secondaries.matchAll(/<a href="([^"]+)"(?: aria-current="location")?( download)?>([^<]+)<\/a>/g)]
      .map(m => [m[1], m[3].replaceAll('&amp;', '&')]);
    assert.deepEqual(found, expected, route + ' uses shared canonical destinations');
    assert.match(secondaries, /href="downloads\/Atlas_Demo_Offline\.html" download>/);
    assert.equal((menu.match(/<a href="/g) || []).length, 15,
                 route + ' keeps seven primary and eight secondary links without duplicates');
  }
});

test('both generated A-Z directories share native script-free secondary mobile navigation', () => {
  for (const [page, sourceFile] of [
    ['terms/index.html','scripts/build_term_pages.py'],
    ['technology/index.html','scripts/build_seo.py']
  ]) {
    const source=fs.readFileSync(path.join(__dirname,'..',sourceFile),'utf8');
    const generatedMobileSecondary = source.includes("mobile_secondary=True");
    assert.ok(generatedMobileSecondary, page+' has build-time shared navigation');
    const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8');
    const menu=html.match(/<nav class="site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav><\/details>/)?.[1];
    const rail=html.match(/<div class="site-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(menu && rail, page+' has native mobile and desktop sections');
    assert.equal((menu.match(/<details class="site-mobile-chrome__more"(?: open)?>/g)||[]).length,1);
    const mobile=menu.match(/<div class="site-mobile-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(mobile,page+' retains the nested disclosure without scripts');
    const links = markup => [...markup.matchAll(/<a href="([^"]+)"(?: aria-current="location")?( download)?>([^<]+)<\/a>/g)]
      .map(m=>[m[1],m[3]]);
    assert.deepEqual(links(mobile),links(rail),page+' has identical mobile/desktop secondary links');
    assert.equal(links(mobile).length,8);
    assert.equal((menu.match(/<a href="/g)||[]).length,15,'Seven primary + eight secondary links, no duplicates');
    assert.match(html,/href="\.\.\/index\.html#\/search"/,'Real search route stays usable');
  }
});


test('generated detail mobile More sections clones the completed shared desktop rail', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const created = script.indexOf("desktopPrimary.insertAdjacentElement('afterend', more);");
  const cloned = script.indexOf("if (menu && !menu.querySelector('.site-mobile-chrome__more'))");
  assert.ok(created !== -1 && cloned > created,
    'Build the missing detail-page secondary rail before its mobile disclosure copies links');
  // Both basic and expanded concept pages now render the same eight routes
  // natively, just like technology profiles, without JavaScript.
  for (const detail of ['terms/MLD-0001-a-b-test.html', 'terms/MLD-0002-ablation-study.html', 'technology/TECH-0288-vllm.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', detail), 'utf8');
    assert.match(html, /class="site-mobile-chrome__menu"/);
    assert.match(html, /class="site-chrome__links"/);
    const extras = html.match(/<details class="site-mobile-chrome__more">([\s\S]*?)<\/details>/g) || [];
    assert.equal(extras.length, 1, detail + ' includes exactly one native mobile disclosure');
    assert.equal((extras[0].match(/<a href=/g) || []).length, 8,
      detail + ' keeps all eight canonical secondary destinations without scripts');
  }
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(script), 'Offline fallback must embed the identical shared interaction script');
});


test('shared native skip links have a visible focus layer above the desktop and mobile chrome', () => {
  const block = css.split('/* atlas-skip-focus-layer:begin */')[1]
    ?.split('/* atlas-skip-focus-layer:end */')[0];
  assert.ok(block, 'Missing common skip-link focus treatment');
  assert.match(block, /body:has\(\.site-chrome\) > a\.skip:focus/);
  assert.match(block, /position:fixed/);
  assert.match(block, /z-index:120/);
  assert.match(block, /background:var\(--surface/);
  assert.ok(!block.includes('display:none'), 'Never conceal the first keyboard target');
  for (const route of [
    'whats-new.html', 'about.html', 'research.html', 'games.html',
    'playbooks.html', 'terms/MLD-0001-a-b-test.html',
    'technology/TECH-0001-adversarial-robustness-toolbox.html'
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.ok(html.includes('<a class="skip" href="#main">'), route + ' has the real skip link');
    assert.ok(html.includes('site-chrome'), route + ' loads common navigation');
  }
});

test('mobile reference introductions share the Discover first-content rhythm without JavaScript', () => {
  const block = css.split('/* atlas-reference-intro-rhythm:begin */')[1]
    ?.split('/* atlas-reference-intro-rhythm:end */')[0];
  assert.ok(block, 'Missing shared mobile article introduction treatment');
  assert.match(block, /@media\(max-width:650px\)/);
  assert.ok(block.includes('.term-shell > .site-chrome + .hero'));
  assert.ok(block.includes('.term-shell > .site-chrome + .breadcrumb-links + .hero'));
  assert.match(block, /margin-top:18px/);
  assert.ok(!block.includes('display:none'), 'Do not hide the hero or breadcrumbs');
  for (const route of [
    'about.html',
    'terms/index.html',
    'terms/MLD-0001-a-b-test.html',
    'technology/index.html',
    'technology/TECH-0001-adversarial-robustness-toolbox.html'
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.ok(html.includes('site-chrome.css'), route + ' must use the shared CSS');
    assert.match(html, /<nav class="site-chrome[^"]*"[^>]*>/, route + ' needs the shared rail');
    assert.match(html, /<header class="hero"/, route + ' retains the original article heading');
  }
  const technology = fs.readFileSync(path.join(__dirname, '..',
    'technology/TECH-0001-adversarial-robustness-toolbox.html'), 'utf8');
  assert.match(technology, /<\/nav><main class="term-shell"><p class="breadcrumb-links">/,
    'The technology breadcrumb must remain inside the content landmark, after shared navigation');
  assert.ok(technology.indexOf('<main class="term-shell">') <
    technology.indexOf('<header class="hero" id="main" tabindex="-1">'),
    'The profile heading remains inside the main content landmark');
  const offline = fs.readFileSync(path.join(__dirname, '..',
    'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline fallback must embed the exact rebuilt shared CSS');
});

test('Research, Playbooks, Technology and daily news share one introduction component', () => {
  const block=css.split('/* atlas-shared-introduction-copy:begin */')[1]
    ?.split('/* atlas-shared-introduction-copy:end */')[0];
  assert.ok(block, 'Missing shared intro typography');
  for(const family of [".playbook-shell > .playbook-hero > p",".tech-shell > .tech-hero > p",".shell:has(> .site-chrome.research-site-chrome) > main > .hero > p",".shell:has(> .site-chrome.top) > main > header .lead"])
    assert.ok(block.includes(family), 'Missing shared introduction: '+family);
  assert.match(block,/max-width:70ch/);
  assert.match(block,/font-size:17px/);
  assert.match(block,/@media\(max-width:650px\)/);
  assert.match(block,/font-size:16px/);
  assert.ok(!block.includes('display:none')&&!block.includes('pointer-events:none'));
  for(const [page,hero] of [
    ['research.html','class="hero"'],
    ['playbooks.html','class="playbook-hero"'],
    ['technologies.html','class="tech-hero"'],
    ['whats-new.html','class="lead"']
  ]) {
    const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8');
    assert.ok(html.includes(hero)&&html.includes('site-chrome.css'), page+' retains its native shared layout');
  }
  assert.ok(fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8').includes(css));
});


test('script-free native catalogs offer source links instead of inert search and loading UI', () => {
  const block=css.split('/* atlas-scriptless-catalog-fallback:begin */')[1]
    ?.split('/* atlas-scriptless-catalog-fallback:end */')[0];
  assert.ok(block, 'Shared script-free card styling is required');
  assert.match(block, /:root:not\(\.atlas-enhanced\) \.site-js-only\{display:none!important\}/);
  const routes = {
    'research.html':['data/papers-01.json','data/papers-06.json','data/alerts-01.json','data/alerts-02.json'],
    'playbooks.html':['data/playbooks-01.json','data/playbooks-04.json'],
    'technologies.html':['technology/index.html','terms/index.html']
  };
  for(const [route,required] of Object.entries(routes)){
    const html=fs.readFileSync(path.join(__dirname,'..',route),'utf8');
    assert.ok(html.includes('<script src="site-theme.js"></script>'),route+' must set shared enhancement state');
    assert.match(html, /<noscript><section class="site-static-fallback"/,route+' needs native visible fallback');
    assert.ok(html.includes('class="site-js-only"'),route+' must hide controls when scripts are absent');
    const fallback=html.match(/<noscript><section class="site-static-fallback"[\s\S]*?<\/section><\/noscript>/);
    assert.ok(fallback,route+' must expose published source links');
    for(const href of required){
      assert.ok(fallback[0].includes('href="'+href+'"'),route+' missing '+href);
      assert.ok(fs.existsSync(path.join(__dirname,'..',href)),route+' fallback target missing '+href);
    }
    assert.ok(!/<noscript><p>JavaScript is (?:needed|required)/.test(html),route+' must not duplicate the fallback');
  }
  assert.match(css, /site-static-fallback__links a:focus-visible/);
});

test('About and both generated catalog directories share real desktop workspace titles', () => {
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8');
  const termsGenerator = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_term_pages.py'), 'utf8');
  assert.ok(generator.includes("topbar_title='About'"), 'About must be generated with the shared title');
  assert.ok(generator.includes("topbar_title=('Technology profiles' if path == 'technology/index.html' else None)"),
    'Technology directory title must not propagate to individual technology profiles');
  assert.ok(termsGenerator.includes("topbar_title=('Concept encyclopedia' if path == 'terms/index.html' else None)"),
    'Concept directory title must not propagate to 1,345 separate articles');
  for (const [route, title] of [
    ['about.html', 'About'],
    ['terms/index.html', 'Concept encyclopedia'],
    ['technology/index.html', 'Technology profiles']
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const span = '<span class="site-mobile-chrome__title">' + title + '</span>';
    assert.equal(html.split(span).length - 1, 1, route + ': exactly one real desktop heading');
    assert.ok(html.includes('data-page-label="' + title + '"'), route + ': script-free label agrees');
    const menuEnd = html.indexOf('</nav></details>');
    const headingAt = html.indexOf(span);
    const searchAt = html.indexOf('site-mobile-chrome__search', headingAt);
    assert.ok(menuEnd >= 0 && menuEnd < headingAt && headingAt < searchAt,
      route + ': heading follows mobile menu and precedes real search link');
    assert.ok(html.includes('<nav class="site-chrome'), route + ': shared desktop rail retained');
  }
});

test('research contextual views reuse Discover horizontal topic navigation', () => {
  const research = fs.readFileSync(path.join(__dirname, '..', 'research.html'), 'utf8');
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  assert.ok(research.includes('<nav class="research-local-nav discovery-topics" aria-label="Research views">'),
    'Research should share the actual Discover topic-strip component');
  assert.match(brand, /\.discovery-topics\{[^}]*overflow:auto/);
  assert.match(research, /\.research-local-nav a\{[^}]*flex:0 0 auto/);
  assert.match(research, /\.research-local-nav a\{[^}]*min-height:44px/);
  assert.ok(!research.includes('flex-wrap:wrap;gap:8px;margin:16px 0 24px;overflow:visible'),
    'Avoid a separate multirow Research navigation design');
  for (const href of ['#papers', '#alerts', '#coverage']) {
    assert.ok(research.includes('href="' + href + '"'), 'Preserve deep link ' + href);
  }
});


test('Research hash views update both shared navigation landmarks and the real workspace title', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'checkpoint.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'research.html'), 'utf8');
  assert.ok(script.includes("view === 'alerts' ? 'index.html#/safety' : 'index.html#/papers'"),
    'Safety and research hash views must select the corresponding shared rail link');
  assert.ok(script.includes("document.querySelectorAll('.site-chrome__more-links a, .site-mobile-chrome__more-links a')"),
    'Desktop and mobile must share the same active-section update');
  assert.ok(script.includes("a.removeAttribute('aria-current')"),
    'Do not leave two active secondary destinations');
  assert.ok(script.includes('mobileChrome.dataset.pageLabel = workspaceName'));
  assert.ok(script.includes("mobileChrome.querySelector('.site-mobile-chrome__title').textContent = workspaceName"));
  assert.ok(script.includes("document.title = workspaceName + ' | AI Updates'"),
    'Research route changes must keep the AI Updates site identity');
  assert.ok(html.includes('class="site-chrome__more-links"') &&
    html.includes('class="site-mobile-chrome__more-links"'), 'Shared navigation landmarks are present');
});

test('Research shares the one global slash-to-search keyboard route without a competing local handler', () => {
  const research = fs.readFileSync(path.join(__dirname, '..', 'checkpoint.js'), 'utf8');
  const shared = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'research.html'), 'utf8');
  assert.ok(!research.includes("document.addEventListener('keydown'"),
    'Research must not race the shared slash navigation handler');
  assert.ok(shared.includes("if (event.key !== '/' || event.defaultPrevented"),
    'Shared keyboard route must remain guarded and prevent duplicate handlers');
  assert.ok(shared.includes("document.querySelector('a.site-mobile-chrome__search[href]')"),
    'Shortcut must use the same real search destination as the visible control');
  assert.ok(research.includes("$('query').addEventListener('input', render)"),
    'Keep the Research-local filter functional when people use its field');
  assert.ok(html.includes('href="index.html#/search"'),
    'Research search link must reach the canonical real search view');
});

test('all technology profiles put shared navigation outside the content landmark', () => {
 const dir=path.join(__dirname,'..','technology');
 const pages=fs.readdirSync(dir).filter(name=>/^TECH-[0-9]{4}-.+\.html$/.test(name));
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'..','publication.json'),'utf8')).published_counts.technologies;
 assert.equal(pages.length,expected);
 for(const name of pages){
   const html=fs.readFileSync(path.join(dir,name),'utf8');
   const mobile=html.indexOf('<div class="directory-mobile-topbar site-mobile-chrome"');
   const nav=html.indexOf('<nav class="site-chrome term-nav"');
   const main=html.indexOf('<main class="term-shell">');
   const breadcrumb=html.indexOf('<p class="breadcrumb-links">');
   const hero=html.indexOf('<header class="hero" id="main" tabindex="-1">');
   assert.ok(mobile>0 && mobile<nav && nav<main && main<breadcrumb && breadcrumb<hero,name);
   assert.ok(html.indexOf('</nav>',nav)<main,name);
   assert.equal((html.match(/<main class="term-shell">/g)||[]).length,1,name);
   assert.equal((html.match(/id="main"/g)||[]).length,1,name);
 }
});


test('enhanced concept details reuse technology sibling navigation without changing script-free HTML', () => {
  const concept = fs.readFileSync(path.join(__dirname, '..', 'terms/MLD-0001-a-b-test.html'), 'utf8');
  const technology = fs.readFileSync(path.join(__dirname, '..', 'technology/TECH-0216-pytorch.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const style = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(concept.indexOf('<main class="term-shell">') < concept.indexOf('<nav class="site-chrome term-nav"'),
    'Unenhanced concept details retain usable native navigation');
  assert.ok(concept.includes('<header class="hero" id="main" tabindex="-1">'),
    'Native skip still targets the real article');
  assert.ok(technology.indexOf('<nav class="site-chrome term-nav"') < technology.indexOf('<main class="term-shell">'),
    'Technology detail remains the sibling-nav reference');
  assert.ok(script.includes('main.before(mobile, rail);'),
    'Enhancement moves rather than duplicates the existing rail and drawer');
  assert.ok(script.includes('main.firstElementChild !== mobile || mobile.nextElementSibling !== rail'),
    'Migration is narrowly guarded against changing unrelated pages');
  assert.ok(style.includes('body > .directory-mobile-topbar.site-mobile-chrome:has(+ nav.site-chrome + main.term-shell)'),
    'Moved header must not inherit the legacy negative mobile gutters');
  assert.ok(offline.includes(script) && offline.includes(style),
    'Offline demo embeds the exact current shared theme script and stylesheet');
});

test('the Concept encyclopedia has one current navigation destination per shared landmark', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'terms/index.html'), 'utf8');
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_term_pages.py'), 'utf8');
  const shared = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  assert.ok(generator.includes("(None if path == 'terms/index.html' else 'Concept dictionary')"),
    'the canonical generator must select the encyclopedia, not two destinations');
  assert.ok(shared.includes('assert not (selected and secondary_current)'),
    'the shared nav component must prevent duplicate active destinations');
  for (const [name, pattern] of [
    ['desktop', /<nav class="site-chrome term-nav"[^>]*>[\s\S]*?<\/nav>/],
    ['mobile', /<nav class="site-mobile-chrome__menu"[^>]*>[\s\S]*?<\/nav>/],
  ]) {
    const nav = html.match(pattern)?.[0];
    assert.ok(nav, 'Missing ' + name + ' navigation');
    assert.equal((nav.match(/<a\b[^>]*aria-current="/g) || []).length, 1,
      name + ' must not announce two simultaneous current pages');
    assert.match(nav, /href="\.\.\/terms\/index\.html" aria-current="location"/);
    assert.doesNotMatch(nav, /href="\.\.\/index\.html#\/dictionary" aria-current=/);
    assert.match(nav, /href="\.\.\/index\.html#\/dictionary"/,
      'the dictionary navigation destination must remain available');
  }
});

test('hydrated Discover route titles share native primary navigation labels', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  const start = '/* atlas-app-primary-labels:begin */';
  const end = '/* atlas-app-primary-labels:end */';
  assert.equal(app.split(start).length - 1, 1);
  assert.equal(app.split(end).length - 1, 1);
  const block = app.split(start)[1].split(end)[0];
  const labels = Object.fromEntries([...block.matchAll(/"([^"]+)":"([^"]+)",/g)]
    .map(([,key,value]) => [key,value]));
  assert.deepEqual(labels, {
    overview:'Discover', dictionary:'Concept dictionary',
    technologies:'Technology profiles', games:'Games', playbooks:'Playbooks'
  });
  const native = fs.readFileSync(path.join(__dirname, '..', 'playbooks.html'), 'utf8');
  assert.ok(native.includes('href="index.html#/games">Games</a>'));
  assert.ok(native.includes('href="playbooks.html" aria-current="page">Playbooks</a>'));
  assert.ok(source.includes('zip(DESTINATIONS, DISCOVER_LINKS, strict=True)'));
  assert.ok(builder.includes('synced_app = sync_app_primary_labels_js(previous_app)'),
    'The build must regenerate app labels from the canonical nav routes');
  assert.ok(offline.includes(block),
    'Offline must embed the same canonical hydrated labels');
});
