# BR 218 Allgäu — End of Era Video Design Doc
Date: 2026-04-12

## Concept
End-of-era video for the BR 218 on the Munich-Oberstdorf Allgäu route. Same emotional formula as BR 101.
The ICE L (Vectron DualMode + Talgo) takes over the route on 11 July 2026, ending 58 years of BR 218
on this service. First units in service 1968 (built 1968–1979, Krauss-Maffei/MaK).
Source: lok-report.de "Abschied vom Diesel-EC und vom Alex im Allgäu", eisenbahnseite.de BR 218.

## Verified Facts Used in Copy
- Year of first service: 1968 (confirmed)
- Route retirement date: July 2026 (July 11, 2026 cited in lok-report.de)
- Fleet number in footage: 218 411-7 (confirmed from frame extraction)
- Speed on card: 140 km/h (shown on app card)
- Power on card: 2,060 HP (shown on app card)
- Rarity on card: RARE (shown on app card)

## Asset Identity Table
| Clip | File | Subject | Location |
|------|------|---------|---------|
| Hook + closer | DB 218 411-7 erreicht Immenstadt im Allgäu mit dem IC nach Oberstdorf #br218.mp4 | BR 218 (218 411-7), red DB livery | Immenstadt im Allgäu station, Alps backdrop |
| Card reveal | ScreenRecording_04-12-2026 14-54-06_1.mp4 | DB Class 218 RARE card | In-app reveal, 23s–25s |
| End screen | ~/Projects/locosnap/docs/assets/locosnap_end_screen.mp4 | Standard end screen | — |

All footage is from Immenstadt im Allgäu — single location, consistent visual language.

## Character Count Checks (720px width, Arial Black)
Based on BR 101 experience: 9 chars clips at 110px. Safe limit for 110px = 8 chars. All text at 90px.

| Text | Chars | Fontsize |
|------|-------|----------|
| SEIT 1968 | 9 | 90px ✓ (under 11-char 90px limit) |
| BALD WEG | 8 | 90px ✓ |
| NUR NOCH | 8 | 90px ✓ |
| 3 MONATE | 8 | 90px ✓ |
| JULI 2026 | 9 | 90px ✓ |
| SCHLUSS | 7 | 90px ✓ |

## Video Structure (DE) — 10s, 720x1280, silent
| Timecode | Clip | Source timestamp | Text overlay |
|----------|------|-----------------|-------------|
| 0:00–0:02 | Immenstadt wide (Alps + station sign visible) | 0s–2s | SEIT 1968 / BALD WEG (90px, yellow #FFFF00) |
| 0:02–0:04 | Immenstadt approaching (both trains visible) | 2s–4s | NUR NOCH / 3 MONATE (90px, yellow #FFFF00) |
| 0:04–0:06 | Card reveal | 23s–25s from SR2 | — |
| 0:06–0:08 | Immenstadt close-up (218 411-7 face, number readable) | 9s–11s | JULI 2026 / SCHLUSS (90px, yellow #FFFF00) |
| 0:08–0:10 | End screen | full | Standard |

## Captions (DE TikTok)
Die BR 218 zieht seit 1968 durch das Allgäu. Ab Juli 2026 ist Schluss — der ICE L übernimmt.
LocoSnap erkennt sie noch. Aber nicht mehr lange.

#eisenbahn #br218 #deutschebahn #allgäu #zugabschied #locosnap #züge #trainspotting

## Captions (EN TikTok — optional, post DE first)
Germany's BR 218 diesel has worked the Allgäu mountains since 1968. In July 2026, it's over.
LocoSnap still knows her. For now.

#trains #railway #germanrailways #br218 #deutschebahn #locosnap #trainspotting #diesel

## Build Notes
- All source clips are 1080x1920; scale down to 720x1280
- Immenstadt clip is 60fps — normalise to 30fps during encode
- Screen recording is 1206x2622 — crop to 1206x2144 centred (crop 239px top and bottom), scale to 720x1280
- Use -an (no audio) — music added at posting time
- Verify output duration is exactly 10.0s with ffprobe after concat
