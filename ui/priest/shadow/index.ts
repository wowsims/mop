import { Player } from '../../core/player';
import { PlayerSpecs } from '../../core/player_specs';
import { Spec } from '../../core/proto/common';
import { Sim } from '../../core/sim';
import { nextEventID } from '../../core/state/batch';
import { ShadowPriestSimUI } from './sim';
const sim = new Sim();
const player = new Player<Spec.SpecShadowPriest>(PlayerSpecs.ShadowPriest, sim);
sim.raid.setPlayer(nextEventID(), 0, player);

new ShadowPriestSimUI(document.body, player);
