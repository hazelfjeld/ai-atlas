'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.join(__dirname, '..');
const expected = {
  'demo.html': ['https://github.com/hazelfjeld/ai-atlas', 'about.html', 'index.html#/sources'],
  'research.html': ['about.html', 'index.html#/sources'],
  'catalog-review.html': ['about.html', 'https://github.com/hazelfjeld/ai-atlas', 'index.html#/sources'],
  'whats-new.html': ['index.html#/sources', 'about.html'],
  'playbooks.html': ['https://github.com/hazelfjeld/ai-atlas', 'about.html', 'index.html#/sources'],
  'technologies.html': ['https://github.com/hazelfjeld/ai-atlas', 'about.html', 'index.html#/sources'],
};
test('native editorial footers group notes and resource links without loose flex items', () => {
  for (const [route, destinations] of Object.entries(expected)) {
    const html = fs.readFileSync(path.join(root, route), 'utf8');
    const footers = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/g);
    assert.equal(footers?.length, 1, route);
    const footer = footers[0];
    const groups = footer.match(/^<footer class="site-chrome__footer"><span class="site-chrome__footer-note">([^<]+)<\/span> <span class="site-chrome__footer-links">([\s\S]+)<\/span><\/footer>$/);
    assert.ok(groups, route + ': two explicit groups');
    assert.match(groups[1], /[.!?]$/);
    const anchors = [...groups[2].matchAll(/<a href="([^"]+)"[^>]*>[^<]*<\/a>/g)];
    assert.deepEqual(anchors.map(x => x[1]), destinations, route + ': original link order and destinations');
    assert.equal(groups[2], anchors.map(x => x[0]).join(' · '), route + ': separators stay within link group');
    assert.ok(html.indexOf(footer) > html.indexOf('</main>'), route + ': native contentinfo outside main');
  }
  const script = [
    'import sys',
    'from pathlib import Path',
    'sys.path.insert(0, "scripts")',
    'from site_chrome import ensure_footer_resources, EDITORIAL_FOOTER_GROUP_PATHS, group_editorial_footer',
    'import re',
    'for route in EDITORIAL_FOOTER_GROUP_PATHS:',
    '    h = Path(route).read_text(encoding="utf-8")',
    '    assert ensure_footer_resources(h, route) == h, route',
    '    footer = re.search(r"<footer\\b[^>]*>[\\s\\S]*?</footer>", h).group()',
    '    assert group_editorial_footer(footer) == footer, route',
    '    raw = re.sub(r"</?span(?: class=\\"site-chrome__footer-(?:note|links)\\")?>", "", footer)',
    '    assert group_editorial_footer(raw) == footer, route',
  ].join('\n');
  execFileSync('python3', ['-c', script], {cwd:root, stdio:'pipe'});
});
