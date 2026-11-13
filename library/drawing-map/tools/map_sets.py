#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""map_sets.py - map what a drawing set is made of.

Reads every drawing set under a root folder (one PDF = one set), sorts the sets into project types
and variants, and writes, for each type, what a typical set contains: the sheet index, the views on
each sheet, the details, and the note blocks, each with how often it appears.

    python3 tools/map_sets.py scan      read the PDFs (resumable; run again until it says nothing is left)
    python3 tools/map_sets.py build     classify, aggregate, write types/*.json, sets.csv, review.html
    python3 tools/map_sets.py status    how many sets are read, how many are left
    python3 tools/map_sets.py show KEY  print what was read from one set (KEY = part of its path)

Folder layout (this script sits in <map>/tools):
    <root>/                       the drawing sets, in any folder depth
    <root>/_blueprint_map/        <map>: taxonomy.json, sheet_kinds.json, outputs
    <root>/_detail_library/       optional. If its _state/occurrences.jsonl exists (built from the DWGs),
                                  view and detail titles come from there; otherwise from the PDF text.

Needs Python 3.8+ and either `pdftotext` (poppler) on the PATH, or the `pypdf` package (less precise).
Nothing is written outside <map>. Source drawings are only read.
"""
import argparse, collections, csv, hashlib, io, json, os, re, shutil, statistics, subprocess, sys, time

VERSION = 5                                 # bump to make `scan` read every set again
HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = 'oasis-blueprints/drawing-map/0.1'


# ------------------------------------------------------------------------------------------ helpers
def jload(path):
    with io.open(path, encoding='utf-8') as f:
        return json.load(f)

def jdump(obj, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with io.open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)

def rx(pats):
    """One case-insensitive regex from a list of patterns, or None for an empty list."""
    pats = [p for p in (pats or []) if p]
    return re.compile('|'.join('(?:%s)' % p for p in pats), re.I) if pats else None

def pct(n, d):
    return round(100.0 * n / d, 1) if d else 0.0

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


# ------------------------------------------------------------------------------------------ reading a PDF
PAGE_RE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
BLOCK_RE = re.compile(r'<block xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">(.*?)</block>', re.S)
LINE_RE = re.compile(r'<line xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">(.*?)</line>', re.S)
WORD_RE = re.compile(r'<word[^>]*>(.*?)</word>', re.S)

def _unescape(s):
    return s.replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'").replace('&apos;', "'").replace('&amp;', '&')

def read_pdf_pdfminer(path):
    """Positioned text through pdfminer.six, for PCs whose pdftotext is the Xpdf build (no -bbox-layout).
    Text boxes become blocks, text lines become lines; y is flipped so it runs down the page, as in poppler.
    Returns None when pdfminer is not installed."""
    try:
        from pdfminer.high_level import extract_pages
        from pdfminer.layout import LAParams, LTTextBox, LTTextLine
    except ImportError:
        return None
    pages = []
    for lp in extract_pages(path, laparams=LAParams()):
        px0, py0, px1, py1 = lp.bbox
        H = py1
        blocks = []
        def boxes(o):
            for e in o:
                if isinstance(e, LTTextBox):
                    yield e
                elif hasattr(e, '__iter__') and not isinstance(e, LTTextLine):
                    for b in boxes(e):
                        yield b
        for tb in boxes(lp):
            lines = []
            for ln in tb:
                if not isinstance(ln, LTTextLine):
                    continue
                t = ' '.join(ln.get_text().split())
                if t:
                    lines.append({'x0': ln.x0 - px0, 'y0': H - ln.y1, 'x1': ln.x1 - px0, 'y1': H - ln.y0, 't': t})
            if lines:
                blocks.append({'x0': tb.x0 - px0, 'y0': H - tb.y1, 'x1': tb.x1 - px0, 'y1': H - tb.y0, 'lines': lines})
        pages.append({'w': px1 - px0, 'h': py1 - py0, 'blocks': blocks})
    return pages

def read_pdf(path):
    """-> (pages, how). A page is {'w','h','blocks'}; a block is {'x0','y0','x1','y1','lines'};
    a line is {'x0','y0','x1','y1','t'}. y runs down the page, in points."""
    exe = shutil.which('pdftotext')
    if exe:
        r = subprocess.run([exe, '-bbox-layout', '-q', path, '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=240)
        if r.returncode == 0 and b'<page' in r.stdout:
            pages = []
            for w, h, body in PAGE_RE.findall(r.stdout.decode('utf-8', 'replace')):
                blocks = []
                for x0, y0, x1, y1, bb in BLOCK_RE.findall(body):
                    lines = []
                    for lx0, ly0, lx1, ly1, lb in LINE_RE.findall(bb):
                        t = ' '.join(_unescape(wd) for wd in WORD_RE.findall(lb)).strip()
                        if t:
                            lines.append({'x0': float(lx0), 'y0': float(ly0), 'x1': float(lx1), 'y1': float(ly1), 't': t})
                    if lines:
                        blocks.append({'x0': float(x0), 'y0': float(y0), 'x1': float(x1), 'y1': float(y1), 'lines': lines})
                pages.append({'w': float(w), 'h': float(h), 'blocks': blocks})
            return pages, 'pdftotext'
    pages = read_pdf_pdfminer(path)
    if pages is not None:
        return pages, 'pdfminer'
    try:
        import pypdf
    except ImportError:
        raise SystemExit('Need `pdftotext` (poppler) on the PATH, or `pip install pypdf`.')
    pages = []
    for pg in pypdf.PdfReader(path).pages:      # no coordinates: paragraphs become blocks, stacked down the page
        blocks, y = [], 0.0
        for para in re.split(r'\n\s*\n', pg.extract_text() or ''):
            lines = []
            for ln in para.split('\n'):
                ln = ln.strip()
                if ln:
                    lines.append({'x0': 0.0, 'y0': y, 'x1': 5.0 * len(ln), 'y1': y + 10, 't': ln}); y += 12
            if lines:
                blocks.append({'x0': 0.0, 'y0': lines[0]['y0'], 'x1': max(l['x1'] for l in lines), 'y1': lines[-1]['y1'], 'lines': lines}); y += 12
        pages.append({'w': float(pg.mediabox.width), 'h': float(pg.mediabox.height), 'blocks': blocks})
    return pages, 'pypdf'


# ------------------------------------------------------------------------------------------ reading a page
SHEETNO = r'[A-Z]{1,3}[-.]?\d{1,3}(?:\.\d{1,2})?'
SHEETNO_RE = re.compile('^' + SHEETNO + '$')
SHEETLINE_RE = re.compile('^(' + SHEETNO + r')(?:\s*[-–:]\s*|\s+)(\S.*)$')      # A1.0 FLOOR PLAN, A.0 - SITE PLAN
LIST_HEAD_RE = re.compile(r'^(DRAWING LIST|SHEET INDEX|INDEX OF DRAWINGS|DRAWING INDEX|SHEET LIST|LIST OF DRAWINGS|INDEX OF SHEETS)\b|^INDEX$', re.I)
FEAT_HEAD_RE = re.compile(r'^PLAN FEATURES\b', re.I)
TITLEBLOCK_RE = re.compile(r'^(PROJECT ?#|PROJECT NO|DRAWN BY|CHECKED BY|SHEET NAME|SHEET NUMBER|SHEET NO|REVISION|NUMBER\b|DESCRIPTION\b|DATE\b|SCALE\b|'
                           r'DRAFT - NOT FOR|NOT FOR CONSTRUCTION|DESIGNS$|HOME PLANS|NORTH$|PLANS PREPARED FOR|GENERAL CONTRACTOR|VICINITY MAP)', re.I)

# Site-specific settings that name a firm or its folders stay out of the shared files, in <map>/_state/local.json:
#   {"titleblock_words": ["ACME"],            title-block text to ignore (a firm's logo line), matched as a whole line
#    "ignore": ["^Marketing", "Old Versions"],  extra path patterns to skip, added to taxonomy.json's `ignore`
#    "top_only": true,                          read only the PDFs sitting in the root, not its subfolders
#    "exclude_from_publish": ["Old Job"]}       sets (path patterns) kept out of every published file
LOCAL = {}

def load_local(map_dir):
    global TITLEBLOCK_RE
    p = os.path.join(map_dir, '_state', 'local.json')
    LOCAL.clear()
    if os.path.exists(p):
        LOCAL.update(jload(p))
    words = [w for w in LOCAL.get('titleblock_words') or [] if w]
    if words:
        TITLEBLOCK_RE = re.compile(TITLEBLOCK_RE.pattern[:-1] + '|' + '|'.join(re.escape(w) + '$' for w in words) + ')', re.I)

def load_taxonomy(map_dir):
    tax = jload(os.path.join(map_dir, 'taxonomy.json'))
    tax['ignore'] = list(tax.get('ignore') or []) + list(LOCAL.get('ignore') or [])
    return tax
ITEM_RE = re.compile(r'^(\(?\d{1,2}[.)]|[A-Za-z][.)]|[•●▪\-–*])\s+\S')
SCALE_RE = re.compile(r'''(\d+(?:\s+\d/\d+|/\d+)?\s*"\s*=\s*\d+\s*'\s*-?\s*\d*\s*"?|\bN\.?T\.?S\.?\b|NOT TO SCALE|\b1\s*:\s*\d{1,4}\b)''', re.I)

ADDRESS_RE = re.compile(r'^\d+\s+\S.*\b(AVE|AVENUE|ST|STREET|RD|ROAD|DR|DRIVE|LN|LANE|BLVD|CT|COURT|WAY|CIR|CIRCLE|PL|PLACE|HWY|TRL|TRAIL)\b\.?|\b[A-Z]{2}\s+\d{5}\b|,\s*[A-Z .]+\s+\d{5}\b', re.I)

def despace(s):
    """'S T R U C T U R A L  N O T E S' -> 'STRUCTURALNOTES' (letter-spaced titles)."""
    toks = s.split()
    if len(toks) >= 4 and sum(len(t) == 1 for t in toks) >= 0.8 * len(toks):
        return ''.join(toks), True
    return s, False

def all_lines(page):
    return [l for b in page['blocks'] for l in b['lines']]

def rows_of(lines):
    """Lines grouped into rows that share a baseline, top to bottom; each row left to right."""
    rows = []
    for l in sorted(lines, key=lambda l: (l['y0'], l['x0'])):
        tol = 0.45 * max(4.0, l['y1'] - l['y0'])
        if rows and abs(rows[-1][0]['y0'] - l['y0']) <= tol:
            rows[-1].append(l)
        else:
            rows.append([l])
    return [sorted(r, key=lambda l: l['x0']) for r in rows]

def region_below(page, head, width=700.0):
    return [l for l in all_lines(page) if l['y0'] > head['y0'] + 1 and head['x0'] - 40 <= l['x0'] <= head['x0'] + width]

def find_head(page, regex):
    for l in sorted(all_lines(page), key=lambda l: (l['y0'], l['x0'])):
        if regex.match(l['t'].strip()):
            return l
    return None

SCOPE_HEAD_RE = re.compile(r'\b(SCOPE OF WORK|PROJECT DESCRIPTION|DESCRIPTION OF WORK|WORK DESCRIPTION)\b\s*:?\s*', re.I)
SCOPE_STOP_RE = re.compile(r'\b(BUILDING CODES?|APPLICABLE CODES|CODE DATA|ZONING|PARCEL|FOLIO|ADDRESS|OWNER|PROJECT TEAM|SHEET INDEX|'
                           r'LEGAL DESCRIPTION|FLOOD ZONE|OCCUPANCY|CONSTRUCTION TYPE|\d{6,})', re.I)

def scope_text(page):
    """The cover's one-line description of the job ("SCOPE OF WORK AS ADDITION"), used only to sort the set.
    It is never written to the type files."""
    text = ' '.join(l['t'] for l in sorted(all_lines(page), key=lambda l: (l['y0'], l['x0'])))
    m = SCOPE_HEAD_RE.search(text)
    if not m:
        return ''
    s = text[m.end():m.end() + 200]
    stop = SCOPE_STOP_RE.search(s)
    return re.sub(r'\s+', ' ', s[:stop.start()] if stop else s).strip(' .:-')

def drawing_list(page):
    """The sheet list on the cover: [[number, name], ...]."""
    head = find_head(page, LIST_HEAD_RE)
    if not head:
        return []
    out, miss = [], 0
    lo = head['x0'] - 200                         # some title blocks set the table left of its heading
    for row in rows_of([l for l in all_lines(page) if l['y0'] > head['y0'] + 1 and lo <= l['x0'] <= head['x0'] + 700]):
        row = [l for l in row if l['x0'] <= head['x0'] + 80] + [l for l in row if l['x0'] > head['x0'] + 80]
        first = row[0]
        t = first['t'].strip()
        if first['x0'] > head['x0'] + 80:
            continue                              # nothing in the list column on this row (stamps, vertical text)
        m = SHEETLINE_RE.match(t)
        if m:
            no, name = m.group(1), m.group(2)
        elif SHEETNO_RE.match(t) and len(row) > 1:
            no, name = t, ''
        else:
            if out:
                miss += 1
                if miss >= 3 or re.match(r'^(PLAN FEATURES|NOTE\b|GENERAL NOTES)', t, re.I):
                    break
            continue
        last = first
        for l in row[1:]:
            if l['x0'] - last['x1'] > (40 if name else 160):   # a name already started: the next column is other text
                break
            name = (name + ' ' + l['t'].strip()).strip(); last = l
        if name:
            out.append([no, re.sub(r'\s+', ' ', name)]); miss = 0
    return out

def plan_features(page):
    head = find_head(page, FEAT_HEAD_RE)
    out = {}
    if head:
        for row in rows_of(region_below(page, head, 520.0))[:14]:
            t = re.sub(r'\s+', ' ', ' '.join(l['t'].strip() for l in row))
            m = re.match(r'^([^:]{3,40}):\s*(\S.{0,40})$', t)
            if m:
                out[m.group(1).strip().upper()] = m.group(2).strip()
            elif out:
                break
    return out

def tallest_text(page, exclude=()):
    """The biggest piece of text on the page that is not title-block boilerplate: the cover title, or a sheet title."""
    best = None
    for l in all_lines(page):
        t, _ = despace(l['t'].strip())
        if len(t) < 5 or sum(c.isalpha() for c in t) < 4 or TITLEBLOCK_RE.match(t) or LIST_HEAD_RE.match(t) or SHEETNO_RE.match(t) or t in exclude:
            continue
        h = l['y1'] - l['y0']
        if h > l['x1'] - l['x0'] or len(t.split()) > 12 or re.match(r'^(THIS DRAWING|ALL DESIGNS|NOTE\b|COPYRIGHT|&)', t, re.I) or ADDRESS_RE.search(t):
            continue                              # text set vertically along the border, disclaimers, street addresses
        if best is None or h > best[0] + 0.5:
            best = (h, t)
    return best[1] if best else ''

def page_sheet_by_name(page, squeezed):
    """squeezed: {name without spaces or punctuation: sheet number}. The tallest line that is exactly a listed sheet name."""
    best = None
    for l in all_lines(page):
        t, _ = despace(l['t'].strip())
        no = squeezed.get(re.sub(r'[^A-Z0-9]', '', t.upper()))
        if no:
            h = l['y1'] - l['y0']
            if best is None or h > best[0]:
                best = (h, no)
    return best[1] if best else None

def page_sheet_no(page, nos):
    """The sheet number in the title block: the tallest text that is exactly a sheet number."""
    best = None
    for l in all_lines(page):
        t = l['t'].strip()
        if (t in nos) if nos else SHEETNO_RE.match(t):
            h = l['y1'] - l['y0']
            if best is None or h > best[0]:
                best = (h, t)
    return best[1] if best else None

def block_text(b):
    return ' '.join(l['t'].strip() for l in b['lines'])

def is_heading(b):
    if len(b['lines']) > 2:
        return False
    t, _ = despace(block_text(b))
    t = t.strip().rstrip(':').strip()
    if not (3 <= len(t) <= 64) or t != t.upper() or len(t.split()) > 8 or sum(c.isalpha() for c in t) < 4:
        return False
    if re.search(r'''\d\s*['"]|=|@''', t) or TITLEBLOCK_RE.match(t) or ITEM_RE.match(t) or SHEETNO_RE.match(t):
        return False
    return True

def is_texty(b):
    t = block_text(b)
    solid = t.replace(' ', '')
    return len(t.split()) >= 4 and solid and sum(c.isalpha() for c in t) >= 0.6 * len(solid)

NOTE_HEAD_RE = re.compile(r'NOTE|SPEC|REQUIRE|CODE|LOAD|DESIGN|CRITERIA|ABBREV|GENERAL|CONCRETE|MASONRY|STEEL|WOOD|LUMBER|FOUNDATION|DEMOLITION|EXCAVATION|SLAB|FASTEN|NAILING|CONNECT', re.I)
def block_kind(heading):
    return 'legend' if re.search(r'LEGEND|SYMBOL|ABBREV|KEY\b', heading, re.I) else 'schedule' if re.search(r'SCHEDULE|TABLE|LIST\b', heading, re.I) else 'notes'

def note_sections(page):
    """Note blocks on a page: a short capital heading with the numbered or written items under it.
    -> [{'heading': str, 'items': [str, ...]}]"""
    blocks = sorted(page['blocks'], key=lambda b: (b['y0'], b['x0']))
    heads = [b for b in blocks if is_heading(b)]
    head_ids = set(id(b) for b in heads)
    used, secs = set(), []
    for h in heads:
        col = sorted((b for b in blocks if b is not h and b['y0'] >= h['y1'] - 2 and -12 <= b['x0'] - h['x0'] <= 70), key=lambda b: b['y0'])
        items, last_y = [], h['y1']
        for b in col:
            if id(b) in head_ids:
                break
            t = block_text(b)
            lh = max(6.0, b['lines'][0]['y1'] - b['lines'][0]['y0'])
            if b['y0'] - last_y > 9 * lh:
                break
            if ITEM_RE.match(t):
                items.append(t)
            elif items:
                items[-1] += ' | ' + t                   # continuation or table rows under an item
            elif is_texty(b):
                items.append(t)
            else:
                break
            used.add(id(b)); last_y = b['y1']
        secs.append({'h': h, 'items': items})
    # a column that starts with numbered items and has no heading carries on from the column to its left
    loose = [b for b in blocks if id(b) not in used and id(b) not in head_ids and ITEM_RE.match(block_text(b))]
    cols = []
    for b in sorted(loose, key=lambda b: b['x0']):
        if cols and b['x0'] - cols[-1][0]['x0'] <= 40:
            cols[-1].append(b)
        else:
            cols.append([b])
    for col in cols:
        left = [s for s in secs if s['h']['x0'] < col[0]['x0'] - 80 and s['items']]
        if left:
            target = max(left, key=lambda s: (round(s['h']['x0'] / 80.0), s['h']['y0']))
            target['items'].extend(block_text(b) for b in sorted(col, key=lambda b: b['y0']))
    out = []
    for s in secs:
        words = sum(len(i.split()) for i in s['items'])
        head, _ = despace(block_text(s['h']))
        head = re.sub(r'\s+', ' ', head).strip().rstrip(':').strip()
        kind = block_kind(head)
        numbered = sum(1 for i in s['items'] if ITEM_RE.match(i))
        # keep real blocks: two or more numbered items, or a legend / schedule / notes heading with some text under it
        if numbered >= 2 or (words >= 12 and (kind != 'notes' or NOTE_HEAD_RE.search(head))):
            out.append({'heading': head, 'kind': kind, 'items': [re.sub(r'\s+', ' ', i) for i in s['items']]})
    return out

def pdf_views(page):
    """View titles read from the PDF text: a line that carries a scale. Only used when no DWG-derived list exists."""
    out = []
    for b in page['blocks']:
        ls = b['lines']
        for i, l in enumerate(ls):
            t = l['t']
            m = SCALE_RE.search(t)
            if not m:
                continue
            title = re.sub(r'\bSCALE\b\s*[:=]?\s*$', '', t[:m.start()], flags=re.I).strip(' :-')
            if len(title) < 3 and i > 0:
                title = ls[i - 1]['t'].strip()
            if len(title) >= 3 and title == title.upper() and not TITLEBLOCK_RE.match(title):
                out.append([title, re.sub(r'\s+', '', m.group(1))])
    return out


# ------------------------------------------------------------------------------------------ one set
def extract_set(key, files):
    rec = {'v': VERSION, 'key': key, 'pdf': 'pdf' in files, 'dwg': 'dwg' in files, 'flags': []}
    if 'pdf' not in files:
        rec['flags'].append('no_pdf')
        return rec
    st = os.stat(files['pdf'])
    rec['sig'] = '%d-%d' % (st.st_size, int(st.st_mtime))
    try:
        pages, how = read_pdf(files['pdf'])
    except Exception as e:                       # a damaged PDF must not stop the run
        rec['flags'].append('pdf_error: %s' % str(e)[:80])
        return rec
    rec['reader'] = how
    rec['pages'] = len(pages)
    if not pages:
        rec['flags'].append('no_pages')
        return rec
    rec['page_size'] = [round(pages[0]['w']), round(pages[0]['h'])]
    dl, list_page = drawing_list(pages[0]), 0
    if not dl and len(pages) > 1:
        dl, list_page = drawing_list(pages[1]), 1
    rec['drawing_list'] = dl
    rec['features'] = plan_features(pages[0])
    rec['title'] = tallest_text(pages[0])
    rec['scope'] = scope_text(pages[0])
    nos = [d[0] for d in dl]
    names = dict(dl)
    by_squeezed = {re.sub(r'[^A-Z0-9]', '', n.upper()): n for n in names.values()}
    no_by_squeezed = {re.sub(r'[^A-Z0-9]', '', n.upper()): no for no, n in dl if len(n) >= 5}
    if not dl:
        rec['flags'].append('no_drawing_list')
    elif len(dl) != len(pages):
        rec['flags'].append('list_%d_pages_%d' % (len(dl), len(pages)))
    sheets = []
    for i, pg in enumerate(pages):
        no = how_matched = None
        if dl and len(dl) == len(pages):
            no, how_matched = nos[i], 'order'
        else:
            no = page_sheet_no(pg, set(nos))
            how_matched = 'title_block' if no else None
            if not no and dl and i != list_page:
                no = page_sheet_by_name(pg, no_by_squeezed)
                how_matched = 'sheet_name' if no else None
        name = names.get(no, '')
        if not name and dl and i == list_page:    # the page that carries the drawing list is the cover
            name, how_matched = 'COVER SHEET', 'list_page'
        if not name:                              # no list entry: use the biggest text on the sheet
            guess = tallest_text(pg, exclude=(rec['title'],))
            name = by_squeezed.get(re.sub(r'[^A-Z0-9]', '', guess.upper()), guess)
            how_matched = how_matched or ('page_title' if name else None)
        sheets.append({'page': i + 1, 'no': no or '', 'name': name, 'how': how_matched or '', 'notes': note_sections(pg), 'views_pdf': pdf_views(pg)})
    rec['sheets'] = sheets
    return rec

def find_sets(root, ignore):
    sets = {}
    for dp, dn, fn in os.walk(root):
        rel = os.path.relpath(dp, root).replace(os.sep, '/')
        rel = '' if rel == '.' else rel
        dn[:] = sorted(d for d in dn if not (ignore and ignore.search((rel + '/' + d).strip('/'))))
        if LOCAL.get('top_only'):
            dn[:] = []                            # local.json {"top_only": true}: only the files in the root itself
        for f in sorted(fn):
            stem, ext = os.path.splitext(f)
            ext = ext.lower()
            if ext not in ('.pdf', '.dwg'):
                continue
            key = (rel + '/' + stem).strip('/')
            if ignore and ignore.search(key):
                continue
            sets.setdefault(key, {})[ext[1:]] = os.path.join(dp, f)
    return sets

def load_cache(path):
    cache = {}
    if os.path.exists(path):
        with io.open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        r = json.loads(line)
                    except ValueError:
                        continue                 # a line cut short by a stopped run
                    cache[r['key']] = r          # later lines win
    return cache

def is_fresh(rec, files):
    if not rec or rec.get('v') != VERSION or rec.get('pdf') != ('pdf' in files):
        return False
    if 'pdf' in files:
        st = os.stat(files['pdf'])
        return rec.get('sig') == '%d-%d' % (st.st_size, int(st.st_mtime))
    return True

def cmd_scan(a):
    tax = load_taxonomy(a.map)
    sets = find_sets(a.root, rx(tax.get('ignore')))
    only = re.compile(a.only, re.I) if a.only else None
    cache_path = os.path.join(a.map, '_state', 'sets.jsonl')
    cache = load_cache(cache_path)
    todo = [k for k in sorted(sets) if (not only or only.search(k)) and (a.force or not is_fresh(cache.get(k), sets[k]))]
    if a.limit:
        todo = todo[:a.limit]
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    t0, done = time.time(), 0
    with io.open(cache_path, 'a', encoding='utf-8') as out:
        for k in todo:
            if a.time_budget and time.time() - t0 > a.time_budget:
                break
            out.write(json.dumps(extract_set(k, sets[k]), ensure_ascii=False) + '\n'); out.flush()
            done += 1
    left = len(todo) - done
    print('sets found: %d   read this run: %d in %.0f s   left: %d' % (len(sets), done, time.time() - t0, left))
    print('Run `scan` again to continue.' if left else 'Nothing left to read. Next: `build`.')

def cmd_status(a):
    tax = load_taxonomy(a.map)
    sets = find_sets(a.root, rx(tax.get('ignore')))
    cache = load_cache(os.path.join(a.map, '_state', 'sets.jsonl'))
    fresh = sum(1 for k in sets if is_fresh(cache.get(k), sets[k]))
    print('sets found: %d (with PDF: %d, DWG only: %d)   read: %d   left: %d' % (
        len(sets), sum('pdf' in v for v in sets.values()), sum('pdf' not in v for v in sets.values()), fresh, len(sets) - fresh))

def cmd_show(a):
    cache = load_cache(os.path.join(a.map, '_state', 'sets.jsonl'))
    hits = [k for k in cache if a.key.lower() in k.lower()]
    for k in hits[:3]:
        r = cache[k]
        print('=' * 100); print(k); print('title:', r.get('title'), '| pages:', r.get('pages'), '| flags:', r.get('flags'), '| features:', r.get('features'))
        for s in r.get('sheets', []):
            print('  p%-2d %-7s %-44s [%s]  notes: %s' % (s['page'], s['no'], s['name'][:44], s['how'], ', '.join('%s (%d)' % (n['heading'], len(n['items'])) for n in s['notes']) or '-'))
    if not hits:
        print('No set read yet whose path contains %r.' % a.key)


# ------------------------------------------------------------------------------------------ classify
def norm_title(s):
    """A view, detail or sheet name with the job-specific parts taken out, so the same thing counts as one."""
    s = re.sub(r'\s+', ' ', s.upper()).strip(' .:-')
    s = re.sub(r'\s*\(\d+\)\s*$', '', s)                                   # ELEVATIONS (2)
    s = re.sub(r'''\d+(?:\.\d+)?(?:'|\s?FT|\s?FEET)?(?:-\d+"?)?\s*[X\u00d7]\s*\d+(?:\.\d+)?(?:'|\s?FT|\s?FEET)?(?:-\d+"?)?''', '{SIZE}', s)   # 12'x24', 4X4
    s = re.sub(r'\b(SECTION|DETAIL|ELEVATION|VIEW)\s+([A-Z]|\d{1,2})(\s*-\s*\2)?\b', r'\1 {X}', s)   # SECTION A-A, DETAIL 3
    return s.strip()

def sheet_kinds(name, kinds):
    out = []
    for k in kinds:
        if k['_any'].search(name) and not (k['_not'] and k['_not'].search(name)):
            out.append(k['key'])
    return out

def attributes(sig, tax):
    """Attributes read from names only (path, cover title, sheet names, view and detail titles), never from note text,
    because standard note blocks mention masonry, steel and so on in every set."""
    att = {}
    for name, rules in (tax.get('attributes') or {}).items():
        if name.startswith('_'):
            continue
        hits = [r['value'] for r in rules if r['_any'].search(sig)]
        if not hits:
            continue
        if name == 'walls' and 'cmu' in hits and 'wood' in hits:
            att[name] = 'cmu+wood'
        else:
            att[name] = hits[0]                     # rules are listed strongest first
    return att

def when_ok(when, att):
    for k, v in (when or {}).items():
        if k.endswith('_min'):
            if (att.get(k[:-4]) or 0) < v: return False
        elif k.endswith('_max'):
            if (att.get(k[:-4]) or 0) > v: return False
        elif isinstance(v, list):
            if att.get(k) not in v: return False
        elif att.get(k) != v:
            return False
    return True

def score(match, key, title, sheet_names):
    s, why = 0, ''
    if match.get('_path') and match['_path'].search(key):
        s, why = 100, 'path'
    if match.get('_title') and match['_title'].search(title):
        if s < 50: s, why = 50, 'title'
    if match.get('_sheets'):
        n = sum(1 for nm in sheet_names if match['_sheets'].search(nm))
        if n and s < 10 * min(n, 3): s, why = 10 * min(n, 3), 'sheets'
    return s, why

def classify(key, title, sheet_names, att, tax):
    best = (0, None, '')
    for t in tax['types']:
        if not when_ok(t.get('when'), att):
            continue
        s, why = score(t.get('match', {}), key, title, sheet_names)
        if s > best[0]:
            best = (s, t, why)
    if not best[1]:
        return 'unsorted', 'unsorted', 'none', ''
    t = best[1]
    vbest = (0, None)
    for v in t.get('variants', []):
        if not when_ok(v.get('when'), att):
            continue
        s, _ = score(v.get('match', {}), key, title, sheet_names) if v.get('match') else (1, '')
        if s > vbest[0]:
            vbest = (s, v)
    vkey = vbest[1]['key'] if vbest[1] else 'general'
    return t['key'], vkey, ('high' if best[0] >= 100 else 'medium' if best[0] >= 50 else 'low'), best[2]

def compile_tax(tax):
    for name, rules in (tax.get('attributes') or {}).items():
        if name.startswith('_'):
            continue
        for r in rules:
            r['_any'] = rx(r['any'])
    def comp(m):
        for f in ('path', 'title', 'sheets'):
            m['_' + f] = rx(m.get(f))
    for t in tax['types']:
        comp(t.setdefault('match', {}))
        for v in t.get('variants', []):
            if v.get('match'):
                comp(v['match'])
    return tax


# ------------------------------------------------------------------------------------------ build
STATES = ('Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|'
          'Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|'
          'New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|'
          'Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming')
STATE_RE = re.compile(r'\b(' + STATES.replace(' ', r'\s*') + r')(?:\b|(?=licensed|building))', re.I)   # PDFs sometimes glue "New Yorklicensed"

def templatize(text):
    """Job-specific words replaced by placeholders, so the same note written for two states counts as one."""
    text = STATE_RE.sub('{state}', text)
    text = re.sub(r'\b(19|20)\d\d\b', '{year}', text)
    text = re.sub(r'\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b', '{phone}', text)
    return text

# Anonymising. Everything written to types/*.json and review.html passes through scrub(): generic rules here, plus the
# names in _state/scrub_names.json (local only, since it lists real people and firms).
SCRUB_RULES = [
    (re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', re.I), '{email}'),
    (re.compile(r'\b(?:https?://|www\.)\S+|\b[\w-]+\.(?:com|net|org|us|biz|co)\b', re.I), '{website}'),
    (re.compile(r'\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b'), '{phone}'),
    (re.compile(r'\b(?:P\.E\.|PE|LIC(?:ENSE)?\.?|CGC|CBC|CRC)\s*(?:NO\.?|#|NUMBER)?\s*[:#]?\s*\d{4,}\b', re.I), '{license}'),
    # the value after a label that names who drew the set or who it was for
    (re.compile(r'\b(DESIGNER\s*/?\s*DRAFTSMAN|DESIGNER|DRAFTSMAN|DRAFTER|DRAWN BY|PREPARED BY|DESIGNED BY|CLIENT)\s*:\s*'
                r'(?!\{)[^:\n]*?(?=\s+(?:PHONE|TEL|EMAIL|E-MAIL|FAX|CELL)\b|\s*\{|$)', re.I), r'\1: {name}'),
    # a firm: up to four capitalised words ending in a company suffix
    (re.compile(r"\b(?:[A-Z][A-Za-z&'.-]*\s+){1,4}(?:LLC|L\.L\.C\.?|INC\.?|INCORPORATED|CORP\.?|CORPORATION|LTD\.?|CO\.)(?=\W|$)"), '{company}'),
]
_SCRUB_NAMES = None

def load_scrub_names(map_dir):
    global _SCRUB_NAMES
    p = os.path.join(map_dir, '_state', 'scrub_names.json')
    pairs = []
    if os.path.exists(p):
        d = jload(p)
        for kind, names in d.items():
            if kind.startswith('_'):
                continue
            pairs += [(n, '{%s}' % kind) for n in names]
    pairs.sort(key=lambda x: -len(x[0]))
    _SCRUB_NAMES = [(re.compile(r'(?<![A-Za-z0-9])' + re.escape(n).replace(r'\ ', r'[\s_-]*') + r'(?![A-Za-z0-9])', re.I), ph) for n, ph in pairs]
    return len(pairs)

def scrub(text):
    for r, ph in (_SCRUB_NAMES or []):
        text = r.sub(ph, text)
    for r, ph in SCRUB_RULES:
        text = r.sub(ph, text)
    text = STATE_RE.sub('{state}', text)
    return re.sub(r'(\{(\w+)\})(?:[\s,]*\1)+', r'\1', text)      # "{person} {person}" -> "{person}"

def scrub_obj(o):
    if isinstance(o, dict):
        return {k: scrub_obj(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [scrub_obj(v) for v in o]
    return scrub(o) if isinstance(o, str) else o

def text_hash(text):
    return hashlib.sha1(re.sub(r'[^a-z0-9{}]+', ' ', templatize(text).lower()).strip().encode('utf-8')).hexdigest()[:12]

def tier(p, tiers):
    return 'core' if p >= tiers['core'] else 'common' if p >= tiers['common'] else 'occasional'

def load_occurrences(root):
    """DWG-derived view list from the detail library, by set key (lower case). {} if there is none."""
    path = os.path.join(root, '_detail_library', '_state', 'occurrences.jsonl')
    occ = collections.defaultdict(list)
    if os.path.exists(path):
        with io.open(path, encoding='utf-8') as f:
            for line in f:
                try:
                    o = json.loads(line)
                except ValueError:
                    continue
                if o.get('empty') or not o.get('title') or not o.get('file'):
                    continue
                occ[os.path.splitext(o['file'])[0].lower()].append(o)
    ids = set()
    idx = os.path.join(root, '_detail_library', 'index.csv')
    if os.path.exists(idx):
        with io.open(idx, encoding='utf-8-sig') as f:
            ids = set(r['id'] for r in csv.DictReader(f))
    return occ, ids

def prepare(rec, occ, lib_ids, tax, kinds, unmapped):
    """Everything known about one set, in one flat record ready to be counted."""
    key = rec['key']
    oc = occ.get(key.lower(), [])
    sheets = []
    for s in rec.get('sheets', []):
        sheets.append({'no': s['no'], 'name': s['name'], 'notes': s['notes'], 'views': [], 'views_pdf': s.get('views_pdf', [])})
    by_no = {s['no']: s for s in sheets if s['no']}
    for o in oc:                                   # put each DWG view on its sheet; make the sheet if the PDF gave none
        s = by_no.get(o.get('sheet') or '')
        if s is None:
            s = {'no': o.get('sheet') or '', 'name': '', 'notes': [], 'views': [], 'views_pdf': []}
            sheets.append(s); by_no[s['no']] = s
        s['views'].append(o)
    for s in sheets:
        s['kinds'] = sheet_kinds(s['name'], kinds) if s['name'] else []
        if s['name'] and not s['kinds']:
            unmapped[norm_title(s['name'])] += 1
        if not s['views'] and s['views_pdf']:      # no DWG list for this sheet: fall back to titles read from the PDF
            s['views'] = [{'title': t, 'scale': sc, 'kind': 'detail' if re.search(r'\bDETAIL\b', t) else 'section' if re.search(r'\bSECTION\b', t) else 'view', 'src': 'pdf'} for t, sc in s['views_pdf']]
    views = [v for s in sheets for v in s['views']]
    sig = ' | '.join([key, rec.get('title') or ''] + [s['name'] for s in sheets] + [v.get('title') or '' for v in views]).upper()
    att = attributes(sig, tax)
    tkey, vkey, conf, why = classify(key, ' | '.join(x for x in (rec.get('title'), rec.get('scope')) if x), [s['name'] for s in sheets], att, tax)
    return {'key': key, 'type': tkey, 'variant': vkey, 'conf': conf, 'why': why, 'att': att, 'pages': rec.get('pages') or 0, 'sheets': sheets,
            'flags': list(rec.get('flags', [])) + ([] if oc else ['no_dwg_views']), 'has_occ': bool(oc), 'lib_ids': lib_ids}

def aggregate(group, tax, kind_names, min_text_sets, vocab):
    n = len(group)
    shared = lambda text: vocab[text] >= min_text_sets      # seen in enough sets, anywhere, to be standard wording
    unlisted = collections.Counter()
    tiers = tax.get('tiers') or {'core': 60, 'common': 25}
    sheet_sets = collections.Counter(); sheet_pos = collections.defaultdict(list); sheet_names = collections.defaultdict(collections.Counter)
    sheet_prefix = collections.defaultdict(collections.Counter); sheet_count = collections.defaultdict(list)
    view_sets = collections.defaultdict(collections.Counter); view_scale = collections.defaultdict(collections.Counter); view_kind = {}
    det_sets = collections.Counter(); det_scale = collections.defaultdict(collections.Counter); det_cat = collections.defaultdict(collections.Counter); det_ids = collections.defaultdict(collections.Counter)
    note_kind = {}
    note_sets = collections.Counter(); note_items = collections.defaultdict(list); note_var = collections.defaultdict(collections.Counter); note_text = {}; note_where = collections.defaultdict(collections.Counter)
    att_counts = collections.defaultdict(collections.Counter)
    for s in group:
        for k, v in s['att'].items():
            att_counts[k][str(v)] += 1
        seen_k, seen_v, seen_d, seen_n = set(), set(), set(), set()
        ns = max(1, len(s['sheets']) - 1)
        per_kind = collections.Counter()
        for i, sh in enumerate(s['sheets']):
            kinds = sh['kinds'] or (['unnamed'] if not sh['name'] else ['other'])
            for k in kinds:
                per_kind[k] += 1
                if k not in seen_k:
                    seen_k.add(k); sheet_sets[k] += 1; sheet_pos[k].append(i / float(ns))
                if sh['name']:
                    sheet_names[k][norm_title(sh['name'])] += 1
                m = re.match(r'^([A-Z]{1,3})', sh['no'] or '')
                if m:
                    sheet_prefix[k][m.group(1)] += 1
            primary = kinds[0]
            for v in sh['views']:
                t = norm_title(v.get('title') or '')
                if not t:
                    continue
                kind = v.get('kind') or 'view'
                sc = re.sub(r'\s+', '', v.get('scale') or '')
                if kind in ('detail', 'section'):
                    if t not in seen_d:
                        seen_d.add(t); det_sets[t] += 1
                    if sc: det_scale[t][sc] += 1
                    if v.get('cat'): det_cat[t][v['cat']] += 1
                    hid = (v.get('hash') or '')[:8]
                    if hid and hid in s['lib_ids']: det_ids[t][hid] += 1
                else:
                    if (primary, t) not in seen_v:
                        seen_v.add((primary, t)); view_sets[primary][t] += 1
                    if sc: view_scale[(primary, t)][sc] += 1
                    view_kind[(primary, t)] = kind
            for nb in sh['notes']:
                h = norm_title(nb['heading'])
                note_kind[h] = nb.get('kind', 'notes')
                body = '\n'.join(nb['items'])
                hsh = text_hash(body)
                if h not in seen_n:
                    seen_n.add(h); note_sets[h] += 1; note_items[h].append(len(nb['items']))
                if (h, hsh) not in seen_n:
                    seen_n.add((h, hsh)); note_var[h][hsh] += 1
                note_text.setdefault((h, hsh), [templatize(i) for i in nb['items']])
                note_where[h][primary] += 1
        for k, c in per_kind.items():
            sheet_count[k].append(c)
    sheets = []
    for k, c in sheet_sets.items():
        p = pct(c, n)
        unlisted['views'] += sum(1 for t in view_sets[k] if not shared(t))
        unlisted['sheet_names'] += sum(1 for t in sheet_names[k] if not shared(t))
        vs = [{'title': t, 'kind': view_kind.get((k, t), 'view'), 'sets': vc, 'pct': pct(vc, n), 'tier': tier(pct(vc, n), tiers),
               'scales': view_scale[(k, t)].most_common(3)} for t, vc in view_sets[k].most_common(60) if shared(t)][:40]
        sheets.append({'kind': k, 'name': kind_names.get(k, k.replace('_', ' ').capitalize()), 'sets': c, 'pct': p, 'tier': tier(p, tiers),
                       'position': round(statistics.median(sheet_pos[k]), 3), 'sheets_per_set': statistics.median(sheet_count[k]),
                       'numbering': sheet_prefix[k].most_common(3), 'names': [x for x in sheet_names[k].most_common(12) if shared(x[0])][:6], 'views': vs})
    sheets.sort(key=lambda x: (x['position'], -x['pct']))
    details = [{'title': t, 'sets': c, 'pct': pct(c, n), 'tier': tier(pct(c, n), tiers), 'category': (det_cat[t].most_common(1) or [['', 0]])[0][0],
                'scales': det_scale[t].most_common(3), 'library_ids': [i for i, _ in det_ids[t].most_common(3)]} for t, c in det_sets.most_common(600) if shared(t)][:400]
    unlisted['details'] = sum(1 for t in det_sets if not shared(t))
    notes = []
    for h, c in note_sets.most_common(300):
        if not shared(h):
            unlisted['note_blocks'] += 1
            continue
        variants = []
        for hsh, vc in note_var[h].most_common(4):
            variants.append({'sets': vc, 'items': note_text[(h, hsh)] if vocab[('body', h, hsh)] >= min_text_sets else None})   # wording seen in one set only stays out
        notes.append({'heading': h, 'kind': note_kind.get(h, 'notes'), 'sets': c, 'pct': pct(c, n), 'tier': tier(pct(c, n), tiers), 'items_median': statistics.median(note_items[h]),
                      'on_sheets': [k for k, _ in note_where[h].most_common(3)], 'wordings': len(note_var[h]), 'variants': variants})
    pages = sorted(s['pages'] for s in group if s['pages'])
    notes = notes[:200]
    seed_sheets = [{'kind': s['kind'], 'name': s['names'][0][0] if s['names'] else s['name'], 'views': [v['title'] for v in s['views'] if v['tier'] == 'core']}
                   for s in sheets if s['tier'] == 'core' and s['kind'] not in ('other', 'unnamed')]
    return {'sets': n, 'pages': {'min': pages[0], 'median': statistics.median(pages), 'max': pages[-1]} if pages else None,
            'attributes': {k: v.most_common() for k, v in att_counts.items()}, 'unlisted': dict(unlisted), 'sheets': sheets, 'details': details, 'notes': notes,
            'template_seed': {'sheets': seed_sheets, 'details': [d['title'] for d in details if d['tier'] == 'core'],
                              'note_blocks': [x['heading'] for x in notes if x['tier'] == 'core' and x['kind'] == 'notes'],
                              'legends_and_schedules': [x['heading'] for x in notes if x['tier'] == 'core' and x['kind'] != 'notes']}}

def cmd_build(a):
    tax = compile_tax(load_taxonomy(a.map))
    kinds = jload(os.path.join(a.map, 'sheet_kinds.json'))['kinds']
    for k in kinds:
        k['_any'] = rx(k['any']); k['_not'] = rx(k.get('not'))
    kind_names = {k['key']: k['name'] for k in kinds}
    cache = load_cache(os.path.join(a.map, '_state', 'sets.jsonl'))
    if not cache:
        raise SystemExit('Nothing read yet. Run `scan` first.')
    print('names to scrub: %d (from _state/scrub_names.json)' % load_scrub_names(a.map))
    occ, lib_ids = load_occurrences(a.root)
    unmapped = collections.Counter()
    sets = [prepare(r, occ, lib_ids, tax, kinds, unmapped) for _, r in sorted(cache.items())]
    sets = [s for s in sets if s['sheets']]       # a set with no PDF and no DWG view list has nothing to count
    # Published files hold sorted sets only. Unsorted sets (commercial jobs and the like) and any set matched by
    # local.json "exclude_from_publish" stay in sets.csv but count nowhere else, not even towards the two-set rule.
    excl = rx(LOCAL.get('exclude_from_publish'))
    for s in sets:
        s['pub'] = s['type'] != 'unsorted' and not (excl and excl.search(s['key']))
    all_sets, sets = sets, [s for s in sets if s['pub']]
    vocab = collections.Counter()                 # in how many sets each name, title, heading and note wording appears
    for s in sets:
        words = set()
        for sh in s['sheets']:
            if sh['name']:
                words.add(norm_title(sh['name']))
            for v in sh['views']:
                words.add(norm_title(v.get('title') or ''))
            for nb in sh['notes']:
                h = norm_title(nb['heading'])
                words.add(h); words.add(('body', h, text_hash('\n'.join(nb['items']))))
        vocab.update(words)
    tnames = {t['key']: t['name'] for t in tax['types']}; tnames['unsorted'] = 'Unsorted'
    vnames = {(t['key'], v['key']): v['name'] for t in tax['types'] for v in t.get('variants', [])}
    groups = collections.defaultdict(list)
    for s in sets:
        groups[(s['type'], s['variant'])].append(s); groups[(s['type'], '_all')].append(s)
    out_dir = os.path.join(a.map, 'types')
    before = set(f for f in os.listdir(out_dir) if f.endswith('.json')) if os.path.isdir(out_dir) else set()
    index, page_data = [], []
    order = {t['key']: i for i, t in enumerate(tax['types'])}
    for (tk, vk), grp in sorted(groups.items(), key=lambda kv: (order.get(kv[0][0], 999), kv[0][1] != '_all', kv[0][1])):
        if vk == '_all' and len(set(s['variant'] for s in grp)) < 2:
            continue                              # a type with one variant needs no roll-up
        ag = aggregate(grp, tax, kind_names, a.min_text_sets, vocab)
        vname = 'All variants' if vk == '_all' else vnames.get((tk, vk), vk.replace('-', ' ').capitalize())
        doc = {'schema': SCHEMA, 'type': {'key': tk, 'name': tnames.get(tk, tk)}, 'variant': {'key': vk, 'name': vname}}
        doc.update(ag)
        doc = scrub_obj(doc)                      # no names, contacts or firms in anything published
        fname = '%s__%s.json' % (tk, vk.strip('_'))
        jdump(doc, os.path.join(out_dir, fname))
        index.append({'type': tk, 'type_name': doc['type']['name'], 'variant': vk, 'variant_name': vname, 'sets': ag['sets'], 'file': 'types/' + fname,
                      'core_sheets': [s['kind'] for s in ag['sheets'] if s['tier'] == 'core']})
        page_data.append(doc)
    stale = 0
    for f in sorted(before - set(g['file'].split('/')[-1] for g in index)):      # groups that no longer exist
        try:
            os.remove(os.path.join(out_dir, f))
        except OSError:                           # some shared folders do not allow deleting: leave a marker instead
            jdump({'schema': SCHEMA, 'stale': True, 'note': 'No longer produced by build. Safe to delete. index.json lists the current files.'}, os.path.join(out_dir, f))
            stale += 1
    flags = collections.Counter(re.sub(r'\d+', 'N', f.split(':')[0]) for s in sets for f in s['flags'])
    meta = {'schema': SCHEMA, 'built': time.strftime('%Y-%m-%d %H:%M'), 'sets': len(sets), 'tiers': tax.get('tiers') or {'core': 60, 'common': 25},
            'with_dwg_views': sum(s['has_occ'] for s in sets), 'flags': flags.most_common(), 'confidence': collections.Counter(s['conf'] for s in sets).most_common(),
            'groups': index}
    jdump(meta, os.path.join(a.map, 'index.json'))
    with io.open(os.path.join(a.map, 'sets.csv'), 'w', encoding='utf-8-sig', newline='') as f:   # local review only: holds set paths
        w = csv.writer(f)
        w.writerow(['set', 'published', 'type', 'variant', 'confidence', 'matched_on', 'walls', 'stories', 'flood', 'roof', 'pages', 'sheets', 'sheets_without_kind', 'views', 'note_blocks', 'flags'])
        for s in all_sets:
            w.writerow([s['key'], 'yes' if s['pub'] else 'no', s['type'], s['variant'], s['conf'], s['why'], s['att'].get('walls', ''), s['att'].get('stories', ''), s['att'].get('flood', ''), s['att'].get('roof', ''),
                        s['pages'], len(s['sheets']), sum(1 for sh in s['sheets'] if sh['name'] and not sh['kinds']), sum(len(sh['views']) for sh in s['sheets']),
                        sum(len(sh['notes']) for sh in s['sheets']), '; '.join(s['flags'])])
    with io.open(os.path.join(a.map, 'unmapped_sheet_names.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(['sheet_name', 'sheets'])
        for nm, c in unmapped.most_common():
            w.writerow([nm, c])
    with io.open(os.path.join(a.map, 'review.html'), 'w', encoding='utf-8') as f:
        f.write(REVIEW_HTML.replace('__DATA__', json.dumps({'meta': meta, 'groups': page_data}, ensure_ascii=False).replace('</', '<\\/')))
    print('sets published: %d   left out (unsorted or excluded): %d   groups: %d   sheet names without a kind: %d' % (
        len(sets), len(all_sets) - len(sets), len(index), len(unmapped)))
    print('Wrote types/*.json, index.json, sets.csv, unmapped_sheet_names.csv, review.html in %s' % a.map)
    if stale:
        print('%d old type files could not be deleted here and were marked "stale". index.json lists the current ones.' % stale)


REVIEW_HTML = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Drawing map</title>
<style>
:root{--ink:#16213a;--mut:#5b667a;--rule:#d5dbe5;--bg:#f6f7f9;--core:#1f63d6;--common:#6f7a8c;--occ:#b9c2d0}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:var(--ink);background:var(--bg);display:grid;grid-template-columns:300px 1fr;min-height:100vh}
#side{background:#fff;border-right:1px solid var(--rule);padding:14px 10px;overflow:auto;height:100vh;position:sticky;top:0}
#side h1{font-size:16px;margin:0 6px 4px}#side p{margin:0 6px 12px;color:var(--mut);font-size:12px}
#side .t{font-weight:700;margin:12px 6px 2px;font-size:13px}#side a{display:flex;justify-content:space-between;gap:8px;padding:3px 8px;border-radius:5px;color:inherit;text-decoration:none;font-size:13px}
#side a:hover{background:var(--bg)}#side a.on{background:var(--ink);color:#fff}#side a span{color:var(--mut)}#side a.on span{color:#cdd5e3}
#main{padding:22px 28px 60px;max-width:1150px}h2{margin:0 0 2px;font-size:22px}h3{margin:26px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.06em}
.sub{color:var(--mut);margin:0 0 10px}.chips span{display:inline-block;background:#fff;border:1px solid var(--rule);border-radius:99px;padding:1px 9px;margin:0 5px 5px 0;font-size:12px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid var(--rule)}th,td{text-align:left;padding:5px 9px;border-top:1px solid var(--rule);vertical-align:top;font-size:13px}
th{background:#eef1f5;border-top:0;font-size:12px}.bar{display:inline-block;height:9px;border-radius:2px;vertical-align:middle;margin-right:6px}
.core .bar{background:var(--core)}.common .bar{background:var(--common)}.occasional .bar{background:var(--occ)}.occasional td{color:var(--mut)}
.tg{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;border-radius:3px;padding:0 5px;border:1px solid currentColor}.core .tg{color:var(--core)}.common .tg{color:var(--common)}.occasional .tg{color:#9aa4b3}
.v{color:var(--mut);font-size:12px}details{background:#fff;border:1px solid var(--rule);margin:0 0 6px;padding:6px 10px}summary{cursor:pointer;font-weight:600}
details ol{margin:8px 0 4px;padding-left:22px;font-size:13px}details li{margin-bottom:4px}.note{color:var(--mut);font-size:12px;margin:6px 0}
pre{background:#fff;border:1px solid var(--rule);padding:10px;white-space:pre-wrap;font-size:12px}
@media(max-width:800px){body{grid-template-columns:1fr}#side{height:auto;position:static}}
</style></head><body><nav id="side"></nav><main id="main"></main><script>
const D=__DATA__,esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const bar=p=>`<span class="bar" style="width:${Math.max(2,p*0.7)}px"></span>${p}%`;
function side(cur){let h=`<h1>Drawing map</h1><p>${D.meta.sets} sets, built ${esc(D.meta.built)}.<br>Core: in at least ${D.meta.tiers.core}% of sets. Common: at least ${D.meta.tiers.common}%.</p>`,last='';
 D.groups.forEach((g,i)=>{if(g.type.key!==last){h+=`<div class="t">${esc(g.type.name)}</div>`;last=g.type.key}h+=`<a href="#${i}" class="${i===cur?'on':''}">${esc(g.variant.name)}<span>${g.sets}</span></a>`});
 h+=`<div class="t">Data quality</div><a href="#q" class="${cur==='q'?'on':''}">Flags and confidence</a>`;document.getElementById('side').innerHTML=h}
function show(){const k=location.hash.slice(1),m=document.getElementById('main');if(k==='q'){side('q');m.innerHTML=`<h2>Data quality</h2><p class="sub">Counts over all sets. The set by set list is in sets.csv.</p><h3>Confidence of the type</h3><pre>${esc(D.meta.confidence.map(x=>x.join(': ')).join('\n'))}</pre><h3>Flags</h3><pre>${esc(D.meta.flags.map(x=>x.join(': ')).join('\n'))}</pre><p class="note">Sets with views read from the DWGs: ${D.meta.with_dwg_views} of ${D.meta.sets}.</p>`;return}
 const i=Math.min(D.groups.length-1,Math.max(0,+k||0)),g=D.groups[i];side(i);
 let h=`<h2>${esc(g.type.name)} · ${esc(g.variant.name)}</h2><p class="sub">${g.sets} set${g.sets===1?'':'s'}${g.pages?` · ${g.pages.min} to ${g.pages.max} sheets, typically ${g.pages.median}`:''}</p><div class="chips">`;
 for(const [a,vals] of Object.entries(g.attributes))h+=`<span>${esc(a)}: ${vals.map(v=>esc(v[0])+' ('+v[1]+')').join(', ')}</span>`;
 h+=`</div>${Object.values(g.unlisted||{}).some(x=>x)?`<p class="note">Left out because they appear in one set only: ${Object.entries(g.unlisted).filter(x=>x[1]).map(x=>x[1]+' '+x[0].replace('_',' ')).join(', ')}.</p>`:''}<h3>Sheet index</h3><table><tr><th>Sheet</th><th>In sets</th><th>Usual name and numbering</th><th>Views on it</th></tr>`;
 for(const s of g.sheets)h+=`<tr class="${s.tier}"><td><b>${esc(s.name)}</b><br><span class="tg">${s.tier}</span></td><td>${bar(s.pct)}</td><td>${esc((s.names[0]||[''])[0])}<div class="v">${s.numbering.map(x=>esc(x[0])).join(', ')}${s.sheets_per_set>1?' · '+s.sheets_per_set+' sheets':''}${s.names.length>1?'<br>also: '+s.names.slice(1,4).map(x=>esc(x[0])).join('; '):''}</div></td><td>${s.views.filter(v=>v.tier!=='occasional').slice(0,10).map(v=>esc(v.title)+` <span class="v">${v.pct}%${v.scales[0]?', '+esc(v.scales[0][0]):''}</span>`).join('<br>')||'<span class="v">none titled</span>'}</td></tr>`;
 h+=`</table><h3>Details</h3><table><tr><th>Detail</th><th>In sets</th><th>Category</th><th>Usual scale</th><th>Library ids</th></tr>`;
 for(const d of g.details.slice(0,80))h+=`<tr class="${d.tier}"><td>${esc(d.title)} <span class="tg">${d.tier}</span></td><td>${bar(d.pct)}</td><td>${esc(d.category)}</td><td>${esc((d.scales[0]||[''])[0])}</td><td class="v">${d.library_ids.map(esc).join(' ')}</td></tr>`;
 h+=`</table>${g.details.length>80?`<p class="note">${g.details.length-80} more in the JSON file.</p>`:''}<h3>Note blocks</h3>`;
 for(const n of g.notes.slice(0,60)){const v=n.variants[0];h+=`<details class="${n.tier}"><summary>${esc(n.heading)} <span class="v">${n.kind==='notes'?'':esc(n.kind)+' · '}${n.pct}% of sets · ${n.items_median} items · on ${n.on_sheets.map(esc).join(', ')} · ${n.wordings} wording${n.wordings===1?'':'s'}</span></summary>${v&&v.items?`<ol>${v.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p class="note">Most common wording, in ${v.sets} sets. Placeholders in braces replace state, year and phone.</p>`:'<p class="note">Wording seen in one set only, so it is left out of the map.</p>'}</details>`}
 h+=`<h3>Template seed</h3><p class="sub">Core sheets in their usual order, with the core views, details and note blocks. This is the starting list for a template of this type.</p><pre>${esc(JSON.stringify(g.template_seed,null,1))}</pre>`;m.innerHTML=h;scrollTo(0,0)}
addEventListener('hashchange',show);show();
</script></body></html>'''


# ------------------------------------------------------------------------------------------ command line
def main():
    ap = argparse.ArgumentParser(description='Map what drawing sets are made of.')
    ap.add_argument('--map', default=os.path.dirname(HERE), help='the _blueprint_map folder (default: the folder above tools/)')
    ap.add_argument('--root', default=None, help='the folder that holds the drawing sets (default: the folder above --map)')
    sub = ap.add_subparsers(dest='cmd')
    s = sub.add_parser('scan'); s.add_argument('--only', help='only sets whose path matches this regex'); s.add_argument('--limit', type=int, default=0)
    s.add_argument('--time-budget', type=float, default=150.0, help='stop after this many seconds; run again to continue (0 = no limit)')
    s.add_argument('--force', action='store_true', help='read again even if already read')
    b = sub.add_parser('build'); b.add_argument('--min-text-sets', type=int, default=2,
                                               help='a sheet name, view or detail title, note heading or note wording goes into the type files only if at least this many sets share it; the rest is counted under "unlisted"')
    sub.add_parser('status')
    sh = sub.add_parser('show'); sh.add_argument('key')
    a = ap.parse_args()
    a.map = os.path.abspath(a.map)
    a.root = os.path.abspath(a.root or os.path.dirname(a.map))
    load_local(a.map)
    {'scan': cmd_scan, 'build': cmd_build, 'status': cmd_status, 'show': cmd_show}.get(a.cmd, lambda _: ap.print_help())(a)

if __name__ == '__main__':
    main()
