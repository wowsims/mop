import {
	BulkCandidatesRequest,
	BulkCandidatesResult,
	BulkCombinationCountRequest,
	BulkCombinationCountResult,
	BulkGearCandidate,
	BulkSettings,
	BulkSimRequest,
	BulkSimResult,
	ComputeStatsRequest,
	ErrorOutcome,
	ErrorOutcomeType,
	PlayerStats,
	ProgressMetrics,
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
} from '@generated/proto/api';
import {
	ArmorType,
	EquipmentSpec,
	Faction,
	GemColor,
	PseudoStat,
	RangedWeaponType,
	Spec,
	Stat,
	UnitReference,
	UnitReference_Type as UnitType,
	WeaponType,
} from '@generated/proto/common';
import { SimDatabase, SimGem } from '@generated/proto/db';
import { DatabaseFilters, RaidFilterOption, SimSettings as SimSettingsProto, SourceFilterOption, UIItem } from '@generated/proto/ui';
import { getLang } from '@i18n/locale_service';
import { SimRequest } from '@worker/types';

import { hasTouch } from '../shared/bootstrap_overrides';
import {
	BULK_CACHE_PROGRESS_CHECK_MODULO,
	BULK_CACHE_YIELD_BUDGET_MS,
	type BulkSimReforgeCacheProgress,
	getBulkSimReforgeCacheData,
	makeBulkGearDatabase,
	makeBulkItemDatabaseFromSpecs,
	throwIfAborted,
	writeBulkSimReforgeCacheResults,
} from './bulk/utils';
import { CURRENT_PHASE, LOCAL_STORAGE_PREFIX } from './constants/other';
import { Encounter } from './encounter';
import { Player, UnitMetadata } from './player';
import { Database } from './proto_utils/database';
import { Gear } from './proto_utils/gear';
import { SimResult } from './proto_utils/sim_result';
import { StatCap, Stats } from './proto_utils/stats';
import { extendPlayerProtoWithMissingEffects, getReforgeCacheGearKey, hasBlacksmithing } from './proto_utils/utils';
import { Raid } from './raid';
import { RequestTypes, SimSignalManager } from './sim_signal_manager';
import { batch } from './state/batch';
import type { Env } from './state/env';
import { Emitter } from './state/events';
import { cacheRelevantReforgeRequest, getReforgeGemOptions, makeReforgeConfigRequestFields } from './state/reforge_request';
import { createSimStore, patchSlice, SimSettingsSlice, UISlice } from './state/sim_store';
import { subscribeStatsInputs, subscribeUiField } from './state/subscriptions';
import { distinct, environmentOf, getEnumValues, hashString, noop, sleep } from './utils';
import { runConcurrentBulkSim, runConcurrentSim, runConcurrentStatWeights } from './wasm';
import { generateRequestId, WorkerPool, WorkerProgressCallback } from './worker_pool';

export const WASM_CONCURRENCY_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}_wasmconcurrency`;
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

interface SimProps {
	// The type of sim. Default `SimType.SimTypeIndividual`
	type?: SimType;
	// Browser adapter used by the domain layer (storage / location / hardware /
	// page hide). Page entries pass `browserEnv`; test harnesses an in-memory one.
	env: Env;
}

export type RunSimOptions = {
	silent?: boolean; // If true, don't emit the simResultEmitter event.
	debug?: boolean;
	singleIteration?: boolean; // If true, only run a single iteration (for testing purposes).
	iterations?: number;
};

// Core Sim module which deals only with api types, no UI-related stuff.
export class Sim {
	private readonly workerPool: WorkerPool;

	readonly type: SimType;
	// Browser adapter for the domain layer; see state/env.ts.
	readonly env: Env;
	readonly raid: Raid;
	readonly encounter: Encounter;

	private db_: Database | null = null;

	// The Zustand store backing this sim's state (see state/sim_store.ts).
	// Declared before the facades that write it.
	readonly store = createSimStore();

	private set(patch: Partial<SimSettingsSlice>) {
		patchSlice(this.store, 'sim', patch);
	}

	readonly crashEmitter = new Emitter<SimError>();

	// Fires when a raid sim API call completes.
	readonly simResultEmitter = new Emitter<SimResult>();

	private readonly _initPromise: Promise<any>;
	isNative: boolean | undefined = undefined;

	// These callbacks are needed so we can apply BuffBot modifications automatically before sending requests.
	private modifyRaidProto: (raidProto: RaidProto) => void = noop;

	readonly signalManager: SimSignalManager;

	constructor({ type, env }: SimProps) {
		this.type = type ?? SimType.SimTypeIndividual;
		this.env = env;

		this.workerPool = new WorkerPool(1);
		subscribeUiField(
			this,
			'wasmConcurrency',
		)(async () => {
			// Prevent using worker concurrency when not running wasm. Local sim has native threading.
			if (await this.workerPool.isWasm()) {
				const nWorker = Math.max(1, Math.min(this.getWasmConcurrency(), this.env.hardwareConcurrency));
				this.workerPool.setNumWorkers(nWorker);
			}
		});

		let wasmConcurrencySetting = parseInt(this.env.storage.getItem(WASM_CONCURRENCY_STORAGE_KEY) ?? 'NaN');
		if (isNaN(wasmConcurrencySetting)) {
			wasmConcurrencySetting = 0;
			// Set a default worker count if env supports multiple threads. Should not be too high as to be safe for all situations.
			// TODO: Set based on browser/engine? E.g. Firefox has significant RAM and CPU usage per worker while Chrome can run many without a downside.
			if (this.env.hardwareConcurrency > 1) {
				wasmConcurrencySetting = Math.min(4, Math.floor(this.env.hardwareConcurrency / 2));
			}
		}
		this.setWasmConcurrency(wasmConcurrencySetting);

		this.signalManager = new SimSignalManager();

		this._initPromise = Database.get().then(async db => {
			this.db_ = db;
			await this.resolveIsNative();
		});

		this.raid = new Raid(this);
		this.encounter = new Encounter(this);

		// Stats recompute on any raid/encounter change — one selector, so a batch
		// touching both recomputes once. Skipped while the initial settings load
		// is applying: those settings already carry the stats they were saved with.
		subscribeStatsInputs(this)(() => {
			if (this.applyingLoadedSettings) return;
			this.updateCharacterStats();
		});

		// Initial language write: initialization, not a change.
		this.store.setState(s => ({ ui: { ...s.ui, language: getLang() } }));
	}

	// True only while loadIndividualSettings is applying stored settings; see the
	// stats subscription in the constructor. Replaces a guard that recognised the
	// load by its EventID being 0, which stopped working once subscribers minted
	// their own ids instead of receiving the originating one.
	private applyingLoadedSettings = false;

	// Runs `apply` with the initial-settings-load flag set. Anything that does not
	// go through here keeps the normal recompute-on-change behaviour.
	applyLoadedSettings<T>(apply: () => T): T {
		this.applyingLoadedSettings = true;
		try {
			return apply();
		} finally {
			this.applyingLoadedSettings = false;
		}
	}

	waitForInit(): Promise<void> {
		return this._initPromise;
	}

	private async resolveIsNative() {
		try {
			this.isNative = !(await this.isWasm());
		} catch {
			// Probe failed - fall back to the hostname heuristic (a local host runs the
			// native sim, an external one runs wasm).
			this.isNative = environmentOf(this.env.location.hostname) === 'local';
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

	async runRaidSim(onProgress: WorkerProgressCallback, options: RunSimOptions = {}): Promise<SimResult | ErrorOutcome> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.getTargets().length < 1) {
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
				this.simResultEmitter.emit(simResult);
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
		} else if (this.encounter.getTargets().length < 1) {
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

	// Normalizes gear for a bulk/reforge request
	private static prepareBulkGear(gear: Gear, isBlacksmith: boolean): Gear {
		if (gear.hasInactiveMetaGem(isBlacksmith)) {
			gear = gear.withoutMetaGem();
		}
		if (!isBlacksmith) {
			gear = gear.withoutBlacksmithSockets();
		}
		return gear;
	}

	// Extends a request's SimDatabase with the reforges available on the given items and with
	// the optimizer's gem options, so the backend optimizer can resolve them.
	private augmentDatabaseForReforge(
		database: SimDatabase,
		items: UIItem[],
		gemOptions: Array<{ id: number; name: string; color: GemColor; stats: number[]; disabledInChallengeMode: boolean }>,
	): void {
		database.reforgeStats = distinct(database.reforgeStats.concat(items.flatMap(item => this.db.getAvailableReforges(item))), (a, b) => a.id == b.id);
		database.gems = distinct(
			database.gems.concat(
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
		} else if (this.encounter.getTargets().length < 1) {
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
			const prepareGear = (gear: Gear) => Sim.prepareBulkGear(gear, isBlacksmith);

			const baselineGear = prepareGear(this.raid.getActivePlayers()[0].getGear());
			const bulkReforgeRequest = reforgeConfig ? this.makeBulkSimReforgeRequest(reforgeConfig) : undefined;
			if (!this.getFixedRngSeed()) {
				// Derive the seed from the run's content instead of Math.random(): the same
				// setup then reproduces bit-identical results (the whole pipeline is
				// deterministic given a seed), while any change to the setup draws a fresh
				// sample. An explicit fixed RNG seed still takes precedence above. The three
				// parts are hashed individually (they are already JSON) and the digests
				// combined, avoiding a second full serialization pass.
				const contentHash = hashString(
					hashString(EquipmentSpec.toJsonString(baselineGear.asSpec())) +
						hashString(bulkSettings ? BulkSettings.toJsonString(bulkSettings) : String(gearSets.length)) +
						hashString(bulkReforgeRequest ? ReforgeOptimizeRequest.toJsonString(cacheRelevantReforgeRequest(bulkReforgeRequest)) : ''),
				);
				const contentSeed = Number(BigInt('0x' + contentHash.slice(0, 8)));
				baseRequest.simOptions!.randomSeed = BigInt(contentSeed);
				// makeRaidSimRequest already drew and recorded a random seed; overwrite the
				// record too so getLastUsedRngSeed() reflects the seed actually used.
				this.setLastUsedRngSeed(contentSeed);
			}
			const useWasmBulkSim = await this.isWasm();
			const backendBuildCandidates = !useWasmBulkSim && !!bulkSettings;
			const preparedGearSets = gearSets.map(prepareGear);
			let preparedCandidates: Array<{ index: number; spec: EquipmentSpec; gearKey: string }> | undefined = undefined;
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
				const candidates: Array<{ index: number; spec: EquipmentSpec; gearKey: string }> = [];
				const frozenItemSlots =
					bulkReforgeRequest?.settings?.freezeItemSlots && bulkReforgeRequest.settings.frozenItemSlots.length
						? bulkReforgeRequest.settings.frozenItemSlots
						: undefined;
				let lastYieldAt = performance.now();
				let lastProgressEmitAt = lastYieldAt;
				const reportCandidateBuildProgress = (processedCandidates: number) => {
					if (processedCandidates % BULK_CACHE_PROGRESS_CHECK_MODULO !== 0 && processedCandidates !== totalCandidates) return;
					const now = performance.now();
					if (processedCandidates !== totalCandidates && now - lastProgressEmitAt < BULK_CACHE_YIELD_BUDGET_MS) return;
					onCacheRestoreProgress?.({
						stage: 'candidate-build',
						processedCandidates,
						totalCandidates,
						restoredCandidates: 0,
					});
					lastProgressEmitAt = now;
				};
				for (let i = 0; i < bulkCandidatesResult.candidates.length; i++) {
					throwIfAborted(abortSignal);
					const candidate = bulkCandidatesResult.candidates[i];
					if (candidate.gear) {
						// Prepare spec (remove meta gems, blacksmith sockets) before computing cache key
						// so cache key matches what would be computed from prepared Gear objects
						const preparedGear = prepareGear(this.db.lookupEquipmentSpec(candidate.gear));
						const preparedSpec = preparedGear.asSpec();
						candidates.push({
							index: candidate.index,
							spec: preparedSpec,
							gearKey: getReforgeCacheGearKey(preparedSpec, frozenItemSlots),
						});
					}
					reportCandidateBuildProgress(i + 1);

					// Periodically yield so large candidate lists do not block popup/UI rendering.
					if (i % 2000 === 0) {
						const yieldNow = performance.now();
						if (yieldNow - lastYieldAt >= BULK_CACHE_YIELD_BUDGET_MS) {
							await sleep(0);
							lastYieldAt = performance.now();
						}
					}
				}
				preparedCandidates = candidates;
			}
			const bulkReforgeCacheData = bulkReforgeRequest
				? await getBulkSimReforgeCacheData({
						player: this.raid.getActivePlayers()[0],
						gearSets: backendBuildCandidates ? undefined : preparedGearSets,
						candidateSpecs: preparedCandidates?.map(candidate => candidate.spec),
						candidateGearKeys: preparedCandidates?.map(candidate => candidate.gearKey),
						candidateIndices: preparedCandidates?.map(candidate => candidate.index),
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
				this.augmentDatabaseForReforge(
					bulkGearDatabase,
					reforgeSourceItems.map(equippedItem => equippedItem.item),
					bulkReforgeRequest.gemOptions,
				);
			}
			player.database = player.database ? Database.mergeSimDatabases(player.database, bulkGearDatabase) : bulkGearDatabase;
			player.equipment = baselineGear.asSpec();
			baseRequest.raid!.parties[0].players[0] = player;
			throwIfAborted(abortSignal);
			const requestCandidates =
				bulkReforgeCacheData?.candidates ??
				preparedCandidates?.map(candidate => ({ index: candidate.index, gear: candidate.spec })) ??
				preparedGearSets.map((gear, index) => ({ index, gear: gear.asSpec() }));
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
			// Incremental cache writes for reforge results as candidates complete; keys written
			// here are excluded from the final catch-all write below.
			const cacheWrites: Promise<void>[] = [];
			const incrementallyWrittenKeys = new Set<string>();
			const writeCacheEntriesIncrementally = (candidates: BulkGearCandidate[]) => {
				if (!bulkReforgeCacheData) return;
				const cacheEntries: Array<{ key: string; optimizedGear: EquipmentSpec }> = [];
				for (const candidate of candidates) {
					const cacheKey = bulkReforgeCacheData.cacheKeysByCandidateIndex.get(candidate.index);
					if (!cacheKey || !candidate.gear) {
						continue;
					}
					incrementallyWrittenKeys.add(cacheKey);
					cacheEntries.push({ key: cacheKey, optimizedGear: candidate.gear });
				}
				if (cacheEntries.length) {
					cacheWrites.push(bulkReforgeCacheData.cache.setGearMany(cacheEntries));
				}
			};
			// Only use worker based concurrency when running wasm. Local sim has native threading.
			if (useWasmBulkSim) {
				const pendingCandidates: BulkGearCandidate[] = [];
				const onReforgeCandidateOptimized = (candidate: BulkGearCandidate, optimizedGear: EquipmentSpec) => {
					pendingCandidates.push(BulkGearCandidate.create({ index: candidate.index, gear: optimizedGear }));
					if (pendingCandidates.length >= 500) {
						writeCacheEntriesIncrementally(pendingCandidates.splice(0));
					}
				};
				result = await runConcurrentBulkSim(bulkRequest, this.workerPool, onProgress, signals, onReforgeCandidateOptimized);
				writeCacheEntriesIncrementally(pendingCandidates.splice(0));
			} else {
				// Wrap onProgress to also write partial reforge candidates to cache incrementally
				const wrappedOnProgress: WorkerProgressCallback = (progress: ProgressMetrics) => {
					onProgress(progress);
					if (progress.optimizedCandidates?.length) {
						writeCacheEntriesIncrementally(progress.optimizedCandidates);
					}
				};
				result = await this.workerPool.bulkSimAsync(bulkRequest, wrappedOnProgress, signals);
			}
			// Wait for all incremental cache writes, then write any candidates that never came
			// through a partial update (e.g. solves that deduplicated onto another candidate).
			await Promise.all(cacheWrites);
			if (bulkReforgeCacheData && result.optimizedCandidates?.length) {
				const remainingCandidates = result.optimizedCandidates.filter(candidate => {
					const cacheKey = bulkReforgeCacheData.cacheKeysByCandidateIndex.get(candidate.index);
					return cacheKey && !incrementallyWrittenKeys.has(cacheKey);
				});
				if (remainingCandidates.length) {
					await writeBulkSimReforgeCacheResults(remainingCandidates, bulkReforgeCacheData);
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
		const baselineGear = Sim.prepareBulkGear(this.raid.getActivePlayers()[0].getGear(), isBlacksmith);
		const bulkGearDatabase = makeBulkItemDatabaseFromSpecs(this.db, baselineGear, bulkSettings.items);
		player.database = player.database ? Database.mergeSimDatabases(player.database, bulkGearDatabase) : bulkGearDatabase;
		player.equipment = baselineGear.asSpec();
		baseRequest.raid!.parties[0].players[0] = player;
		return baseRequest;
	}

	async getBulkCombinationCount(bulkSettings: BulkSettings): Promise<BulkCombinationCountResult> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.getTargets().length < 1) {
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
		} else if (this.encounter.getTargets().length < 1) {
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

	async runRaidSimWithLogs(options: RunSimOptions = {}): Promise<SimResult | null> {
		if (this.raid.isEmpty()) {
			throw new Error('Raid is empty! Try adding some players first.');
		} else if (this.encounter.getTargets().length < 1) {
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
				this.simResultEmitter.emit(simResult);
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
	async updateCharacterStats() {
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
			this.crashEmitter.emit(new SimError(result.errorResult));
			return;
		}

		batch(async () => {
			const playerUpdatePromises = result
				.raidStats!.parties.map((partyStats, partyIndex) =>
					partyStats.players.map((playerStats, playerIndex) => {
						const player = players[partyIndex * 5 + playerIndex];
						if (player) {
							player.setCurrentStats(playerStats);
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
				this.store.setState(s => ({ sim: { ...s.sim, metadataVersion: s.sim.metadataVersion + 1 } }));
			}
		});
	}

	// Returns the stats for Player 0 without triggering any metadata updates.
	// Can be used for Suggest Gems / Batch Simming without interfering with the UI.
	async getCharacterStatsForGear(gear: Gear): Promise<PlayerStats> {
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
			this.crashEmitter.emit(new SimError(result.errorResult));
		}

		return result.raidStats!.parties[0].players[0];
	}

	async reforgeOptimize(config: ReforgeOptimizeConfig): Promise<ReforgeOptimizeResult> {
		const signals = this.signalManager.registerRunning(RequestTypes.ReforgeOptimize);
		try {
			await this.waitForInit();
			const gemOptions = getReforgeGemOptions(this.db, config.settings);
			const raid = this.getModifiedRaidProto();
			const player = raid.parties[0].players[0];
			player.database = config.gear.toDatabase(this.db);
			this.augmentDatabaseForReforge(
				player.database,
				config.gear
					.asArray()
					.filter((equippedItem): equippedItem is NonNullable<typeof equippedItem> => equippedItem != null)
					.map(equippedItem => equippedItem.item),
				gemOptions,
			);
			player.equipment = config.gear.asSpec();
			raid.parties[0].players[0] = player;

			const request = ReforgeOptimizeRequest.create({
				requestId: generateRequestId(SimRequest.reforgeOptimizeAsync),
				raid,
				...makeReforgeConfigRequestFields(config, this.db),
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
			...makeReforgeConfigRequestFields(config, this.db),
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
		} else if (this.encounter.getTargets().length < 1) {
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
		return this.store.getState().sim.phase;
	}
	setPhase(newPhase: number) {
		if (newPhase != this.getPhase()) {
			this.set({ phase: newPhase });
		}
	}

	getFaction(): Faction {
		return this.store.getState().sim.faction;
	}
	setFaction(newFaction: Faction) {
		if (newFaction != this.getFaction() && !!newFaction) {
			this.set({ faction: newFaction });
		}
	}

	getFixedRngSeed(): number {
		return this.store.getState().sim.fixedRngSeed;
	}
	setFixedRngSeed(newFixedRngSeed: number) {
		if (newFixedRngSeed != this.getFixedRngSeed()) {
			this.set({ fixedRngSeed: newFixedRngSeed });
		}
	}

	static MAX_RNG_SEED = Math.pow(2, 32) - 1;
	private nextRngSeed(): number {
		let rngSeed = 0;
		if (this.getFixedRngSeed()) {
			rngSeed = this.getFixedRngSeed();
		} else {
			rngSeed = Math.floor(Math.random() * Sim.MAX_RNG_SEED);
		}

		this.setLastUsedRngSeed(rngSeed);
		return rngSeed;
	}
	// Counts as a change on every call (like the old unconditional write), so
	// subscribers watch the version counter, not the value.
	private setLastUsedRngSeed(rngSeed: number) {
		this.store.setState(s => ({ sim: { ...s.sim, lastUsedRngSeed: rngSeed, lastUsedRngSeedVersion: s.sim.lastUsedRngSeedVersion + 1 } }));
	}
	getLastUsedRngSeed(): number {
		return this.store.getState().sim.lastUsedRngSeed;
	}

	getFilters(): DatabaseFilters {
		// Make a defensive copy
		return DatabaseFilters.clone(this.store.getState().sim.filters);
	}
	setFilters(newFilters: DatabaseFilters) {
		if (DatabaseFilters.equals(newFilters, this.store.getState().sim.filters)) {
			return;
		}

		// Make a defensive copy; replace-on-write, so subscribers can use
		// reference equality.
		const filters = DatabaseFilters.clone(newFilters);
		this.set({ filters });
	}

	private get ui(): UISlice {
		return this.store.getState().ui;
	}
	private setUi(patch: Partial<UISlice>) {
		patchSlice(this.store, 'ui', patch);
	}

	getShowDamageMetrics(): boolean {
		return this.ui.showDamageMetrics;
	}
	setShowDamageMetrics(newShowDamageMetrics: boolean) {
		if (newShowDamageMetrics != this.ui.showDamageMetrics) this.setUi({ showDamageMetrics: newShowDamageMetrics });
	}

	getShowThreatMetrics(): boolean {
		return this.ui.showThreatMetrics;
	}
	setShowThreatMetrics(newShowThreatMetrics: boolean) {
		if (newShowThreatMetrics != this.ui.showThreatMetrics) this.setUi({ showThreatMetrics: newShowThreatMetrics });
	}

	getShowHealingMetrics(): boolean {
		return (
			this.ui.showHealingMetrics ||
			(this.ui.showThreatMetrics &&
				[Spec.SpecBloodDeathKnight, Spec.SpecGuardianDruid, Spec.SpecBrewmasterMonk, Spec.SpecProtectionPaladin, Spec.SpecProtectionWarrior].includes(
					this.raid.getPlayer(0)?.playerSpec.specID,
				))
		);
	}
	setShowHealingMetrics(newShowHealingMetrics: boolean) {
		if (newShowHealingMetrics != this.ui.showHealingMetrics) this.setUi({ showHealingMetrics: newShowHealingMetrics });
	}

	getShowExperimental(): boolean {
		return this.ui.showExperimental;
	}
	setShowExperimental(newShowExperimental: boolean) {
		if (newShowExperimental != this.ui.showExperimental) this.setUi({ showExperimental: newShowExperimental });
	}

	getWasmConcurrency(): number {
		return this.ui.wasmConcurrency;
	}
	setWasmConcurrency(newWasmConcurrency: number) {
		if (newWasmConcurrency != this.ui.wasmConcurrency) {
			this.env.storage.setItem(WASM_CONCURRENCY_STORAGE_KEY, newWasmConcurrency.toString());
			this.setUi({ wasmConcurrency: newWasmConcurrency });
		}
	}

	getShowQuickSwap(): boolean {
		return !hasTouch() && this.ui.showQuickSwap;
	}
	setShowQuickSwap(newShowQuickSwap: boolean) {
		if (newShowQuickSwap != this.ui.showQuickSwap) this.setUi({ showQuickSwap: newShowQuickSwap });
	}

	getShowEPValues(): boolean {
		return this.ui.showEPValues;
	}
	setShowEPValues(newShowEPValues: boolean) {
		if (newShowEPValues != this.ui.showEPValues) this.setUi({ showEPValues: newShowEPValues });
	}

	getLanguage(): string {
		return this.ui.language;
	}
	setLanguage(newLanguage: string) {
		newLanguage = newLanguage || 'en';
		if (newLanguage != this.ui.language) this.setUi({ language: newLanguage });
	}

	getIterations(): number {
		return this.store.getState().sim.iterations;
	}
	setIterations(newIterations: number) {
		if (newIterations != this.getIterations()) {
			this.set({ iterations: newIterations });
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

	fromProto(proto: SimSettingsProto) {
		batch(() => {
			this.setIterations(proto.iterations || 12500);
			this.setPhase(proto.phase || CURRENT_PHASE);
			this.setFixedRngSeed(Number(proto.fixedRngSeed));
			this.setShowDamageMetrics(proto.showDamageMetrics);
			this.setShowThreatMetrics(proto.showThreatMetrics);
			this.setShowHealingMetrics(proto.showHealingMetrics);
			this.setShowExperimental(proto.showExperimental);
			this.setShowQuickSwap(proto.showQuickSwap);
			this.setShowEPValues(proto.showEpValues);
			this.setLanguage(proto.language);
			this.setFaction(proto.faction || Faction.Alliance);

			const filters = proto.filters || this.defaultFilters();
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
			this.setFilters(filters);
		});
	}

	applyDefaults(isTankSim: boolean, isHealingSim: boolean) {
		this.fromProto(
			SimSettingsProto.create({
				iterations: 12500,
				phase: CURRENT_PHASE,
				faction: Faction.Alliance,
				showDamageMetrics: !isHealingSim,
				showThreatMetrics: isTankSim,
				showHealingMetrics: isHealingSim,
				showQuickSwap: true,
				language: this.getLanguage(), // Don't change language.
				filters: this.defaultFilters(),
				showEpValues: false,
				useSoftCapBreakpoints: true,
			}),
		);
	}

	defaultFilters(): DatabaseFilters {
		const { favoriteItems = [], favoriteGems = [], favoriteRandomSuffixes = [], favoriteReforges = [], favoriteEnchants = [] } = this.getFilters();
		return DatabaseFilters.create({
			oneHandedWeapons: true,
			twoHandedWeapons: true,
			favoriteItems,
			favoriteGems,
			favoriteEnchants,
			favoriteRandomSuffixes,
			favoriteReforges,
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
