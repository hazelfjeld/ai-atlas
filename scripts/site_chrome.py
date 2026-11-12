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
# Build-time source of truth for Discover and native desktop secondary destinations.
# Existing Discover icons and dynamic counts are preserved; this adds no routes.
SECONDARY_DESTINATIONS = (
    ("safety", "view", "index.html#/safety", "Safety observatory"),
    ("papers", "view", "index.html#/papers", "Research library"),
    ("compare", "view", "index.html#/compare", "Compare tools"),
    ("saved", "view", "index.html#/saved", "Your notebook"),
    ("sources", "view", "index.html#/sources", "Sources & coverage"),
    ("demo", "static", "demo.html", "Guided professor demo"),
    ("encyclopedia", "static", "terms/index.html", "Concept encyclopedia"),
    ("offline", "static", "downloads/Atlas_Demo_Offline.html", "Offline demo download ↓"),
)

def render_secondary_script_data():
    """Generate only the existing native desktop enhancement destinations."""
    import json
    lines = ["      /* atlas-secondary-data:begin */", "      const sharedSecondarySections = ["]
    for _, _, route, label in SECONDARY_DESTINATIONS:
        lines.append("        [" + json.dumps(route, ensure_ascii=False) + ", " +
                     json.dumps(label, ensure_ascii=False) + "],")
    lines.extend(["      ];", "      /* atlas-secondary-data:end */"])
    return "\n".join(lines)

def sync_secondary_navigation_script(script):
    """Update generated JS data, rejecting duplicated or missing markers."""
    import re
    block = render_secondary_script_data()
    start, end = "      /* atlas-secondary-data:begin */", "      /* atlas-secondary-data:end */"
    if start in script or end in script:
        assert script.count(start) == script.count(end) == 1, "Ambiguous secondary navigation markers"
        first, last = script.index(start), script.index(end) + len(end)
        return script[:first] + block + script[last:]
    original = re.compile(r"      const sharedSecondarySections = \[\n(?:[^\n]*\n)*?      \];")
    replaced, count = original.subn(lambda _: block, script, count=1)
    assert count == 1, "Missing secondary navigation data block"
    return replaced

def sync_discover_secondary(secondary):
    """Use the same canonical links and labels but preserve icon SVGs and counts."""
    import re
    pattern = re.compile(r'<a class="nav-link" data-(view|static)="([^"]+)" href="([^"]+)"([^>]*)>(.*?)</a>', re.S)
    matches = list(pattern.finditer(secondary))
    assert len(matches) == len(SECONDARY_DESTINATIONS), "Unexpected Discover secondary link count"
    assert all("<" not in label and ">" not in label for _, _, _, label in SECONDARY_DESTINATIONS)
    n = 0
    def replace(match):
        nonlocal n
        key, kind, route, label = SECONDARY_DESTINATIONS[n]
        n += 1
        assert (match.group(1), match.group(2)) == (kind, key), "Unexpected Discover secondary key/order"
        inner, changed = re.subn(r"<span>[^<]*</span>",
                                 lambda _: "<span>" + label + "</span>",
                                 match.group(5), count=1)
        assert changed == 1, "Missing Discover secondary label"
        return ('<a class="nav-link" data-' + kind + '="' + key +
                '" href="' + route.removeprefix("index.html") + '"' +
                match.group(4) + '>' + inner + '</a>')
    return pattern.sub(replace, secondary)

def render_secondary_nav(prefix, current=None):
    """Script-free desktop disclosure using Discover's canonical secondary routes.

    On a page that is itself a secondary destination, expose its current
    location on first paint without JavaScript or a duplicate navigation list.
    """
    assert prefix in ("", "../")
    assert current is None or current in {key for key, _, _, _ in SECONDARY_DESTINATIONS}
    return (
        '<details class="site-chrome__more"' + (' open' if current else '') +
        '><summary>More sections</summary>'
        '<div class="site-chrome__more-links">'
        + "".join(
            '<a href="' + prefix + route + '"' +
            (' aria-current="location"' if key == current else '') +
            (' download' if route == "downloads/Atlas_Demo_Offline.html" else '') +
            '>' + escape(label) + '</a>'
            for key, _, route, label in SECONDARY_DESTINATIONS
        ) +
        '</div></details>'
    )

def render_mobile_secondary_nav(prefix, current=None):
    """The same eight script-free links in the native mobile drawer."""
    assert prefix in ("", "../")
    assert current is None or current in {key for key, _, _, _ in SECONDARY_DESTINATIONS}
    return (
        '<details class="site-mobile-chrome__more"' + (' open' if current else '') +
        '><summary>More sections</summary>'
        '<div class="site-mobile-chrome__more-links">'
        + "".join(
            '<a href="' + prefix + route + '"' +
            (' aria-current="location"' if key == current else '') +
            (' download' if route == "downloads/Atlas_Demo_Offline.html" else '') +
            '>' + escape(label) + '</a>'
            for key, _, route, label in SECONDARY_DESTINATIONS
        ) +
        '</div></details>'
    )

# Reference directory landings and About use the same outer site chrome.
# Preserve the existing detail-page markup pending a separately verified migration.
REFERENCE_LANDING_PATHS = frozenset(("about.html", "terms/index.html", "technology/index.html"))
REFERENCE_LANDING_HERO_CSS = '@media(min-width:651px){.term-shell>.hero{margin-top:8px}}@media(max-width:650px){.term-shell>.hero{margin-top:18px}body>.directory-mobile-topbar{margin:0;padding-inline:20px}}'

def wrap_reference_shell(nav, content, path, main_id, *, expanded_concept=False):
    """Keep the canonical shared navigation outside the main landmark on migrated pages."""
    is_tech_detail = path.startswith('technology/TECH-') and path.endswith('.html')
    is_concept_detail = path.startswith('terms/MLD-') and path.endswith('.html')
    assert not expanded_concept or is_concept_detail, path
    if path in REFERENCE_LANDING_PATHS or is_tech_detail or is_concept_detail:
        if path == "about.html" and main_id == ' id="main"':
            marker = '<header class="hero">'
            assert content.count(marker) == 1, path
            content = content.replace(marker, '<header class="hero" id="main" tabindex="-1">', 1)
        if is_tech_detail:
            assert content.startswith('<p class="breadcrumb-links">'), path
            assert content.count('<header class="hero" id="main" tabindex="-1">') == 1, path
        else:
            assert content.startswith('<header class="hero" id="main" tabindex="-1">'), path
        if path in REFERENCE_LANDING_PATHS or is_tech_detail or is_concept_detail:
            # Every existing concept (reference or expanded), technology profile
            # and landing page uses one script-free global contentinfo landmark.
            # Preserve the original policy/source links rather than copying them.
            assert content.count('<footer>') == 1 and content.endswith('</footer>'), path
            article, footer_tail = content.rsplit('<footer>', 1)
            return (nav + '<main class="term-shell">' + article + '</main>'
                    + '<footer class="site-chrome__footer">' + footer_tail)
        return nav + '<main class="term-shell">' + content + '</main>'
    return '<main class="term-shell"' + main_id + '>' + nav + content + '</main>'

DIRECTORY_MOBILE_CSS = '@media(max-width:650px){.term-shell{padding:0 20px 65px}.term-shell .term-nav{display:none}.directory-mobile-topbar{margin:0 -20px;padding:14px 20px;border-bottom:1px solid var(--line)}}'

def render_primary_links(prefix, selected, current_kind="page"):
    """One canonical seven-destination navigation list."""
    return "".join(
        '<a href="' + prefix + route + '"' +
        (' aria-current="' + current_kind + '"' if name == selected else '') +
        '>' + escape(name) + '</a>'
        for route, name in DESTINATIONS
    )

def native_directory_article_skip(body, path, *, native_concept_article=False):
    """Put native skip focus on directory content, not the shared navigation.

    Both A–Z directories and individual technology profiles now reach the
    article with JavaScript disabled. Every concept article uses the same native article target.
    Keep the main landmark and place the fragment ID on the real hero.
    """
    is_directory = path in ("terms/index.html", "technology/index.html")
    is_technology_detail = path.startswith("technology/TECH-") and path.endswith(".html")
    is_concept_detail = path.startswith("terms/MLD-") and path.endswith(".html")
    if not (is_directory or is_technology_detail or
            (native_concept_article and is_concept_detail)):
        return body, ' id="main"'
    heading = '<header class="hero">'
    assert body.count(heading) == 1, 'Missing or repeated article hero: ' + path
    if is_directory:
        assert body.startswith(heading), 'Directory must start with the article heading: ' + path
    return body.replace(heading, '<header class="hero" id="main" tabindex="-1">', 1), ''

def render_directory_hero(eyebrow, title, summary, *, lead=False):
    """One Discover-style heading component for both A-Z reference directories.

    Use the existing .discover-heading styles from brand.css. This is only
    for directory landing pages; individual profiles keep their own layouts.
    """
    suffix = ' class="lead"' if lead else ''
    return (
        '<header class="hero"><div class="discover-heading"><div>'
        '<p class="eyebrow">' + escape(eyebrow) + '</p>'
        '<h1>' + escape(title) + '</h1></div></div>'
        '<p' + suffix + '>' + escape(summary) + '</p></header>'
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
                         desktop_classes="site-chrome term-nav", labeled=True, current_kind="page", page_label=None, mobile_brand=False, native_secondary=False, mobile_secondary=False, secondary_current=None, topbar_title=None):
    """One script-free site header, with only page-specific shell classes configurable."""
    assert prefix in ("", "../")
    assert selected is None or selected in {name for _, name in DESTINATIONS}
    assert current_kind in ("page", "location")
    # An encyclopedia subdestination is the current page, not its parent
    # dictionary workspace. Announcing both as current confuses navigation.
    assert not (selected and secondary_current), "Only one current navigation destination"
    links = render_primary_links(prefix, selected, current_kind)
    brand = render_brand(prefix)
    mobile_wordmark = render_brand(prefix, "site-mobile-chrome__brand") if mobile_brand else ""
    title = ('<span class="site-mobile-chrome__title">' + escape(topbar_title) + '</span>') if topbar_title else ''
    mobile = (
        '<div class="' + mobile_classes + '"' +
        (' aria-label="AI Updates mobile header"' if labeled else '') +
        (' data-page-label="' + escape(page_label) + '"' if page_label else '') + '>'
        '<details class="' + details_classes + '" id="' + details_id + '">'
        '<summary class="' + toggle_classes + '" aria-label="Toggle navigation"><span aria-hidden="true">☰</span></summary>'
        '<nav class="' + menu_classes + '" aria-label="AI Updates sections">' + mobile_wordmark + links +
        (render_mobile_secondary_nav(prefix, secondary_current) if mobile_secondary else '') + '</nav></details>' + title +
        '<a class="' + search_classes + '" href="' + prefix + 'index.html#/search" aria-label="Search AI Updates in the main collection">'
        '<span class="' + icon_classes + '" aria-hidden="true">⌕</span>'
        '<span class="' + search_label_classes + '">Search tools, research, concepts…</span></a></div>'
    )
    desktop = (
        '<nav class="' + desktop_classes + '" aria-label="AI Updates primary navigation">'
        + brand + '<div class="site-chrome__links">' + links + '</div>' +
        (render_secondary_nav(prefix, secondary_current) if native_secondary else '') + '</nav>'
    )
    return mobile + desktop


# Retain each page's established layout classes, but generate the visible
# site navigation, brand and search from the same source as catalog directories.
# tuple: mobile extra, details extra/id, toggle, menu, search, icon, label,
#        desktop extra, selected label, aria-current kind, mobile aria-label
STANDALONE_NAVS = {
    # The guided demo is an existing secondary Discover destination; retain its
    # page identity while showing Discover as the parent shared section.
    "demo.html": ("", "", "demo-mobile-nav", "", "", "", "", "",
                  "demo-site-chrome", "Discover", "location", True),
    "research.html": ("research-mobile-topbar", "research-mobile-nav", "research-mobile-nav", "research-menu-toggle",
                      "research-menu-panel", "research-search-link", "research-search-icon",
                      "research-search-placeholder", "research-site-chrome", "Discover", "location", True),
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
                       "archive-search-placeholder", "top", "What’s New Today", "page", True),
}


def render_standalone_nav(path):
    (mobile, details, details_id, toggle, menu, search, icon, label, desktop, selected, kind, labeled) = STANDALONE_NAVS[path]
    def classes(extra, core):
        return (extra + " " if extra else "") + core
    page_title = {
        "research.html": "Research library",
        "demo.html": "Guided demo",
        "catalog-review.html": "Catalog review",
        "hardware-review.html": "Hardware evidence",
    }.get(path, selected)
    # A secondary destination is the current page, not Discover itself.
    # Keep the canonical Discover link, but never announce two current links
    # inside the same native mobile or desktop navigation landmark.
    secondary_current = {"demo.html": "demo", "research.html": "papers"}.get(path)
    markup = render_directory_nav(
        "", (None if secondary_current else selected),
        mobile_classes=classes(mobile, "site-mobile-chrome"),
        details_classes=classes(details, "site-mobile-chrome__nav"), details_id=details_id,
        toggle_classes=classes(toggle, "site-mobile-chrome__toggle"),
        menu_classes=classes(menu, "site-mobile-chrome__menu"),
        search_classes=classes(search, "site-mobile-chrome__search"),
        icon_classes=classes(icon, "site-mobile-chrome__search-icon"),
        search_label_classes=classes(label, "site-mobile-chrome__search-placeholder"),
        desktop_classes="site-chrome " + desktop, labeled=labeled, current_kind=kind,
        page_label=page_title, topbar_title=page_title,
        mobile_brand=True, native_secondary=True, mobile_secondary=True,
        secondary_current=secondary_current,
    )
    # Each page owns its article landmark. Keep navigation outside <main>,
    # matching the existing editorial and reference landing pages.
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



# The desktop rail reuses Discover's SVG geometries rather than maintaining
# seven separately drawn symbols in another stylesheet or page template.
RAIL_ICON_START = "/* atlas-rail-icons:begin */"
RAIL_ICON_END = "/* atlas-rail-icons:end */"

def render_desktop_rail_icons_css():
    """Generate the existing standalone rail icons from Discover's canonical SVGs."""
    from urllib.parse import quote
    parts = [
        RAIL_ICON_START,
        '/* Generated from the very same DISCOVER_LINKS SVG paths as the Discover rail. */',
        '@media (min-width:651px){',
        '.site-chrome .site-chrome__links a{gap:10px}',
        '.site-chrome .site-chrome__links a::before{content:"";display:block;flex:0 0 16px;width:16px;height:16px;background:currentColor;-webkit-mask:var(--atlas-rail-icon) center/contain no-repeat;mask:var(--atlas-rail-icon) center/contain no-repeat}',
        '.site-chrome .site-chrome__links a[aria-current]::before{background:#d9a16f}',
    ]
    for (route, _), (_, _, icon) in zip(DESTINATIONS, DISCOVER_LINKS, strict=True):
        uri = 'data:image/svg+xml,' + quote(icon.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1).replace('currentColor', 'black'), safe='')
        parts.append('.site-chrome .site-chrome__links a[href$="' + route + '"]{--atlas-rail-icon:url("' + uri + '")}')
    parts.extend(('}', RAIL_ICON_END))
    return '\n'.join(parts)

def sync_desktop_rail_icons_css(css):
    """Replace exactly one generated CSS block; never append duplicate rails."""
    assert css.count(RAIL_ICON_START) == css.count(RAIL_ICON_END) == 1
    first = css.index(RAIL_ICON_START)
    last = css.index(RAIL_ICON_END) + len(RAIL_ICON_END)
    return css[:first] + render_desktop_rail_icons_css() + css[last:]



APP_LABELS_START = "/* atlas-app-primary-labels:begin */"
APP_LABELS_END = "/* atlas-app-primary-labels:end */"

def render_app_primary_labels_js():
    """Keep hydrated workspace names identical to the native seven-link rail."""
    import json
    entries = [(key, label) for (_, label), (key, kind, _) in
               zip(DESTINATIONS, DISCOVER_LINKS, strict=True) if kind == "view"]
    assert {key for key, _ in entries} == {"overview", "dictionary", "technologies", "games", "playbooks"}
    return (APP_LABELS_START + "\n" +
            "".join(json.dumps(key) + ":" + json.dumps(label, ensure_ascii=False) + ",\n"
                    for key, label in entries) + APP_LABELS_END)

def sync_app_primary_labels_js(script):
    """Replace only the tagged primary labels, leaving secondary routes intact."""
    assert script.count(APP_LABELS_START) == script.count(APP_LABELS_END) == 1
    start = script.index(APP_LABELS_START)
    end = script.index(APP_LABELS_END) + len(APP_LABELS_END)
    return script[:start] + render_app_primary_labels_js() + script[end:]


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
    """Share the native script-free drawer and canonical secondary routes with other pages.

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
        + brand + links + render_mobile_secondary_nav("").replace('href="index.html#/', 'href="#/') + '</nav></details></div>'
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
    secondary = sync_discover_secondary(secondary)
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



def ensure_skip_destination_focusable(html, path=None):
    """Keep script-free skip links keyboard-focusable across page families.

    A fragment scroll alone need not move focus. Preserve the existing
    destination, native link, and page-specific text; never add a duplicate.
    """
    import re
    # Keep native article skips out of the shared rail nested in <main>.
    # This is a build-time change, so it also works without JavaScript.
    article_targets = {
        "about.html": '<header class="hero">',
        "research.html": '<section class="hero">',
        "playbooks.html": '<section class="playbook-hero">',
        "technologies.html": '<section class="tech-hero">',
        "hardware-review.html": '<header>',
    }
    if path in article_targets:
        main = re.search(r'<main\b[^>]*>', html)
        assert main, 'Missing main landmark: ' + path
        marker = article_targets[path]
        if ' id="main"' in main.group(0):
            assert html.count(marker) == 1, 'Ambiguous article target: ' + path
            assert html.index(marker) > html.index('</nav>', main.end()), 'Article precedes shared rail: ' + path
            bare_main = main.group(0).replace(' id="main"', '').replace(' tabindex="-1"', '')
            html = html[:main.start()] + bare_main + html[main.end():]
            html = html.replace(marker, marker[:-1] + ' id="main" tabindex="-1">', 1)
        else:
            assert marker[:-1] + ' id="main" tabindex="-1">' in html, 'Missing native article target: ' + path
    skip = re.search(r'<a\b[^>]*\bclass="skip"[^>]*\bhref="#([^"]+)"', html)
    assert skip, 'Missing native skip link'
    target = re.compile(r'<[a-z][a-z0-9]*\b[^>]*\bid="' + re.escape(skip.group(1)) + r'"[^>]*>', re.I)

    def focusable(match):
        tag = match.group(0)
        return tag if re.search(r'\btabindex=', tag) else tag[:-1] + ' tabindex="-1">'

    result, count = target.subn(focusable, html, count=1)
    assert count == 1, 'Missing skip destination: ' + skip.group(1)
    return result


def ensure_footer_resources(html, path):
    """Keep existing footer caveats and links while making resources universal.

    As with the primary navigation, these are static links: a reader without
    JavaScript can reach policy and source coverage from every standalone page.
    Rebuilding an already-normalized page must not duplicate either link.
    """
    import re
    assert path in STANDALONE_NAVS
    # Games also uses the canonical footer resources. Its generated native
    # workspace deliberately omits the duplicate policy link supplied by the app shell.
    match = re.search(r"<footer\b[^>]*>[\s\S]*?</footer>", html)
    assert match, "Missing standalone footer: " + path
    original_footer = match.group(0)
    footer = original_footer
    # The two editorial and two native directory pages already keep the
    # footer outside <main>. Give them one global footer component,
    # preserving their existing policy links and source-specific caveats.
    if path in ("whats-new.html", "catalog-review.html", "technologies.html", "playbooks.html"):
        if footer.startswith("<footer>"):
            footer = footer.replace("<footer>", '<footer class="site-chrome__footer">', 1)
        else:
            assert footer.startswith('<footer class="site-chrome__footer">'), (
                "Unexpected editorial footer: " + path)
    # Normalize the visible label for the one shared policy destination.
    # Keep contextual wording, source links and other review-page destinations.
    for old_label in ("Editorial policy", "Editorial corrections policy"):
        footer = footer.replace(
            '<a href="about.html">' + old_label + "</a>",
            '<a href="about.html">Editorial policy & coverage</a>',
        )
    extra = ""
    for url, label in (
        ("about.html", "Editorial policy & coverage"),
        ("index.html#/sources", "Sources & downloads"),
    ):
        if ('href="' + url + '"') not in footer:
            extra += ' · <a href="' + url + '">' + label + "</a>"
    if not extra and footer == original_footer:
        return html
    # Replace the footer atomically; its length may change during normalization.
    # A second build produces identical output with no duplicate links.
    updated_footer = footer.replace("</footer>", extra + "</footer>", 1)
    return html[:match.start()] + updated_footer + html[match.end():]



def migrate_legacy_article_landmark(html, path):
    """Place the existing native chrome before the article on two legacy pages.

    Keep the exact shared nav output and content in place; change only the
    landmark boundary. Idempotent on subsequent deterministic rebuilds.
    """
    targets = {
        "demo.html": ("<main>", '<div class="site-mobile-chrome"',
                      '<nav class="site-chrome demo-site-chrome"'),
        "hardware-review.html": ('<main class="review-shell">',
                                 '<div class="hardware-mobile-topbar site-mobile-chrome"',
                                 '<nav class="site-chrome review-nav"'),
    }
    if path not in targets:
        return html
    main_tag, mobile_tag, rail_tag = targets[path]
    assert html.count(main_tag) == html.count(mobile_tag) == html.count(rail_tag) == 1, path
    main_at, mobile_at, rail_at = (html.index(mark) for mark in (main_tag, mobile_tag, rail_tag))
    rail_end = html.index('</nav>', rail_at) + len('</nav>')
    article_at = html.index('<header id="main" tabindex="-1">', rail_end)
    if rail_end < main_at < article_at:
        assert mobile_at < rail_at, path
        return html
    assert main_at < mobile_at < rail_at < rail_end < article_at, path
    assert not html[main_at + len(main_tag):mobile_at].strip(), path
    # Remove the old opening tag and the empty gap before the existing
    # mobile header, then restore the identical opening after the shared rail.
    html = html[:main_at] + html[mobile_at:]
    rail_end -= mobile_at - main_at
    return html[:rail_end] + '\n' + main_tag + html[rail_end:]


def normalize_standalone_chrome(html, path):
    """Replace only the known navigation pair; fail if page markup drifts."""
    import re
    mobile, *rest = STANDALONE_NAVS[path]
    desktop = rest[7]
    start = '<div class="' + ((mobile + " ") if mobile else "") + 'site-mobile-chrome"'
    end = '<nav class="site-chrome ' + desktop + '" aria-label="AI Updates primary navigation">'
    middle = r'(?:<main(?: id="main")?(?: tabindex="-1")?>)?\s*' if path == "research.html" else r'\s*'
    pattern = re.compile(re.escape(start) + r'[^>]*>.*?</div>' + middle +
                         re.escape(end) + r'.*?</nav>', re.S)
    normalized, count = pattern.subn(lambda _: render_standalone_nav(path), html)
    assert count == 1, 'Unexpected shared header structure on ' + path
    return ensure_skip_destination_focusable(migrate_legacy_article_landmark(normalized, path), path)
