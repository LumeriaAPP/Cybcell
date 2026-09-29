# CybCell təqdimat videosu

`cybcell-launch.mp4`: 30 saniyə, 1920×1080 (2.39:1 kino kadrı), 60 fps, stereo səs, -16 LUFS (sosial şəbəkələr üçün standart səs səviyyəsi), true peak -1.5 dBTP-dən aşağı.

Montaj oyun treylerlərinin dili ilə qurulub. Qaranlıqda sistem işə düşür, işıq nöqtəsi enerji toplayır, hər böyük zərbədən əvvəl bir anlıq tam sükut olur. Keçidlər işıq çaxması, kamera silkələnməsi, anamorf lens işığı və rəng ayrılması ilə edilir. Videodakı hər şey eyni "ulduz tozu" hüceyrələrindən qurulur:

| Vaxt | Səhnə | Yazı |
| --- | --- | --- |
| 0–2 s | Qaranlıq, sistem yüklənir, xətt sönüb işıq nöqtəsinə çevrilir; sükut | CYBCELL // SİSTEM İŞƏ DÜŞÜR |
| 2 s | Zərbə: nöqtə alovlanan ulduz-hüceyrəyə çevrilir | Hər şey bir hüceyrədən başlayır. |
| 4.6–7 s | Hüceyrə 1 → 2 → 4 → 8 → 16 bölünür, soyuyub ağarır | Biz biznesinizin rəqəmsal hüceyrələrini qururuq. |
| 7–10.2 s | Zərbə; brauzer, sonra telefon | 01 Saytlar və mobil tətbiqlər. |
| 10.2–12.2 s | Neyron şəbəkə, impulslar axır | 02 Süni intellekt inteqrasiyası. |
| 12.2–15 s | Bina qat-qat tikilir, mərtəbə açılır | 03 Bina tikilməmiş satılır. |
| 15–17.4 s | Satış qrafiki yüksəlir | 04 Diqqəti satışa çeviririk. |
| 17.4–19.4 s | Kiosk, kontaktsız ödəniş, çek | 05 Kiosk, POS, ağıllı ekranlar. |
| 19.4–21.4 s | Qalxan təhdidləri dayandırır | 06 24/7 dəstək və təhlükəsizlik. |
| 21.4–22.4 s | Nəfəs: hər şey toza dağılır, səs demək olar ki, susur | Hər həll bir hüceyrədir. |
| 22.4–25.4 s | Qalaktika yaranır, sürətlənir, bir nöqtəyə çökür; sükut | Birlikdə ekosistem. |
| 25.4–30 s | Ən böyük zərbə: CybCell sözü partlayışla yaranır, kənarları isti işıqla yanır | Biznesiniz üçün rəqəmsal ekosistem. |

Səs (hamısı `tools/sound.py`-da sintez olunur, B minor):

- 31 Hz B0 sub dron;
- açılışda narahat yüksək tonlar, sistem yüklənmə siqnalları və enerji dolma səsi;
- zərbələrdə braam, sub bum və metal səs;
- bölünmədə ürək döyüntüsü;
- montajda 150 BPM ostinato;
- nəfəs anında sükut;
- sonda çöküş, ad üzərində final zərbə.

Aşağı tezliklər doyurulur ki, telefon dinamiklərində də hiss olunsun.

## Yenidən yaratmaq

Səhnə vaxtları və zərbə nöqtələri `timeline.json`-dadır, həm görüntü (`index.html`), həm səs (`tools/sound.py`) oradan oxuyur. Yazılar `index.html`-də `buildCaptions` funksiyasındadır.

```bash
pip install numpy imageio-ffmpeg        # ffmpeg bu paketlə gəlir
cd video
python3 -m http.server 8766 &            # index.html-i brauzerdə də açıb canlı baxmaq olar
python3 tools/sound.py build/sound.wav   # səs, avtomatik -16 LUFS / -1.5 dBTP
node tools/render.mjs build/video.mp4 60 # 1800 kadr, ~5 dəqiqə (Playwright lazımdır)
```

Sonra səsi videoya birləşdirin: `ffmpeg -i build/video.mp4 -i build/sound.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart cybcell-launch.mp4`.

Şrift: Geist və Geist Mono (SIL Open Font License, `fonts/LICENSE.txt`).
