# CashCompass: MoneyQuest

**Can you survive 30 days without going broke?**

A separate Roblox financial-literacy mini-game, written in Luau. The CashCompass `/moneyquest` page launches the published experience through Roblox; gameplay runs in Roblox, not an iframe or React simulation. All figures are fictional. No CashCompass sessions, balances, credentials, or API connections enter the game.

## Delivery status

Implemented: original procedural 3D neighborhood, four interactive stations, six financial decision challenges, a day-30 review, HUD, forecasts, server-controlled finance calculations, transparent scoring, and replay. The Rojo place builds locally, Luau syntax checks pass, and all **324 complete decision paths** pass **4,261 assertions** in standalone Luau. Engine, scorer, protocol, and tests also pass `luau-analyze`.

**Studio playtesting and publishing are still required.** A generated `.rbxlx` is a build artifact, not proof of successful Studio execution. No experience ID has been invented or published. The website defaults to “Game publishing in progress.” A configured URL is validated structurally; its publication status, availability, and ownership must be checked manually.

## Open the place now

The generated local file is `build/MoneyQuest.rbxlx`. If you have that file:

1. Open **Roblox Studio** and sign into your own Roblox account.
2. Use **File → Open from File** (some Studio versions label this **Open**) and select `roblox/moneyquest/build/MoneyQuest.rbxlx`.
3. Use **Play / F5** to run both server and client. The original neighborhood is generated when the server starts; an empty edit view before Play is expected.
4. Walk with **WASD**, approach the highlighted station, and press **E** or tap **Explore**. Close an information dialog to keep walking. Decisions advance the fictional calendar immediately.
5. Complete all seven stops and use **Play Again** on the result screen. Use **Stop / Shift+F5** when finished.

Built artifacts are ignored by Git. On another machine, build from source using Rojo, or use the manual import below. No API key, Studio HTTP permission, or DataStore access is required.

## Build from source with Rojo

Install the CLI and optional Studio plugin from the [official Rojo installation guide](https://rojo.space/docs/v7/getting-started/installation/). Verified here with **Rojo 7.7.1**. Use **Luau 0.743** or a newer compatible release for local tests, from the [official Luau releases](https://github.com/luau-lang/luau/releases).

Windows PowerShell, from the repository root:

```powershell
Set-Location roblox/moneyquest
New-Item -ItemType Directory -Force build | Out-Null
rojo build default.project.json --output build/MoneyQuest.rbxlx
luau tests/FinanceEngine.spec.luau
luau-analyze src/server/FinanceEngine.luau src/server/Scoring.luau src/server/Protocol.luau tests/FinanceEngine.spec.luau
Get-ChildItem src -Recurse -Filter *.luau | ForEach-Object {
    luau-compile $_.FullName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Luau syntax check failed: $($_.FullName)" }
}
```

macOS/Linux, from the repository root:

```sh
cd roblox/moneyquest
mkdir -p build
rojo build default.project.json --output build/MoneyQuest.rbxlx
luau tests/FinanceEngine.spec.luau
luau-analyze src/server/FinanceEngine.luau src/server/Scoring.luau src/server/Protocol.luau tests/FinanceEngine.spec.luau
luau-compile src/server/*.luau src/client/*.luau > /dev/null
```

Optional live development: run `rojo serve default.project.json`, open a **new blank place** in Studio, then use the Rojo Studio plugin to connect to `127.0.0.1:34872` and sync. Do not sync over an unrelated place. The [project mapping](https://rojo.space/docs/v7/project-format/) creates the services and script locations below.

## Manual Studio import without Rojo

Start a **new Baseplate** place. Enable **Explorer**, **Properties**, and **Output** from Studio's View/Window menus if hidden.

| Studio location | Instance type and name | Paste this file's source |
| --- | --- | --- |
| `ServerScriptService/MoneyQuest` | Folder | — |
| Inside that folder | ModuleScript `FinanceEngine` | `src/server/FinanceEngine.luau` |
| Inside that folder | ModuleScript `Scoring` | `src/server/Scoring.luau` |
| Inside that folder | ModuleScript `Protocol` | `src/server/Protocol.luau` |
| Inside that folder | ModuleScript `World` | `src/server/World.luau` |
| Inside that folder | Script `RoundService` | `src/server/RoundService.server.luau` |
| `StarterPlayer/StarterPlayerScripts` | LocalScript `MoneyQuest` | `src/client/MoneyQuest.client.luau` |

Use these names exactly; do not leave `.luau` or `.server` in Studio instance names. Replace the default script content entirely. `RoundService` creates `ReplicatedStorage/MoneyQuest/Request` and `Update` as RemoteEvents if absent. Delete the template's Baseplate and SpawnLocation so the generated neighborhood and its spawn are used. Press **Play / F5**, not server-only Run.

## What is implemented

| Station | Decision / event | Day |
| --- | --- | --- |
| Store | Buy the $1,200 laptop now, check affordability after payday, or start a $150 laptop fund | 1 |
| Apartment | Pay $1,200 rent, or arrange a fictional day-15 extension with a $50 fee | 5 |
| Store | $300 essentials or $500 premium grocery basket | 8 |
| Bank | Buy $250 shoes on a repayment promise, wait, or agree on a later date | 11 |
| Advisor | $450 bike repair from checking/savings, or a $500 day-22 payment plan | 12 |
| Bank | Allocate $400, $200, or up to $400 after protecting bills and buffer | 16 |
| Advisor | Day-30 financial-health review and replay | 30 |

The bank view shows balance, safe-to-spend, known obligations, and conservative/expected month-end checking. The store has a shopkeeper and decisions. The apartment handles rent and an NPC roommate scenario. The advisor explains the repair, outlook, and final score. Buildings are compact exterior interaction stations; walking inside is not required.

The server advances days between choices. A $1,500 salary posts on day 15, utilities cost $150 on day 20, and a $200 roommate repayment actually posts on day 24. There is no real-time wait and no random outcome. A delayed bill is paid exactly once, including its disclosed $50 fee. A deferred laptop is purchased on day 16 **only if** bills, savings, and the buffer still fit. The $150 laptop fund stays separate from the $400 goal and is not automatically spent this month.

Safe-to-spend reserves known unpaid bills before the next guaranteed payday (or month-end), remaining goal savings, and a $300 checking buffer. The day-12 surprise is excluded until it is discovered. Promised roommate money is never counted as available before the actual deposit. The outlook is a projection of known commitments, not a guarantee, and does not assume future discretionary spending or savings transfers.

Amounts use integer cents. Fictional checking may go negative so players see a failed plan rather than silently avoiding its consequences. The interface explicitly labels this a game and has no real transfers, Robux, monetization, or account linking.

## Scoring and reference paths

| Rule | Maximum points |
| --- | ---: |
| Fraction of the four bills paid on time | 35 |
| Checking never fell below zero | 20 |
| Lowest checking balance / $300 buffer, capped at 1 | 15 |
| Final goal savings / $400 goal, capped at 1 | 20 |
| Fraction of optional purchases that fit safe-to-spend at purchase time | 10 |

The total is rounded to the nearest integer and capped at 100. If no optional purchase occurs, the last category receives 10. Spending itself is not penalized: waiting can buy the laptop and earn **100**. A protected-future win requires every bill paid, no negative checking during the round, at least $300 ending checking, and at least $400 goal savings. Late bills lose on-time points even if the final win conditions are met.

**Reference path:** wait for laptop → pay rent → budget groceries → wait for repayment → pay repair from checking → save safely → review. Expected: **$500 checking, $400 goal savings, $300 lowest checking, laptop owned, 100/100**.

**Risk path:** change only the first choice to buy today. Expected: the same **$500** ending checking but **−$650** lowest checking and a lower score. This is the demo's central timing lesson.

## Authority and validation

`FinanceEngine`, `Scoring`, and `Protocol` live in **ServerScriptService**. The client sends an action, choice ID, round ID, and revision. It never submits accepted balances, dates, scores, or bill amounts. The server validates the current phase, station visit, live character distance, allowed choice, request rate, and round/revision before mutation. Duplicate/stale choices are rejected. Respawning preserves the round; replay is allowed only after the result. Disconnecting loses the session, intentionally.

This follows Roblox's [client/server boundary guidance](https://create.roblox.com/docs/scripting/security/client-server-boundary). Position checks are basic validation, not a complete anti-cheat system. There is no persistent economy or competitive reward to protect in this MVP.

## Required Studio checks before judging

1. Run **Play / F5**; confirm the four stations, spawn, HUD, and local highlight appear. Check both **Client** and **Server** Output for errors.
2. Visit the wrong station; it should show information and direct you to the current objective. Choosing while far from a station must fail.
3. Play the reference path above and confirm all exact balances and the score. Play the buy-today path and confirm its negative historical balance is retained.
4. Try the rent extension, expensive groceries, shoes, repair plan, and each savings option. Confirm automatic salary, utility, deferred-payment, and roommate postings in activity.
5. Double-click a choice; it must apply once. Reset your character mid-round; the financial state must remain. Complete the round and replay; balances must reset.
6. Use Studio's **Server & Clients** testing mode with two clients to verify independent sessions. This tests isolation; there are no multiplayer mechanics.
7. Use **Device Emulator** for phone/landscape: check scrolling dialogs, readable text, touch Explore, navigation, and the Roblox movement controls. Desktop is the MVP target.
8. Test the published experience with Roblox Player from a separate permitted account. Record a short fallback video once the actual place runs successfully.

Standalone tests do not cover Roblox Instances, UI layout, replication, real movement/proximity, or Studio permissions. Those remain manual until performed in Studio/Player. See [Studio testing modes](https://create.roblox.com/docs/studio/testing-modes).

## Publish with your Roblox account

1. Finish Studio testing, then **Stop** the play session.
2. Choose **File → Publish** (older Studio versions call this **Publish to Roblox**), name it **CashCompass: MoneyQuest**, describe the fictional budgeting challenge, and save to your own new experience.
3. Follow Studio's release flow and content-maturity questions honestly. In Creator Hub, select the experience and review **Publish settings → Manage Audience → Manage access** so intended judges can join.
4. Roblox applies account-age, verification, audience, and release requirements. Use the access options your account qualifies for; a saved private place is not publicly playable.
5. Open the experience's Roblox details page and copy its genuine `https://www.roblox.com/games/<place-id>/...` URL. Use the **place ID**, not the universe ID. Test joining in Roblox Player with the intended audience.

These steps follow [Roblox's current publishing guidance](https://create.roblox.com/docs/production/publishing/publish-games-and-places); the dashboard's available release options are authoritative. Publishing and release require your account action. No publishing, paid reach, or account settings are changed by this repository.

## Connect the published experience to CashCompass

Enter the genuine URL directly into the deployment's private environment configuration:

```dotenv
NEXT_PUBLIC_ROBLOX_MONEYQUEST_URL=
```

Set the value to the copied URL; do not leave a placeholder ID. Locally put it in the git-ignored `.env.local`. The value is public and is deliberately not a secret. Rebuild Next.js after changing this `NEXT_PUBLIC_` variable. Deployment still needs the owner's approval under the existing server-change instructions.

Only HTTPS `roblox.com`/`www.roblox.com` direct `/games/<positive-place-id>` links are accepted; tracking parameters are discarded. Missing/invalid links show “Game publishing in progress” and no play button. No automatic availability check contacts Roblox. A configured link opens in a new tab with `noopener noreferrer`. Roblox handles launching its player. The Cash Flow simulator remains unchanged and linked as an alternative.

Website verification from the repository root:

```sh
npm run lint
npm run typecheck
npm run build
npm test
BASE_URL=http://localhost:3101 node scripts/audit-moneyquest.mjs
```

The browser audit needs a running isolated local demo server with no real financial integrations. It checks four widths, both themes, desktop placement, mobile More navigation, the retained bottom-bar links, honest unpublished state (or `MONEYQUEST_EXPECT_LAUNCH_URL`), the Cash Flow link, runtime errors, overflow, and axe accessibility. Do not run stateful finance tests against a live database.

Verified October 18, 2026: lint, typecheck, production build, **143 unit tests** (four live-service tests skipped), and the unpublished-state browser audit all pass. The browser audit passes **375/768/1024/1440 px × light/dark**, with zero overflow, runtime errors, or axe violations. Both menus and navigation into the existing Cash Flow simulator work. A production-mode HTTP check confirms MoneyQuest and Cash Flow both redirect to the configuration error page when Auth0 is missing; this is not a new live Auth0 sign-in test.

The browser audit ran against a fresh, credential-free temporary preview because the already-running workspace dev server had stale client assets after dependency restoration. That server was left running; restart your local `npm run dev` process if its buttons are unresponsive. No Vultr restart, rebuild, deployment, main-branch push, or Roblox publication was performed.

Local dependency restoration required `npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund`: the existing lockfile omits React Native peer packages. No package manifest or lockfile was changed. Use Node 22+ for the wallet dependencies' declared engine requirements.

Changed website files:

| File | Purpose |
| --- | --- |
| `src/app/(app)/moneyquest/page.tsx` | Launcher, honest unpublished state, scenario overview, Cash Flow link |
| `src/components/moneyquest/neighborhood-preview.tsx` | Original SVG neighborhood concept |
| `src/lib/moneyquest/launcher.ts` and `launcher.test.ts` | URL validation and launcher/auth-boundary tests |
| `src/components/shell/nav-items.ts` | Shared MoneyQuest route and Gamepad2 icon |
| `src/components/shell/mobile-nav.tsx` | Preserve bottom navigation by selecting existing routes explicitly |
| `.env.example` | Empty public experience URL configuration |
| `scripts/audit-moneyquest.mjs` | Read-only browser/navigation/accessibility verification |
| `docs/PROJECT_STATUS.md` | Scoped delivery evidence and remaining manual work |

## Architecture and limitations

```text
default.project.json                 Rojo service/script mapping
src/server/FinanceEngine.luau         Scenario, integer-cents state, choices, scheduled events, forecast
src/server/Scoring.luau               Transparent 0–100 score and lessons
src/server/Protocol.luau              Round/revision/action authorization
src/server/World.luau                 Four original low-poly stations and NPC guides
src/server/RoundService.server.luau   Per-player sessions, proximity, remotes, replay
src/client/MoneyQuest.client.luau     HUD, local objective highlight, choices, results
tests/FinanceEngine.spec.luau         All 324 paths, accounting, scoring, isolation, request validation
```

The target session length is 2–3 minutes, not yet timed in Studio. One fixed scenario; no DataStore persistence, cross-session progress, real-money integration, co-op mechanics, marketplace assets, audio, or advanced animation. Goal savings are first allocated after the emergency, so “use savings first” truthfully falls back to checking in this scenario. The web illustration is labeled a concept, not a gameplay screenshot.

The project is designed as an educational Roblox Studio companion for the requested hackathon category: original 3D interactions and core Luau gameplay teach consequences of financial timing. This is a design rationale, **not a verified prize-eligibility claim**; organizers decide eligibility and submission requirements. Include the tested published experience, a Studio/Luau walkthrough, and real gameplay footage with your submission.
