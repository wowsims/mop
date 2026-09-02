import { browserEnv } from '@app/browser_env';
import { Player } from '@domain/player';
import { PlayerSpecs } from '@domain/player_specs';
import { Sim } from '@domain/sim';
import { nextEventID } from '@domain/state/batch';

import { Spec } from '../../core/proto/common';
import { ElementalShamanSimUI } from './sim';
const sim = new Sim({ env: browserEnv });
const player = new Player<Spec.SpecElementalShaman>(PlayerSpecs.ElementalShaman, sim);
sim.raid.setPlayer(nextEventID(), 0, player);
new ElementalShamanSimUI(document.body, player);
