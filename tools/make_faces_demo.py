"""Demo placeholders for the "İşlədiyimiz Üzlər" page: ten neutral silhouette portraits and
public/data/faces.json. Replace them with real people (photo + name + handle) from the admin
later; the page reads only faces.json, so nothing else has to change.
"""
import json, math, os

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "public", "faces")
CATS = ["Lifestyle", "Moda", "Gözəllik", "Qida", "Səyahət", "İdman", "Texnologiya", "Avtomobil", "Musiqi", "Biznes"]

def portrait(i):
    """A soft studio silhouette: head, neck and shoulders lit from one side."""
    t1 = 0.86 - (i % 5) * 0.05
    t2 = t1 - 0.2
    g = lambda v: f"#{int(v*255):02x}{int(v*253):02x}{int(v*248):02x}"
    hx = 200 + ((i * 7) % 5 - 2) * 4          # small pose shifts
    hy = 205 + (i % 3) * 5
    sw = 150 + (i % 4) * 10                    # shoulder half-width
    lx = 0.25 + (i % 4) * 0.15                 # key light side
    hair = [
        f"M{hx-58} {hy-8} C{hx-62} {hy-70} {hx+62} {hy-74} {hx+58} {hy-6} C{hx+52} {hy-44} {hx-48} {hy-50} {hx-58} {hy-8}Z",
        f"M{hx-60} {hy+30} C{hx-80} {hy-90} {hx+80} {hy-92} {hx+60} {hy+30} C{hx+58} {hy-34} {hx-56} {hy-36} {hx-60} {hy+30}Z",
        f"M{hx-56} {hy-14} C{hx-40} {hy-80} {hx+70} {hy-70} {hx+60} {hy+4} C{hx+30} {hy-40} {hx-20} {hy-30} {hx-56} {hy-14}Z",
    ][i % 3]
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
  <defs>
    <radialGradient id="bg" cx="{lx:.2f}" cy="0.3" r="0.95">
      <stop offset="0" stop-color="{g(t1)}"/><stop offset="1" stop-color="{g(t2)}"/>
    </radialGradient>
    <linearGradient id="body" x1="{lx:.2f}" y1="0" x2="{1-lx:.2f}" y2="1">
      <stop offset="0" stop-color="#3a3936"/><stop offset=".55" stop-color="#1d1c1a"/><stop offset="1" stop-color="#121210"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="400" height="500" fill="url(#bg)"/>
  <ellipse cx="{hx+18}" cy="{hy+190}" rx="{sw+20}" ry="120" fill="#000" opacity=".18" filter="url(#soft)"/>
  <g fill="url(#body)">
    <path d="M{hx-sw} 500 C{hx-sw+6} {hy+170} {hx-70} {hy+122} {hx-26} {hy+106} L{hx+26} {hy+106} C{hx+70} {hy+122} {hx+sw-6} {hy+170} {hx+sw} 500Z"/>
    <path d="M{hx-26} {hy+40} L{hx+26} {hy+40} L{hx+30} {hy+112} Q{hx} {hy+128} {hx-30} {hy+112}Z"/>
    <ellipse cx="{hx}" cy="{hy}" rx="52" ry="64"/>
    <path d="{hair}"/>
  </g>
  <text x="28" y="54" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="600" fill="#fff" fill-opacity=".92">{i+1:02d}</text>
  <text x="372" y="50" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" letter-spacing="3" fill="#fff" fill-opacity=".8">DEMO</text>
</svg>
"""

faces = []
for i in range(10):
    name = f"demo-{i+1:02d}.svg"
    open(os.path.join(OUT, name), "w", encoding="utf-8").write(portrait(i))
    faces.append({
        "name": f"Demo üz {i+1:02d}",
        "category": CATS[i],
        "handle": f"@demo{i+1:02d}",
        "instagram": "",
        "photo": f"faces/{name}",
        "demo": True,
    })
json.dump({"_note": "Hər üz: name, category, handle, instagram (tam link, boş ola bilər), photo (public/ qovluğuna nisbətən yol). Admin paneldən bu fayl yenilənəcək.", "faces": faces},
          open(os.path.join(ROOT, "public", "data", "faces.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok", len(faces))
