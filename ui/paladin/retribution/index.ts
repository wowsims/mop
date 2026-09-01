import { Player } from '../../core/player.js';
import { PlayerSpecs } from '../../core/player_specs';
import { Spec } from '../../core/proto/common.js';
import { Sim } from '../../core/sim.js';
import { nextEventID } from '../../core/state/batch';
import { RetributionPaladinSimUI } from './sim.js';
const sim = new Sim();
const player = new Player<Spec.SpecRetributionPaladin>(PlayerSpecs.RetributionPaladin, sim);
sim.raid.setPlayer(nextEventID(), 0, player);

new RetributionPaladinSimUI(document.body, player);
