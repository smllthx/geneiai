"""Color the supplied GENEAI geometry; keep originals for repeatable builds."""
from pathlib import Path
import xml.etree.ElementTree as ET
import json,re
ET.register_namespace('', 'http://www.w3.org/2000/svg')
root=Path(__file__).resolve().parent.parent
out=root/'src/assets/icons'; originals=out/'original'
# Filled silhouettes only where the original path is intentionally open.
backgrounds={
'home':'<path d="M5.4 9.1 12 3.8l6.6 5.3v11.3h-4.4v-5.8H9.8v5.8H5.4Z"/>',
'archive':'<path d="M4.6 8.8h14.8v11.5H4.6Z"/>',
'birth':'<path d="M12 13.6C7.7 14.1 4.7 11.6 4 7.3c4.6-.5 7.6 1.7 8 5.3Zm.1-2.1c.1-4.9 3-7.3 7.6-7.5.2 4.6-2.7 7.7-7.6 7.5Z"/>',
'bulb':'<path d="M8.4 15.8c-.1-1.4-2.5-2.9-2.5-6.3a6.1 6.1 0 0 1 12.2 0c0 3.5-2.5 5-2.6 6.3Z"/>',
'people':'<path d="M2.8 20c.3-4.1 2.9-6.3 6.5-6.3s6.2 2.2 6.5 6.3Z"/>',
'user':'<path d="M4.8 20c.4-4.2 3.3-6.5 7.2-6.5s6.8 2.3 7.2 6.5Z"/>',
'ship':'<path d="M6.7 7.5h10.6v6H6.7Z"/><path d="m3.7 14.3 8.3-2.8 8.3 2.8-2.7 4.9H6.4Z"/>',
'flask':'<path d="M10.1 4h3.8v6.5l5.3 7.4c.8 1.2 0 2.6-1.4 2.6H6.2c-1.4 0-2.2-1.4-1.4-2.6l5.3-7.4Z"/>',
'source':'<path d="M4.4 4.5h10.1l3 3.1v11.7H4.4Z"/>',
'photos':'<path d="M4.5 16.4 3.1 6.3a1.3 1.3 0 0 1 1.1-1.5l11.5-1.6a1.3 1.3 0 0 1 1.5 1.1l.1.9Z"/>',
'logout':'<path d="M10.4 4.1H4.1v15.8h6.3Z"/>',
'upload':'<path d="M4.2 16h15.6v4H4.2Z"/>',
'download':'<path d="M4.2 16h15.6v4H4.2Z"/>',
'building':'<path d="M5 9h14v11H5Z"/>',
}
palettes={
'blue':('#3276b5','#73b9f0','#d4edff'),
'mint':('#207e69','#64c9a5','#c4f1df'),
'gold':('#98621f','#edb554','#ffe4a8'),
'coral':('#b95652','#f18e82','#ffd5c7'),
'violet':('#7552b1','#b394e6','#e8dcff'),
'rose':('#ad5188','#e79fc9','#fbe0f1'),
'slate':('#526887','#a3b5d0','#dde7f5'),
}
groups={'mint':'tree birth branches pin calendar check sync','gold':'archive folder tag ship bulb building','coral':'compass heart','violet':'dna search spark language flask compare merge','rose':'photos photo','slate':'tools settings sliders logout menu more expand close back chevron chevrondown arrow minus'}
name_palette={n:k for k,v in groups.items() for n in v.split()}
# Modern filled accents. Original supplied SVGs remain intact for provenance.
refreshed={
'birth':'<g transform="rotate(-17 7 13)" fill="#6bcbb1"><path d="M7.3 8c-2.9 0-4.1 2.5-3.1 5.2.7 1.9.6 2.3.3 4-.4 2.5 1.2 4.1 3.1 3.8 2.3-.3 2.7-2.5 2.1-4.5-.6-2-.1-2.8.7-4.2C11.3 10.2 9.7 8 7.3 8Z"/><ellipse cx="9" cy="5" rx="1.6" ry="2"/><circle cx="5.5" cy="5.1" r="1.2"/><circle cx="3.1" cy="6.6" r="1"/><circle cx="2.1" cy="8.9" r=".85"/></g><g transform="translate(12 -2) rotate(17 4 12)" fill="#ef9b8b"><path d="M4 8c2.7 0 3.8 2.5 2.9 5.1-.7 1.9-.6 2.2-.3 3.9.4 2.4-1.1 4-3 3.7-2.1-.3-2.6-2.4-2-4.4.5-2 .1-2.7-.7-4.1C0 10.1 1.7 8 4 8Z"/><ellipse cx="2.2" cy="5" rx="1.5" ry="1.9"/><circle cx="5.5" cy="5.2" r="1.15"/><circle cx="7.7" cy="6.7" r=".95"/><circle cx="8.5" cy="9" r=".8"/></g>',
'archive':'<rect x="3" y="8" width="18" height="13" rx="3" fill="#e8b85d"/><rect x="2" y="3" width="20" height="6" rx="2" fill="#ffe0a0"/><rect x="8" y="12" width="8" height="3" rx="1.5" fill="#946d35"/>',
'document':'<path d="M6 2h8l6 6v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z" fill="#82bcec"/><path d="M14 2v4a2 2 0 0 0 2 2h4Z" fill="#cce9ff"/><path d="M7 12h9M7 16h6" stroke="#32699d" stroke-width="1.6" stroke-linecap="round"/>',
'calendar':'<rect x="2" y="4" width="20" height="18" rx="4" fill="#a4e1ce"/><path d="M6 4h12a4 4 0 0 1 4 4v1H2V8a4 4 0 0 1 4-4Z" fill="#4caa90"/><path d="M7 2v4M17 2v4" stroke="#287e68" stroke-width="2" stroke-linecap="round"/><g fill="#368b73"><circle cx="7" cy="13" r="1.1"/><circle cx="12" cy="13" r="1.1"/><circle cx="17" cy="13" r="1.1"/><circle cx="7" cy="18" r="1.1"/><circle cx="12" cy="18" r="1.1"/></g>',
'work':'<rect x="2" y="7" width="20" height="15" rx="4" fill="#ba9cde"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12q9 5 18 0" fill="none" stroke="#74549e" stroke-width="1.8"/><rect x="10" y="12" width="4" height="5" rx="1.4" fill="#e8d8ff"/>',
}
symbols=[]; names=[]
for p in sorted(originals.glob('*.svg')):
 name=p.stem; names.append(name)
 if name in refreshed:
  symbols.append(f'<symbol id="{name}" viewBox="0 0 24 24">{refreshed[name]}</symbol>'); continue
 elem=ET.fromstring(p.read_text()); stroke,fill,light=palettes[name_palette.get(name,'blue')]
 content=backgrounds.get(name,'').replace('/>',f' fill="{fill}" stroke="none"/>')
 for i,child in enumerate(elem):
  tag=child.tag.split('}')[-1]; d=child.attrib.get('d','')
  closed=tag in ('rect','circle','ellipse','polygon') or bool(re.search('[zZ]',d))
  child.set('fill', (fill if i%2==0 else light) if closed else 'none')
  # Tiny dots and tree nodes should be solid, not dark outlines.
  if tag=='circle' and float(child.attrib.get('r',10))<2.2:child.set('fill',fill)
  content+=ET.tostring(child,encoding='unicode').replace(' xmlns="http://www.w3.org/2000/svg"','')
 symbols.append(f'<symbol id="{name}" viewBox="0 0 24 24"><g fill="none" stroke="{stroke}" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">{content}</g></symbol>')
custom={
# Separate arcs make the two gold bands pass over and under each other.
'marriage':'<g fill="none" stroke-linecap="round"><ellipse cx="8.5" cy="11" rx="5.5" ry="7" transform="rotate(-27 8.5 11)" stroke="#a66b1c" stroke-width="3.8"/><ellipse cx="8.5" cy="11" rx="5.5" ry="7" transform="rotate(-27 8.5 11)" stroke="#f4c967" stroke-width="2.3"/><ellipse cx="15.5" cy="13" rx="5.5" ry="7" transform="rotate(27 15.5 13)" stroke="#a66b1c" stroke-width="3.8"/><ellipse cx="15.5" cy="13" rx="5.5" ry="7" transform="rotate(27 15.5 13)" stroke="#efb84b" stroke-width="2.3"/><path d="M8.8 17.3c2.5.8 4.8-1 5.2-3.2" stroke="#a66b1c" stroke-width="3.8"/><path d="M8.8 17.3c2.5.8 4.8-1 5.2-3.2" stroke="#f4c967" stroke-width="2.3"/><path d="M3.5 7.2q.5-2 2-2.8M14.5 7.5q2.5-1 3.8.5" stroke="#fff2c3" stroke-width="1.1"/></g>',
'baptism':'<path d="M12 2C10 5.8 6 8.8 6 12a6 6 0 0 0 12 0c0-3.2-4-6.2-6-10Z" fill="#72c9ef" stroke="#2d7ba3" stroke-width="1.5"/><path d="M9 12q0 3 3 3" fill="none" stroke="#e6f8ff" stroke-width="2" stroke-linecap="round"/><path d="M4 21h16M7 18h10" stroke="#5b9fbf" stroke-width="1.6" stroke-linecap="round"/>',
'death':'<path d="M6 21V9a6 6 0 0 1 12 0v12Z" fill="#b6b9d6" stroke="#626487" stroke-width="1.5"/><path d="M3 21h18M10 9h4M10 12h4" stroke="#626487" stroke-width="1.5" stroke-linecap="round"/><path d="M12 18c-2-3 1-4 3-4-1 3-1 4-3 4Z" fill="#6ca68a"/>',
'work':'<rect x="3" y="7" width="18" height="14" rx="2" fill="#c4a1e8" stroke="#78539d" stroke-width="1.5"/><path d="M8 7V4h8v3M3 12q9 5 18 0" fill="none" stroke="#78539d" stroke-width="1.5"/><rect x="10" y="12" width="4" height="4" rx="1" fill="#f1e0ff"/>',
}
custom.update({n:svg for n,svg in refreshed.items() if n not in names})
for n,svg in custom.items():names.append(n);symbols.append(f'<symbol id="{n}" viewBox="0 0 24 24">{svg}</symbol>')
(out/'geneai.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg">'+''.join(symbols)+'</svg>')
(out/'names.json').write_text(json.dumps(names,ensure_ascii=False))
print(f'Generated {len(names)} colored icons')
