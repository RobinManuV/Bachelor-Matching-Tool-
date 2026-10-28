"""Genera robin-airlines-standalone.html: un único archivo con CSS, JS, imágenes y fuente incrustados.

Uso (desde la carpeta robin-airlines-selector):
    python3 herramientas/generar-standalone.py

Sirve para enseñar el mockup sin servidor (se abre con doble clic) o subirlo como página suelta.
Para integrar en la web o en el portal, usa index.html + styles.css + app.js + assets/.
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIME = {'.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2'}


def data_uri(rel):
    f = ROOT / rel
    return f'data:{MIME[f.suffix]};base64,' + base64.b64encode(f.read_bytes()).decode()


def inline_assets(text):
    return re.sub(r"assets/[\w./-]+\.(?:webp|png|woff2)", lambda m: data_uri(m.group(0)), text)


html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = inline_assets((ROOT / 'styles.css').read_text(encoding='utf-8'))
js = inline_assets((ROOT / 'app.js').read_text(encoding='utf-8'))

html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}</style>')
html = html.replace('<script src="app.js"></script>', f'<script>\n{js}</script>')
html = inline_assets(html)
assert 'assets/' not in html, 'quedan rutas sin incrustar'

out = ROOT / 'robin-airlines-standalone.html'
out.write_text(html, encoding='utf-8')
print(f'{out.name}: {round(len(html) / 1024)} KB')
