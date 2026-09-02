import { UnitReference, UnitReference_Type as UnitType } from '@core/proto/common';
import { Player } from '@domain/player';

export type UNIT_SET = 'aura_sources' | 'aura_sources_targets_first' | 'targets' | 'players';

export const unitSets: Record<
	UNIT_SET,
	{
		// Uses target icon by default instead of person icon. This should be set to true for inputs that default to CurrentTarget.
		targetUI?: boolean;
		getUnits: (player: Player<any>) => Array<UnitReference | undefined>;
	}
> = {
	aura_sources: {
		getUnits: player => {
			return [
				undefined,
				player
					.getPetMetadatas()
					.asList()
					.map((petMetadata, i) => UnitReference.create({ type: UnitType.Pet, index: i, owner: UnitReference.create({ type: UnitType.Self }) })),
				UnitReference.create({ type: UnitType.CurrentTarget }),
				UnitReference.create({ type: UnitType.PreviousTarget }),
				UnitReference.create({ type: UnitType.NextTarget }),
				player.sim.raid
					.getActivePlayers()
					.filter(filter => filter != player)
					.map(mapPlayer => UnitReference.create({ type: UnitType.Player, index: mapPlayer.getRaidIndex() })),
				player.sim.encounter.targetsMetadata.asList().map((targetMetadata, i) => UnitReference.create({ type: UnitType.Target, index: i })),
			].flat();
		},
	},
	aura_sources_targets_first: {
		targetUI: true,
		getUnits: player => {
			return [
				undefined,
				player.sim.encounter.targetsMetadata.asList().map((targetMetadata, i) => UnitReference.create({ type: UnitType.Target, index: i })),
				UnitReference.create({ type: UnitType.Self }),
				player
					.getPetMetadatas()
					.asList()
					.map((petMetadata, i) => UnitReference.create({ type: UnitType.Pet, index: i, owner: UnitReference.create({ type: UnitType.Self }) })),
			].flat();
		},
	},
	targets: {
		targetUI: true,
		getUnits: player => {
			return [
				undefined,
				player.sim.encounter.targetsMetadata.asList().map((_targetMetadata, i) => UnitReference.create({ type: UnitType.Target, index: i })),
				UnitReference.create({ type: UnitType.PreviousTarget }),
				UnitReference.create({ type: UnitType.NextTarget }),
			].flat();
		},
	},
	players: {
		targetUI: true,
		getUnits: player => {
			return [
				undefined,
				player.sim.raid.getActivePlayers().map(player => UnitReference.create({ type: UnitType.Player, index: player.getRaidIndex() })),
			].flat();
		},
	},
};
