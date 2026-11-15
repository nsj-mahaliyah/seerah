# Fra seerah til handling – videogenerator

**Side:** https://nsj-mahaliyah.github.io/seerah/

- **Video:** træk en episodes lydfil ind → 1080p MP4 med seriens baggrund og guld-lydsøjler der følger stemmen.
- **Diskret lydforbedring:** highpass 75 Hz, −2 dB @ 250 Hz, +1,5 dB @ 4,5 kHz, +1 dB luft, blid kompression 2,5:1, normalisering til −16 LUFS og limiter på −1,5 dBFS. Kan slås fra; før/efter-lyt.
- **Promo:** YouTube-thumbnail, story (9:16), opslag (1:1) og lodret teaser-video (30–60 sek.).

Alt kører i browseren (Chrome/Edge på computer) – intet uploades.

## Udvikling
Rediger filer i `src/` og kør `python3 build.py` for at bygge `index.html` (én selvstændig fil med fonte og mp4-muxer indlejret).
