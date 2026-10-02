# CybCell

**Biznesiniz üçün rəqəmsal ekosistem.**

CybCell-in rəsmi saytı. Sayt şirkətin adını hekayə kimi danışır: **CYB** (kibernetika, idarəetmə və əlaqə elmi) + **CELL** (hüceyrə, həyatın ən kiçik vahidi).

Səhifənin arxasında canlı bir hüceyrə koloniyası yaşayır. Aşağı sürüşdürdükcə koloniya dəyişir:

| Səhnə | Nə baş verir | Mənası |
| --- | --- | --- |
| Giriş | Hüceyrələr bir dəfə CybCell loqosuna yığılır | Rəqəmsal ekosistem |
| 01 Hüceyrə | Bir hüceyrə canlanır | Hər həll bir hüceyrədir |
| 02 Əlaqə | Hüceyrələr şəbəkədə siqnal ötürür | Sayt, tətbiq, e-menyu, CRM bir-birinə bağlıdır |
| 03 Ekosistem | Hüceyrələr vahid sistem yaradır | Hamısı birlikdə |

“Adın mənası” bölməsinin arxasında seyrək, xırda ulduzlar görünür. Şriftlər saytın öz fayllarından yüklənir, Google Fonts sorğusu tələb olunmur.

Səhifə brauzerin təbii sürüşdürməsindən istifadə edir. Girişdən sonra sakit keçidlər və kartlarda incə hover reaksiyaları var; mobil cihazlarda effektlər yüngülləşir, azaldılmış hərəkət seçimi aktiv olduqda statik görünüş göstərilir.

Giriş animasiyası tamamlandıqdan və səhnə keçidləri bitdikdən sonra Canvas yenidən çəkilmir; bu, mobil cihazlarda əlavə yükü azaldır.

## İmkanlar

- Öz yazdığımız Canvas 2D mühərriki: loqoya yığılan hüceyrələr və üç sakit hekayə səhnəsi. Heç bir kitabxanadan asılı deyil.
- İki dil: Azərbaycan (əsas) və ingilis dili. Seçim yadda saxlanılır.
- Həllər bölməsində xidmət seçildikdə ulduz tozu üslubunda statik təsvir göstərilir: bloklardan yığılan sayt, bildiriş alan telefon, cavab verən süni intellekt şəbəkəsi, mərtəbəsi açılan 3D bina, satış hunisi, ödəniş qəbul edən kiosk və təhdidləri dayandıran qalxan (`src/specimen.ts`).
- "Canlı dialoq" bölməsi: masaüstündə sakit aralıqlarla yenilənən terminal; mobil cihazlarda və azaldılmış hərəkət rejimində statik nümunə.
- "Adın mənası" lüğət maddəsi kimi, standartlar və həyat dövrü sakit, tipoqrafik bölmələr kimi qurulub.
- Tam responsiv (telefon, planşet, masaüstü), `prefers-reduced-motion` dəstəyi, klaviatura ilə idarəetmə, SEO və sosial şəbəkə paylaşımı üçün önizləmə şəkli.
- Heç bir runtime kitabxanasından asılı deyil.

## Başlamaq

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ qovluğuna istehsal versiyası
npm run preview    # build-i yerli olaraq yoxlamaq
npm run build:single   # artifact/cybcell.html: bütün CSS və JS daxilində olan tək fayl
```

## Brauzer yoxlamaları

```bash
npx playwright install chromium  # ilk dəfə
npm run test:e2e
```

Sistem Chromium-u varsa, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` ilə onun yolunu göstərin. Testlər iki yerli dev server başladır və Formspree cavablarını simulyasiya edir; real mesaj göndərilmir. Mobil ölçülər, dil seçimi, təbii sürüşdürmə, animasiyanın dayanması və formanın uğur/xəta halları yoxlanılır.

## Saytı yayımlamaq (GitHub Pages)

`main` budağına hər push-da `.github/workflows/deploy.yml` saytı avtomatik yığıb GitHub Pages-ə göndərir. Yalnız bir dəfə aktivləşdirmək lazımdır:

1. Repozitoriyada **Settings → Pages** bölməsinə keçin.
2. **Source** üçün **GitHub Actions** seçin.
3. **Actions** bölməsində "Deploy to GitHub Pages" işini yenidən işə salın.

Sayt `https://lumeriaapp.github.io/Cybcell/` ünvanında açılacaq. Öz domeniniz (məsələn `cybcell.az`) varsa, onu elə həmin səhifədə **Custom domain** xanasına yazın.

Build nisbi yollarla yığıldığı üçün `dist/` qovluğunu istənilən statik hostinqə (Netlify, Vercel, Cloudflare Pages) də olduğu kimi yükləmək olar.

## Əlaqə formasını qoşmaq (Formspree)

Forma mesajları HTTPS üzərindən Formspree-yə göndərir. Göndəriş yalnız xidmətin uğurlu cavabından sonra təsdiqlənir. Xəta və ya 15 saniyəlik gözləmə limiti zamanı yazılanlar saxlanılır; təkrar göndəriş və birbaşa e-poçtla əlaqə mümkündür. Endpoint təyin edilməyibsə, forma bunu açıq bildirir və e-poçt ünvanını göstərir.

1. [Formspree](https://formspree.io/) hesabında yeni forma yaradın, mesajları qəbul edəcək e-poçt ünvanını təsdiqləyin və saytın domeninə aid məhdudiyyətləri yoxlayın.
2. Yerli inkişaf üçün `.env.example` faylını `.env.local` adı ilə kopyalayın və açıq forma ünvanını daxil edin:

   ```dotenv
   VITE_CONTACT_ENDPOINT=https://formspree.io/f/FORM_ID
   ```

3. GitHub Pages üçün **Settings → Secrets and variables → Actions → Variables** bölməsində `VITE_CONTACT_ENDPOINT` adlı repository variable yaradın. Dəyər həmin açıq forma ünvanı olmalıdır. Deploy workflow bu dəyişəni build-ə ötürür.
4. Dəyişiklikdən sonra dev serveri yenidən başladın və ya saytı yenidən build/deploy edin. `VITE_` dəyişənləri build zamanı daxil edilir; artıq yayımlanmış fayllar öz-özünə yenilənmir.
5. Yayımlanmış saytdan sınaq mesajını göndərin, uğur bildirişini və Formspree panelində mesajın qəbulunu yoxlayın.

`VITE_CONTACT_ENDPOINT` yalnız `https://formspree.io/f/…` ünvanı qəbul edir və yayımlanmış JavaScript-də görünür. Buraya gizli API açarı, hesab parolu və ya şəxsi token yazmayın. `.env.local` Git tərəfindən nəzərə alınmır. Forma istifadəçinin poçt proqramını avtomatik açmır; alternativ e-poçt keçidi yalnız kliklə açılır.

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
src/main.ts           scroll → səhnə, naviqasiya, HUD
src/contact.ts        Formspree göndərişi, yoxlama, əlaqə vəziyyətləri
src/engine/cells.ts   hüceyrə mühərriki (Canvas 2D)
src/specimen.ts       həllər bölməsindəki animasiyalı şəkillər
src/i18n.ts           dil dəyişdirici və ingiliscə mətnlər
src/dialogue.ts       canlı dialoq terminalı
src/styles.css        dizayn sistemi və layout
public/               favicon, og.png, robots.txt
```
