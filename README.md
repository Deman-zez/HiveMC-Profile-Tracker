# HiveMC Profile Tracker

**Better. Beautiful. Open.** — the first open-source Hive tracker.

A stats tracker for [The Hive](https://playhive.com), the Minecraft Bedrock server. Look up any player, follow your progress over time, and see your recent games, cosmetics and leaderboard places in one place.

**Live:** https://deman-zez.github.io/HiveMC-Profile-Tracker/

| Profile | Game | Cosmetics |
|---|---|---|
| ![Profile](profile.jpg) | ![Game](game.jpg) | ![Cosmetics](cosmetics.jpg) |

## Getting started

Open the site, type a Hive username and pick it from the suggestions. Your stats are saved each time you open the profile, and the **Trend** tab shows how they change.

English and Russian are supported.

## Privacy

- No account is needed. Your snapshots and settings stay in your browser.
- Requests to Hive go through the project's small Cloudflare server, which only passes them on and briefly caches public stats.
- **Sync by code** stores a copy of your data on that server under a hash of the code. Anyone who knows the code can open it, so treat it like a password.
- Visits are counted with Cloudflare Web Analytics, which uses no cookies.

## Signing in with Xbox

Signing in is optional. It lets the site keep your game history while it is closed and sync between your devices without a code.

How it works:

- You sign in on Microsoft's own page (`microsoft.com/link`) with a one-time code. The site never sees your password or email.
- The sign-in uses Minecraft's official app, the same way launchers do, so Microsoft may mention Minecraft.
- The site receives only your gamertag and Xbox ID, and uses them to find your Hive profile. Microsoft's tokens are used once and not stored.
- Your browser keeps a sign-in pass for 90 days. It renews itself while you use the site.
- While you are signed in, the server checks your Hive game feed every 20 minutes and keeps the games it finds for up to 180 days.
- **Sign out** in Settings stops the checks right away. If you do not open the site for 30 days, your stored games are deleted.

## Running locally

Serve the folder over HTTP. Opening `index.html` straight from disk often blocks browser storage.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Credits

- [The Hive](https://playhive.com) for the server and the public API.
- [CubeEdge Studios](https://github.com/CubeEdge-Studios/hive-bedrock) for their open Hive libraries and game data.

This is a fan project, not affiliated with or endorsed by The Hive. Game names, cosmetics and images belong to their owners.

## License

MIT — see [LICENSE](LICENSE).
