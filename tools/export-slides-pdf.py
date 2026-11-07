#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Exportador de las 31 diapositivas a un archivo PDF de alta resolución (1920x1080 apaisado).
Usa Chrome headless nativo de Windows.
"""
import os, sys, json, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLIDES = os.path.join(ROOT, "slides")
PUBLIC = os.path.join(ROOT, "public")
HTML_OUT = os.path.join(PUBLIC, "presentacion-pdf.html")
PDF_LOCAL = os.path.join(PUBLIC, "Marketing-con-Proposito-Presentacion-31-Slides.pdf")
USER_DOWNLOADS = os.path.join(os.path.expanduser("~"), "Downloads")
PDF_DOWNLOADS = os.path.join(USER_DOWNLOADS, "Marketing-con-Proposito-Presentacion-31-Slides.pdf")

# Iconos de deck.js en formato SVG
ICONS = {
    "Play": '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/>',
    "Search": '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    "Chat": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "Users": '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "Warning": '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    "CheckCircle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    "Lightbulb": '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z"/>',
    "Verified": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    "Trust": '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
    "Clock": '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    "Star": '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    "Book": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    "Tool": '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    "ThumbsUp": '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
    "Chart": '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    "Check": '<polyline points="20 6 9 17 4 12"/>',
    "Activity": '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    "Lightning": '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
}

def replace_x_icons(html):
    def repl(m):
        full = m.group(0)
        name_m = re.search(r'name=["\']([^"\']+)["\']', full)
        style_m = re.search(r'style=["\']([^"\']+)["\']', full)
        name = name_m.group(1) if name_m else ""
        style = style_m.group(1) if style_m else ""
        w_m = re.search(r'width:\s*(\d+)px', style)
        w = w_m.group(1) if w_m else "48"
        h_m = re.search(r'height:\s*(\d+)px', style)
        h = h_m.group(1) if h_m else w
        c_m = re.search(r'(?:^|;)\s*color:\s*([^;]+)', style)
        c = c_m.group(1) if c_m else "currentColor"
        inner = ICONS.get(name, "")
        return f'<svg viewBox="-6 -6 36 36" width="{w}" height="{h}" fill="none" stroke="{c}" color="{c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">{inner}</svg>'
    return re.sub(r'<x-icon\b[^>]*>.*?</x-icon>|<x-icon\b[^>]*/>', repl, html, flags=re.S)

IMAGENES = {
    "276272c8f2c6607213834cb84cba9e28": "img/foto-manuel.png",
    "183876cb907106c1275e3cc36e98bb62": "img/logo-sumaspro.png",
    "e220a900992d4a9123eadb3887eeff4c": "img/marcas/mexc.png",
    "38722551bba306db93abe831d3c295e0": "img/marcas/buen-dia-cbo.png",
    "36efa7b99fbce47aebb2fa1f01abbcef": "img/marcas/mana-fastfood.png",
    "99ff2ce2286de3b6f9520e1ed783b536": "img/marcas/dores.png",
    "7ca10413603e772bad01dcd0ae1d33c2": "img/marcas/jac-ciudad-bolivar.png",
    "30cfbc3986566ed2ae46249abe7ec091": "img/marcas/nova-vision.png",
    " 31cfbc3986566ed2ae46249abe7ec091": "img/marcas/nova-vision.png",
    "af26abd866755f2efab00e3979428938": "qr.svg",
}

deck = json.load(open(os.path.join(SLIDES, "deck.json"), encoding="utf-8"))
links = "\n".join(f'<link rel="stylesheet" href="{f["href"]}">' for f in deck["faces"].values())

slide_divs = []
for idx, sid in enumerate(deck["order"], 1):
    html = open(os.path.join(SLIDES, sid + ".html"), encoding="utf-8").read().strip()
    html = re.sub(r"<aside>.*?</aside>", "", html, flags=re.S)
    for blob, local in IMAGENES.items():
        html = html.replace("/_blob/" + blob, local)
    html = html.replace("Código QR que enlaza a claude.ai/artifact/NMEWGfuP4gc8fMBN5HSKtF", "Código QR del taller")
    html = replace_x_icons(html)
    
    # Envolver en un contenedor que garantice 1920x1080 por página
    slide_divs.append(f'<div class="slide-page" id="page-{idx}">\n{html}\n</div>')

doc = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Marketing con Propósito · Slides PDF</title>
{links}
<style>
@page {{
  size: 1920px 1080px;
  margin: 0;
}}
html, body {{
  margin: 0;
  padding: 0;
  background: #0F0B22;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}}
.slide-page {{
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  font-family: 'Inter', Arial, sans-serif;
  background: #0F0B22;
}}
.slide-page > section {{
  position: absolute;
  inset: 0;
  width: 1920px;
  height: 1080px;
  box-sizing: border-box;
  overflow: hidden;
  display: flex !important;
  flex-direction: column;
  opacity: 1 !important;
}}
.slide-page section * {{
  box-sizing: border-box;
  margin: 0;
}}
.slide-page section div:not([style*="display"]) {{
  display: flex;
  flex-direction: column;
}}
.slide-page section img {{
  display: block;
}}
.slide-page section svg {{
  flex: none;
}}
.slide-page section ol, .slide-page section ul {{
  padding-left: 36px;
}}
</style>
</head>
<body>
{''.join(slide_divs)}
</body>
</html>
"""

open(HTML_OUT, "w", encoding="utf-8").write(doc)
print(f"Generado HTML imprimible con {len(deck['order'])} diapositivas: {HTML_OUT}")

# Generar PDF con Chrome Headless
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(chrome_path):
    chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

print(f"Usando navegador: {chrome_path}")
file_url = "file:///" + HTML_OUT.replace("\\", "/")

cmd = [
    chrome_path,
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={PDF_DOWNLOADS}",
    file_url
]

print("Compilando PDF a resolución completa 1920x1080...")
res = subprocess.run(cmd, capture_output=True, text=True)

# Copiar también a public/ para descarga web
if os.path.exists(PDF_DOWNLOADS):
    import shutil
    shutil.copyfile(PDF_DOWNLOADS, PDF_LOCAL)
    size_mb = os.path.getsize(PDF_DOWNLOADS) / (1024 * 1024)
    print(f"✓ PDF creado exitosamente en Descargas: {PDF_DOWNLOADS} ({size_mb:.2f} MB)")
    print(f"✓ Copia local disponible en: {PDF_LOCAL}")
else:
    print("Error: No se encontró el PDF generado.")
    print("Stdout:", res.stdout)
    print("Stderr:", res.stderr)
