/** Passive automated mechanics for non-playable world powers */

export interface NpcMechanicDef {
  id: string;
  countryId: string;
  name: string;
  description: string;
  /** Shown in dossier while dormant */
  dormantHint: string;
}

export const NPC_MECHANICS: NpcMechanicDef[] = [
  {
    id: 'western_aid_pipeline',
    countryId: 'ukraine',
    name: 'Western Aid Pipeline',
    description:
      'Military and financial lifelines from Washington and European capitals — scales with bilateral support.',
    dormantHint: 'Inactive while not at war with Russia.',
  },
  {
    id: 'zeitenwende',
    countryId: 'germany',
    name: 'Zeitenwende',
    description:
      'Crisis-driven rearmament — Berlin ramps defense spending and capability after prolonged Russian aggression.',
    dormantHint: 'Dormant until Russia’s war strains Europe for several turns.',
  },
  {
    id: 'remilitarization',
    countryId: 'japan',
    name: 'Remilitarization',
    description:
      'Incremental capability creep under Pacific tension — Tokyo loosens pacifist constraints as threats mount.',
    dormantHint: 'Building slowly while China–Japan and US–China tensions remain elevated.',
  },
  {
    id: 'independent_deterrent',
    countryId: 'france',
    name: 'Independent Deterrent',
    description:
      'Autonomous strategic posture — Paris signals nuclear and expeditionary resolve, routing aid to Kyiv on its own terms.',
    dormantHint: 'Activates when Russia’s war or Franco-Russian hostility demands European leadership.',
  },
  {
    id: 'opec_leverage',
    countryId: 'saudi_arabia',
    name: 'OPEC Leverage',
    description:
      'Petro-state market power — Riyadh modulates global oil shock severity via production and diplomatic messaging.',
    dormantHint: 'Passive until a global oil shock is active.',
  },
  {
    id: 'suez_gatekeeper',
    countryId: 'egypt',
    name: 'Suez Gatekeeper',
    description:
      'Chokepoint stewardship — Cairo’s stability and canal access shape trade flows when the Middle East burns.',
    dormantHint: 'Stressed when regional wars or instability threaten Red Sea / Suez transit.',
  },
];

export const NPC_MECHANIC_BY_COUNTRY: Record<string, NpcMechanicDef> = Object.fromEntries(
  NPC_MECHANICS.map(m => [m.countryId, m])
);

export function getNpcMechanicDef(countryId: string): NpcMechanicDef | undefined {
  return NPC_MECHANIC_BY_COUNTRY[countryId];
}
