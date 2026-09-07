import { BulkSimResult, BulkSimStage, DistributionMetrics } from '@generated/proto/api';
import { ItemSlot, WeaponType } from '@generated/proto/common';

import type { Player } from '../player';
import { getClassWeaponTypes, isSpecDualWieldCapable } from '../player_classes/capabilities';
import { Gear } from '../proto_utils/gear';
import { getGearIdentityKey } from '../proto_utils/items';
import {
	BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS,
	BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT,
	BulkSimItemSlot,
	ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT,
} from './constants_auto_gen';
import { OptimisationStage } from './types';

export { BulkSimItemSlot, ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT, BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT, BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS };

export const getBulkItemSlotFromSlot = (slot: ItemSlot, canDualWield: boolean): BulkSimItemSlot => {
	if (canDualWield && [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].includes(slot)) {
		return BulkSimItemSlot.ItemSlotHandWeapon;
	}
	return ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT.get(slot)!;
};

export const getBulkPlayerCanDualWield = (player: Player<any>): boolean => {
	// A class with no melee weapon capabilities (hunters) gets no dual-wield grouping either -
	// the backend rejects its melee candidates through the same weapon table.
	return isSpecDualWieldCapable(player.getSpec()) && getClassWeaponTypes(player.getClass()).length > 0;
};

const TWO_HAND_ONLY_WEAPON_TYPES: WeaponType[] = [WeaponType.WeaponTypePolearm, WeaponType.WeaponTypeStaff];

export const getBulkFreezeWeaponTypes = (player: Player<any>, slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand): WeaponType[] => {
	const playerCanDualWield = getBulkPlayerCanDualWield(player);

	return Array.from(
		new Set(
			player
				.getPlayerClass()
				.weaponTypes.filter(
					eligibleWeaponType =>
						slot === ItemSlot.ItemSlotMainHand || (playerCanDualWield && !TWO_HAND_ONLY_WEAPON_TYPES.includes(eligibleWeaponType.weaponType)),
				)
				.map(eligibleWeaponType => eligibleWeaponType.weaponType),
		),
	);
};

export const cleanBulkDpsMetrics = (dpsMetrics: DistributionMetrics): DistributionMetrics => {
	dpsMetrics.hist = [];
	dpsMetrics.allValues = [];
	return dpsMetrics;
};

export const dedupeGearSets = (gearSets: Gear[], existingGearSets: Gear[] = []): Gear[] => {
	const seenGearKeys = new Set<string>();
	for (let i = 0; i < existingGearSets.length; i++) {
		seenGearKeys.add(getGearIdentityKey(existingGearSets[i].asSpec()));
	}

	const deduped: Gear[] = [];
	for (let i = 0; i < gearSets.length; i++) {
		const gear = gearSets[i];
		const gearKey = getGearIdentityKey(gear.asSpec());
		if (seenGearKeys.has(gearKey)) {
			continue;
		}
		seenGearKeys.add(gearKey);
		deduped.push(gear);
	}

	return deduped;
};

export const bulkSimStageToOptimisationStage = (stage: BulkSimStage): OptimisationStage | 'reforging' | 'finalist' | null => {
	switch (stage) {
		case BulkSimStage.BulkSimStageReforge:
			return 'reforging';
		case BulkSimStage.BulkSimStageLow:
			return 'low';
		case BulkSimStage.BulkSimStageMedium:
			return 'medium';
		case BulkSimStage.BulkSimStageHigh:
			return 'high';
		case BulkSimStage.BulkSimStageFinalist:
			return 'finalist';
		default:
			return null;
	}
};

export const getCoreBulkSimTrackingMetrics = (result: BulkSimResult): Record<string, string | number> => {
	const metrics: Record<string, string | number> = {
		total_sim_rounds: result.stageMetrics.reduce((total, stage) => total + stage.inputGearSets + 1, 0),
	};

	for (const stage of result.stageMetrics) {
		const stageName = bulkSimStageToOptimisationStage(stage.stage);
		if (!stageName) continue;
		metrics[`${stageName}_input_gear_sets`] = stage.inputGearSets;
		metrics[`${stageName}_survivors`] = stage.survivors;
		metrics[`${stageName}_iterations`] = stage.iterations;
		metrics[`${stageName}_target_error_pct`] = stage.targetErrorPct;
		metrics[`${stageName}_concurrency`] = stage.concurrency;
		metrics[`${stageName}_duration_seconds`] = Math.round(stage.durationSeconds);
	}

	if (result.timings) {
		metrics.core_simming_duration_seconds = Math.round(result.timings.simmingSeconds);
		metrics.core_total_duration_seconds = Math.round(result.timings.totalSeconds);
	}

	return metrics;
};

export const throwIfAborted = (signal?: AbortSignal, errorMessage = 'Bulk Sim Aborted'): void => {
	if (signal?.aborted) {
		throw new Error(errorMessage);
	}
};
