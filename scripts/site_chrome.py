"""Shared, script-free AI Updates navigation for the two generated catalog directories.

The CSS belongs to site-chrome.css. Keep labels and routes aligned with the
existing Discover/editorial header, without adding a browser-side dependency.
"""
from html import escape

DESTINATIONS = (
    ("index.html#/overview", "Discover"),
    ("whats-new.html", "What’s New Today"),
    ("index.html#/dictionary", "Concept dictionary"),
    ("index.html#/technologies", "Technology profiles"),
    ("index.html#/games", "Games"),
    ("playbooks.html", "Playbooks"),
    ("about.html", "About"),
)
DIRECTORY_MOBILE_CSS = '@media(max-width:650px){.term-shell{padding:0 20px 65px}.term-shell .term-nav{display:none}.directory-mobile-topbar{margin:0 -20px;padding:14px 20px;border-bottom:1px solid var(--line)}}'

def render_directory_nav(prefix, selected):
    assert prefix in ("", "../")
    assert selected in ("Concept dictionary", "Technology profiles")
    links = "".join(
        '<a href="' + prefix + route + '"' + (' aria-current="page"' if name == selected else '') + '>' + escape(name) + '</a>'
        for route, name in DESTINATIONS
    )
    brand = (
        '<a class="site-chrome__brand" href="' + prefix + 'index.html#/overview" aria-label="AI Updates home">'
        '<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M5 7h12v12H5zM21 17h10v12H21z" stroke="currentColor" stroke-width="2"/>'
        '<path d="M21 6h10M26 1v10M5 25h12M5 30h8" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>'
        '<span class="site-chrome__name">AI Updates<small>THE FRONTIER, IN CONTEXT</small></span></a>'
    )
    mobile = (
        '<div class="directory-mobile-topbar site-mobile-chrome" aria-label="AI Updates mobile header">'
        '<details class="site-mobile-chrome__nav" id="directory-mobile-nav">'
        '<summary class="site-mobile-chrome__toggle" aria-label="Toggle navigation"><span aria-hidden="true">☰</span></summary>'
        '<nav class="site-mobile-chrome__menu" aria-label="AI Updates sections">' + links + '</nav></details>'
        '<a class="site-mobile-chrome__search" href="' + prefix + 'index.html#/search" aria-label="Search AI Updates in the main collection">'
        '<span class="site-mobile-chrome__search-icon" aria-hidden="true">⌕</span>'
        '<span class="site-mobile-chrome__search-placeholder">Search tools, research, concepts…</span></a></div>'
    )
    desktop = (
        '<nav class="site-chrome term-nav" aria-label="AI Updates primary navigation">'
        + brand + '<div class="site-chrome__links">' + links + '</div></nav>'
    )
    return mobile + desktop
