# M1.1 real-device test checklist

Fill one copy per device. Headless (emulated) results are recorded separately in the test report and must not be copied here.

Device: ____________  OS version: ________  Browser + version: ________  Date: ________  Tester: ________
URL used: https://raw.githack.com/xgridseurope/cos-huma/m1.1-test/3d/index.html

## 0. Diagnostics (do first)
1. Open the URL. Tap ⚙︎ (top right). Tap "▶ FPS 5 s" and keep the phone still for 5 s.
2. Tap 📋 to copy the report and paste it into the chat (or screenshot the panel).
   - Model must read `glb`. If it reads `embedded`, the real GLB did not load: note it.

| # | Check | How | Pass if | Result (✔/✘ + note) |
|---|---|---|---|---|
| D1 | Load | Open URL on mobile data or school Wi-Fi | Skeleton visible; panel shows load time | |
| D2 | FPS | ⚙︎ → FPS 5 s | ≥ 30 (Android), ≥ 50 (iPad) | |
| D3 | WebGL | ⚙︎ panel | WebGL 2 or 1 shown, context lost: no | |

## 1. Labels (20)
| # | Check | Pass if | Result |
|---|---|---|---|
| L1 | All 20 names readable at arm's length (≈35 cm), portrait | No name needs zooming | |
| L2 | No two names overlap, none cut at the screen edge | | |
| L3 | Each leader line ends on the right bone | Check the 20 one by one | |
| L4 | Only textbook bones are labelled (no clavicle) | | |

## 2. Tapping (finger, no stylus)
| # | Check | Pass if | Result |
|---|---|---|---|
| T1 | Tap each of the 20 bones once, assembled view | Correct bone highlights ≥ 18/20 | __/20 |
| T2 | Thin bones: fingers, toes, fibula (peroné), ribs | Hit within 2 tries each | |
| T3 | Tap a name label | The bone highlights | |
| T4 | The body does not move when the info card opens | | |

## 3. Rotation and mis-touch
| # | Check | Pass if | Result |
|---|---|---|---|
| R1 | Turn the body slowly with one finger, 5 times | Smooth; nothing gets selected | |
| R2 | Pinch to zoom in/out | Smooth; nothing gets selected | |
| R3 | Child uses it freely for 3 min | Count unwanted selections: ___ | |

## 4. Front / back, explode, restore
| # | Check | Pass if | Result |
|---|---|---|---|
| V1 | Darrere, then Davant | Turns smoothly; labels follow | |
| V2 | Desmunta once (50 %) | Head up, arms out, legs down: 3 zones | |
| V3 | Desmunta again (100 %) | Every bone separate, names readable | |
| V4 | Munta twice | Back to the assembled body, nothing left out of place | |
| V5 | Slider from 0 to 100 and back | No jumps or flicker | |

## 5. Orientation
| # | Check | Pass if | Result |
|---|---|---|---|
| O1 | Rotate phone to landscape | Body not stretched; "gira el mòbil" hint shown (phones); names hidden | |
| O2 | Back to portrait | Body and names return as before | |
| O3 | iPad landscape | Names visible, not overlapping | |

## 6. Errors (optional)
| # | Check | Pass if | Result |
|---|---|---|---|
| E1 | Open the URL with `#embedded` at the end | Loads; ⚙︎ panel shows model `embedded (diagnòstic)` | |
| E2 | Load the page, switch to airplane mode, tap ↺ | Nothing breaks (files are already loaded) | |
