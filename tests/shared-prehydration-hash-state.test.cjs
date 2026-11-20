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
  return {
    dataset: {view: key}, attrs, classes,
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
    ['papers','Research library'],['safety','Safety observatory']];
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
    'catalog-loading':{}};
  let callback;
  const document = {
    addEventListener(event,fn){assert.equal(event,'DOMContentLoaded');callback=fn;},
    getElementById(id){return nodes[id]||null;},
    querySelector(selector){return selector==='.discover-mobile-chrome'?header:null;},
  };
  vm.runInNewContext(block,{window:{location:{hash}},document});
  assert.equal(typeof callback,'function');
  callback();
  return {links,mobile,mainMore,mobileMore,title,header,toggleAttrs,cleared};
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
test('first-paint hash fix is exactly shared in the offline demo and does not duplicate chrome', () => {
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes('/* atlas-prehydration-section-state:begin */'+block+
    '/* atlas-prehydration-section-state:end */'));
  assert.equal(source.split('/* atlas-prehydration-section-state:begin */').length-1,1);
  assert.equal((read('index.html').match(/id="navigation"/g)||[]).length,1);
  assert.equal((read('index.html').match(/id="discover-mobile-nav"/g)||[]).length,1);
});
