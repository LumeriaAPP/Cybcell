"""Wikimedia Commons helper: search files and show size, or download chosen files.
  python tools/commons.py search "query" [...]
  python tools/commons.py info "File:..." [...]
"""
import sys, json, urllib.request, urllib.parse

UA = {"User-Agent": "CybCellSite/1.0 (contact: hello@cybcell.az)"}
API = "https://commons.wikimedia.org/w/api.php"

def api(**p):
    p["format"] = "json"
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(p), headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=60))

def info(titles):
    out = {}
    for i in range(0, len(titles), 40):
        r = api(action="query", titles="|".join(titles[i:i + 40]), prop="imageinfo",
                iiprop="url|size|mime|extmetadata", iiextmetadatafilter="LicenseShortName|Artist|DateTimeOriginal")
        for pg in r["query"]["pages"].values():
            ii = (pg.get("imageinfo") or [{}])[0]
            out[pg["title"]] = ii
    return out

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "search":
        for q in args:
            r = api(action="query", list="search", srnamespace=6, srlimit=10, srsearch=q)
            titles = [s["title"] for s in r["query"]["search"] if not s["title"].lower().endswith((".pdf", ".djvu"))]
            print("===", q)
            for t, ii in info(titles).items():
                lic = ii.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "?")
                print(f"  {ii.get('width')}x{ii.get('height')} {ii.get('size', 0)//1024}KB [{lic}] {t}")
    elif cmd == "info":
        for t, ii in info(args).items():
            print(t, ii.get("width"), ii.get("height"), ii.get("size"), ii.get("url"))

def thumbs(titles, width, outdir):
    import os
    os.makedirs(outdir, exist_ok=True)
    paths = []
    for i in range(0, len(titles), 40):
        r = api(action="query", titles="|".join(titles[i:i + 40]), prop="imageinfo", iiprop="url", iiurlwidth=width)
        for pg in r["query"]["pages"].values():
            ii = (pg.get("imageinfo") or [{}])[0]
            u = ii.get("thumburl") or ii.get("url")
            if not u:
                print("missing", pg["title"]); continue
            name = os.path.join(outdir, str(abs(hash(pg["title"])) % 10**8) + ".jpg")
            urllib.request.urlretrieve if False else None
            data = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()
            open(name, "wb").write(data)
            paths.append((pg["title"], name))
    return paths
