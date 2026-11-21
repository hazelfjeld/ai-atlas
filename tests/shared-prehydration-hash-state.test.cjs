'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const source = read('site-theme.js');
const block = source.split('/* atlas-prehydration-section-state:begin */')[1]
  ?.split('/* atlas-prehydration-section-state:end */')[0];
function makeLink(key, label, secondary = false) {
  const attrs = new Map([['href', '#/' + key]]);
  const classes = new Set();
  const alias = read('index.html').match(new RegExp('data-view="' + key +
    '" data-view-aliases="([^"]+)"'))?.[1] || '';
  return {
    dataset: {view: key, viewAliases: alias}, attrs, classes,
    classList: {toggle(name, selected) { if (selected) classes.add(name); else classes.delete(name); }},
    getAttribute(name) { return attrs.get(name); },
    setAttribute(name, value) { attrs.set(name, value); },
    removeAttribute(name) { attrs.delete(name); },
    closest(name) { return secondary && name === 'details.nav-more' ? {} : null; },
    querySelector(name) { return name === 'span:not(.nav-count)' ? {textContent: label} : null; },
  };
}
function exercise(hash) {
  const labels = [['overview','Discover'],['dictionary','Concept dictionary'],
    ['technologies','Technology profiles'],['games','Games'],
    ['papers','Research library'],['safety','Safety observatory'],
    ['sources','Sources & coverage']];
  const links = labels.map(([key,label])=>makeLink(key,label,['papers','safety'].includes(key)));
  const mobile = labels.map(([key,label])=>makeLink(key,label));
  links[0].setAttribute('aria-current','page');
  mobile[0].setAttribute('aria-current','page');
  const mainMore = {open:false,dataset:{}};
  const mobileMore = {open:false,dataset:{}};
  const toggleAttrs = new Map();
  const toggle = {setAttribute(k,v){toggleAttrs.set(k,v);}};
  const nav = {querySelectorAll(selector) {
    assert.equal(selector,'a[data-view]');return links;
  }};
  const drawer = {
    querySelectorAll(selector){assert.equal(selector,'a[href^="#/"]');return mobile;},
    querySelector(selector){
      if(selector==='details.site-mobile-chrome__more')return mobileMore;
      if(selector===':scope > summary')return toggle;
      return null;
    },
  };
  const title = {textContent:'Discover'};
  const header = {dataset:{pageLabel:'Discover'},setAttribute(k,v){this[k]=v;}};
  let cleared=0;
  const page = {
    querySelector(selector){return selector==='.discover-heading'?{}:null;},
    replaceChildren(){cleared++;},
  };
  const nodes = {'navigation':nav,'discover-mobile-nav':drawer,
    'additional-navigation':mainMore,'breadcrumb':title,'page':page,
    'catalog-loading':{}, 'global-query':{getAttribute(name){return name==='aria-label'?'Search AI Updates':null;}}};
  let callback, earlyClick, hashchange;
  const location = {hash};
  const window = {location, addEventListener(event, fn) {
    assert.equal(event, 'hashchange');
    hashchange = fn;
  }};
  const document = {
    addEventListener(event,fn){
      if(event==='DOMContentLoaded') callback=fn;
      else if(event==='click') earlyClick=fn;
      else assert.fail('unexpected event listener: '+event);
    },
    getElementById(id){return nodes[id]||null;},
    querySelector(selector){return selector==='.discover-mobile-chrome'?header:null;},
  };
  vm.runInNewContext(block,{window,document});
  assert.equal(typeof callback,'function');
  callback();
  return {links,mobile,mainMore,mobileMore,title,header,toggleAttrs,cleared,earlyClick,
    navigate(hash) {location.hash = hash; hashchange();},
    finishLoading() {delete nodes['catalog-loading'];}};
}
test('deep-link prehydration uses the canonical primary or secondary rail and real mobile title', () => {
  assert.ok(block);
  const secondary=exercise('#/papers?topic=safety');
  assert.equal(secondary.links.filter(x=>x.attrs.get('aria-current')==='page').length,1);
  assert.equal(secondary.links.find(x=>x.dataset.view==='papers').attrs.get('aria-current'),'page');
  assert.equal(secondary.mobile.find(x=>x.dataset.view==='papers').attrs.get('aria-current'),'page');
  assert.equal(secondary.links[0].attrs.has('aria-current'),false);
  assert.equal(secondary.title.textContent,'Research library');
  assert.equal(secondary.header.dataset.pageLabel,'Research library');
  assert.equal(secondary.toggleAttrs.get('aria-label'),'Toggle navigation · Research library');
  assert.equal(secondary.mainMore.open,true);
  assert.equal(secondary.mobileMore.open,true);
  assert.equal(secondary.mainMore.dataset.atlasAutoOpened,'true');
  assert.equal(secondary.cleared,1);
  const primary=exercise('#/dictionary');
  assert.equal(primary.links.find(x=>x.dataset.view==='dictionary').attrs.get('aria-current'),'page');
  assert.equal(primary.mainMore.open,false);
  assert.equal(primary.cleared,1);
  const overview=exercise('#/overview?topic=research');
  assert.equal(overview.title.textContent,'Discover');
  assert.equal(overview.cleared,0);
  const unknown=exercise('#/unrecognized');
  assert.equal(unknown.links[0].attrs.get('aria-current'),'page');
  assert.equal(unknown.cleared,0);
});
test('cross-page search opens the real search workspace before catalog hydration', () => {
  const state = exercise('#/search?q=reward%20hacking');
  // The global search is a workspace, not a fake eighth primary rail tab.
  assert.equal(state.links.filter(link=>link.attrs.has('aria-current')).length, 0);
  assert.equal(state.mobile.filter(link=>link.attrs.has('aria-current')).length, 0);
  assert.equal(state.title.textContent, 'Search AI Updates');
  assert.equal(state.header.dataset.pageLabel, 'Search AI Updates');
  assert.equal(state.toggleAttrs.get('aria-label'), 'Toggle navigation · Search AI Updates');
  assert.equal(state.mainMore.open, false);
  assert.equal(state.mobileMore.open, false);
  assert.equal(state.cleared, 1, 'old Discover teaser must not flash on direct search');
  assert.ok(read('research.html').includes('href="index.html#/search"'),
    'standalone Research really routes into this live search workspace');
  assert.ok(read('technology/TECH-0303-tohoku-aisin-16-nm-stt-mram-edge-ai-soc.html')
    .includes('href="../index.html#/search"'),
    'nested technology pages use the same functional search destination');
});


test('shared rails follow rapid hash navigation while the catalog is still loading', () => {
  const state = exercise('#/overview');
  state.navigate('#/safety');
  assert.equal(state.title.textContent, 'Safety observatory');
  assert.equal(state.links.find(x => x.dataset.view === 'safety').attrs.get('aria-current'), 'page');
  assert.equal(state.mobile.find(x => x.dataset.view === 'safety').attrs.get('aria-current'), 'page');
  assert.equal(state.mainMore.open, true);
  assert.equal(state.mobileMore.open, true);
  state.navigate('#/dictionary');
  assert.equal(state.title.textContent, 'Concept dictionary');
  assert.equal(state.mainMore.open, false, 'only the auto-opened disclosure closes');
  assert.equal(state.mobileMore.open, false);
  state.navigate('#/search?q=agent');
  assert.equal(state.title.textContent, 'Search AI Updates');
  assert.equal(state.links.filter(x => x.attrs.has('aria-current')).length, 0);
  state.navigate('#/papers');
  state.earlyClick({target:{closest() {return {parentElement:state.mainMore};}}});
  state.mainMore.open = false;
  state.navigate('#/overview');
  assert.equal(state.mainMore.open, false, 'manual disclosure ownership survives another hash');
  const before = state.title.textContent;
  state.finishLoading();
  state.navigate('#/safety');
  assert.equal(state.title.textContent, before, 'hydrated router owns navigation afterward');
});

test('manual More disclosure ownership is available before catalog hydration', () => {
  const result=exercise('#/safety');
  assert.equal(typeof result.earlyClick,'function');
  assert.equal(result.mainMore.dataset.atlasAutoOpened,'true');
  assert.equal(result.mobileMore.dataset.atlasAutoOpened,'true');
  // A normal link click must not forfeit ownership of an auto-opened menu.
  result.earlyClick({target:{closest(){return null;}}});
  assert.equal(result.mainMore.dataset.atlasAutoOpened,'true');
  // Both pointer and keyboard summary activation generate a click.
  for (const details of [result.mobileMore,result.mainMore]) {
    result.earlyClick({target:{closest(selector){
      assert.match(selector, /additional-navigation/);
      assert.match(selector, /site-mobile-chrome__more/);
      return {parentElement:details};
    }}});
    assert.equal(Object.hasOwn(details.dataset,'atlasAutoOpened'),false);
    assert.equal(details.dataset.atlasManualTouched,'true');
  }
  assert.equal((read('app.js').match(/document.addEventListener\('click', event => \{/g)||[]).length,0);
});
test('first-paint hash fix is exactly shared in the offline demo and does not duplicate chrome', () => {
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes('/* atlas-prehydration-section-state:begin */'+block+
    '/* atlas-prehydration-section-state:end */'));
  assert.equal(source.split('/* atlas-prehydration-section-state:begin */').length-1,1);
  assert.equal((read('index.html').match(/id="navigation"/g)||[]).length,1);
  assert.equal((read('index.html').match(/id="discover-mobile-nav"/g)||[]).length,1);
});

test('manual More choice survives catalog hydration and leaving a secondary route', () => {
  const app = read('app.js');
  const body = app.split('const syncAutomaticDisclosure=(disclosure,selected)=>{')[1]
    ?.split('\n  };')[0];
  assert.ok(body, 'Retain the canonical disclosure synchronization helper');
  const sync = vm.runInNewContext('(disclosure,selected) => {' + body + '\n}', {});
  const state = exercise('#/safety');
  const menu = state.mobileMore;
  assert.equal(menu.dataset.atlasAutoOpened, 'true');
  menu.open = false;
  state.earlyClick({target:{closest(){return {parentElement:menu};}}});
  sync(menu, true);
  assert.equal(menu.open, false, 'hydration cannot undo an intentional close');
  menu.open = true;
  sync(menu, false);
  assert.equal(menu.open, true, 'a deliberate re-open persists after primary navigation');
  const untouched = {open:true, dataset:{atlasAutoOpened:'true'}};
  sync(untouched, false);
  assert.equal(untouched.open, false, 'automatic expansions still collapse');
  assert.equal(untouched.dataset.atlasAutoOpened, undefined);
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(
    "if(selected && !disclosure.open && disclosure.dataset.atlasManualTouched !== 'true'){"));
});

test('canonical legacy hashes and unknown routes stay in sync before and after hydration', () => {
  for (const [alias, section, title] of [
    ['terms', 'dictionary', 'Concept dictionary'],
    ['alerts', 'safety', 'Safety observatory'],
    ['coverage', 'sources', 'Sources & coverage'],
  ]) {
    const state = exercise('#/' + alias + '?topic=research');
    assert.equal(state.links.find(link => link.dataset.view === section)
      .attrs.get('aria-current'), 'page', alias + ': desktop rail');
    assert.equal(state.mobile.find(link => link.dataset.view === section)
      .attrs.get('aria-current'), 'page', alias + ': mobile rail');
    assert.equal(state.title.textContent, title, alias + ': workspace title');
    assert.equal(state.links.filter(link => link.attrs.has('aria-current')).length, 1);
  }
  const state = exercise('#/safety');
  state.navigate('#/not-a-workspace');
  assert.equal(state.title.textContent, 'Discover');
  assert.equal(state.links.find(link => link.dataset.view === 'overview')
    .attrs.get('aria-current'), 'page', 'invalid hash resets to Discover');
  assert.equal(state.mainMore.open, false);
  assert.equal(state.mobileMore.open, false);
  const app = read('app.js');
  const parse = app.split('\n').find(line => line.startsWith('function parse(){'));
  assert.ok(parse?.includes('a[data-view-aliases]'), 'hydrated router reads canonical alias attributes');
  for (const [hash, expected] of [
    ['#/terms', 'dictionary'], ['#/alerts?topic=alignment', 'safety'],
    ['#/coverage', 'sources'], ['#/not-a-workspace', 'overview'],
  ]) {
    const context = {
      location: {hash}, URLSearchParams, labels: {
        overview: 'Discover', dictionary: 'Concept dictionary',
        safety: 'Safety observatory', sources: 'Sources & coverage'
      },
      $: id => {
        assert.equal(id, 'navigation');
        const links = ['dictionary', 'safety', 'sources'].map(key => makeLink(key, key));
        return {querySelectorAll(selector) {
          assert.equal(selector, 'a[data-view-aliases]');
          return links;
        }};
      },
      view: 'overview', state: {}
    };
    vm.runInNewContext(parse + ';parse();', context);
    assert.equal(context.view, expected, hash + ': hydrated route');
  }
});
