/** Flavor and strategic context for non-playable nations */

export type NpcStrategicRole =
  | 'war_zone'
  | 'energy_power'
  | 'economic_giant'
  | 'nato_pillar'
  | 'regional_gatekeeper';

export interface NpcProfile {
  role: NpcStrategicRole;
  roleLabel: string;
  quote: string;
  summary: string;
  foreignPolicy: string;
  /** What this nation tends to do in the simulation */
  behaviorNotes: string[];
  keyPartners: string[];
  keyRivals: string[];
}

export const NPC_ROLE_LABELS: Record<NpcStrategicRole, string> = {
  war_zone: 'Active war zone',
  energy_power: 'Energy power',
  economic_giant: 'Economic giant',
  nato_pillar: 'NATO pillar',
  regional_gatekeeper: 'Regional gatekeeper',
};

export const NPC_PROFILES: Record<string, NpcProfile> = {
  ukraine: {
    role: 'war_zone',
    roleLabel: 'Active war zone',
    quote: 'We fight for every inch — Western aid is our lifeline, but exhaustion is real.',
    summary:
      'Battle-hardened defender locked in existential war with Russia. High morale but mounting exhaustion and treasury strain.',
    foreignPolicy:
      'Seeks maximum Western military and financial support; will not accept territorial concessions while fighting continues.',
    behaviorNotes: [
      'Defends home regions fiercely — collapse risk if morale collapses',
      'Benefits from high relations with USA, UK, and EU majors',
      'Primary target of Russian offensives at game start',
    ],
    keyPartners: ['usa', 'england', 'germany', 'france'],
    keyRivals: ['russia'],
  },
  saudi_arabia: {
    role: 'energy_power',
    roleLabel: 'Energy power',
    quote: 'Oil is leverage — Riyadh balances Washington, Beijing, and Tehran without picking a permanent side.',
    summary:
      'Gulf petro-state with deep pockets and a US security umbrella. Critical to global oil shocks and Iran tensions.',
    foreignPolicy:
      'Pragmatic balancer: arms deals with the West, quiet trade with China, cold rivalry with Iran.',
    behaviorNotes: [
      'Exposed to Hormuz crises when Iran is at war',
      'Relations with USA and Israel shape Gulf stability',
      'Regime security fragile if oil income and patronage falter',
    ],
    keyPartners: ['usa', 'pakistan', 'egypt'],
    keyRivals: ['iran', 'israel'],
  },
  japan: {
    role: 'economic_giant',
    roleLabel: 'Economic giant',
    quote: 'Pacifist constitution, mounting threats — Tokyo rethinks deterrence every election cycle.',
    summary:
      'Technological and industrial powerhouse with constrained offensive military doctrine. Quad member tied to US strategy.',
    foreignPolicy:
      'US alliance anchor in the Pacific; cautious on China; incremental remilitarization debate.',
    behaviorNotes: [
      'Quad membership links fate to US–China competition',
      'High debt limits fiscal flexibility despite large treasury',
      'Vulnerable to oil shocks and regional missile crises',
    ],
    keyPartners: ['usa', 'india', 'south_korea'],
    keyRivals: ['china', 'north_korea', 'russia'],
  },
  france: {
    role: 'nato_pillar',
    roleLabel: 'NATO pillar',
    quote: 'Independent nuclear deterrent, European ambition — Paris leads when it chooses to.',
    summary:
      'Nuclear-armed EU heavyweight with global expeditionary tradition. NATO member but often charts its own course.',
    foreignPolicy:
      'Atlantic alliance when convenient; champions EU strategic autonomy; active in Africa and Middle East periphery.',
    behaviorNotes: [
      'NATO bloc ties affect war declarations against members',
      'Supports Ukraine materially when relations are strong',
      'Regime stability sensitive to domestic unrest and debt',
    ],
    keyPartners: ['usa', 'england', 'germany', 'ukraine'],
    keyRivals: ['russia', 'iran'],
  },
  germany: {
    role: 'nato_pillar',
    roleLabel: 'NATO pillar',
    quote: 'Europe\'s wallet and workshop — Berlin moves slowly until crisis forces its hand.',
    summary:
      'EU economic engine with historically low defense spending. Sanctions architect against Russia, aid hub for Ukraine.',
    foreignPolicy:
      'Economic statecraft first; rearmament under pressure; reluctant to lead militarily without US cover.',
    behaviorNotes: [
      'High treasury but cautious war enthusiasm',
      'Energy exposure makes Hormuz and Russia wars costly',
      'Coalition politics slow bold military moves',
    ],
    keyPartners: ['usa', 'france', 'england', 'ukraine'],
    keyRivals: ['russia'],
  },
  egypt: {
    role: 'regional_gatekeeper',
    roleLabel: 'Regional gatekeeper',
    quote: 'Suez, Sinai, and 100 million mouths — Cairo trades stability for aid and arms.',
    summary:
      'Arab world\'s demographic heavyweight. Controls Suez chokepoint logic; balances Gulf money, US aid, and public anger.',
    foreignPolicy:
      'Authoritarian stability over ideology; mediates Gaza/Levant periphery; avoids direct great-power war.',
    behaviorNotes: [
      'Regime collapse risk if security and treasury both weaken',
      'Useful partner for USA and Gulf states in Middle East',
      'Sensitive to refugee flows and regional war spillover',
    ],
    keyPartners: ['usa', 'saudi_arabia', 'england'],
    keyRivals: ['iran'],
  },
};

export function getNpcProfile(countryId: string): NpcProfile | undefined {
  return NPC_PROFILES[countryId];
}

export function getNpcNationIds(): string[] {
  return Object.keys(NPC_PROFILES);
}
