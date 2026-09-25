# Crazy Games guest build

Unstitch Sprites ships two static builds.

| | GitHub Pages / AlterU | Crazy Games |
| --- | --- | --- |
| Command | `npm run build` | `npm run build:crazygames` |
| Output | `dist/` | `dist-crazygames/`, copied to `artifacts/crazygames/` |
| Upload zip | — | `artifacts/unstitch-sprites-crazygames.zip` (`index.html` at the zip root) |
| Pages path | site root | `/crazygames/` beside the root site |
| Language | Chinese or English from the browser | English only, `<html lang="en">` |
| AlterU / Aigram | guest shell, scoped storage, optional cloud save and leaderboard | Off. Play starts from the title. Progress is `localStorage` on the device |

The Pages workflow builds both and copies the guest folder to `dist/crazygames/` without replacing `dist/index.html`.

https://yinxinghuan.github.io/stitch-sprites/crazygames/

## Guest play

- Title screen, then 40 patterns. The AlterU bloom logo chart is not in this list (the host build still has all 41).
- Coins, pace, and tools save on the device. There is no login, leaderboard, friend profile, or ad.
- First clear pays 100 coins, a replay pays 20, and the first clear of a color chapter pays an extra 200. The purse starts at 200 and opens on the pattern 2 result.
- Light Step (1.12×, 400 coins) opens after pattern 5. Quick Queue (1.25×, 1000 coins) opens after pattern 17. The player can switch back to a slower pace.
- Tools, once unlocked: Recall (Q, 80), Shuffle (W, 120), Extra slot (E, 180, this pattern only), Peel (V, 280). Preview first, then confirm. A failed confirm does not spend coins. Using one drops the clean-run score bonus.
- Every result names the next pattern and the next locked upgrade.
- The first pattern teaches the red reel, the path, keys 1–4, the five-slot fail, and the album. Skip is on the card. Settings can replay it.
- Audio starts on the first gesture. Mute (M) and volume are remembered. P pauses. Esc is unused.

## UI spec

One scale for the guest frame. Thread colors stay on the reels and the hoop. Chrome does not add a second rainbow.

- Space: 8px, 12px, 16px. Panel padding 12px. Gap 8px.
- Type: 11px label, 13px body, 18px section title, 28px wordmark (40px on a 1600px-wide window). One sans family.
- Line: 2px `#241f1c`. Radius 8px on controls, 12px on modals. Pressed cards use a 2px or 3px hard shadow, not a blur.
- Palette: page `#e7e1d6`, panel `#f7f3ec`, ink `#241f1c`, muted `#6e665c`, gold `#a67c2d` with fill `#f4e4bc`. Gold is only the purse, the selected card, and the primary button.
- Desktop frame: embroidery hoop in the center, goal and workshop on the left, four stacks on the right with key caps. The stage caps at 1440px. The first-run lesson is a card in the center column, under the header, so it stays on screen at 800×450. Portrait host layout is unchanged.

## Audio

| File | Use | Source | Licence |
| --- | --- | --- | --- |
| `src/cg/audio/bgm.mp3` | Looping background music. 128 kbps encode of the full track. | [Carefree](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3) by Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `src/cg/audio/spool.ogg` | Pick a reel. Kenney `click_001.ogg`. | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/cg/audio/travel.ogg` | Sprites leave. Kenney `bong_001.ogg`. | same pack | CC0 |
| `src/cg/audio/stitch.ogg` | A stitch comes out. Kenney `confirmation_001.ogg`. | same pack | CC0 |
| `src/cg/audio/wait.ogg` | A reel has to wait. Kenney `drop_002.ogg`. | same pack | CC0 |
| `src/cg/audio/win.ogg` | Pattern clear. Kenney `confirmation_004.ogg`. | same pack | CC0 |
| `src/cg/audio/fail.ogg` | Rack full. Kenney `error_003.ogg`. | same pack | CC0 |
| `src/cg/audio/buy.ogg` | Purchase. Kenney `switch_001.ogg`. | same pack | CC0 |

Music: Carefree by Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0.

Interface sounds by Kenney (www.kenney.nl), CC0. Credit is not required by the licence.

## Pattern assets

The playable charts are the project's own generated cross-stitch textures in `public/patterns/`. The generator traces them from art-direction sheets named in `scripts/generate-stitch-patterns.py`. Those sheets are not stored in this repository, so an outside reader cannot re-check the upstream file licence from git alone. Nothing in the guest level list uses a named third-party character. `alteruBloom` is taken from `alteru-logo-stitch-candidates.png` and is omitted here, along with `poster.png` (an AI-generated host poster). Treat the missing source sheets as the one licensing point that is not proven from this repo.

## Build the upload package

```bash
npm ci
npm run build:crazygames
```

Upload `artifacts/unstitch-sprites-crazygames.zip` in the Crazy Games developer portal. Do not submit from this repository's automation.
