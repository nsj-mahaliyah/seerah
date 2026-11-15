# Profetens liv – Islam i praksis · videogenerator

**Side:** https://nsj-mahaliyah.github.io/seerah/ · Serie: Profetens liv – Islam i praksis

- **Video:** træk en episodes lydfil ind → 1080p MP4 med seriens baggrund og guld-lydsøjler der følger stemmen.
- **Diskret lydforbedring:** highpass 75 Hz, −2 dB @ 250 Hz, +1,5 dB @ 4,5 kHz, +1 dB luft, blid kompression 2,5:1, normalisering til −16 LUFS og limiter på −1,5 dBFS. Kan slås fra; før/efter-lyt.
- **Promo:** YouTube-thumbnail, story (9:16), opslag (1:1) og lodret teaser med streg-animationer (Profeten ﷺ og sahaba vises aldrig) og rolig lydflade uden musik.
- **Automatisk teaser:** gratis talegenkendelse i browseren (whisper-small via transformers.js), udvælger de stærkeste sætninger og klipper til 30/45/60 sek. Scene vises kun ved sikkert emne-match – ellers skrivemaskine-tekst. Nasheed (upload, gemmes lokalt) dæmpes under talen.
- **YouTube:** kapitler med "Markér her", færdig titel og beskrivelse til at kopiere.

Alt kører i browseren (Chrome/Edge på computer) – intet uploades.

## Udvikling
Rediger filer i `src/` og kør `python3 build.py` for at bygge `index.html` (én selvstændig fil med fonte og mp4-muxer indlejret).
