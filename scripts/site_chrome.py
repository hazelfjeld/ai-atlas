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

def render_directory_nav(prefix, selected, *, mobile_classes="directory-mobile-topbar site-mobile-chrome",
                         details_classes="site-mobile-chrome__nav", details_id="directory-mobile-nav",
                         toggle_classes="site-mobile-chrome__toggle", menu_classes="site-mobile-chrome__menu",
                         search_classes="site-mobile-chrome__search", icon_classes="site-mobile-chrome__search-icon",
                         search_label_classes="site-mobile-chrome__search-placeholder",
                         desktop_classes="site-chrome term-nav", labeled=True, current_kind="page"):
    """One script-free site header, with only page-specific shell classes configurable."""
    assert prefix in ("", "../")
    assert selected is None or selected in {name for _, name in DESTINATIONS}
    assert current_kind in ("page", "location")
    links = "".join(
        '<a href="' + prefix + route + '"' +
        (' aria-current="' + current_kind + '"' if name == selected else '') +
        '>' + escape(name) + '</a>'
        for route, name in DESTINATIONS
    )
    brand = (
        '<a class="site-chrome__brand" href="' + prefix + 'index.html#/overview" aria-label="AI Updates home">'
        '<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M5 7h12v12H5zM21 17h10v12H21z" stroke="currentColor" stroke-width="2"/>'
        '<path d="M21 6h10M26 1v10M5 25h12M5 30h8" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>'
        '<span class="site-chrome__name">AI Updates<small>THE FRONTIER, IN CONTEXT</small></span></a>'
    )
    mobile = (
        '<div class="' + mobile_classes + '"' +
        (' aria-label="AI Updates mobile header"' if labeled else '') + '>'
        '<details class="' + details_classes + '" id="' + details_id + '">'
        '<summary class="' + toggle_classes + '" aria-label="Toggle navigation"><span aria-hidden="true">☰</span></summary>'
        '<nav class="' + menu_classes + '" aria-label="AI Updates sections">' + links + '</nav></details>'
        '<a class="' + search_classes + '" href="' + prefix + 'index.html#/search" aria-label="Search AI Updates in the main collection">'
        '<span class="' + icon_classes + '" aria-hidden="true">⌕</span>'
        '<span class="' + search_label_classes + '">Search tools, research, concepts…</span></a></div>'
    )
    desktop = (
        '<nav class="' + desktop_classes + '" aria-label="AI Updates primary navigation">'
        + brand + '<div class="site-chrome__links">' + links + '</div></nav>'
    )
    return mobile + desktop


# Retain each page's established layout classes, but generate the visible
# site navigation, brand and search from the same source as catalog directories.
# tuple: mobile extra, details extra/id, toggle, menu, search, icon, label,
#        desktop extra, selected label, aria-current kind, mobile aria-label
STANDALONE_NAVS = {
    "research.html": ("research-mobile-topbar", "research-mobile-nav", "research-mobile-nav", "research-menu-toggle",
                      "research-menu-panel", "research-search-link", "research-search-icon",
                      "research-search-placeholder", "research-site-chrome", None, "page", True),
    "catalog-review.html": ("review-mobile-topbar", "", "review-mobile-nav", "", "", "", "", "",
                            "nav", "What’s New Today", "location", True),
    "hardware-review.html": ("hardware-mobile-topbar", "", "hardware-mobile-nav", "", "", "", "", "",
                             "review-nav", "What’s New Today", "location", True),
    "games.html": ("", "", "games-mobile-nav", "", "", "", "", "", "games-site-chrome", "Games", "page", True),
    "technologies.html": ("tech-mobile-topbar", "tech-mobile-nav", "tech-mobile-nav", "tech-menu-toggle",
                          "tech-menu-panel", "tech-search-link", "tech-search-icon", "tech-search-placeholder",
                          "tech-top", "Technology profiles", "page", True),
    "playbooks.html": ("playbook-mobile-topbar", "playbook-mobile-nav", "playbook-mobile-nav", "playbook-menu-toggle",
                       "playbook-menu-panel", "playbook-search-link", "playbook-search-icon",
                       "playbook-search-placeholder", "playbook-top", "Playbooks", "page", True),
    "whats-new.html": ("mobile-topbar", "archive-mobile-nav", "archive-mobile-nav", "archive-menu-toggle",
                       "archive-menu-panel", "archive-search-link", "archive-search-icon",
                       "archive-search-placeholder", "top", "What’s New Today", "page", False),
}


def render_standalone_nav(path):
    (mobile, details, details_id, toggle, menu, search, icon, label, desktop, selected, kind, labeled) = STANDALONE_NAVS[path]
    def classes(extra, core):
        return (extra + " " if extra else "") + core
    markup = render_directory_nav(
        "", selected,
        mobile_classes=classes(mobile, "site-mobile-chrome"),
        details_classes=classes(details, "site-mobile-chrome__nav"), details_id=details_id,
        toggle_classes=classes(toggle, "site-mobile-chrome__toggle"),
        menu_classes=classes(menu, "site-mobile-chrome__menu"),
        search_classes=classes(search, "site-mobile-chrome__search"),
        icon_classes=classes(icon, "site-mobile-chrome__search-icon"),
        search_label_classes=classes(label, "site-mobile-chrome__search-placeholder"),
        desktop_classes="site-chrome " + desktop, labeled=labeled, current_kind=kind,
    )
    # Research's main landmark intentionally starts between the two headers.
    if path == "research.html":
        markup = markup.replace('</div><nav class="site-chrome', '</div><main id="main"><nav class="site-chrome', 1)
    return markup


def normalize_discover_sidebar(html):
    """Use the shared seven destinations in Discover's first-paint sidebar.

    Preserve SVG icons, hydrated counts, legacy hash routes and secondary links.
    Playbooks moves to the primary group rather than appearing twice.
    """
    import re
    marker = '<nav id="navigation" aria-label="Main navigation">'
    assert html.count(marker) == 1, 'Unexpected Discover navigation structure'
    before, rest = html.split(marker, 1)
    nav, after = rest.split('</nav>', 1)
    assert nav.count('<details class="nav-more"') == 1
    _, secondary = nav.split('<details class="nav-more"', 1)
    anchors = re.compile(
        r'<a class="nav-link(?: active)?" data-(?:view|static)="([^"]+)" href="[^"]+"[^>]*>.*?</a>',
        re.S,
    )
    existing = {match.group(1): match.group(0) for match in anchors.finditer(nav)}
    keys = ('overview', 'daily', 'dictionary', 'technologies', 'games', 'playbooks', 'about')
    primary = []
    for (route, label), key in zip(DESTINATIONS, keys, strict=True):
        anchor = existing.get(key) or (existing.get('demo') if key == 'about' else None)
        assert anchor is not None, 'Missing Discover icon/link template: ' + key
        kind = 'static' if key in ('daily', 'about') else 'view'
        anchor, count = re.subn(r'data-(?:view|static)="[^"]+"', f'data-{kind}="{key}"', anchor, count=1)
        assert count == 1
        anchor, count = re.subn(r'href="[^"]+"', f'href="{route.replace("index.html#/", "#/")}"', anchor, count=1)
        assert count == 1
        anchor, count = re.subn(r'<span>[^<>]*</span>', '<span>' + escape(label) + '</span>', anchor, count=1)
        assert count == 1
        primary.append(anchor)
    secondary = '<details class="nav-more"' + secondary
    secondary = re.sub(
        r'<a class="nav-link" data-view="playbooks" href="#/playbooks">.*?</a>',
        '', secondary, count=1, flags=re.S,
    )
    assert 'data-view="playbooks"' not in secondary, 'Playbooks must appear only once'
    return before + marker + ''.join(primary) + secondary + '</nav>' + after


def normalize_standalone_chrome(html, path):
    """Replace only the known navigation pair; fail if page markup drifts."""
    import re
    mobile, *rest = STANDALONE_NAVS[path]
    desktop = rest[7]
    start = '<div class="' + ((mobile + " ") if mobile else "") + 'site-mobile-chrome"'
    end = '<nav class="site-chrome ' + desktop + '" aria-label="AI Updates primary navigation">'
    middle = r'(?:<main id="main">)?\s*' if path == "research.html" else r'\s*'
    pattern = re.compile(re.escape(start) + r'[^>]*>.*?</div>' + middle +
                         re.escape(end) + r'.*?</nav>', re.S)
    normalized, count = pattern.subn(lambda _: render_standalone_nav(path), html)
    assert count == 1, 'Unexpected shared header structure on ' + path
    return normalized
