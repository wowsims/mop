import { Player } from '../../core/player.js';
import { PlayerSpecs } from '../../core/player_specs';
import { Spec } from '../../core/proto/common.js';
import { Sim } from '../../core/sim.js';
import { nextEventID } from '../../core/state/batch';
import { BloodDeathKnightSimUI } from './sim';
const sim = new Sim();
const player = new Player<Spec.SpecBloodDeathKnight>(PlayerSpecs.BloodDeathKnight, sim);
player.enableHealing();

sim.raid.setPlayer(nextEventID(), 0, player);

new BloodDeathKnightSimUI(document.body, player);
