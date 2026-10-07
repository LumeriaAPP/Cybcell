"""Download the chosen public-domain paintings from Wikimedia Commons into art/ (originals, capped)."""
import io, os, sys, urllib.request
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from commons import api, UA

ART = os.path.join(os.path.dirname(__file__), "..", "art")
os.makedirs(ART, exist_ok=True)

# key: (Commons title, max width to fetch)
PICKS = {
    "bosch_creation": ("File:El Bosco - Tríptico del Jardín de las delicias.jpg", 0),
}

def main(only):
    for key, (title, cap) in PICKS.items():
        if only and key not in only:
            continue
        dst = os.path.join(ART, key + ".jpg")
        if os.path.exists(dst):
            print("have", key); continue
        p = dict(action="query", titles=title, prop="imageinfo", iiprop="url|size")
        if cap:
            p["iiurlwidth"] = cap
        ii = list(api(**p)["query"]["pages"].values())[0]["imageinfo"][0]
        url = ii.get("thumburl") if cap and ii["width"] > cap else ii["url"]
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
        Image.open(io.BytesIO(data)).convert("RGB").save(dst, quality=95)
        print(f"got {key} {len(data)//1024}KB")


if __name__ == "__main__":
    main(sys.argv[1:])
