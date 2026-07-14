import { createInitialState } from '../src/engine/gameState.ts';
import { playerDeclareWar } from '../src/engine/actions.ts';
import { detectFronts } from '../src/engine/combat.ts';
import {
  getInstallClientPreview,
  installCampaignClient,
  acknowledgeCampaignBrief,
  getMissionHud,
} from '../src/engine/usaCampaign.ts';

const s = createInitialState('usa', 'campaign');
acknowledgeCampaignBrief(s, 'ukraine');
console.log('hud', getMissionHud(s));
console.log('install early', getInstallClientPreview(s, 'cuba').blockReason);

const err = playerDeclareWar(s, 'cuba');
console.log('war', err);
s.fronts = detectFronts(s);
console.log(
  'cuba fronts',
  s.fronts
    .filter(f => f.defenderCountryId === 'cuba' || f.attackerCountryId === 'cuba')
    .map(f => `${f.attackerRegionId}->${f.defenderRegionId}`)
);

s.regions.cuba_west!.controlledBy = 'usa';
s.regions.cuba_west!.unrest = 50;
s.actionEnergy = 4;
s.countries.usa!.stats.treasuryPoints = 200;
console.log('install mid', getInstallClientPreview(s, 'cuba'));
const ie = installCampaignClient(s, 'cuba');
console.log('install', ie, 'status', s.usaCampaign?.activeMission?.status, 'clients', s.usaCampaign?.clientStates);
