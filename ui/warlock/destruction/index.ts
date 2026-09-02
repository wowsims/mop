import { browserEnv } from '@app/browser_env';
import { Player } from '@domain/player';
import { PlayerSpecs } from '@domain/player_specs';
import { Sim } from '@domain/sim';
import { nextEventID } from '@domain/state/batch';

import { Spec } from '../../core/proto/common';
import { DestructionWarlockSimUI } from './sim';
const sim = new Sim({ env: browserEnv });
const player = new Player<Spec.SpecDestructionWarlock>(PlayerSpecs.DestructionWarlock, sim);
sim.raid.setPlayer(nextEventID(), 0, player);

new DestructionWarlockSimUI(document.body, player);
