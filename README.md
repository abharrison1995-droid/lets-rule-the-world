# Let's Rule The World

A turn-based geopolitical strategy game themed around modern warfare. Built as a mobile-first Progressive Web App (PWA), single-player, client-side only.

## Play

Choose from 11 playable nations — each with unique difficulty, mechanics, and win/loss conditions seeded from real-world data.

**Playable nations:** USA, England, Russia, China, Turkey, Israel, India, Pakistan, Iran, North Korea, South Korea

## How to Play

1. **Choose a nation** from the title screen (11 playable options)
2. **World Map (Tier 1)** — tap any country to zoom into its national map
3. **National Map (Tier 2)** — tap regions for strike options; toggle map layers via the tray
4. **Diplomacy panel** — declare war (⚔), launch covert ops (🕵), execute nation-specific special actions
5. **Economy panel** — allocate budget across Military/Diplomacy/Domestic/Covert/Reserve; invest in military development
6. **End Turn** — economy ticks, diplomacy AI runs, events fire, combat resolves on active fronts
7. **Intel sidebar** — track wars, fronts, covert ops, and turn history

### Opening Scenario
Russia-Ukraine war is active at game start with live front lines.

### Win Conditions
Each nation has a unique victory goal (shown on nation select and Intel sidebar):
- **USA/UK**: Hegemony — maintain high relations with allies
- **Russia**: Annex Ukraine or control 30% of world territory
- **Israel**: Survive 40 turns with US backing, no territorial loss
- **North Korea/Pakistan/Iran**: Survival under economic/diplomatic pressure
- **China/India**: Economic dominance milestones
- **Turkey/SK**: Regional defensive objectives

### Peace & Propaganda
- **Peace negotiations** — Diplomacy panel → select wartime opponent → White Peace / Ceasefire / Reparations
- **Domestic propaganda** — Economy panel → campaign boosts war popularity (diminishing returns at high saturation)
- **Foreign influence** — Economy panel → target nation → relation boost
- **Counter-intelligence** — Domestic sub-allocation slider; exposes enemy covert ops and reduces your discovery risk

## Development

```bash
npm install
npm run dev
```

## Build & Deploy (GitHub Pages)

```bash
npm run build
```

Deploy the `dist/` folder to GitHub Pages. The app is configured with base path `/lets-rule-the-world/`.

## Tech Stack

- React + TypeScript + Vite
- SVG maps (Tier 1 world map, Tier 2 national maps)
- PWA with service worker for offline play
- localStorage save/load
- No backend — all state is client-side

## Game Systems

- **Two-tier map:** World overview → National region detail with GTA-style layer toggles
- **Turn loop:** Economy → Diplomacy → Events → Player actions → Combat
- **Combat:** Pressure-based front creeping, missile/drone strikes, alliance call-ups
- **Diplomacy:** Transparent relation matrix (-100 to 100), tiered alliances
- **Events:** 30+ events with telegraphed collapse conditions
- **Economy:** GDP growth, budget allocation, war exhaustion, sanctions
- **Nation mechanics:** Unique covert ops and special actions per nation

## License

MIT
