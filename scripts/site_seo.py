"""Shared, dependency-free metadata for the static AI Updates publication."""
from html import escape
import json
import re
import unicodedata

ORIGIN = 'https://aiupdates.app'
BRAND = 'AI Updates'


def absolute(path):
    return ORIGIN + '/' + ('' if path == 'index.html' else path.lstrip('/'))


def jsonld(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def metadata(title, description, path, structured=None):
    e = lambda s: escape(str(s), quote=True)
    canonical = absolute(path)
    prefix = '../' if '/' in path else ''
    values = [
        f'<title>{e(title)}</title>',
        f'<meta name="description" content="{e(description)}">',
        '<meta name="robots" content="index,follow,max-image-preview:large">',
        f'<link rel="canonical" href="{canonical}">',
        f'<link rel="icon" href="{prefix}favicon.svg" type="image/svg+xml">',
        '<meta name="theme-color" content="#18211E">',
        f'<meta property="og:site_name" content="{BRAND}">',
        '<meta property="og:type" content="website">',
        '<meta property="og:locale" content="en_US">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(description)}">',
        f'<meta property="og:url" content="{canonical}">',
        f'<meta property="og:image" content="{ORIGIN}/social-card.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="AI Updates — the frontier, in context. AI research, tools and concepts.">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{e(title)}">',
        f'<meta name="twitter:description" content="{e(description)}">',
        f'<meta name="twitter:image" content="{ORIGIN}/social-card.png">',
    ]
    if structured:
        values.append('<script type="application/ld+json">' + jsonld(structured) + '</script>')
    return '\n'.join(values)


def breadcrumbs(items):
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': name, 'item': absolute(path)}
        for i, (name, path) in enumerate(items)]}


def technology_path(row):
    slug = unicodedata.normalize('NFKD', row['name']).encode('ascii', 'ignore').decode().lower()
    slug = re.sub('[^a-z0-9]+', '-', slug).strip('-') or 'profile'
    return f'technology/{row["id"]}-{slug}.html'


def replace_head(html, content):
    """Replace only managed metadata; preserve script/style/viewport behavior."""
    head, tail = html.split('</head>', 1)
    head = re.sub(r'<!-- seo:start -->.*?<!-- seo:end -->', '', head, flags=re.S)
    head = re.sub(r'<title>.*?</title>', '', head, flags=re.S)
    head = re.sub(r'<meta\s+(?:name|property)="(?:description|robots|theme-color|og:[^"]+|twitter:[^"]+)"[^>]*>', '', head)
    head = re.sub(r'<link\s+rel="(?:canonical|icon)"[^>]*>', '', head)
    return head.rstrip() + '\n<!-- seo:start -->\n' + content + '\n<!-- seo:end -->\n</head>' + tail
