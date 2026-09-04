# HiveMC Profile Tracker

A stats tracker for [The Hive](https://playhive.com), the Minecraft Bedrock server. One HTML file — no build step, no dependencies, no backend. Open it and it works.

**Live:** https://deman-zez.github.io/HiveMC-Profile-Tracker/

Your Hive profile already shows where you stand today. This shows where you are *going*: it saves snapshots of your stats over time and turns them into progress you can actually see.

## Screenshots

| Profile | Game breakdown | Cosmetics |
|---|---|---|
| ![Profile](profile.jpg) | ![Game](game.jpg) | ![Cosmetics](cosmetics.jpg) |

| Appearance | Trend | Settings |
|---|---|---|
| ![Appearance](appearance.jpg) | ![Trend](trend.jpg) | ![Settings](settings.jpg) |

## Features

**Profile at a glance.** Rank tag next to your name, equipped avatar, and the hub title rendered with its real in-game colours — including a shimmer that plays through darker and lighter shades of each coloured segment, so multi-coloured titles keep every colour. A login streak card tells you whether today's login has already counted, with a countdown to the next game day in your own timezone.

**Player search.** Start typing a username and matching players appear below the field, with the part you typed highlighted. Pick one and the whole profile switches to them — handy for scouting an opponent.

**Every game, every field.** Cards are sorted by how much you play them, with the most played one marked. Tap any card for the full picture: level progress, win rate, K/D, kills and deaths per game, XP per game, and every raw field the API returned. Nothing is hardcoded, so new fields show up on their own.

**Cosmetics.** Hub titles, avatars, costumes, hats, backblings, mounts and pets — what you own and what you have equipped, newest first, with icons pulled straight from Hive's CDN.

**Snapshots and trends.** Every refresh stores a snapshot locally. Once you have two, the Trend tab plots any metric over time — including computed ones like win rate and K/D, which the API does not return.

**Kill breakdown.** Total kills are assembled from different fields across games (`kills`, `hider_kills`, `murders` and so on). Tap the tile to see exactly which fields were counted per game, with totals both with and without final kills, so you can match the number to your in-game Total Kills title.

**Multiple accounts.** Snapshots are tied to the username they were taken for, so you can track yourself and a few friends without their history bleeding into yours.

**Bilingual.** English and Russian, picked from your device language, switchable in settings.

## Desktop mode

The layout is not just a stretched phone screen. On screens 900px and wider it switches to a dedicated desktop mode:

![Desktop](desktop.jpg)

- Two columns: games on the left, the cosmetics locker on the right.
- The header becomes horizontal — avatar beside the name and title instead of stacked.
- Each game gets a full-width row with wins, games played and win rate side by side.
- Detail views open as centred dialogs with their own scrolling; the page behind them stays put.
- The tab bar turns into a floating centred pill, and cards, chips and buttons respond to hover.

Everything stays in the same single file — there is no separate desktop build.

## Getting started

1. Open the page and go to **Settings**.
2. Enter your Hive username, or start typing and pick it from the suggestions.
3. Choose the games you want to follow.
4. Go back and press **Take snapshot**.

The first snapshot gives you your current stats. The second one and everything after builds history, and the Trend tab comes alive.

All data lives in your browser's `localStorage`. Nothing is uploaded anywhere, and there is no account to create. Settings include backup export and import if you want to move between devices.

## Rate limits and fair use

Hive's public API allows the same player-and-game pair to be requested three times per hour for anonymous clients. The page keeps its own guards well inside that:

- a configurable pause per game, five minutes by default;
- at least a minute between any two snapshots;
- a rolling cap of 80 requests and 8 distinct usernames per hour;
- a three-minute cooldown on the diagnostic profile request.

The remaining request budget is shown under the snapshot button.

**Scouting tip:** every tracked game costs one request per snapshot, so looking someone up with all thirteen games enabled burns thirteen requests at once. When you only want to check an opponent, leave a single mode ticked in Settings — one player then costs one or two requests instead, and the hourly budget lasts far longer. Player search also spends one request per query, though repeated prefixes are served from memory.

These guards are client-side. Anyone can edit the file and remove them — they exist to keep normal use polite, not to make abuse impossible. **Please do not use this to bulk-query other people's accounts.** The public API is a courtesy from Hive, and it stays available only while people treat it well.

## Running locally

Opening the file directly from disk usually works, but browsers often block storage on `file://` and `content://` origins, which means your snapshots will not persist. Serve it over HTTP instead:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

If your browser blocks the API requests with a CORS error, Settings has a proxy field. The address is prepended to the API URL, or you can use the `{url}` placeholder if your proxy expects the target as a parameter. A minimal Cloudflare Worker is enough.

## How it is built

Plain HTML, CSS and JavaScript in a single ~91 KB file. No frameworks, no bundler, no build.

- Stats come from the public API at `api.playhive.com/v0`, including `/player/search` for the username suggestions.
- Levels are derived from XP using the tables in [hive-bedrock-data](https://github.com/CubeEdge-Studios/hive-bedrock-data), loaded from a CDN at runtime.
- Cosmetic icons come from `cdn.playhive.com`. Players without a known avatar get a coloured tile derived from their UUID, so the same person always looks the same.
- The gradient background, the drifting light, the scroll-linked dimming and every transition run on compositor-only properties so they never interfere with scrolling. A **Fewer animations** switch in settings turns them off entirely, and the system "reduce motion" preference is respected automatically.
- Charts are hand-drawn SVG — no charting library.
- Visitor counts use [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/), which sets no cookies and tracks nobody across sites.

## Credits

- [The Hive](https://playhive.com) for the server and the public API.
- [hive-bedrock-data](https://github.com/CubeEdge-Studios/hive-bedrock-data) by CubeEdge Studios for the level curves and game metadata.

This project is unofficial and not affiliated with or endorsed by The Hive. All game names, cosmetic names and images belong to their respective owners.

## License

MIT — see [LICENSE](LICENSE).
