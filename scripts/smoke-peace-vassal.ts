import { createInitialState } from '../src/engine/gameState.ts';
import {
  applyTheaterPeaceSettlement,
  getTheaterControlShare,
  getTheaterForWar,
  resolveRegionFate,
  syncWarTheaters,
  tickVassalRegions,
} from '../src/engine/warTheater.ts';
import { calculatePeaceAcceptance, getPeaceOptions } from '../src/engine/peace.ts';

const s = createInitialState('usa');
syncWarTheaters(s);
const war = s.wars[0]!;
const t = getTheaterForWar(s, war.id);
console.log('theater', t?.name, 'share rus', t ? getTheaterControlShare(t, 'russia').toFixed(2) : null);

if (t) {
  let n = 0;
  for (const id of Object.keys(t.hexes)) {
    if (n++ % 2 === 0) t.hexes[id]!.ownerId = 'russia';
  }
  applyTheaterPeaceSettlement(s, war.id, 'territorial_cede');
  console.log('settlements', s.theaterSettlements.length, s.theaterSettlements[0]?.terms);
  console.log('theater closed', s.warTheaters[0]?.closed);
}

const s2 = createInitialState('russia');
syncWarTheaters(s2);
const th = s2.warTheaters[0]!;
th.pendingFate = {
  theaterId: th.id,
  regionId: 'ukr_east',
  conquerorId: 'russia',
  subjectNationId: 'ukraine',
};
const before = s2.countries.ukraine!.stats.treasuryPoints;
resolveRegionFate(s2, th.id, 'vassal');
console.log('vassals', s2.vassalRegions.length, 'unrest', s2.regions.ukr_east!.unrest);
tickVassalRegions(s2);
console.log(
  'tribute',
  before,
  '->',
  s2.countries.ukraine!.stats.treasuryPoints,
  'overlord+',
  s2.countries.russia!.stats.treasuryPoints
);

const s3 = createInitialState('russia');
console.log('peace options RU vs UA', getPeaceOptions(s3, 'ukraine'));
console.log('accept freeze', calculatePeaceAcceptance(s3, 'ukraine', 'freeze_lines').toFixed(2));
console.log('accept cede', calculatePeaceAcceptance(s3, 'ukraine', 'territorial_cede').toFixed(2));
console.log('accept dmz', calculatePeaceAcceptance(s3, 'ukraine', 'dmz').toFixed(2));

// Absorb pariah check as player
const s4 = createInitialState('russia');
syncWarTheaters(s4);
const th4 = s4.warTheaters[0]!;
th4.pendingFate = {
  theaterId: th4.id,
  regionId: 'ukr_south',
  conquerorId: 'russia',
  subjectNationId: 'ukraine',
};
resolveRegionFate(s4, th4.id, 'absorb');
console.log('absorb unrest', s4.regions.ukr_south!.unrest, 'pariah', s4.internationalPariahTurns);

// Theater edge unlocks map terms
const s5 = createInitialState('russia');
syncWarTheaters(s5);
const t5 = getTheaterForWar(s5, s5.wars[0]!.id)!;
for (const id of Object.keys(t5.hexes)) {
  if (t5.hexes[id]!.ownerId !== 'russia') t5.hexes[id]!.ownerId = 'russia';
}
console.log('edge options', getPeaceOptions(s5, 'ukraine'));
console.log('edge freeze', calculatePeaceAcceptance(s5, 'ukraine', 'freeze_lines').toFixed(2));
console.log('edge cede', calculatePeaceAcceptance(s5, 'ukraine', 'territorial_cede').toFixed(2));
