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

def render_primary_links(prefix, selected, current_kind="page"):
    """One canonical seven-destination navigation list."""
    return "".join(
        '<a href="' + prefix + route + '"' +
        (' aria-current="' + current_kind + '"' if name == selected else '') +
        '>' + escape(name) + '</a>'
        for route, name in DESTINATIONS
    )

def render_brand(prefix, classes="site-chrome__brand"):
    """Reusable real SVG wordmark for desktop and native mobile navigation."""
    return (
        '<a class="' + classes + '" href="' + prefix + 'index.html#/overview" aria-label="AI Updates home">'
        '<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M5 7h12v12H5zM21 17h10v12H21z" stroke="currentColor" stroke-width="2"/>'
        '<path d="M21 6h10M26 1v10M5 25h12M5 30h8" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>'
        '<span class="site-chrome__name">AI Updates<small>THE FRONTIER, IN CONTEXT</small></span></a>'
    )

def render_directory_nav(prefix, selected, *, mobile_classes="directory-mobile-topbar site-mobile-chrome",
                         details_classes="site-mobile-chrome__nav", details_id="directory-mobile-nav",
                         toggle_classes="site-mobile-chrome__toggle", menu_classes="site-mobile-chrome__menu",
                         search_classes="site-mobile-chrome__search", icon_classes="site-mobile-chrome__search-icon",
                         search_label_classes="site-mobile-chrome__search-placeholder",
                         desktop_classes="site-chrome term-nav", labeled=True, current_kind="page", page_label=None):
    """One script-free site header, with only page-specific shell classes configurable."""
    assert prefix in ("", "../")
    assert selected is None or selected in {name for _, name in DESTINATIONS}
    assert current_kind in ("page", "location")
    links = render_primary_links(prefix, selected, current_kind)
    brand = render_brand(prefix)
    mobile = (
        '<div class="' + mobile_classes + '"' +
        (' aria-label="AI Updates mobile header"' if labeled else '') +
        (' data-page-label="' + escape(page_label) + '"' if page_label else '') + '>'
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
        page_label="Research library" if path == "research.html" else None,
    )
    # Research's main landmark intentionally starts between the two headers.
    if path == "research.html":
        markup = markup.replace('</div><nav class="site-chrome', '</div><main id="main"><nav class="site-chrome', 1)
    return markup


# Discover has a distinct interactive sidebar, but uses the same canonical
# destinations and labels as the standalone mobile/desktop header. The icons,
# route semantics, and first-paint counts are generated here rather than copied
# from another independent list of anchors in index.html.
DISCOVER_LINKS = (
    ("overview", "view", "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z\"/></svg>"),
    ("daily", "static", "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7\"/></svg>"),
    ("dictionary", "view", "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3z M12 6v16\"/></svg>"),
    ("technologies", "view", "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3 3 8l9 5 9-5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5\"/></svg>"),
    ("games", "view", "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M7 7h10a3 3 0 0 1 3 3l1 7a2 2 0 0 1-3 2l-3-3H9l-3 3a2 2 0 0 1-3-2l1-7a3 3 0 0 1 3-3z M7 10v4 M5 12h4 M16 11h.01 M18 13h.01\"/></svg>"),
    ("playbooks", "view", "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 4h16v16H4z M8 8h8 M8 12h5 M8 16h7\"/></svg>"),
    ("about", "static", "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 4h16v16H4z M8 8h8 M8 12h5 M8 16h7\"/></svg>"),
)


def render_discover_primary(term_count, tech_count):
    """Render Discover's first-paint primary links from the same seven routes.

    Hash navigation and data-view attributes are kept for app.js hydration.
    Counts come from the verified catalog, not from stale page markup.
    """
    assert term_count >= 0 and tech_count >= 0
    parts = []
    for (route, label), (key, kind, icon) in zip(DESTINATIONS, DISCOVER_LINKS, strict=True):
        href = route.removeprefix("index.html")
        current = ' aria-current="page"' if key == "overview" else ""
        cls = "nav-link active" if key == "overview" else "nav-link"
        count = ('<span class="nav-count">' + format(term_count, ",") + '</span>'
                 if key == "dictionary" else
                 '<span class="nav-count">' + format(tech_count, ",") + '</span>'
                 if key == "technologies" else "")
        parts.append('<a class="' + cls + '" data-' + kind + '="' + key +
                     '" href="' + href + '"' + current + '>' + icon +
                     '<span>' + escape(label) + '</span>' + count + '</a>')
    return "".join(parts)


def render_discover_mobile():
    """Share the native script-free drawer with all other site pages.

    Discover retains its existing desktop rail and working search input.
    """
    links = render_primary_links("", "Discover").replace('href="index.html#/', 'href="#/')
    brand = render_brand("", "site-mobile-chrome__brand").replace('href="index.html#/', 'href="#/')
    return (
        '<div class="site-mobile-chrome discover-mobile-chrome" aria-label="AI Updates mobile header">'
        '<details class="site-mobile-chrome__nav" id="discover-mobile-nav">'
        '<summary class="site-mobile-chrome__toggle" aria-label="Toggle navigation">'
        '<span aria-hidden="true">☰</span></summary>'
        '<nav class="site-mobile-chrome__menu" aria-label="AI Updates sections">'
        + brand + links + '</nav></details></div>'
    )


def normalize_discover_sidebar(html, term_count, tech_count):
    """Generate canonical Discover primary navigation; preserve native extras.

    Keep the existing sidebar shell, details/secondary routes, SVG icons and
    hydration hooks. Fail on unexpected input instead of silently dropping
    navigation during a rebuild.
    """
    import re
    marker = '<nav id="navigation" aria-label="Main navigation">'
    assert html.count(marker) == 1, 'Unexpected Discover navigation structure'
    before, rest = html.split(marker, 1)
    nav, after = rest.split('</nav>', 1)
    assert nav.count('<details class="nav-more"') == 1
    original_primary, secondary = nav.split('<details class="nav-more"', 1)
    existing_keys = re.findall(
        r'<a class="nav-link(?: active)?" data-(?:view|static)="([^"]+)"',
        original_primary,
    )
    assert existing_keys == [key for key, _, _ in DISCOVER_LINKS], (
        'Unexpected Discover primary links: ' + repr(existing_keys)
    )
    secondary = '<details class="nav-more"' + secondary
    assert 'data-view="playbooks"' not in secondary, 'Playbooks must appear only once'
    normalized = (before + marker + render_discover_primary(term_count, tech_count) +
                  secondary + '</nav>' + after)
    mobile = render_discover_mobile()
    old_button = '<button id="menu-toggle" class="icon-button mobile-only" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded="false">☰</button>'
    native_pattern = r'<div class="site-mobile-chrome discover-mobile-chrome"[^>]*>.*?</nav></details></div>'
    if old_button in normalized:
        normalized = normalized.replace(old_button, mobile, 1)
    else:
        normalized, count = re.subn(native_pattern, lambda _: mobile, normalized, count=1, flags=re.S)
        assert count == 1, 'Discover native drawer missing during rebuild'
    css_anchor = '<link rel="stylesheet" href="brand.css">'
    if 'href="site-chrome.css"' not in normalized:
        normalized = normalized.replace(css_anchor, css_anchor + '<link rel="stylesheet" href="site-chrome.css"><script src="site-theme.js"></script>', 1)
    assert normalized.count('id="discover-mobile-nav"') == 1
    return normalized


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
