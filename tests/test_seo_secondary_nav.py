"""Shared secondary navigation must remain idempotent and fail on drift."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from site_chrome import SECONDARY_DESTINATIONS, sync_secondary_navigation_script, sync_discover_secondary, render_mobile_secondary_nav

class SecondaryNavigationTests(unittest.TestCase):
    def test_native_generator_and_offline_source(self):
        script = (ROOT / "site-theme.js").read_text(encoding="utf-8")
        self.assertEqual(sync_secondary_navigation_script(script), script)
        self.assertEqual(len(SECONDARY_DESTINATIONS), 8)

    def test_discover_is_canonical_without_dropping_icons_or_downloads(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        start = html.index('<details class="nav-more"')
        end = html.index("</details>", start)
        nav = html[start:end]
        self.assertEqual(sync_discover_secondary(nav), nav)
        self.assertIn('href="downloads/Atlas_Demo_Offline.html" download', nav)
        changed = nav.replace(">Research library</span>", ">Outdated label</span>", 1)
        self.assertEqual(sync_discover_secondary(changed), nav)

    def test_every_technology_profile_has_native_secondary_navigation(self):
        """All published technology detail links work even with JavaScript off."""
        from site_chrome import render_secondary_nav
        expected = render_secondary_nav("../")
        self.assertEqual(expected.count("<a "), len(SECONDARY_DESTINATIONS))
        pages = sorted((ROOT / "technology").glob("TECH-*.html"))
        self.assertEqual(len(pages), 303)
        for page in pages:
            source = page.read_text(encoding="utf-8")
            with self.subTest(path=page.name):
                self.assertEqual(source.count('<details class="site-chrome__more">'), 1)
                self.assertIn(expected, source)
                self.assertEqual(source.count('<details class="site-mobile-chrome__more">'), 1)
                self.assertIn(render_mobile_secondary_nav("../"), source)
                self.assertEqual(source.count('<div class="site-mobile-chrome__more-links">'), 1)
                self.assertEqual(source.count('aria-label="AI Updates primary navigation"'), 1)
                self.assertIn('href="../index.html#/search"', source)
                self.assertEqual(source.count('id="main"'), 1)

    def test_unexpected_key_and_bad_markers_fail_closed(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        nav = html[html.index('<details class="nav-more"'):].split("</details>", 1)[0]
        with self.assertRaises(AssertionError):
            sync_discover_secondary(nav.replace('data-view="papers"', 'data-view="unknown"', 1))
        script = (ROOT / "site-theme.js").read_text(encoding="utf-8")
        with self.assertRaises(AssertionError):
            sync_secondary_navigation_script(script.replace("/* atlas-secondary-data:end */", "/* missing */"))

if __name__ == "__main__":
    unittest.main()
