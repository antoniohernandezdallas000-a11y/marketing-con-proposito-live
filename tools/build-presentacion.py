#!/usr/bin/env python3
"""Arma public/presentacion.html a partir de las diapositivas en slides/ y slides/deck.json.

Uso:  python3 tools/build-presentacion.py
Si cambias alguna diapositiva (exportándola de nuevo), vuelve a correr este script.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLIDES = os.path.join(ROOT, "slides")
OUT = os.path.join(ROOT, "public", "presentacion.html")

# Imágenes guardadas en la presentación original → archivos locales en public/img/
IMAGENES = {
    "276272c8f2c6607213834cb84cba9e28": "img/foto-manuel.png",
    "183876cb907106c1275e3cc36e98bb62": "img/logo-sumaspro.png",
    "e220a900992d4a9123eadb3887eeff4c": "img/marcas/mexc.png",
    "38722551bba306db93abe831d3c295e0": "img/marcas/buen-dia-cbo.png",
    "36efa7b99fbce47aebb2fa1f01abbcef": "img/marcas/mana-fastfood.png",
    "99ff2ce2286de3b6f9520e1ed783b536": "img/marcas/dores.png",
    "7ca10413603e772bad01dcd0ae1d33c2": "img/marcas/jac-ciudad-bolivar.png",
    "30cfbc3986566ed2ae46249abe7ec091": "img/marcas/nova-vision.png",
    "af26abd866755f2efab00e3979428938": "qr.svg",  # QR dinámico que genera el servidor
}

deck = json.load(open(os.path.join(SLIDES, "deck.json"), encoding="utf-8"))
links = "\n".join(f'<link rel="stylesheet" href="{f["href"]}">' for f in deck["faces"].values())

partes = []
for sid in deck["order"]:
    html = open(os.path.join(SLIDES, sid + ".html"), encoding="utf-8").read().strip()
    html = re.sub(r"<aside>.*?</aside>", "", html, flags=re.S)  # notas del orador fuera
    for blob, local in IMAGENES.items():
        html = html.replace("/_blob/" + blob, local)
    html = html.replace("Código QR que enlaza a claude.ai/artifact/NMEWGfuP4gc8fMBN5HSKtF", "Código QR que abre la app del taller")
    partes.append(html)

doc = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{deck["title"]} · Presentación</title>
{links}
<style>
html,body{{margin:0;height:100%;background:#0F0B22;overflow:hidden}}
#stage{{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center center}}
#stage > section{{position:absolute;inset:0;width:1920px;height:1080px;box-sizing:border-box;overflow:hidden;opacity:0;pointer-events:none;transition:opacity .35s ease;font-family:'Inter',Arial,sans-serif}}
#stage > section.on{{opacity:1;pointer-events:auto}}
#stage > section:not([style*="display"]){{display:flex;flex-direction:column}}
#stage section *{{box-sizing:border-box;margin:0}}
#stage > section > *:not([style*="position"]){{position:relative}}
#stage section div:not([style*="display"]){{display:flex;flex-direction:column}}
#stage section h1{{font-size:96px;font-weight:600;line-height:1.1}}
#stage section h2{{font-size:64px;font-weight:600;line-height:1.15}}
#stage section h3{{font-size:44px;font-weight:600;line-height:1.2}}
#stage section p{{font-size:32px;line-height:1.4}}
#stage section img{{display:block}}
#stage section svg{{flex:none}}
#stage section ol,#stage section ul{{padding-left:36px}}
.poll-fill{{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(107,43,255,.22);transition:width .9s cubic-bezier(.2,.8,.2,1);z-index:0;pointer-events:none}}
@keyframes bump{{0%{{transform:scale(1)}}40%{{transform:scale(1.12)}}100%{{transform:scale(1)}}}}
.bump{{animation:bump .5s ease}}
#counter{{position:fixed;right:16px;bottom:12px;font:700 13px 'Courier Prime',monospace;color:#8F84C9;letter-spacing:2px;opacity:.6}}
</style>
</head>
<body>
<div id="stage">
{chr(10).join(partes)}
</div>
<div id="counter"></div>
<script src="/socket.io/socket.io.js"></script>
<script src="js/deck.js"></script>
</body>
</html>
"""
open(OUT, "w", encoding="utf-8").write(doc)
print("Listo:", OUT, f"({len(deck['order'])} diapositivas)")
