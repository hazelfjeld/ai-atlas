'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const source = read('site-theme.js');
const helper = source.slice(source.indexOf('function syncDiscoverMobileSelection('),
  source.indexOf("if (typeof window !== 'undefined') window.atlasSyncDiscoverMobileSelection"));
const text = s => s.replaceAll('&amp;', '&');
function getNavigation(html) {
  const start = html.indexOf('id="discover-mobile-nav"');
  const end = html.indexOf('</nav></details>', start);
  const railStart = html.indexOf('id="navigation"');
  const rail = html.slice(railStart, html.indexOf('<div class="sidebar-bottom">', railStart));
  const mobile = [...html.slice(start, end).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map(([,href,label]) => ({href, label:text(label), attrs:new Map()}));
  const desktop = [...rail.matchAll(/<a\b[^>]*data-view="([^"]+)"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g)]
    .map(([,view,href,label]) => ({view,href,label:text(label)}));
  assert.equal(desktop.length, 10);
  assert.equal(mobile.length, 15);
  return {mobile, desktop};
}
function exercise({desktop,mobile}) {
  const links = mobile.map(row => ({
    textContent:row.label, getAttribute:() => row.href,
    setAttribute:(k,v) => row.attrs.set(k,v), removeAttribute:k => row.attrs.delete(k),
  }));
  const sync = vm.runInNewContext(helper + '\nsyncDiscoverMobileSelection');
  const drawer = {querySelectorAll:() => links};
  for (const route of desktop) {
    sync(drawer,{getAttribute:() => route.href,querySelector:() => ({textContent:route.label})});
    assert.deepEqual(mobile.filter(row => row.attrs.has('aria-current')).map(row => row.label),
      [route.label], route.view + ': canonical section, not an alias with the same URL');
  }
  sync(drawer,null);
  assert.equal(mobile.filter(row => row.attrs.has('aria-current')).length,0);
}
test('live Discover mobile selection follows the actual desktop routes', () => {
  exercise(getNavigation(read('index.html')));
});
test('offline shared hrefs select the actual canonical section, not About/demo/encyclopedia', () => {
  const nav = getNavigation(read('downloads/Atlas_Demo_Offline.html'));
  for (const href of ['#/sources','#/overview','#/dictionary'])
    assert.equal(nav.mobile.filter(row => row.href === href).length,2, 'real bundled alias ' + href);
  exercise(nav);
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(source), 'offline uses exact shared source');
});
