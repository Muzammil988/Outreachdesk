"""Builds public/index.html from src/. Run: python3 build.py"""
import glob, os
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'src')
head = open(os.path.join(src, 'head.html')).read()
body = open(os.path.join(src, 'body.html')).read()
shim = open(os.path.join(src, 'standalone.js')).read()
js = '\n'.join(open(f).read() for f in sorted(glob.glob(os.path.join(src, 'js', '*.js'))))
app = "(() => {\n'use strict';\n" + js + "\n})();\n"
icon = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23085761'/%3E"
        "%3Cpath d='M46 18 16 31l11 4 4 11 15-28Z' fill='%23F9F3EB'/%3E%3C/svg%3E")
page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="robots" content="noindex,nofollow">\n<meta name="theme-color" content="#F9F3EB">\n'
        f'<link rel="icon" href="{icon}">\n'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0;font:14px system-ui,sans-serif;background:#F9F3EB}img{max-width:100%}[hidden]{display:none!important}</style>\n'
        + head + '\n</head>\n<body>\n' + body + '\n<script>\n' + shim + '</script>\n<script>\n' + app + '</script>\n</body>\n</html>\n')
os.makedirs(os.path.join(here, 'public'), exist_ok=True)
open(os.path.join(here, 'public', 'index.html'), 'w').write(page)
print('public/index.html', len(page.encode()), 'bytes')
