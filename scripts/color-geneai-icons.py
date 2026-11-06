"""Build glass icons from the user's immutable, original 24-unit SVG geometry.

Color belongs to each shape, not a background tile or a CSS filter. Gradients
are scoped inside each symbol; GeneIcon embeds them with unique instance IDs.
"""
from copy import deepcopy
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

ET.register_namespace('', 'http://www.w3.org/2000/svg')
OUT = Path(__file__).resolve().parent.parent / 'src/assets/icons'
PALETTES = {
    'blue': ('#8bd7ff', '#349de1', '#2378ba'),
    'mint': ('#82e2c5', '#28af8e', '#18856d'),
    'gold': ('#ffdb87', '#dfa936', '#a6751b'),
    'coral': ('#ffb1a0', '#ed7568', '#c4504d'),
    'violet': ('#cfb1fa', '#a17add', '#7950b8'),
    'rose': ('#f8b5dc', '#d675b0', '#ac4e89'),
    'slate': ('#c5d6e9', '#8babc7', '#5f7e9e'),
}
GROUPS = {
    'mint': 'tree birth branches fan calendar check checklist sync',
    'gold': 'archive document source book ship',
    'coral': 'compass heart pin bulb logout',
    'violet': 'dna search spark flask compare merge folder layers clock timeline',
    'rose': 'photos photo tag',
    'slate': 'tools settings sliders building',
}
COLORS = {name: hue for hue, names in GROUPS.items() for name in names.split()}
CONTROLS = set('arrow back chevron chevrondown close expand external menu minus more add circle'.split())

# Fill open silhouettes while retaining their supplied outlines and proportions.
SILHOUETTES = {
    'home': '<path d="M5.4 9.1 12 3.8l6.6 5.3v10.3a1 1 0 0 1-1 1h-3.4v-5.8H9.8v5.8H6.4a1 1 0 0 1-1-1Z"/>',
    'archive': '<path d="M4.6 8.8h14.8v9.9c0 .9-.7 1.6-1.6 1.6H6.2c-.9 0-1.6-.7-1.6-1.6Z"/>',
    'bulb': '<path d="M8.4 15.8c-.1-1.4-2.5-2.9-2.5-6.3a6.1 6.1 0 0 1 12.2 0c0 3.5-2.5 5-2.6 6.3Z"/>',
    'people': '<path d="M2.8 20c.3-4.1 2.9-6.3 6.5-6.3s6.2 2.2 6.5 6.3Z"/>',
    'user': '<path d="M4.8 20c.4-4.2 3.3-6.5 7.2-6.5s6.8 2.3 7.2 6.5Z"/>',
    'ship': '<path d="M6.7 7.5h10.6v6H6.7Z"/><path d="m3.7 14.3 8.3-2.8 8.3 2.8-2.7 4.9H6.4Z"/>',
    'flask': '<path d="M10.1 4h3.8v6.5l5.3 7.4c.8 1.2 0 2.6-1.4 2.6H6.2c-1.4 0-2.2-1.4-1.4-2.6l5.3-7.4Z"/>',
    'source': '<path d="M4.4 4.5h10.1l3 3.1v11.7H4.4Z"/>',
    'photos': '<path d="M4.5 16.4 3.1 6.3a1.3 1.3 0 0 1 1.1-1.5l11.5-1.6a1.3 1.3 0 0 1 1.5 1.1l.1.9Z"/>',
    'logout': '<path d="M10.4 4.1H5.6c-.9 0-1.5.6-1.5 1.5v12.8c0 .9.6 1.5 1.5 1.5h4.8Z"/>',
}


def gradients(name, hue):
    light, color, deep = PALETTES[hue]
    return (
        f'<defs><linearGradient id="{name}-glass" gradientUnits="userSpaceOnUse" x1="4" y1="3" x2="19" y2="22">'
        f'<stop stop-color="{light}"/><stop offset=".42" stop-color="{color}"/>'
        f'<stop offset="1" stop-color="{deep}"/></linearGradient>'
        f'<linearGradient id="{name}-ink" gradientUnits="userSpaceOnUse" x1="4" y1="2" x2="19" y2="22">'
        f'<stop stop-color="{color}"/><stop offset="1" stop-color="{deep}"/></linearGradient>'
        f'<linearGradient id="{name}-edge" gradientUnits="userSpaceOnUse" x1="4" y1="3" x2="18" y2="21">'
        f'<stop stop-color="#ffffff" stop-opacity=".65"/><stop offset=".55" stop-color="{light}" stop-opacity=".18"/>'
        f'<stop offset="1" stop-color="{deep}" stop-opacity=".28"/></linearGradient></defs>'
    )


def serialize(element):
    return ET.tostring(element, encoding='unicode').replace(' xmlns="http://www.w3.org/2000/svg"', '')


def supplied_icon(name, source):
    ink = 'currentColor' if name in CONTROLS else f'url(#{name}-ink)'
    glass, edge = f'url(#{name}-glass)', f'url(#{name}-edge)'
    fills, strokes = [], []
    if name in SILHOUETTES:
        fills.append(f'<g fill="{glass}" stroke="{edge}" stroke-width=".6">{SILHOUETTES[name]}</g>')
    for index, child in enumerate(source):
        tag = child.tag.split('}')[-1]
        closed = tag in ('rect', 'circle', 'ellipse', 'polygon')
        closed_paths = re.findall(r'[Mm][^Mm]*?[Zz]', child.get('d', ''))
        if (closed or closed_paths) and name not in CONTROLS:
            shape = deepcopy(child)
            if not closed:
                shape.set('d', ' '.join(closed_paths))
            shape.set('fill', glass)
            shape.set('stroke', edge)
            shape.set('stroke-width', '.6')
            if (name == 'pin' and tag == 'circle') or (name in ('photo', 'photos') and tag == 'circle'):
                shape.set('fill', '#ffffff')
                shape.set('fill-opacity', '.65')
            if name in ('search', 'zoom', 'globe') or (name == 'source' and tag == 'circle'):
                shape.set('fill-opacity', '.25')
            fills.append(serialize(shape))
        # Filled silhouettes have a fine luminous edge, never a dark contour.
        if closed and name not in CONTROLS and name not in ('search', 'zoom', 'clock', 'globe', 'sliders', 'tools', 'source'):
            continue
        stroke = deepcopy(child)
        # Original internal marks become translucent highlights. The silhouette
        # stays colored; removing enclosing strokes avoids the old cartoon edge.
        if name == 'archive' and tag == 'path':
            stroke.set('d', 'M9.2 12h5.6M11 14.4h2')
            stroke.set('stroke', '#ffffff')
            stroke.set('stroke-opacity', '.72')
        elif name == 'document':
            stroke.set('d', 'M14 3.5v4.8h4.3M8.5 12h7M8.5 15.6h5.2')
            stroke.set('stroke', '#ffffff')
            stroke.set('stroke-opacity', '.72')
        elif (name == 'photo' and tag == 'path') or (name == 'photos' and index == 2):
            stroke.set('stroke', '#ffffff')
            stroke.set('stroke-opacity', '.72')
        elif name == 'calendar' and tag == 'path':
            strokes.append('<path d="M7.9 3.2v5.2M16.1 3.2v5.2"/>')
            stroke.set('d', 'M3.8 10.9h16.4M7.6 15h1.2M12 15h1.2')
            stroke.set('stroke', '#ffffff')
            stroke.set('stroke-opacity', '.72')
        elif name in ('clock', 'mail', 'compare') and tag == 'path':
            stroke.set('stroke', '#ffffff')
            stroke.set('stroke-opacity', '.72')
        stroke.set('fill', ink if tag == 'circle' and name == 'more' else 'none')
        strokes.append(serialize(stroke))
    return (gradients(name, COLORS.get(name, 'blue')) + ''.join(fills)
            + f'<g fill="none" stroke="{ink}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'
            + ''.join(strokes) + '</g>')


def event_icons():
    foot = '<path d="M6.7 8.5c-2.1-.2-3.7 1.7-3 3.9.5 1.5.9 2.7.5 4.2-.5 2 .4 3.4 2 3.5 1.9.2 2.9-1.3 2.4-3.2-.5-1.8-.2-2.8.8-4.3 1.3-2-.3-3.9-2.7-4.1Z"/><ellipse cx="8.3" cy="5.7" rx="1.35" ry="1.65"/><circle cx="5.3" cy="5.8" r="1.05"/><circle cx="3.2" cy="7.1" r=".85"/><circle cx="2.1" cy="9.1" r=".65"/><circle cx="2.1" cy="11" r=".5"/>'
    birth = '<g transform="rotate(-13 6 13)" fill="url(#birth-glass)">' + foot + '</g><g transform="translate(23 -1) scale(-1 1) rotate(-13 6 13)" fill="url(#birth-other-glass)">' + foot + '</g>'
    marriage = '<g fill="none" stroke="url(#marriage-glass)" stroke-width="2.2" stroke-linecap="round"><ellipse cx="8.5" cy="10.7" rx="5.2" ry="6.3" transform="rotate(-27 8.5 10.7)"/><ellipse cx="15.4" cy="13" rx="5.2" ry="6.3" transform="rotate(27 15.4 13)"/><path d="M8.8 16.7c2.5.7 4.4-.8 4.9-3.2"/></g><path d="M3.6 7.3q.4-2 2.2-2.8M14.6 7.1q2.1-.7 3.7.5" fill="none" stroke="#fff6db" stroke-opacity=".8" stroke-width=".65" stroke-linecap="round"/>'
    baptism = '<path d="M12 2.8C10 6.6 6.4 9.3 6.4 12.4a5.6 5.6 0 0 0 11.2 0C17.6 9.3 14 6.6 12 2.8Z" fill="url(#baptism-glass)" stroke="url(#baptism-edge)" stroke-width=".65"/><path d="M9 12.5q0 2.6 2.7 2.8" fill="none" stroke="#eefbff" stroke-opacity=".75" stroke-width="1.1" stroke-linecap="round"/><path d="M6 21h12" stroke="url(#baptism-ink)" stroke-width="1.4" stroke-linecap="round"/>'
    death = '<path d="M6.4 20.5V9a5.6 5.6 0 0 1 11.2 0v11.5Z" fill="url(#death-glass)" stroke="url(#death-edge)" stroke-width=".65"/><path d="M4 20.5h16M10 9.5h4M10 12.8h3" fill="none" stroke="url(#death-ink)" stroke-width="1.35" stroke-linecap="round"/>'
    work = '<path d="M8.3 7V5.2a1.7 1.7 0 0 1 1.7-1.7h4a1.7 1.7 0 0 1 1.7 1.7V7" fill="none" stroke="url(#work-ink)" stroke-width="1.4"/><rect x="3" y="7" width="18" height="13.3" rx="2.8" fill="url(#work-glass)" stroke="url(#work-edge)" stroke-width=".65"/><path d="M3.6 11.8q8.4 3.4 16.8 0" fill="none" stroke="url(#work-ink)" stroke-width="1.1"/><rect x="10.6" y="11.8" width="2.8" height="3.4" rx=".9" fill="#eee4ff" fill-opacity=".85"/>'
    return {
        'birth': gradients('birth', 'mint') + gradients('birth-other', 'coral') + birth,
        'marriage': gradients('marriage', 'gold') + marriage,
        'baptism': gradients('baptism', 'blue') + baptism,
        'death': gradients('death', 'slate') + death,
        'work': gradients('work', 'violet') + work,
    }


events = event_icons()
icons = {p.stem: events.get(p.stem) or supplied_icon(p.stem, ET.fromstring(p.read_text()))
         for p in sorted((OUT / 'original').glob('*.svg'))}
icons.update({name: content for name, content in events.items() if name not in icons})
symbols = [f'<symbol id="{name}" viewBox="0 0 24 24">{content}</symbol>' for name, content in icons.items()]
(OUT / 'geneai.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg">' + ''.join(symbols) + '</svg>')
(OUT / 'names.json').write_text(json.dumps(list(icons), ensure_ascii=False))
print(f'Generated {len(icons)} glass icons from the supplied GENEAI geometry')
