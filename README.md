# CybCell

**Biznesiniz üçün rəqəmsal ekosistem.**

CybCell-in rəsmi saytı. Sayt şirkətin adını hekayə kimi danışır: **CYB** (kibernetika, idarəetmə və əlaqə elmi) + **CELL** (hüceyrə, həyatın ən kiçik vahidi).

Səhifənin arxasında canlı bir hüceyrə koloniyası yaşayır. Aşağı sürüşdürdükcə koloniya dəyişir:

| Səhnə | Nə baş verir | Mənası |
| --- | --- | --- |
| Giriş | "CybCell" ulduz tozundan yazılır, sürüşdürəndə spiral qalaktikaya çevrilir | Rəqəmsal ekosistem |
| 01 Hüceyrə | Hər şey bir hüceyrəyə yığılır | Hər həll bir hüceyrədir |
| 02 Böyümə | 1 → 64 hüceyrə bölünməsi | Biznes böyüdükcə sistem də böyüyür |
| 03 İnteqrasiya | Hüceyrələr şəbəkədə siqnal ötürür | Sayt, tətbiq, e-menyu, CRM bir-birinə bağlıdır |
| 04 3D və AR | Hüceyrələr qat-qat bina tikir, bina fırlanır | 3D satış sistemi, virtual tur, AR menyu |
| 05 Marketinq | Hüceyrələrdən yüksələn satış qrafiki, artım xətti boyunca siqnallar | SMM, reklam, brendinq, analitika |
| 06 Dəstək | Virus daxil olur, hüceyrələr onu mühasirəyə alıb zərərsizləşdirir | 24/7 monitorinq və texniki dəstək |
| 07 Ekosistem | Hüceyrələr CYBCELL sözünü yazır | Hamısı birlikdə |

Giriş və hekayədə hər sürüşdürmə bir mərhələyə keçir (`src/stepper.ts`).

Kursoru hərəkət etdirəndə hüceyrələr sizə siqnal göndərir, ekrana toxunanda isə şok dalğası yaranır.

## İmkanlar

- Öz yazdığımız Canvas 2D mühərriki: bölünmə, siqnal zəncirləri, immun reaksiyası, mətnə çevrilmə. Heç bir kitabxanadan asılı deyil.
- İki dil: Azərbaycan (əsas) və ingilis dili. Seçim yadda saxlanılır.
- Həllər bölməsində hər xidmətin yanında ulduz tozu üslubunda canlı şəkil var: bloklardan yığılan sayt, bildiriş alan telefon, cavab verən süni intellekt şəbəkəsi, mərtəbəsi açılan 3D bina, satış hunisi, ödəniş qəbul edən kiosk və təhdidləri dayandıran qalxan (`src/specimen.ts`).
- "Canlı dialoq" bölməsi: hüceyrələrin bir-biri ilə danışdığı canlı terminal.
- "Adın mənası" lüğət maddəsi kimi, standartlar və həyat dövrü sakit, tipoqrafik bölmələr kimi qurulub.
- Tam responsiv (telefon, planşet, masaüstü), `prefers-reduced-motion` dəstəyi, klaviatura ilə idarəetmə, SEO və sosial şəbəkə paylaşımı üçün önizləmə şəkli.
- JS ~15 kB (gzip), heç bir runtime asılılığı yoxdur.

## Başlamaq

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ qovluğuna istehsal versiyası
npm run preview    # build-i yerli olaraq yoxlamaq
npm run build:single   # artifact/cybcell.html: bütün CSS və JS daxilində olan tək fayl
```

## Saytı yayımlamaq (GitHub Pages)

`main` budağına hər push-da `.github/workflows/deploy.yml` saytı avtomatik yığıb GitHub Pages-ə göndərir. Yalnız bir dəfə aktivləşdirmək lazımdır:

1. Repozitoriyada **Settings → Pages** bölməsinə keçin.
2. **Source** üçün **GitHub Actions** seçin.
3. **Actions** bölməsində "Deploy to GitHub Pages" işini yenidən işə salın.

Sayt `https://lumeriaapp.github.io/Cybcell/` ünvanında açılacaq. Öz domeniniz (məsələn `cybcell.az`) varsa, onu elə həmin səhifədə **Custom domain** xanasına yazın.

Build nisbi yollarla yığıldığı üçün `dist/` qovluğunu istənilən statik hostinqə (Netlify, Vercel, Cloudflare Pages) də olduğu kimi yükləmək olar.

## Məzmunu dəyişmək

| Nə | Harada |
| --- | --- |
| Azərbaycanca mətnlər | `index.html` |
| İngiliscə mətnlər | `src/i18n.ts` (açarlar `data-i18n` atributları ilə eynidir) |
| Canlı dialoqun mesajları | `src/dialogue.ts` |
| Nümunə layihələr (3D satış sistemi, AR menyu, canlı menyulu sayt) | `index.html`, `#work` bölməsi |
| E-poçt ünvanı | `index.html`, `data-email` elementi (hazırda `hello@cybcell.az`) |
| Rənglər, şriftlər (Geist, Geist Mono; qara-ağ palitra) | `src/styles.css`, ən yuxarıdakı `:root` bloku |
| Hüceyrə mühərriki və səhnələr | `src/engine/cells.ts` |
| Həllər bölməsindəki animasiyalı şəkillər | `src/specimen.ts` |
| Sosial önizləmə şəkli | `public/og.png` (1200×630) |

> Göstəricilər (24/7, <2 s, 99.9%) və e-poçt ünvanı nümunə kimi yazılıb. Onları şirkətin real məlumatları ilə yeniləyin.

## Struktur

```
index.html            səhifənin bütün bölmələri (AZ mətn)
src/main.ts           scroll → səhnə, naviqasiya, HUD, forma
src/engine/cells.ts   hüceyrə mühərriki (Canvas 2D)
src/specimen.ts       həllər bölməsindəki animasiyalı şəkillər
src/i18n.ts           dil dəyişdirici və ingiliscə mətnlər
src/dialogue.ts       canlı dialoq terminalı
src/styles.css        dizayn sistemi və layout
public/               favicon, og.png, robots.txt
```
