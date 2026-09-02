import { Player as PlayerProto, ReforgeSettings } from '@core/proto/api';
import { APLRotation_Type as APLRotationType } from '@core/proto/apl';
import {
	ConsumesSpec,
	Debuffs,
	Encounter as EncounterProto,
	EquipmentSpec,
	Faction,
	HealingModel,
	IndividualBuffs,
	ItemSwap,
	PartyBuffs,
	Race,
	RaidBuffs,
	UnitReference,
} from '@core/proto/common';
import { SavedRotation, SavedTalents } from '@core/proto/ui';

import type { Player } from '../player';
import type { Stats } from '../proto_utils/stats';
import type { SpecOptions } from '../proto_utils/utils';

export interface PresetBase {
	name: string;
	tooltip?: string;
	enableWhen?: (obj: Player<any>) => boolean;
	onLoad?: (player: Player<any>) => void;
}

export interface PresetOptionsBase extends Pick<PresetBase, 'onLoad'> {
	customCondition?: (player: Player<any>) => boolean;
}

export interface PresetGear extends PresetBase {
	gear: EquipmentSpec;
}
export interface PresetGearOptions extends PresetOptionsBase, Pick<PresetBase, 'tooltip'> {
	faction?: Faction;
}

export interface PresetTalents {
	name: string;
	data: SavedTalents;
	enableWhen?: (obj: Player<any>) => boolean;
}

export interface PresetTalentsOptions {
	customCondition?: (player: Player<any>) => boolean;
}

export interface PresetRotation extends PresetBase {
	rotation: SavedRotation;
}
export interface PresetRotationOptions extends Pick<PresetOptionsBase, 'onLoad'> {
	talents?: number[];
}

export interface PresetEpWeights extends PresetBase {
	epWeights: Stats;
}
export interface PresetEpWeightsOptions extends PresetOptionsBase {}

export interface PresetItemSwap extends PresetBase {
	itemSwap: ItemSwap;
}

export interface PresetEncounter extends PresetBase {
	encounter?: EncounterProto;
	healingModel?: HealingModel;
	tanks?: UnitReference[];
	targetDummies?: number;
}
export interface PresetEncounterOptions extends PresetOptionsBase {}

type PresetPlayerOptions = Partial<
	Pick<
		PlayerProto,
		'reactionTimeMs' | 'channelClipDelayMs' | 'inFrontOfTarget' | 'distanceFromTarget' | 'profession1' | 'profession2' | 'enableItemSwap' | 'itemSwap'
	>
>;

export interface PresetSettings extends PresetBase {
	race?: Race;
	raidBuffs?: RaidBuffs;
	partyBuffs?: PartyBuffs;
	buffs?: IndividualBuffs;
	debuffs?: Debuffs;
	consumables?: ConsumesSpec;
	specOptions?: Partial<SpecOptions<any>>;
	playerOptions?: PresetPlayerOptions;
}

export interface PresetBuild {
	name: string;
	gear?: PresetGear;
	itemSwap?: PresetItemSwap;
	talents?: PresetTalents;
	rotation?: PresetRotation;
	rotationType?: APLRotationType;
	epWeights?: PresetEpWeights;
	encounter?: PresetEncounter;
	settings?: PresetSettings;
	reforgeSettings?: ReforgeSettings;
}

export interface PresetBuildOptions extends Omit<PresetBuild, 'name'> {}
