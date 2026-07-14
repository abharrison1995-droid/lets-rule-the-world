/**
 * Campaign ladder smoke: Cuba → peer pick → exhaustion win → playerWon
 */
import { createInitialState } from '../src/engine/gameState.ts';
import { playerDeclareWar } from '../src/engine/actions.ts';
import {
  acknowledgeCampaignBrief,
  installCampaignClient,
  pickPeerThreat,
  tickUsaCampaign,
  getUsaCampaignLadderProgress,
  getMissionHud,
} from '../src/engine/usaCampaign.ts';
import { getWinProgress, checkWinConditions } from '../src/engine/winConditions.ts';
import { PEER_FORCE_PICK_TURN, PEER_EXHAUSTION_WIN } from '../src/data/campaignUsa.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const s = createInitialState('usa', 'campaign');
acknowledgeCampaignBrief(s, 'ukraine');

playerDeclareWar(s, 'cuba');
s.regions.cuba_west!.controlledBy = 'usa';
s.actionEnergy = 4;
s.countries.usa!.stats.treasuryPoints = 200;
assert(!installCampaignClient(s, 'cuba'), 'install cuba');
assert(s.usaCampaign?.activeMission?.status === 'won', 'cuba mission won');
assert(s.usaCampaign?.completedMissions.includes('mission_cuba'), 'cuba completed');
assert(!s.playerWon, 'no victory after cuba alone');

// Jump to peer force
s.turn = PEER_FORCE_PICK_TURN;
tickUsaCampaign(s);
assert(s.usaCampaign?.peerChoicePending, 'peer pending');
assert(!pickPeerThreat(s, 'russia'), 'pick russia');
assert(s.usaCampaign?.peerTargetId === 'russia', 'peer target');
assert(s.usaCampaign?.activeMission?.missionId === 'mission_peer_russia', 'peer mission');
assert(s.usaCampaign?.activeMission?.status === 'active', 'peer active');

const hud = getMissionHud(s);
assert(hud?.kind === 'peer_contest', 'hud peer');
assert(hud?.allowsClientInstall === false, 'no install on peer');

playerDeclareWar(s, 'russia');
s.countries.russia!.stats.warExhaustion = PEER_EXHAUSTION_WIN;
tickUsaCampaign(s);
assert(s.usaCampaign?.activeMission?.status === 'won', 'peer won');
assert(s.playerWon, 'campaign victory');
assert(s.winReason?.includes('Hegemony'), `win reason: ${s.winReason}`);

const ladder = getUsaCampaignLadderProgress(s);
assert(ladder.met, 'ladder met');
assert(ladder.progress === 1, `ladder progress ${ladder.progress}`);

const wp = getWinProgress(s);
assert(wp.description.includes('hegemony') || wp.description.includes('campaign'), wp.description);

// Sandbox still uses floor wins path (no early campaign)
const sand = createInitialState('usa', 'sandbox');
sand.turn = 50;
checkWinConditions(sand);
assert(!sand.playerWon, 'sandbox no early win');

console.log('smoke-campaign-ladder OK', {
  winReason: s.winReason,
  completed: s.usaCampaign?.completedMissions,
  ladder: ladder.details,
});
