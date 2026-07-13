import type { GameState } from '../types/game';
import { getRelation } from '../data/relations';
import { getWinCondition } from './winConditions';
import { getFiscalHeadroom } from '../engine/fiscal';
import { formatDisplayGDP, formatDebtRatio } from '../engine/treasuryDisplay';
import { ALLIANCES_DATA } from './countries';

export interface NationIntro {
  quote: string;
  subtitle?: string;
}

export const NATION_INTROS: Record<string, NationIntro> = {
  usa: {
    quote: 'The arsenal of democracy stands ready — but every dollar spent is borrowed from tomorrow.',
    subtitle: 'Unmatched power, crushing debt, and allies who expect leadership.',
  },
  england: {
    quote: 'Perfidious or steadfast — history will judge how we hold the line with our allies.',
    subtitle: 'A mid-sized power punching above its weight through NATO.',
  },
  russia: {
    quote: "Mother Russia's beauty lies in her strength. May they all see our smile.",
    subtitle: 'A continental empire at war, sanctioned yet defiant.',
  },
  china: {
    quote: 'The century belongs to those who build — and those who endure the purge.',
    subtitle: 'Economic ascent shadowed by internal factional risk.',
  },
  turkey: {
    quote: 'Where Europe meets Asia, a nation refuses to be anyone\'s junior partner.',
    subtitle: 'Regional power broker between blocs.',
  },
  israel: {
    quote: 'Surrounded, outnumbered, and unwilling to yield an inch of security.',
    subtitle: 'Iron Dome overhead, American aid on the line.',
  },
  india: {
    quote: 'A billion voices, one rising power — if the coalition holds.',
    subtitle: 'Demographic giant navigating great-power rivalry.',
  },
  pakistan: {
    quote: 'Nuclear umbrella, empty coffers, and generals watching the streets.',
    subtitle: 'Survival on a knife edge between debt and doctrine.',
  },
  iran: {
    quote: 'The axis of resistance bends but does not break — sanctions be damned.',
    subtitle: 'Isolated, defiant, and one miscalculation from catastrophe.',
  },
  north_korea: {
    quote: 'The world may mock us — until the missiles rise from the mountains.',
    subtitle: 'Hermit kingdom, nuclear deterrent, perpetual siege mentality.',
  },
  south_korea: {
    quote: 'Prosperity built under the shadow of the DMZ — peace is never guaranteed.',
    subtitle: 'Economic miracle one artillery barrage from ruin.',
  },
};

export function getNationStandingBullets(state: GameState, countryId: string): string[] {
  const country = state.countries[countryId];
  if (!country) return [];

  const bullets: string[] = [];
  const headroom = getFiscalHeadroom(country);
  const debt = country.debtToGdp ?? 0;

  bullets.push(
    `GDP (est.): ${formatDisplayGDP(country.stats.treasuryPoints)} · Treasury: ${country.stats.treasuryPoints} TP · Spendable: ${Math.round(headroom)} TP`
  );
  if (debt > 0) {
    bullets.push(`National debt: ${formatDebtRatio(debt)} — servicing limits spending power`);
  }

  const allianceNames = ALLIANCES_DATA.filter(a =>
    a.members.includes(countryId)
  ).map(a => a.name);
  if (allianceNames.length > 0) {
    bullets.push(`Alliances: ${allianceNames.join(', ')}`);
  } else {
    bullets.push('Alliances: none at start');
  }

  const wars = state.wars.filter(w => w.belligerents.includes(countryId));
  if (wars.length > 0) {
    const opponents = wars.flatMap(w =>
      w.belligerents.filter(b => b !== countryId).map(id => state.countries[id]?.name ?? id)
    );
    bullets.push(`At war with: ${[...new Set(opponents)].join(', ')}`);
  } else {
    bullets.push('At war: no (yet)');
  }

  const hostile = Object.keys(state.countries)
    .filter(id => id !== countryId && getRelation(state.relations, countryId, id) < -30)
    .map(id => state.countries[id]?.name)
    .slice(0, 4);
  if (hostile.length > 0) {
    bullets.push(`Hostile relations: ${hostile.join(', ')}`);
  }

  const friendly = Object.keys(state.countries)
    .filter(id => id !== countryId && getRelation(state.relations, countryId, id) > 40)
    .map(id => state.countries[id]?.name)
    .slice(0, 4);
  if (friendly.length > 0) {
    bullets.push(`Friendly relations: ${friendly.join(', ')}`);
  }

  const win = getWinCondition(countryId);
  if (win) {
    bullets.push(`Victory goal: ${win.description}`);
  }

  bullets.push(`Difficulty: ${country.difficultyRating.blurb}`);

  return bullets;
}
