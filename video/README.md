# CybCell təqdimat videosu

`cybcell-launch.mp4`: 30 saniyə, 1920×1080, 60 fps, stereo səs, -16 LUFS (sosial şəbəkələr üçün standart səs səviyyəsi).

Videodakı hər şey eyni "ulduz tozu" hüceyrələrindən qurulur və səhnədən səhnəyə axır:

| Vaxt | Səhnə | Yazı |
| --- | --- | --- |
| 0–3 s | Qaranlıqdan nöqtələr toplanıb bir hüceyrə yaradır | Hər şey bir hüceyrədən başlayır. |
| 3–6 s | Hüceyrə 1 → 2 → 4 → 8 → 16 bölünür | Biz biznesinizin rəqəmsal hüceyrələrini qururuq. |
| 6–9 s | Hüceyrələr brauzerə, sonra telefona çevrilir | 01 Saytlar və mobil tətbiqlər. |
| 9–12 s | Neyron şəbəkə, impulslar axır | 02 Süni intellekt inteqrasiyası. |
| 12–15.5 s | Bina qat-qat tikilir, mərtəbə açılır | 03 Bina tikilməmiş satılır. |
| 15.5–19 s | Satış qrafiki yüksəlir | 04 Diqqəti satışa çeviririk. |
| 19–21 s | Kiosk, kontaktsız ödəniş, çek | 05 Kiosk, POS, ağıllı ekranlar. |
| 21–23 s | Qalxan təhdidləri dayandırır | 06 24/7 dəstək və təhlükəsizlik. |
| 23–26.5 s | Hər şey qalaktikaya çevrilir | Hər həll bir hüceyrədir. Birlikdə ekosistem. |
| 26.5–30 s | Qalaktika CybCell sözünə yığılır | Biznesiniz üçün rəqəmsal ekosistem. |

## Yenidən yaratmaq

Mətn, vaxt və ya səhnəni dəyişmək üçün `index.html` (görüntü, yazılar `CAPS` siyahısındadır) və `tools/sound.py` (səs) fayllarını redaktə edin.

```bash
pip install numpy imageio-ffmpeg        # ffmpeg bu paketlə gəlir
cd video
python3 -m http.server 8766 &            # index.html-i brauzerdə də açıb canlı baxmaq olar
python3 tools/sound.py build/sound.wav   # səs
node tools/render.mjs build/video.mp4 60 # 1800 kadr, ~4 dəqiqə (Playwright lazımdır)
```

Sonra səsi -16 LUFS-a normallaşdırıb videoya birləşdirin (ffmpeg `loudnorm`, iki keçid).

Şrift: Geist və Geist Mono (SIL Open Font License, `fonts/LICENSE.txt`).
