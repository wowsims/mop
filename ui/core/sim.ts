import { getLang } from '../i18n/locale_service';
import { hasTouch } from '../shared/bootstrap_overrides';
import { SimRequest } from '../worker/types';
import { CURRENT_PHASE, LOCAL_STORAGE_PREFIX } from './constants/other';
import { Encounter } from './encounter';
import { Player, UnitMetadata } from './player';
import {
	BulkGearCandidate,
	BulkCombinationCountRequest,
	BulkCombinationCountResult,
	BulkCandidatesRequest,
	BulkCandidatesResult,
	BulkSettings,
	BulkSimRequest,
	BulkSimResult,
	ComputeStatsRequest,
	ErrorOutcome,
	ErrorOutcomeType,
	PlayerStats,
	Raid as RaidProto,
	RaidSimRequest,
	RaidSimResult,
	ReforgeOptimizeRequest,
	ReforgeOptimizeResult,
	ReforgeSettings,
	SimOptions,
	SimType,
	StatWeightsRequest,
	StatWeightsResult,
	BulkSimStage,
	ProgressMetrics,
} from './proto/api.js';
import {
	ArmorType,
	Faction,
	ItemSpec,
	ItemQuality,
	Profession,
	PseudoStat,
	RangedWeaponType,
	Spec,
	Stat,
	UnitReference,
	UnitReference_Type as UnitType,
	WeaponType,
	EquipmentSpec,
} from './proto/common.js';
import { DatabaseFilters, RaidFilterOption, SimSettings as SimSettingsProto, SourceFilterOption } from './proto/ui.js';
import { ItemEffectRandPropPoints, SimDatabase, SimGem, SimItem } from './proto/db.js';
import { UIItem } from './proto/ui.js';
import { Database } from './proto_utils/database.js';
import { Gear } from './proto_utils/gear';
import { SimResult } from './proto_utils/sim_result.js';
import { StatCap, Stats } from './proto_utils/stats.js';
import { extendPlayerProtoWithMissingEffects, getGearKeyFromSpec, hasBlacksmithing } from './proto_utils/utils';
import { Raid } from './raid.js';
import { RequestTypes, SimSignalManager } from './sim_signal_manager';
import { EventID, TypedEvent } from './typed_event.js';
import { distinct, getEnumValues, isExternal, noop, sleep } from './utils.js';
import { runConcurrentBulkSim, runConcurrentSim, runConcurrentStatWeights } from './wasm';
import {
	getBulkSimReforgeCacheData,
	type BulkSimReforgeCacheProgress,
	throwIfAborted,
	writeBulkSimReforgeCacheResults,
} from './components/individual_sim_ui/bulk/utils';
import { ReforgeOptimizer } from './components/suggest_reforges_action';
import { makeBulkGearDatabase } from './wasm/bulk_sim';
import { generateRequestId, WorkerPool, WorkerProgressCallback } from './worker_pool.js';

export type RaidSimData = {
	request: RaidSimRequest;
	result: RaidSimResult;
};

export type StatWeightsData = {
	request: StatWeightsRequest;
	result: StatWeightsResult;
};

export type ReforgeOptimizeConfig = {
	gear: Gear;
	preCapEPWeights: Stats;
	undershootCaps: Stats;
	settings: ReforgeSettings;
	softCaps: StatCap[];
	debug?: boolean;
};

const makeBulkItemDatabaseFromSpecs = (db: Database, baselineGear: Gear, itemSpecs: readonly ItemSpec[]): SimDatabase => {
	const gearSets = [baselineGear];
	const selectedItems = itemSpecs
		.map(itemSpec => (itemSpec ? db.lookupItemSpec(itemSpec) : null))
		.filter((item): item is NonNullable<typeof item> => item != null);
	const simDatabase = makeBulkGearDatabase(db, gearSets);
	for (const selectedItem of selectedItems) {
		simDatabase.items.push(SimItem.fromJson(UIItem.toJson(selectedItem.item), { ignoreUnknownFields: true }));
		const scalingIlvls = new Set<number>([selectedItem.ilvl]);
		Object.values(selectedItem.item.scalingOptions ?? {}).forEach(scalingOption => {
			if (scalingOption?.ilvl) {
				scalingIlvls.add(scalingOption.ilvl);
			}
		});
		scalingIlvls.forEach(ilvl => {
			const ieRpp = db.getItemEffectRandPropPoints(ilvl);
			if (ieRpp) {
				simDatabase.itemEffectRandPropPoints.push(ItemEffectRandPropPoints.create(ieRpp));
			}
		});
		if (selectedItem.randomSuffix) {
			simDatabase.randomSuffixes.push(selectedItem.randomSuffix);
		}
	}
	return SimDatabase.create({
		items: distinct(simDatabase.items, (a, b) => a.id == b.id),
		randomSuffixes: distinct(simDatabase.randomSuffixes, (a, b) => a.id == b.id),
		reforgeStats: distinct(simDatabase.reforgeStats, (a, b) => a.id == b.id),
		itemEffectRandPropPoints: distinct(simDatabase.itemEffectRandPropPoints, (a, b) => a.ilvl == b.ilvl),
		enchants: distinct(simDatabase.enchants, (a, b) => a.effectId == b.effectId),
		gems: distinct(simDatabase.gems, (a, b) => a.id == b.id),
	});
};

interface SimProps {
	// The type of sim. Default `SimType.SimTypeIndividual`
	type?: SimType;
}

export type RunSimOptions = {
	silent?: boolean; // If true, don't emit the simResultEmitter event.
	debug?: boolean;
	singleIteration?: boolean; // If true, only run a single iteration (for testing purposes).
	iterations?: number;
};

const WASM_CONCURRENCY_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}_wasmconcurrency`;

// Core Sim module which deals only with api types, no UI-related stuff.
export class Sim {
	private readonly workerPool: WorkerPool;

	iterations = 12500;

	private phase: number = CURRENT_PHASE;
	private faction: Faction = Faction.Alliance;
	private fixedRngSeed = 0;
	private filters: DatabaseFilters = Sim.defaultFilters();
	private showDamageMetrics = true;
	private showThreatMetrics = false;
	private showHealingMetrics = false;
	private showExperimental = false;
	private wasmConcurrency = 0;
	private showQuickSwap = true;
	private showEPValues = false;
	private language = '';

	readonly type: SimType;
	readonly raid: Raid;
	readonly encounter: Encounter;

	private db_: Database | null = null;

	readonly iterationsChangeEmitter = new TypedEvent<void>();
	readonly phaseChangeEmitter = new TypedEvent<void>();
	readonly factionChangeEmitter = new TypedEvent<void>();
	readonly fixedRngSeedChangeEmitter = new TypedEvent<void>();
	readonly lastUsedRngSeedChangeEmitter = new TypedEvent<void>();
	readonly filtersChangeEmitter = new TypedEvent<void>();
	readonly showDamageMetricsChangeEmitter = new TypedEvent<void>();
	readonly showThreatMetricsChangeEmitter = new TypedEvent<void>();
	readonly showHealingMetricsChangeEmitter = new TypedEvent<void>();
	readonly showExperimentalChangeEmitter = new TypedEvent<void>();
	readonly wasmConcurrencyChangeEmitter = new TypedEvent<void>();
	readonly showQuickSwapChangeEmitter = new TypedEvent<void>();
	readonly showEPValuesChangeEmitter = new TypedEvent<void>();
	readonly languageChangeEmitter = new TypedEvent<void>();
	readonly crashEmitter = new TypedEvent<SimError>();

	// Emits when any of the settings change (but not the raid / encounter).
	readonly settingsChangeEmitter: TypedEvent<void>;

	// Emits when any player, target, or pet has metadata changes (spells or auras).
	readonly unitMetadataEmitter = new TypedEvent<void>('UnitMetadata');

	// Emits when any of the above emitters emit.
	readonly changeEmitter: TypedEvent<void>;

	// Fires when a raid sim API call completes.
	readonly simResultEmitter = new TypedEvent<SimResult>();

	private readonly _initPromise: Promise<any>;
	isNative: boolean | undefined = undefined;
	private lastUsedRngSeed = 0;

	// These callbacks are needed so we can apply BuffBot modifications automatically before sending requests.
	private modifyRaidProto: (raidProto: RaidProto) => void = noop;

	readonly signalManager: SimSignalManager;

	constructor({ type }: SimProps = {}) {
		this.type = type ?? SimType.SimTypeIndividual;

		this.workerPool = new WorkerPool(1);
		this.wasmConcurrencyChangeEmitter.on(async () => {
			// Prevent using worker concurrency when not running wasm. Local sim has native threading.
			if (await this.workerPool.isWasm()) {
				const nWorker = Math.max(1, Math.min(this.wasmConcurrency, navigator.hardwareConcurrency));
				this.workerPool.setNumWorkers(nWorker);
			}
		});

		let wasmConcurrencySetting = parseInt(window.localStorage.getItem(WASM_CONCURRENCY_STORAGE_KEY) ?? 'NaN');
		if (isNaN(wasmConcurrencySetting)) {
			wasmConcurrencySetting = 0;
			// Set a default worker count if env supports multiple threads. Should not be too high as to be safe for all situations.
			// TODO: Set based on browser/engine? E.g. Firefox has significant RAM and CPU usage per worker while Chrome can run many without a downside.
			if (navigator.hardwareConcurrency > 1) {
				wasmConcurrencySetting = Math.min(4, Math.floor(navigator.hardwareConcurrency / 2));
			}
		}
		this.setWasmConcurrency(TypedEvent.nextEventID(), wasmConcurrencySetting);

		this.signalManager = new SimSignalManager();

		this._initPromise = Database.get().then(async db => {
			this.db_ = db;
			await this.resolveIsNative();
		});

		this.raid = new Raid(this);
		this.encounter = new Encounter(this);

		this.settingsChangeEmitter = TypedEvent.onAny([
			this.iterationsChangeEmitter,
			this.phaseChangeEmitter,
			this.fixedRngSeedChangeEmitter,
			this.filtersChangeEmitter,
			this.showDamageMetricsChangeEmitter,
			this.showThreatMetricsChangeEmitter,
			this.showHealingMetricsChangeEmitter,
			this.showExperimentalChangeEmitter,
			this.wasmConcurrencyChangeEmitter,
			this.showQuickSwapChangeEmitter,
			this.showEPValuesChangeEmitter,
			this.languageChangeEmitter,
		]);

		this.changeEmitter = TypedEvent.onAny([this.settingsChangeEmitter, this.raid.changeEmitter, this.encounter.changeEmitter]);

		TypedEvent.onAny([this.raid.changeEmitter, this.encounter.changeEmitter]).on(eventID => this.updateCharacterStats(eventID));

		this.language = getLang();
	}

	waitForInit(): Promise<void> {
		return this._initPromise;
	}

	private async resolveIsNative() {
		try {
			this.isNative = !(await this.isWasm());
		} catch {
			this.isNative = isExternal();
		}
	}

	/**
	 * Check if workers are running wasm.
	 * @returns true if workers are running wasm.
	 */
	isWasm() {
		return this.workerPool.isWasm();
	}

	/**
	 * Whether the current environment should use wasm/worker concurrency methods.
	 * @returns true if running wasm workers and concurrency setting is active.
	 */
	async shouldUseWasmConcurrency() {
		return (await this.isWasm()) && this.getWasmConcurrency() >= 2 && this.workerPool.getNumWorkers() >= 2;
	}

	get db(): Database {
		return this.db_!;
	}

	setModifyRaidProto(newModFn: (raidProto: RaidProto) => void) {
		this.modifyRaidProto = newModFn;
	}

	getModifiedRaidProto(): RaidProto {
		const raidProto = this.raid.toProto(false, true);
		this.modifyRaidProto(raidProto);

		// Remove any inactive meta gems, since the backend doesn't have its own validation.
		raidProto.parties.forEach(party => {
			party.players.forEach(player => {
				if (!player.equipment) {
					return;
				}

				let gear = this.db.lookupEquipmentSpec(player.equipment);
				let gearChanged = false;

				const isBlacksmith = hasBlacksmithing(player);

				// Disable meta gem if inactive.
				if (gear.hasInactiveMetaGem(isBlacksmith)) {
					gear = gear.withoutMetaGem();
					gearChanged = true;
				}

				// Remove bonus sockets if not blacksmith.
				if (!isBlacksmith) {
					gear = gear.withoutBlacksmithSockets();
					gearChanged = true;
				}

				if (gearChanged) {
					player.equipment = gear.asSpec();
				}

				extendPlayerProtoWithMissingEffects(player, this.db);
			});
		});

		return raidProto;
	}

	makeRaidSimRequest(options: RunSimOptions = {}): RaidSimRequest {
		const raid = this.getModifiedRaidProto();
		const encounter = this.encounter.toProto();

		// TODO: remove any replenishment from sim request here? probably makes more sense to do it inside the sim to protect against accidents
		return RaidSimRequest.create({
			requestId: generateRequestId(SimRequest.raidSimAsync),
			type: this.type,
			raid: raid,
			encounter: encounter,
			simOptions: SimOptions.create({
				iterations: options.singleIteration ? 1 : (options.iterations ?? this.getIterations()),
				randomSeed: BigInt(this.nextRngSeed()),
				debugFirstIteration: true,
				debug: options.debug ?? false,
			}),
		});
	}

	async runRaidSim(eventID: EventID, onProgress: WorkerProgressCallback, options: RunSimOptions = {}): Promise<SimResult | ErrorOutcome> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.targets.length < 1) {
			throw new Error('Encounter has no targets! Try adding some targets first.');
		}

		const signals = this.signalManager.registerRunning(RequestTypes.RaidSim);
		try {
			await this.waitForInit();

			const request = this.makeRaidSimRequest(options);

			let result;
			// Only use worker base concurrency when running wasm. Local sim has native threading.
			if (await this.shouldUseWasmConcurrency()) {
				result = await runConcurrentSim(request, this.workerPool, onProgress, signals);
			} else {
				result = await this.workerPool.raidSimAsync(request, onProgress, signals);
			}

			if (result.error) {
				if (result.error.type != ErrorOutcomeType.ErrorOutcomeError) return result.error;
				throw new SimError(result.error.message);
			}

			const simResult = await SimResult.makeNew(request, result);
			if (!options.silent) {
				this.simResultEmitter.emit(eventID, simResult);
			}
			return simResult;
		} catch (error) {
			if (error instanceof SimError) throw error;
			console.error(error);
			throw new Error('Something went wrong running your raid sim. Reload the page and try again.');
		} finally {
			this.signalManager.unregisterRunning(signals);
		}
	}

	// Runs a lightweight version of the sim that uses a gear set and doesn't compute combat logs or other expensive data,
	// and returns the raw result from the sim worker.
	async runRaidSimLightweight(
		gear: Gear,
		onProgress: WorkerProgressCallback,
		options: RunSimOptions = {},
	): Promise<[RaidSimRequest, RaidSimResult] | ErrorOutcome> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.targets.length < 1) {
			throw new Error('Encounter has no targets! Try adding some targets first.');
		}

		const signals = this.signalManager.registerRunning(RequestTypes.RaidSim);
		try {
			await this.waitForInit();

			const request = this.makeRaidSimRequest(options);
			const player = request.raid!.parties[0].players[0];

			// Disable meta gem if inactive.
			const isBlacksmith = hasBlacksmithing(player);
			if (gear.hasInactiveMetaGem(isBlacksmith)) {
				gear = gear.withoutMetaGem();
			}

			// Remove bonus sockets if not blacksmith.
			if (!isBlacksmith) {
				gear = gear.withoutBlacksmithSockets();
			}

			player.database = gear.toDatabase(this.db);
			player.equipment = gear.asSpec();

			request.raid!.parties[0].players[0] = player;

			let result;
			// Only use worker base concurrency when running wasm. Local sim has native threading.
			if (await this.shouldUseWasmConcurrency()) {
				result = await runConcurrentSim(request, this.workerPool, onProgress, signals);
			} else {
				result = await this.workerPool.raidSimAsync(request, onProgress, signals);
			}

			if (result.error) {
				if (result.error.type != ErrorOutcomeType.ErrorOutcomeError) return result.error;
				throw new SimError(result.error.message);
			}

			return [request, result];
		} catch (error) {
			if (error instanceof SimError) throw error;
			console.error(error);
			throw new Error('Something went wrong running your lightweight raid sim. Reload the page and try again.');
		} finally {
			this.signalManager.unregisterRunning(signals);
		}
	}

	async runBulkSim(
		gearSets: Gear[],
		onProgress: WorkerProgressCallback,
		reforgeConfig?: ReforgeOptimizeConfig,
		bulkSettings?: BulkSettings,
		onCacheRestoreProgress?: (progress: BulkSimReforgeCacheProgress) => void,
		abortSignal?: AbortSignal,
	): Promise<BulkSimResult | ErrorOutcome> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.targets.length < 1) {
			throw new Error('Encounter has no targets! Try adding some targets first.');
		}

		const signals = this.signalManager.registerRunning(RequestTypes.RaidSim);
		try {
			await this.waitForInit();

			const requestId = generateRequestId(SimRequest.bulkSimAsync);
			const baseRequest = this.makeRaidSimRequest();
			baseRequest.requestId = requestId;
			baseRequest.simOptions!.debugFirstIteration = false;
			baseRequest.simOptions!.debug = false;

			const player = baseRequest.raid!.parties[0].players[0];
			const isBlacksmith = hasBlacksmithing(player);
			const prepareGear = (gear: Gear) => {
				if (gear.hasInactiveMetaGem(isBlacksmith)) {
					gear = gear.withoutMetaGem();
				}
				if (!isBlacksmith) {
					gear = gear.withoutBlacksmithSockets();
				}
				return gear;
			};

			const baselineGear = prepareGear(this.raid.getActivePlayers()[0].getGear());
			const bulkReforgeRequest = reforgeConfig ? this.makeBulkSimReforgeRequest(reforgeConfig) : undefined;
			const useWasmConcurrency = await this.shouldUseWasmConcurrency();
			const backendBuildCandidates = !useWasmConcurrency && !!bulkSettings;
			let preparedGearSets = gearSets.map(prepareGear);
			let preparedCandidateSpecs: EquipmentSpec[] | undefined = undefined;
			let preparedCandidateGearKeys: string[] | undefined = undefined;
			let preparedCandidateIndices: number[] | undefined = undefined;
			if (backendBuildCandidates && bulkSettings) {
				const bulkCandidatesResult = await this.getBulkCandidates(bulkSettings);
				if (bulkCandidatesResult.error) {
					throw new Error(bulkCandidatesResult.error.message || 'Failed to build bulk candidates');
				}

				const totalCandidates = bulkCandidatesResult.candidates.length;
				onCacheRestoreProgress?.({
					stage: 'candidate-build',
					processedCandidates: 0,
					totalCandidates,
					restoredCandidates: 0,
				});
				preparedCandidateIndices = [];
				preparedCandidateSpecs = [];
				preparedCandidateGearKeys = [];
				let lastYieldAt = performance.now();
				let lastProgressEmitAt = lastYieldAt;
				for (let i = 0; i < bulkCandidatesResult.candidates.length; i++) {
					throwIfAborted(abortSignal);
					const candidate = bulkCandidatesResult.candidates[i];
					if (!candidate.gear) {
						const processedCandidates = i + 1;
						if (processedCandidates % 1024 === 0 || processedCandidates === totalCandidates) {
							const now = performance.now();
							if (processedCandidates === totalCandidates || now - lastProgressEmitAt >= 16) {
								onCacheRestoreProgress?.({
									stage: 'candidate-build',
									processedCandidates,
									totalCandidates,
									restoredCandidates: 0,
								});
								lastProgressEmitAt = now;
							}
						}
						continue;
					}
					preparedCandidateIndices.push(candidate.index);
					preparedCandidateSpecs.push(candidate.gear);
					preparedCandidateGearKeys.push(getGearKeyFromSpec(candidate.gear));
					const processedCandidates = i + 1;
					if (processedCandidates % 1024 === 0 || processedCandidates === totalCandidates) {
						const now = performance.now();
						if (processedCandidates === totalCandidates || now - lastProgressEmitAt >= 16) {
							onCacheRestoreProgress?.({
								stage: 'candidate-build',
								processedCandidates,
								totalCandidates,
								restoredCandidates: 0,
							});
							lastProgressEmitAt = now;
						}
					}

					// Periodically yield so large candidate lists do not block popup/UI rendering.
					if (i % 2000 === 0) {
						const yieldNow = performance.now();
						if (yieldNow - lastYieldAt >= 16) {
							await sleep(0);
							lastYieldAt = performance.now();
						}
					}
				}
			}
			const bulkReforgeCacheData =
				bulkReforgeRequest
					? await getBulkSimReforgeCacheData({
							player: this.raid.getActivePlayers()[0],
							gearSets: backendBuildCandidates ? undefined : preparedGearSets,
							candidateSpecs: backendBuildCandidates ? preparedCandidateSpecs : undefined,
							candidateGearKeys: backendBuildCandidates ? preparedCandidateGearKeys : undefined,
							candidateIndices: preparedCandidateIndices,
							db: this.db,
							reforgeRequest: bulkReforgeRequest,
							raidBuffs: this.raid.getBuffs(),
							partyBuffs: this.raid.getActivePlayers()[0].getParty()?.getBuffs(),
							debuffs: this.raid.getDebuffs(),
							onProgress: onCacheRestoreProgress,
							signal: abortSignal,
						})
					: undefined;
			throwIfAborted(abortSignal);
			const cachedOptimizedGearSets = bulkReforgeCacheData?.cachedOptimizedGearSets ?? [];
			const bulkGearDatabase =
				backendBuildCandidates && bulkSettings
					? makeBulkItemDatabaseFromSpecs(this.db, baselineGear, bulkSettings.items)
					: makeBulkGearDatabase(this.db, [baselineGear, ...preparedGearSets, ...cachedOptimizedGearSets]);
			if (bulkReforgeRequest) {
				const selectedItems =
					bulkSettings?.items.map(itemSpec => this.db.lookupItemSpec(itemSpec)).filter((item): item is NonNullable<typeof item> => item != null) ??
					[];
				const reforgeSourceItems = backendBuildCandidates
					? selectedItems
					: preparedGearSets
							.flatMap(gearSet => gearSet.asArray())
							.filter((equippedItem): equippedItem is NonNullable<typeof equippedItem> => equippedItem != null);
				bulkGearDatabase.reforgeStats = distinct(
					bulkGearDatabase.reforgeStats.concat(reforgeSourceItems.flatMap(equippedItem => this.db.getAvailableReforges(equippedItem.item))),
					(a, b) => a.id == b.id,
				);
				bulkGearDatabase.gems = distinct(
					bulkGearDatabase.gems.concat(
						bulkReforgeRequest.gemOptions.map(gem =>
							SimGem.create({
								id: gem.id,
								name: gem.name,
								color: gem.color,
								stats: gem.stats.slice(),
								disabledInChallengeMode: gem.disabledInChallengeMode,
							}),
						),
					),
					(a, b) => a.id == b.id,
				);
			}
			player.database = player.database ? Database.mergeSimDatabases(player.database, bulkGearDatabase) : bulkGearDatabase;
			player.equipment = baselineGear.asSpec();
			baseRequest.raid!.parties[0].players[0] = player;
			throwIfAborted(abortSignal);
			const requestCandidates =
				bulkReforgeCacheData?.candidates ??
				(backendBuildCandidates
					? (preparedCandidateSpecs ?? []).map((gear, index) => ({
							index: preparedCandidateIndices?.[index] ?? index,
							gear,
					  }))
					: preparedGearSets.map((gear, index) => ({
							index: preparedCandidateIndices?.[index] ?? index,
							gear: gear.asSpec(),
					  })));
			const bulkRequest = BulkSimRequest.create({
				requestId,
				baseRequest,
				candidates: requestCandidates,
				optimizedCandidates: bulkReforgeCacheData?.optimizedCandidates ?? [],
				topResults: 5,
				highStageIterations: bulkSettings?.iterationsPerCombo ?? this.getIterations(),
				reforgeRequest: bulkReforgeRequest,
				bulkSettings,
			});
			let result: BulkSimResult;
			// Only use worker based concurrency when running wasm. Local sim has native threading.
			if (useWasmConcurrency) {
				const cacheWrites: Promise<void>[] = [];
				const onReforgeCandidateOptimized = (candidate: BulkGearCandidate, optimizedGear: EquipmentSpec) => {
					const cacheKey = bulkReforgeCacheData?.cacheKeysByCandidateIndex.get(candidate.index);
					if (cacheKey) cacheWrites.push(bulkReforgeCacheData!.cache.setGear(cacheKey, optimizedGear));
				};
				result = await runConcurrentBulkSim(bulkRequest, this.workerPool, onProgress, signals, onReforgeCandidateOptimized);
				await Promise.all(cacheWrites);
				if (bulkReforgeCacheData && result.optimizedCandidates?.length) {
					await writeBulkSimReforgeCacheResults(result.optimizedCandidates, bulkReforgeCacheData);
				}
			} else {
				// Wrap onProgress to also write partial reforge candidates to cache incrementally
				const cacheWrites: Promise<void>[] = [];
				const wrappedOnProgress: WorkerProgressCallback = (progress: ProgressMetrics) => {
					onProgress(progress);
					// Write partial reforge candidates to cache as they complete
					if (progress.optimizedCandidates?.length && bulkReforgeCacheData) {
						const cacheEntries = progress.optimizedCandidates.flatMap(candidate => {
							const cacheKey = bulkReforgeCacheData.cacheKeysByCandidateIndex.get(candidate.index);
							if (!cacheKey || !candidate.gear) return [];
							return [{ key: cacheKey, optimizedGear: candidate.gear }];
						});
						if (cacheEntries.length) {
							cacheWrites.push(bulkReforgeCacheData.cache.setGearMany(cacheEntries));
						}
					}
				};
				result = await this.workerPool.bulkSimAsync(bulkRequest, wrappedOnProgress, signals);
				// Wait for all cache writes to complete
				await Promise.all(cacheWrites);
				// Still handle final candidates in case any weren't sent via partial updates
				if (bulkReforgeCacheData && result.optimizedCandidates?.length) {
					await writeBulkSimReforgeCacheResults(result.optimizedCandidates, bulkReforgeCacheData);
				}
			}
			if (result.error) {
				if (result.error.type != ErrorOutcomeType.ErrorOutcomeError) return result.error;
				throw new SimError(result.error.message);
			}

			return result;
		} catch (error) {
			if (error instanceof SimError) throw error;
			console.error(error);
			throw new Error('Something went wrong running your bulk sim. Reload the page and try again.');
		} finally {
			this.signalManager.unregisterRunning(signals);
		}
	}

	private makeBulkBaseRequest(bulkSettings: BulkSettings): RaidSimRequest {
		const baseRequest = this.makeRaidSimRequest();
		const player = baseRequest.raid!.parties[0].players[0];
		const isBlacksmith = hasBlacksmithing(player);
		let baselineGear = this.raid.getActivePlayers()[0].getGear();
		if (baselineGear.hasInactiveMetaGem(isBlacksmith)) {
			baselineGear = baselineGear.withoutMetaGem();
		}
		if (!isBlacksmith) {
			baselineGear = baselineGear.withoutBlacksmithSockets();
		}
		const bulkGearDatabase = makeBulkItemDatabaseFromSpecs(this.db, baselineGear, bulkSettings.items);
		player.database = player.database ? Database.mergeSimDatabases(player.database, bulkGearDatabase) : bulkGearDatabase;
		player.equipment = baselineGear.asSpec();
		baseRequest.raid!.parties[0].players[0] = player;
		return baseRequest;
	}

	async getBulkCombinationCount(bulkSettings: BulkSettings): Promise<BulkCombinationCountResult> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.targets.length < 1) {
			throw new Error('Encounter has no targets! Try adding some targets first.');
		}

		await this.waitForInit();
		const baseRequest = this.makeBulkBaseRequest(bulkSettings);
		const request = BulkCombinationCountRequest.create({
			baseRequest,
			bulkSettings,
		});
		return await this.workerPool.bulkCombinationCount(request);
	}

	async getBulkCandidates(bulkSettings: BulkSettings): Promise<BulkCandidatesResult> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.targets.length < 1) {
			throw new Error('Encounter has no targets! Try adding some targets first.');
		}

		await this.waitForInit();
		const baseRequest = this.makeBulkBaseRequest(bulkSettings);
		const request = BulkCandidatesRequest.create({
			baseRequest,
			bulkSettings,
		});
		return await this.workerPool.bulkCandidates(request);
	}

	async runRaidSimWithLogs(eventID: EventID, options: RunSimOptions = {}): Promise<SimResult | null> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.targets.length < 1) {
			throw new Error('Encounter has no targets! Try adding some targets first.');
		}

		const signals = this.signalManager.registerRunning(RequestTypes.RaidSim);
		try {
			await this.waitForInit();

			const request = this.makeRaidSimRequest({ debug: true, ...options });
			const result = await this.workerPool.raidSimAsync(request, noop, signals);
			if (result.error) {
				throw new SimError(result.error.message);
			}
			const simResult = await SimResult.makeNew(request, result);
			if (!options.silent) {
				this.simResultEmitter.emit(eventID, simResult);
			}
			return simResult;
		} catch (error) {
			if (error instanceof SimError) throw error;
			console.error(error);
			throw new Error('Something went wrong running your raid sim. Reload the page and try again.');
		} finally {
			this.signalManager.unregisterRunning(signals);
		}
	}

	// This should be invoked internally whenever stats might have changed.
	async updateCharacterStats(eventID: EventID) {
		if (eventID == 0) {
			// Skip the first event ID because it interferes with the loaded stats.
			return;
		}
		eventID = TypedEvent.nextEventID();

		await this.waitForInit();
		// Capture the current players so we avoid issues if something changes while
		// request is in-flight.

		const players = this.raid.getPlayers();
		const req = ComputeStatsRequest.create({
			raid: this.getModifiedRaidProto(),
			encounter: this.encounter.toProto(),
		});
		const result = await this.workerPool.computeStats(req);
		if (result.errorResult != '') {
			this.crashEmitter.emit(eventID, new SimError(result.errorResult));
			return;
		}

		TypedEvent.freezeAllAndDo(async () => {
			const playerUpdatePromises = result
				.raidStats!.parties.map((partyStats, partyIndex) =>
					partyStats.players.map((playerStats, playerIndex) => {
						const player = players[partyIndex * 5 + playerIndex];
						if (player) {
							player.setCurrentStats(eventID, playerStats);
							return player.updateMetadata();
						} else {
							return null;
						}
					}),
				)
				.flat()
				.filter(p => p != null) as Array<Promise<boolean>>;

			const targetUpdatePromise = this.encounter.targetsMetadata.update(result.encounterStats!.targets.map(t => t.metadata!));

			const anyUpdates = await Promise.all(playerUpdatePromises.concat([targetUpdatePromise]));
			if (anyUpdates.some(v => v)) {
				this.unitMetadataEmitter.emit(eventID);
			}
		});
	}

	// Returns the stats for Player 0 without triggering any metadata updates.
	// Can be used for Suggest Gems / Batch Simming without interfering with the UI.
	async getCharacterStatsForGear(eventID: EventID, gear: Gear): Promise<PlayerStats> {
		await this.waitForInit();

		const raidProto = this.raid.toProto(false, true);
		this.modifyRaidProto(raidProto);

		const player = raidProto.parties[0].players[0];

		const isBlacksmith = hasBlacksmithing(player);

		// Disable meta gem if inactive.
		if (gear.hasInactiveMetaGem(isBlacksmith)) {
			gear = gear.withoutMetaGem();
		}

		// Remove bonus sockets if not blacksmith.
		if (!isBlacksmith) {
			gear = gear.withoutBlacksmithSockets();
		}

		player.database = gear.toDatabase(this.db);
		player.equipment = gear.asSpec();

		extendPlayerProtoWithMissingEffects(player, this.db);
		raidProto.parties[0].players[0] = player;

		const req = ComputeStatsRequest.create({
			raid: raidProto,
			encounter: this.encounter.toProto(),
		});

		const result = await this.workerPool.computeStats(req);
		if (result.errorResult != '') {
			this.crashEmitter.emit(eventID, new SimError(result.errorResult));
		}

		return result.raidStats!.parties[0].players[0];
	}

	async reforgeOptimize(config: ReforgeOptimizeConfig): Promise<ReforgeOptimizeResult> {
		const signals = this.signalManager.registerRunning(RequestTypes.ReforgeOptimize);
		try {
			await this.waitForInit();
			const gemOptions = ReforgeOptimizer.getReforgeGemOptions(this.db, config.settings);
			const raid = this.getModifiedRaidProto();
			const player = raid.parties[0].players[0];
			player.database = config.gear.toDatabase(this.db);
			player.database.reforgeStats = distinct(
				player.database.reforgeStats.concat(
					config.gear.asArray().flatMap(equippedItem => (equippedItem ? this.db.getAvailableReforges(equippedItem.item) : [])),
				),
				(a, b) => a.id == b.id,
			);
			player.database.gems = distinct(
				player.database.gems.concat(
					gemOptions.map(gem =>
						SimGem.create({
							id: gem.id,
							name: gem.name,
							color: gem.color,
							stats: gem.stats.slice(),
							disabledInChallengeMode: gem.disabledInChallengeMode,
						}),
					),
				),
				(a, b) => a.id == b.id,
			);
			player.equipment = config.gear.asSpec();
			raid.parties[0].players[0] = player;

			const request = ReforgeOptimizeRequest.create({
				requestId: generateRequestId(SimRequest.reforgeOptimizeAsync),
				raid,
				...ReforgeOptimizer.makeReforgeConfigRequestFields(config, this.db),
				debug: config.debug ?? false,
			});
			const result = await this.workerPool.reforgeOptimizeAsync(request, signals);
			if (result.error) {
				throw new SimError(result.error.message);
			}
			return result;
		} finally {
			this.signalManager.unregisterRunning(signals);
		}
	}

	private makeBulkSimReforgeRequest(config: ReforgeOptimizeConfig): ReforgeOptimizeRequest {
		return ReforgeOptimizeRequest.create({
			requestId: generateRequestId(SimRequest.reforgeOptimizeAsync),
			...ReforgeOptimizer.makeReforgeConfigRequestFields(config, this.db),
		});
	}

	async statWeights(
		player: Player<any>,
		epStats: Array<Stat>,
		epPseudoStats: Array<PseudoStat>,
		epReferenceStat: Stat,
		onProgress: WorkerProgressCallback,
	): Promise<StatWeightsResult> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.targets.length < 1) {
			throw new Error('Encounter has no targets! Try adding some targets first.');
		}

		await this.waitForInit();

		if (player.getParty() == null) {
			console.warn('Trying to get stat weights without a party!');
			return StatWeightsResult.create();
		} else {
			const tanks = this.raid
				.getTanks()
				.map(tank => tank.index)
				.includes(player.getRaidIndex())
				? [UnitReference.create({ type: UnitType.Player, index: 0 })]
				: [];
			const request = StatWeightsRequest.create({
				player: player.toProto(false, true),
				raidBuffs: this.raid.getBuffs(),
				partyBuffs: player.getParty()!.getBuffs(),
				debuffs: this.raid.getDebuffs(),
				encounter: this.encounter.toProto(),
				simOptions: SimOptions.create({
					iterations: this.getIterations(),
					randomSeed: BigInt(this.nextRngSeed()),
					debug: false,
				}),
				tanks: tanks,

				statsToWeigh: epStats,
				pseudoStatsToWeigh: epPseudoStats,
				epReferenceStat: epReferenceStat,
			});

			const signals = this.signalManager.registerRunning(RequestTypes.StatWeights);
			try {
				let result: StatWeightsResult;
				// Only use worker based concurrency when running wasm.
				if (await this.shouldUseWasmConcurrency()) {
					result = await runConcurrentStatWeights(request, this.workerPool, onProgress, signals);
				} else {
					result = await this.workerPool.statWeightsAsync(request, onProgress, signals);
				}
				if (result.error) {
					if (result.error.type != ErrorOutcomeType.ErrorOutcomeError) return result;
					throw new SimError(result.error.message);
				}
				return result;
			} catch (error) {
				if (error instanceof SimError) throw error;
				console.error(error);
				throw new Error('Something went wrong calculating your stat weights. Reload the page and try again.');
			} finally {
				this.signalManager.unregisterRunning(signals);
			}
		}
	}

	getUnitMetadata(ref: UnitReference | undefined, contextPlayer: Player<any> | null, defaultRef: UnitReference): UnitMetadata | undefined {
		if (!ref || ref.type == UnitType.Unknown) {
			return this.getUnitMetadata(defaultRef, contextPlayer, defaultRef);
		} else if (ref.type == UnitType.Player) {
			return this.raid.getPlayerFromUnitReference(ref)?.getMetadata();
		} else if (ref.type == UnitType.Target) {
			return this.encounter.targetsMetadata.asList()[ref.index];
		} else if (ref.type == UnitType.Pet) {
			const owner = this.raid.getPlayerFromUnitReference(ref.owner, contextPlayer);
			if (owner) {
				return owner.getPetMetadatas().asList()[ref.index];
			} else {
				return undefined;
			}
		} else if (ref.type == UnitType.Self) {
			return contextPlayer?.getMetadata();
		} else if (ref.type == UnitType.CurrentTarget) {
			return this.encounter.targetsMetadata.asList()[0];
		}
		return undefined;
	}

	getPhase(): number {
		return this.phase;
	}
	setPhase(eventID: EventID, newPhase: number) {
		if (newPhase != this.phase) {
			this.phase = newPhase;
			this.phaseChangeEmitter.emit(eventID);
		}
	}

	getFaction(): Faction {
		return this.faction;
	}
	setFaction(eventID: EventID, newFaction: Faction) {
		if (newFaction != this.faction && !!newFaction) {
			this.faction = newFaction;
			this.factionChangeEmitter.emit(eventID);
		}
	}

	getFixedRngSeed(): number {
		return this.fixedRngSeed;
	}
	setFixedRngSeed(eventID: EventID, newFixedRngSeed: number) {
		if (newFixedRngSeed != this.fixedRngSeed) {
			this.fixedRngSeed = newFixedRngSeed;
			this.fixedRngSeedChangeEmitter.emit(eventID);
		}
	}

	static MAX_RNG_SEED = Math.pow(2, 32) - 1;
	private nextRngSeed(): number {
		let rngSeed = 0;
		if (this.fixedRngSeed) {
			rngSeed = this.fixedRngSeed;
		} else {
			rngSeed = Math.floor(Math.random() * Sim.MAX_RNG_SEED);
		}

		this.lastUsedRngSeed = rngSeed;
		this.lastUsedRngSeedChangeEmitter.emit(TypedEvent.nextEventID());
		return rngSeed;
	}
	getLastUsedRngSeed(): number {
		return this.lastUsedRngSeed;
	}

	getFilters(): DatabaseFilters {
		// Make a defensive copy
		return DatabaseFilters.clone(this.filters);
	}
	setFilters(eventID: EventID, newFilters: DatabaseFilters) {
		if (DatabaseFilters.equals(newFilters, this.filters)) {
			return;
		}

		// Make a defensive copy
		this.filters = DatabaseFilters.clone(newFilters);
		this.filtersChangeEmitter.emit(eventID);
	}

	getShowDamageMetrics(): boolean {
		return this.showDamageMetrics;
	}
	setShowDamageMetrics(eventID: EventID, newShowDamageMetrics: boolean) {
		if (newShowDamageMetrics != this.showDamageMetrics) {
			this.showDamageMetrics = newShowDamageMetrics;
			this.showDamageMetricsChangeEmitter.emit(eventID);
		}
	}

	getShowThreatMetrics(): boolean {
		return this.showThreatMetrics;
	}
	setShowThreatMetrics(eventID: EventID, newShowThreatMetrics: boolean) {
		if (newShowThreatMetrics != this.showThreatMetrics) {
			this.showThreatMetrics = newShowThreatMetrics;
			this.showThreatMetricsChangeEmitter.emit(eventID);
		}
	}

	getShowHealingMetrics(): boolean {
		return (
			this.showHealingMetrics ||
			(this.showThreatMetrics &&
				[Spec.SpecBloodDeathKnight, Spec.SpecGuardianDruid, Spec.SpecBrewmasterMonk, Spec.SpecProtectionPaladin, Spec.SpecProtectionWarrior].includes(
					this.raid.getPlayer(0)?.playerSpec.specID,
				))
		);
	}
	setShowHealingMetrics(eventID: EventID, newShowHealingMetrics: boolean) {
		if (newShowHealingMetrics != this.showHealingMetrics) {
			this.showHealingMetrics = newShowHealingMetrics;
			this.showHealingMetricsChangeEmitter.emit(eventID);
		}
	}

	getShowExperimental(): boolean {
		return this.showExperimental;
	}
	setShowExperimental(eventID: EventID, newShowExperimental: boolean) {
		if (newShowExperimental != this.showExperimental) {
			this.showExperimental = newShowExperimental;
			this.showExperimentalChangeEmitter.emit(eventID);
		}
	}

	getWasmConcurrency(): number {
		return this.wasmConcurrency;
	}
	setWasmConcurrency(eventID: EventID, newWasmConcurrency: number) {
		if (newWasmConcurrency != this.wasmConcurrency) {
			this.wasmConcurrency = newWasmConcurrency;
			window.localStorage.setItem(WASM_CONCURRENCY_STORAGE_KEY, newWasmConcurrency.toString());
			this.wasmConcurrencyChangeEmitter.emit(eventID);
		}
	}

	getShowQuickSwap(): boolean {
		return !hasTouch() && this.showQuickSwap;
	}
	setShowQuickSwap(eventID: EventID, newShowQuickSwap: boolean) {
		if (newShowQuickSwap != this.showQuickSwap) {
			this.showQuickSwap = newShowQuickSwap;
			this.showQuickSwapChangeEmitter.emit(eventID);
		}
	}

	getShowEPValues(): boolean {
		return this.showEPValues;
	}
	setShowEPValues(eventID: EventID, newShowEPValues: boolean) {
		if (newShowEPValues != this.showEPValues) {
			this.showEPValues = newShowEPValues;
			this.showEPValuesChangeEmitter.emit(eventID);
		}
	}

	getLanguage(): string {
		return this.language;
	}
	setLanguage(eventID: EventID, newLanguage: string) {
		newLanguage = newLanguage || 'en';
		if (newLanguage != this.language) {
			this.language = newLanguage;
			this.languageChangeEmitter.emit(eventID);
		}
	}

	getIterations(): number {
		return this.iterations;
	}
	setIterations(eventID: EventID, newIterations: number) {
		if (newIterations != this.iterations) {
			this.iterations = newIterations;
			this.iterationsChangeEmitter.emit(eventID);
		}
	}

	static readonly ALL_ARMOR_TYPES = (getEnumValues(ArmorType) as Array<ArmorType>).filter(v => v != 0);
	static readonly ALL_WEAPON_TYPES = (getEnumValues(WeaponType) as Array<WeaponType>).filter(v => v != 0);
	static readonly ALL_RANGED_WEAPON_TYPES = (getEnumValues(RangedWeaponType) as Array<RangedWeaponType>).filter(v => v != 0);
	static readonly ALL_SOURCES = (getEnumValues(SourceFilterOption) as Array<SourceFilterOption>).filter(v => v != 0);
	static readonly ALL_RAIDS = (getEnumValues(RaidFilterOption) as Array<RaidFilterOption>).filter(v => v != 0);

	toProto(): SimSettingsProto {
		const filters = this.getFilters();
		if (filters.armorTypes.length == Sim.ALL_ARMOR_TYPES.length) {
			filters.armorTypes = [];
		}
		if (filters.weaponTypes.length == Sim.ALL_WEAPON_TYPES.length) {
			filters.weaponTypes = [];
		}
		if (filters.rangedWeaponTypes.length == Sim.ALL_RANGED_WEAPON_TYPES.length) {
			filters.rangedWeaponTypes = [];
		}
		if (filters.sources.length == Sim.ALL_SOURCES.length) {
			filters.sources = [];
		}
		if (filters.raids.length == Sim.ALL_RAIDS.length) {
			filters.raids = [];
		}

		return SimSettingsProto.create({
			iterations: this.getIterations(),
			phase: this.getPhase(),
			fixedRngSeed: BigInt(this.getFixedRngSeed()),
			showDamageMetrics: this.getShowDamageMetrics(),
			showThreatMetrics: this.getShowThreatMetrics(),
			showHealingMetrics: this.getShowHealingMetrics(),
			showExperimental: this.getShowExperimental(),
			showQuickSwap: this.getShowQuickSwap(),
			showEpValues: this.getShowEPValues(),
			language: this.getLanguage(),
			faction: this.getFaction(),
			filters: filters,
		});
	}

	fromProto(eventID: EventID, proto: SimSettingsProto) {
		TypedEvent.freezeAllAndDo(() => {
			this.setIterations(eventID, proto.iterations || 12500);
			this.setPhase(eventID, proto.phase || CURRENT_PHASE);
			this.setFixedRngSeed(eventID, Number(proto.fixedRngSeed));
			this.setShowDamageMetrics(eventID, proto.showDamageMetrics);
			this.setShowThreatMetrics(eventID, proto.showThreatMetrics);
			this.setShowHealingMetrics(eventID, proto.showHealingMetrics);
			this.setShowExperimental(eventID, proto.showExperimental);
			this.setShowQuickSwap(eventID, proto.showQuickSwap);
			this.setShowEPValues(eventID, proto.showEpValues);
			this.setLanguage(eventID, proto.language);
			this.setFaction(eventID, proto.faction || Faction.Alliance);

			const filters = proto.filters || Sim.defaultFilters();
			if (filters.armorTypes.length == 0) {
				if (this.type == SimType.SimTypeIndividual) {
					// For Individual sims, by default only show the class's default armor type because of armor specialization
					filters.armorTypes = [this.raid.getActivePlayers()[0].getPlayerClass().armorTypes[0]];
				} else {
					filters.armorTypes = Sim.ALL_ARMOR_TYPES.slice();
				}
			}
			if (filters.weaponTypes.length == 0) {
				filters.weaponTypes = Sim.ALL_WEAPON_TYPES.slice();
			}
			if (filters.rangedWeaponTypes.length == 0) {
				filters.rangedWeaponTypes = Sim.ALL_RANGED_WEAPON_TYPES.slice();
			}
			if (filters.sources.length == 0) {
				filters.sources = Sim.ALL_SOURCES.slice();
			}
			if (filters.raids.length == 0) {
				filters.raids = Sim.ALL_RAIDS.slice();
			}
			this.setFilters(eventID, filters);
		});
	}

	applyDefaults(eventID: EventID, isTankSim: boolean, isHealingSim: boolean) {
		this.fromProto(
			eventID,
			SimSettingsProto.create({
				iterations: 12500,
				phase: CURRENT_PHASE,
				faction: Faction.Alliance,
				showDamageMetrics: !isHealingSim,
				showThreatMetrics: isTankSim,
				showHealingMetrics: isHealingSim,
				showQuickSwap: true,
				language: this.getLanguage(), // Don't change language.
				filters: Sim.defaultFilters(),
				showEpValues: false,
				useSoftCapBreakpoints: true,
			}),
		);
	}

	static defaultFilters(): DatabaseFilters {
		return DatabaseFilters.create({
			oneHandedWeapons: true,
			twoHandedWeapons: true,
		});
	}
}

export class SimError extends Error {
	readonly errorStr: string;

	constructor(errorStr: string) {
		super(errorStr);
		this.errorStr = errorStr;
	}
}
