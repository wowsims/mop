import { SimRequest } from '../../worker/types';
import { ErrorOutcomeType, Raid as RaidProto, ReforgeOptimizeMode, ReforgeOptimizeRequest, ReforgeSettings } from '../proto/api';
import { EquipmentSpec } from '../proto/common';
import { SimSignals } from '../sim_signal_manager';
import { generateRequestId, WorkerPool } from '../worker_pool';

export const reforgeGearKey = (gear: EquipmentSpec): string => {
	return Array.from(EquipmentSpec.toBinary(gear)).join(',');
};

export const optimizeReforgeGear = async (
	baseRaid: RaidProto,
	templateRequest: ReforgeOptimizeRequest,
	gear: EquipmentSpec,
	includeGems: boolean,
	workerPool: WorkerPool,
	signals: SimSignals,
	mode = ReforgeOptimizeMode.ReforgeOptimizeModeSingle,
): Promise<EquipmentSpec | null> => {
	const reforgeRequest = makeReforgeRequest(baseRaid, templateRequest, gear, includeGems, mode);
	if (!reforgeRequest) {
		return null;
	}

	try {
		const result = await workerPool.reforgeOptimize(reforgeRequest, signals);
		if (result.error) {
			if (result.error.type != ErrorOutcomeType.ErrorOutcomeAborted) {
				console.warn(`[Reforge] Optimization failed includeGems=${includeGems}: ${result.error.message}`);
			}
			return null;
		}

		return result.optimizedGear ? EquipmentSpec.clone(result.optimizedGear) : null;
	} catch (error) {
		if (!signals.abort.isTriggered()) {
			console.warn(`[Reforge] Optimization failed includeGems=${includeGems}`, error);
		}
		return null;
	}
};

export const makeReforgeRequest = (
	baseRaid: RaidProto,
	templateRequest: ReforgeOptimizeRequest,
	gear: EquipmentSpec,
	includeGems: boolean,
	mode = ReforgeOptimizeMode.ReforgeOptimizeModeSingle,
): ReforgeOptimizeRequest | null => {
	const raid = RaidProto.clone(baseRaid);
	const player = raid.parties[0]?.players[0];
	if (!player) {
		return null;
	}

	player.equipment = EquipmentSpec.clone(gear);
	const reforgeRequest = ReforgeOptimizeRequest.clone(templateRequest);
	reforgeRequest.requestId = generateRequestId(SimRequest.reforgeOptimizeAsync);
	reforgeRequest.raid = raid;
	reforgeRequest.mode = mode;
	reforgeRequest.settings = ReforgeSettings.clone(reforgeRequest.settings ?? ReforgeSettings.create());
	reforgeRequest.settings.includeGems = includeGems;
	return reforgeRequest;
};
