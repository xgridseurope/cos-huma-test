# M2 real-device test checklist (muscles, textbook p.27)

Fill one copy per device. Headless (emulated) results are kept separately in `test-results/headless/` and must not be copied here.

Device: ____________  OS version: ________  Browser + version: ________  Date: ________  Tester: ________
URL: https://xgridseurope.github.io/cos-huma-test/3d/musculatura.html

## 0. Diagnostics
| # | Check | Pass if | Result |
|---|---|---|---|
| D1 | Open the URL | Red muscle body visible; ⚙︎ panel shows `model: glb` | |
| D2 | ⚙︎ → ▶ FPS 5 s, keep still | ≥ 30 (Android), ≥ 50 (iPad) · note "cossos: 1 or 2" | |
| D3 | ⚙︎ panel | context lost: no | |

## 1. Layout
| # | Check | Pass if | Result |
|---|---|---|---|
| L1 | Phone portrait | One body; Davant shows 9 names, Darrere shows 6 | |
| L2 | iPad landscape / computer | Two bodies (front left, back right) and all 15 names, as on p.27 | |
| L3 | "👥 Davant + darrere" button | Switches between one body and two | |
| L4 | Names readable at ≈35 cm, none overlapping or cut | | |
| L5 | Names exactly as in the book (lower case, accents) | 15/15 | |

## 2. Lines and tapping
| # | Check | Pass if | Result |
|---|---|---|---|
| T1 | Each line ends on the muscle it names (front names → front body, back names → back body) | 15/15 | |
| T2 | Tap each name label | That muscle lights up (both sides) | __/15 |
| T3 | Tap each labelled muscle on the body | Correct muscle ≥ 13/15 | __/15 |
| T4 | Small muscles: orbicular, masseter, esternoclidomastoidal | Hit within 2 tries each | |
| T5 | Tap a pale (unlabelled) muscle | Card says "altres músculs · No surt al llibre" | |

## 3. Turning and mis-touch
| # | Check | Pass if | Result |
|---|---|---|---|
| R1 | Drag sideways with one finger, 5 times | Both bodies turn together, smoothly; nothing selected | |
| R2 | Pinch to zoom, two-finger move | Smooth; nothing selected | |
| R3 | ↺ | Back to the start view | |
| R4 | Phone landscape | "gira el mòbil" hint; names hidden; back to portrait restores | |

## 4. Navigation
| # | Check | Pass if | Result |
|---|---|---|---|
| N1 | 🦴 on the muscle page / 💪 on the skeleton page | Opens the other page | |
| N2 | 📖 2D | Opens the 2D test page | |
