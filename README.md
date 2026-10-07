# CybCell

**Biznesiniz üçün rəqəmsal ekosistem.**

CybCell rəqəmsal agentliyinin rəsmi saytı.

## Sayt necə qurulub

Sayt iki hissədən ibarətdir:

1. **Qaranlıq giriş.** Hieronim Bosxun «Dünyanın yaradılışı» triptixinin bağlı qanadları (Prado, ictimai mülkiyyət) dərinlik parallaksı ilə canlanır. Aşağı sürüşdürəndə qapılar açılır və şüşə kürənin yerində canlı bir hüceyrə görünür: *In principio erat cella.*
2. **Agentlik.** Hüceyrə bölünüb çoxalanda səhifə qaradan ağa keçir. Bundan sonra sayt müasir və minimalistdir: ağ fon, qara mətn, ağ fonda qara hüceyrələr. Hüceyrə koloniyası hekayəni danışır: bölünmə (1→64), inteqrasiya şəbəkəsi, tikilən bina, artım qrafiki, təhdidə qarşı qoruma və hüceyrələrdən yığılan CYBCELL sözü. Ardınca xidmətlər, sahələr, iş prosesi, standartlar, əlaqə forması və Instagram gəlir.

Bütün animasiyalar scroll ilə idarə olunur. GSAP ScrollTrigger səhnələri, Lenis isə yumşaq sürüşməni idarə edir. `prefers-reduced-motion` açıq olanda animasiya olmur: giriş qaranlıq, qalan hissə ağ qalır.

## Başlamaq

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ qovluğuna istehsal versiyası
npm run preview    # build-i yerli olaraq yoxlamaq
```

## Saytı yayımlamaq (GitHub Pages)

`main` budağına hər push-da `.github/workflows/deploy.yml` saytı yığıb GitHub Pages-ə göndərir (Settings → Pages → Source: GitHub Actions). Build nisbi yollarla yığılır, ona görə `dist/` qovluğunu istənilən statik hostinqə də yükləmək olar.

## Məzmunu dəyişmək

| Nə | Harada |
| --- | --- |
| Azərbaycanca mətnlər | `index.html` |
| İngiliscə mətnlər | `src/i18n.ts` (açarlar `data-i18n` atributları ilə eynidir) |
| E-poçt və Instagram | `index.html` (`hello@cybcell.az`, `instagram.com/cybcell.az`), `src/main.ts` (`EMAIL`) |
| Rənglər və şriftlər | `src/styles.css`, `:root` bloku (giriş: Texturina və qızılı; sayt: Inter Tight, Inter, ağ-qara) |
| Qaradan ağa keçid | `src/scenes.ts`, `dawn()` |
| Hüceyrə mühərriki və səhnələr | `src/engine/cells.ts`, scroll bağlantısı: `src/colony.ts` |
| Giriş rəsmi və dərinlik xəritəsi | `public/art/bosch_*`; yenidən yaratmaq: `tools/fetch_art.py`, sonra `tools/make_art.py` |
| Logo, favicon və tətbiq ikonları | orijinal: `brand/cybcell-logo-source.png`; yenidən yaratmaq: `python tools/make_brand.py` → `public/brand/cybcell-mark.png`, `public/favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` |
| Sosial önizləmə şəkli | `public/og.jpg` (1200×630) |

> Göstəricilər (24/7, <2 s, 99,9%) hədəf kimi yazılıb. Onları şirkətin real məlumatları ilə yoxlayın.

## Struktur

```
index.html            səhifənin bütün bölmələri (AZ mətn)
src/main.ts           başlanğıc, mobil menyu, keçidlər, əlaqə forması
src/scenes.ts         GSAP səhnələri: qapıların açılması, qaradan ağa keçid, parallax, görünmə
src/colony.ts         scroll mövqeyini hüceyrə səhnələrinə çevirir
src/engine/cells.ts   hüceyrə mühərriki (Canvas 2D)
src/painting.ts       dərinlik xəritəli WebGL rəsm (triptixin qanadları)
src/dust.ts           girişdəki qızılı toz
src/i18n.ts           dil dəyişdirici və ingiliscə mətnlər
src/styles.css        bütün stillər
tools/                rəsmi yükləmək və dərinlik xəritəsi çıxarmaq üçün Python skriptləri
```
