"""Bygger index.html (én selvstændig fil) fra src/."""
import base64, os
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, "src")
fonts = [("Amiri", 700, "amiri-arabic-700-normal.woff2"),
         ("Cormorant Garamond", 600, "cormorant-garamond-latin-600-normal.woff2"),
         ("Cormorant Garamond", 700, "cormorant-garamond-latin-700-normal.woff2"),
         ("Cinzel", 600, "cinzel-latin-600-normal.woff2"),
         ("Cinzel", 700, "cinzel-latin-700-normal.woff2")]
css = "".join(
    f"@font-face{{font-family:'{n}';font-weight:{w};font-style:normal;font-display:block;src:url(data:font/woff2;base64,"
    f"{base64.b64encode(open(os.path.join(src, 'fonts', f), 'rb').read()).decode()}) format('woff2')}}\n" for n, w, f in fonts)
html = open(os.path.join(src, "shell.html")).read()
html = html.replace("/*FONTS*/", css).replace("/*MUXER*/", open(os.path.join(src, "vendor", "mp4-muxer.js")).read())
html = html.replace("/*APP*/", open(os.path.join(src, "scenes.js")).read() + "\n" + open(os.path.join(src, "app.js")).read())
open(os.path.join(here, "index.html"), "w").write(html)
print("index.html", len(html), "bytes")
