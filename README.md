# CybCell

**Hüceyrələr danışır. Sistemlər yaşayır.**

CybCell-in rəsmi saytı. Sayt şirkətin adını hekayə kimi danışır: **CYB** (kibernetika, idarəetmə və əlaqə elmi) + **CELL** (hüceyrə, həyatın ən kiçik vahidi).

Səhifənin arxasında canlı bir hüceyrə koloniyası yaşayır. Aşağı sürüşdürdükcə koloniya dəyişir:

| Səhnə | Nə baş verir | Texnoloji mənası |
| --- | --- | --- |
| Giriş | Koloniya bir hüceyrədən bölünərək yaranır, hüceyrələr bir-birinə siqnal ötürür | — |
| 01 Hüceyrə | Hər şey bir hüceyrəyə yığılır | Modul arxitektura |
| 02 Bölünmə | 1 → 2 → 4 … 64, hər yeni hüceyrə valideynindən doğulur | Mikroservislər, avtomatik miqyaslanma |
| 03 Siqnal | Şəbəkə, hüceyrələr mesajı bir-birinə ötürür | API, hadisə axınları |
| 04 İmmunitet | Yad virus daxil olur, həyəcan yayılır, hüceyrələr onu mühasirəyə alıb zərərsizləşdirir | Kiber təhlükəsizlik |
| 05 Orqanizm | Hüceyrələr birləşib **CYBCELL** sözünü yazır | Süni intellekt, özünü bərpa edən sistemlər |

Kursoru hərəkət etdirəndə hüceyrələr sizə siqnal göndərir, ekrana toxunanda isə şok dalğası yaranır.

## İmkanlar

- Öz yazdığımız Canvas 2D mühərriki: bölünmə, siqnal zəncirləri, immun reaksiyası, mətnə çevrilmə. Heç bir kitabxanadan asılı deyil.
- İki dil: Azərbaycan (əsas) və ingilis dili. Seçim yadda saxlanılır.
- "Canlı dialoq" bölməsi: hüceyrələrin bir-biri ilə danışdığı canlı terminal.
- Həyati göstəricilər bölməsində EKQ monitoru, həyat dövrü bölməsində proses xətti.
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
| E-poçt ünvanı | `index.html`, `data-email` elementi (hazırda `hello@cybcell.az`) |
| Rənglər, şriftlər | `src/styles.css`, ən yuxarıdakı `:root` bloku |
| Hüceyrə mühərriki və səhnələr | `src/engine/cells.ts` |
| Sosial önizləmə şəkli | `public/og.png` (1200×630) |

> Xidmətlərin siyahısı, göstəricilər (24/7, <50 ms, 99.9%) və e-poçt ünvanı nümunə kimi yazılıb. Onları şirkətin real məlumatları ilə yeniləyin.

## Struktur

```
index.html            səhifənin bütün bölmələri (AZ mətn)
src/main.ts           scroll → səhnə, naviqasiya, HUD, forma
src/engine/cells.ts   hüceyrə mühərriki (Canvas 2D)
src/i18n.ts           dil dəyişdirici və ingiliscə mətnlər
src/dialogue.ts       canlı dialoq terminalı
src/styles.css        dizayn sistemi və layout
public/               favicon, og.png, robots.txt
```
