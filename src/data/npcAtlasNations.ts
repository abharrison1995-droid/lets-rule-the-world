import type { Country, GovernmentType } from '../types/game';

type Spec = {
  id: string;
  name: string;
  color: string;
  gov?: GovernmentType;
  debt?: number;
  treasury?: number;
  growth?: number;
  defense?: number;
  quality?: number;
  tech?: number;
  morale?: number;
  security?: number;
  blurb?: string;
  alliances?: string[];
};

function npc(spec: Spec): Country {
  const gov = spec.gov ?? 'hybrid';
  return {
    id: spec.id,
    name: spec.name,
    playable: false,
    debtToGdp: spec.debt ?? 0.55,
    governmentType: gov,
    color: spec.color,
    // Placeholder — overwritten by WORLD_COASTLINES Natural Earth paths
    worldMapPath: 'M 0,0 L 1,0 L 1,1 Z',
    worldMapLabel: [0, 0],
    stats: {
      treasuryPoints: spec.treasury ?? 24,
      baseGrowthRate: spec.growth ?? 0.025,
      defenseBudget: spec.defense ?? 0.015,
      troopQuality: spec.quality ?? 0.5,
      techLevel: spec.tech ?? 0.45,
      moraleBase: spec.morale ?? 0.55,
      regimeSecurity: spec.security ?? 0.6,
      warPopularity: 0.5,
      warExhaustion: 0,
      propagandaSaturation: 0,
    },
    militaryDev: {
      troopQuality: Math.max(1, Math.round((spec.quality ?? 0.5) * 4)),
      missileDefense: 1,
      droneProgram: 1,
      strikeCapability: 2,
      fortification: 1,
    },
    startingAlliances: spec.alliances ?? [],
    startingRelations: {},
    difficultyRating: {
      score: 5,
      blurb: spec.blurb ?? `NPC — ${spec.name}.`,
    },
    uniqueMechanics: [],
    collapseCondition: {
      type: gov === 'democratic' ? 'soft' : 'hard',
      triggerStats: { regimeSecurity: 0.28 },
      telegraphEventId: `${spec.id}_crisis_warning`,
    },
  };
}

/** Additional map NPCs matched to Natural Earth coastlines. */
export const NPC_ATLAS_NATIONS: Record<string, Country> = Object.fromEntries(
  [
    npc({ id: 'peru', name: 'Peru', color: '#7a6a58', gov: 'democratic', treasury: 26, growth: 0.028, blurb: 'NPC — Andean Pacific state.' }),
    npc({ id: 'ecuador', name: 'Ecuador', color: '#6a7a48', gov: 'democratic', treasury: 18, growth: 0.03, blurb: 'NPC — Pacific energy & dollarized economy.' }),
    npc({ id: 'bolivia', name: 'Bolivia', color: '#6a5850', gov: 'hybrid', treasury: 16, growth: 0.025, blurb: 'NPC — Lithium & highland politics.' }),
    npc({ id: 'uruguay', name: 'Uruguay', color: '#5a7088', gov: 'democratic', treasury: 16, growth: 0.02, blurb: 'NPC — Stable Southern Cone democracy.' }),
    npc({ id: 'paraguay', name: 'Paraguay', color: '#6a7850', gov: 'hybrid', treasury: 14, growth: 0.032, blurb: 'NPC — Landlocked agricultural exporter.' }),

    npc({ id: 'netherlands', name: 'Netherlands', color: '#8a6a48', gov: 'democratic', debt: 0.5, treasury: 38, growth: 0.015, defense: 0.014, quality: 0.78, tech: 0.82, alliances: ['nato'], blurb: 'NPC — NATO logistics & trade hub.' }),
    npc({ id: 'belgium', name: 'Belgium', color: '#6a6a78', gov: 'democratic', debt: 1.05, treasury: 30, quality: 0.72, tech: 0.75, alliances: ['nato'], blurb: 'NPC — EU & NATO headquarters state.' }),
    npc({ id: 'portugal', name: 'Portugal', color: '#5a7868', gov: 'democratic', treasury: 24, quality: 0.68, tech: 0.7, alliances: ['nato'], blurb: 'NPC — Atlantic NATO flank.' }),
    npc({ id: 'norway', name: 'Norway', color: '#4a6a7a', gov: 'democratic', debt: 0.4, treasury: 42, growth: 0.014, defense: 0.018, quality: 0.8, tech: 0.82, alliances: ['nato'], blurb: 'NPC — Arctic energy & NATO north.' }),
    npc({ id: 'finland', name: 'Finland', color: '#5a7888', gov: 'democratic', treasury: 28, defense: 0.02, quality: 0.78, tech: 0.8, alliances: ['nato'], blurb: 'NPC — Baltic NATO frontier.' }),
    npc({ id: 'austria', name: 'Austria', color: '#7a6870', gov: 'democratic', treasury: 28, quality: 0.7, tech: 0.75, blurb: 'NPC — Neutral Alpine industrial state.' }),
    npc({ id: 'greece', name: 'Greece', color: '#5a7088', gov: 'democratic', debt: 1.7, treasury: 22, quality: 0.65, tech: 0.65, alliances: ['nato'], blurb: 'NPC — Eastern Med NATO member.' }),
    npc({ id: 'romania', name: 'Romania', color: '#7a5858', gov: 'democratic', treasury: 24, defense: 0.022, quality: 0.6, alliances: ['nato'], blurb: 'NPC — Black Sea NATO flank.' }),
    npc({ id: 'czechia', name: 'Czechia', color: '#6a6878', gov: 'democratic', treasury: 26, quality: 0.7, tech: 0.74, alliances: ['nato'], blurb: 'NPC — Central European industrial core.' }),
    npc({ id: 'ireland', name: 'Ireland', color: '#4a7a58', gov: 'democratic', treasury: 28, growth: 0.04, tech: 0.8, blurb: 'NPC — EU tech & finance node.' }),
    npc({ id: 'denmark', name: 'Denmark', color: '#7a5860', gov: 'democratic', treasury: 28, quality: 0.78, tech: 0.8, alliances: ['nato'], blurb: 'NPC — Baltic / North Sea NATO state.' }),
    npc({ id: 'switzerland', name: 'Switzerland', color: '#6a5858', gov: 'democratic', debt: 0.4, treasury: 45, growth: 0.012, quality: 0.85, tech: 0.88, blurb: 'NPC — Neutral finance & tech fortress.' }),
    npc({ id: 'belarus', name: 'Belarus', color: '#5a6a58', gov: 'autocratic', treasury: 16, quality: 0.45, security: 0.55, blurb: 'NPC — Russian-aligned buffer state.' }),

    npc({ id: 'morocco', name: 'Morocco', color: '#7a6848', gov: 'autocratic', treasury: 22, growth: 0.03, blurb: 'NPC — Maghreb Atlantic hinge.' }),
    npc({ id: 'libya', name: 'Libya', color: '#6a7050', gov: 'hybrid', treasury: 18, growth: 0.02, defense: 0.03, security: 0.4, blurb: 'NPC — Oil & post-war fragmentation.' }),
    npc({ id: 'kenya', name: 'Kenya', color: '#6a7a48', gov: 'democratic', treasury: 18, growth: 0.045, blurb: 'NPC — East African commercial hub.' }),
    npc({ id: 'ghana', name: 'Ghana', color: '#8a7848', gov: 'democratic', treasury: 16, growth: 0.04, blurb: 'NPC — West African democratic beachhead.' }),
    npc({ id: 'angola', name: 'Angola', color: '#6a5850', gov: 'autocratic', treasury: 20, growth: 0.025, blurb: 'NPC — Atlantic oil exporter.' }),
    npc({ id: 'tanzania', name: 'Tanzania', color: '#4a6a58', gov: 'hybrid', treasury: 16, growth: 0.05, blurb: 'NPC — East African demographic rise.' }),
    npc({ id: 'drc', name: 'DR Congo', color: '#5a5848', gov: 'hybrid', treasury: 14, growth: 0.04, security: 0.4, blurb: 'NPC — Mineral giant, governance stress.' }),

    npc({ id: 'syria', name: 'Syria', color: '#6a5858', gov: 'autocratic', treasury: 10, growth: 0.01, security: 0.35, blurb: 'NPC — Shattered Levant battlefield.' }),
    npc({ id: 'jordan', name: 'Jordan', color: '#6a6870', gov: 'autocratic', treasury: 14, blurb: 'NPC — Levant buffer monarchy.' }),

    npc({ id: 'bangladesh', name: 'Bangladesh', color: '#4a6a58', gov: 'hybrid', treasury: 22, growth: 0.055, blurb: 'NPC — Dense manufacturing rise.' }),
    npc({ id: 'afghanistan', name: 'Afghanistan', color: '#6a5a48', gov: 'autocratic', treasury: 8, growth: 0.01, security: 0.35, blurb: 'NPC — Landlocked conflict economy.' }),
    npc({ id: 'malaysia', name: 'Malaysia', color: '#5a6a78', gov: 'hybrid', treasury: 28, growth: 0.04, tech: 0.6, blurb: 'NPC — Strait of Malacca economy.' }),
    npc({ id: 'thailand', name: 'Thailand', color: '#6a5868', gov: 'hybrid', treasury: 30, growth: 0.03, blurb: 'NPC — Mainland SE Asia hub.' }),
    npc({ id: 'myanmar', name: 'Myanmar', color: '#5a5848', gov: 'autocratic', treasury: 12, security: 0.4, blurb: 'NPC — Junta & border conflicts.' }),
    npc({ id: 'mongolia', name: 'Mongolia', color: '#7a6a58', gov: 'democratic', treasury: 12, growth: 0.035, blurb: 'NPC — Resource corridor between Russia & China.' }),
    npc({ id: 'taiwan', name: 'Taiwan', color: '#5a6a88', gov: 'democratic', treasury: 36, growth: 0.025, defense: 0.025, quality: 0.75, tech: 0.9, blurb: 'NPC — Chip foundry & flashpoint.' }),
    npc({ id: 'uzbekistan', name: 'Uzbekistan', color: '#6a7860', gov: 'autocratic', treasury: 18, growth: 0.04, blurb: 'NPC — Central Asian population center.' }),
  ].map(c => [c.id, c])
);
