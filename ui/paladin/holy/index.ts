import { Player } from '../../core/player.js';
import { PlayerSpecs } from '../../core/player_specs';
import { Spec } from '../../core/proto/common.js';
import { Sim } from '../../core/sim.js';
import { nextEventID } from '../../core/state/batch';
import { HolyPaladinSimUI } from './sim.js';
const sim = new Sim();
const player = new Player<Spec.SpecHolyPaladin>(PlayerSpecs.HolyPaladin, sim);
player.enableHealing();

sim.raid.setPlayer(nextEventID(), 0, player);

new HolyPaladinSimUI(document.body, player);
