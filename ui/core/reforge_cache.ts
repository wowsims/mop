import { openDB, IDBPDatabase } from 'idb';

import { CURRENT_API_VERSION, LOCAL_STORAGE_PREFIX } from './constants/other';
import { SimSettingCategories } from './constants/sim_settings';
import { throwIfAborted } from './components/individual_sim_ui/bulk/utils';
import { PlayerSpec } from './player_spec';
import { PlayerSpecs } from './player_specs';
import { EquipmentSpec, Spec } from './proto/common';
import { IndividualSimSettings } from './proto/ui';
import { IndividualLinkExporter } from './components/individual_sim_ui/exporters/individual_link_exporter';
import { IndividualLinkImporter } from './components/individual_sim_ui/importers/individual_link_importer';
import { IndividualSimUI } from './individual_sim_ui';
import { sleep } from './utils';

const REFORGE_CACHE_DB_NAME = `${LOCAL_STORAGE_PREFIX}_reforge-cache`;
const REFORGE_CACHE_DB_VERSION = 3;
const REFORGE_CACHE_MAX_ENTRIES = 200_000;
const REFORGE_CACHE_KEY_PREFIX = `v${REFORGE_CACHE_DB_VERSION}:api-v${CURRENT_API_VERSION}:`;
const REFORGE_CACHE_EQUIPMENT_SPEC_PREFIX = 'equipmentSpec:';
const REFORGE_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // Store reforge results for 14 days
const REFORGE_CACHE_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const REFORGE_CACHE_ACCESS_UPDATE_CHUNK_SIZE = 2000;

interface ReforgeGearCacheRecord {
	gear: string;
	lastAccessedAt: number;
}

type ReforgeGearCacheStoreName = `${string}_reforgeGearSets`;

type ReforgeGearCacheDb = {
	[Store in ReforgeGearCacheStoreName]: {
		key: string;
		value: ReforgeGearCacheRecord;
		indexes: {
			byLastAccessedAt: number;
		};
	};
};

export class ReforgeGearCache<SpecType extends Spec = Spec> {
	private static storeCreationQueue: Promise<void> = Promise.resolve();
	private static caches = new Map<string, ReforgeGearCache<any>>();

	private readonly storeName: ReforgeGearCacheStoreName;
	private readonly storeReadyPromise: Promise<void>;
	private lastPrunedAt = 0;

	constructor(playerSpec: PlayerSpec<SpecType>) {
		this.storeName = ReforgeGearCache.getStoreName(playerSpec);
		this.storeReadyPromise = ReforgeGearCache.ensureStore(this.storeName);
	}

	static get<SpecType extends Spec>(playerSpec: PlayerSpec<SpecType>): ReforgeGearCache<SpecType> {
		const storeName = ReforgeGearCache.getStoreName(playerSpec);
		let cache = ReforgeGearCache.caches.get(storeName);
		if (!cache) {
			cache = new ReforgeGearCache(playerSpec);
			ReforgeGearCache.caches.set(storeName, cache);
		}
		return cache as ReforgeGearCache<SpecType>;
	}

	static async getHash(fingerprintParts: unknown): Promise<string> {
		return ReforgeGearCache.digestString(JSON.stringify(fingerprintParts) ?? '');
	}

	static async getKey(gearFingerprintParts: unknown, configHash: string): Promise<string> {
		const gearHash = await ReforgeGearCache.getHash(gearFingerprintParts);
		return `${REFORGE_CACHE_KEY_PREFIX}${configHash}:${gearHash}`;
	}

	async get(key: string): Promise<EquipmentSpec | null> {
		let db: IDBPDatabase<ReforgeGearCacheDb> | null = null;
		try {
			db = await this.getDb();
			const record = await db.get(this.storeName, key);
			if (!record) {
				return null;
			}

			record.lastAccessedAt = Date.now();
			await this.putRecord(db, key, record);
			return this.parseCachedGear(record.gear);
		} catch (error) {
			console.warn('[Reforge Cache] Failed to read cached reforge result.', error);
			return null;
		} finally {
			db?.close();
		}
	}

	async getMany(keys: string[], signal?: AbortSignal): Promise<Map<string, EquipmentSpec>> {
		const results = new Map<string, EquipmentSpec>();
		if (!keys.length) return results;

		let db: IDBPDatabase<ReforgeGearCacheDb> | null = null;
		try {
			throwIfAborted(signal);
			db = await this.getDb();
			const now = Date.now();
			let lastYieldAt = performance.now();
			const accessUpdates: Array<{ key: string; record: ReforgeGearCacheRecord }> = [];

			for (let i = 0; i < keys.length; i++) {
				throwIfAborted(signal);
				const key = keys[i];
				const record = await db.get(this.storeName, key);
				if (!record) {
					continue;
				}

				const gear = this.parseCachedGear(record.gear);
				if (!gear) {
					continue;
				}

				accessUpdates.push({
					key,
					record: {
						...record,
						lastAccessedAt: now,
					},
				});
				results.set(key, gear);

				if (i % 2000 === 0) {
					const yieldNow = performance.now();
					if (yieldNow - lastYieldAt >= 16) {
						await sleep(0);
						lastYieldAt = performance.now();
					}
				}
			}

			for (let start = 0; start < accessUpdates.length; start += REFORGE_CACHE_ACCESS_UPDATE_CHUNK_SIZE) {
				throwIfAborted(signal);
				await this.putRecords(db, accessUpdates.slice(start, start + REFORGE_CACHE_ACCESS_UPDATE_CHUNK_SIZE));
				if (start + REFORGE_CACHE_ACCESS_UPDATE_CHUNK_SIZE < accessUpdates.length) {
					await sleep(0);
				}
			}
		} catch (error) {
			console.warn('[Reforge Cache] Failed to read cached reforge results.', error);
		} finally {
			db?.close();
		}
		return results;
	}

	async set(key: string, optimizedGearLink: string): Promise<void> {
		let db: IDBPDatabase<ReforgeGearCacheDb> | null = null;
		try {
			db = await this.getDb();
			const now = Date.now();
			await this.putRecord(db, key, {
				gear: optimizedGearLink,
				lastAccessedAt: now,
			});
			await this.prune(db);
		} catch (error) {
			console.warn('[Reforge Cache] Failed to store reforge result.', error);
		} finally {
			db?.close();
		}
	}

	async setGear(key: string, optimizedGear: EquipmentSpec): Promise<void> {
		return this.set(key, ReforgeGearCache.equipmentSpecToLinkHash(optimizedGear));
	}

	async setGearMany(entries: Array<{ key: string; optimizedGear: EquipmentSpec }>): Promise<void> {
		if (!entries.length) return;

		let db: IDBPDatabase<ReforgeGearCacheDb> | null = null;
		try {
			db = await this.getDb();
			await this.putRecords(
				db,
				entries.map(entry => ({
					key: entry.key,
					record: {
						gear: ReforgeGearCache.equipmentSpecToLinkHash(entry.optimizedGear),
						lastAccessedAt: Date.now(),
					},
				})),
			);
			await this.prune(db);
		} catch (error) {
			console.warn('[Reforge Cache] Failed to store batched reforge results.', error);
		} finally {
			db?.close();
		}
	}

	async hasEntries(): Promise<boolean> {
		let db: IDBPDatabase<ReforgeGearCacheDb> | null = null;
		try {
			db = await this.getDb();
			return (await db.count(this.storeName)) > 0;
		} catch (error) {
			// Fail open: if this probe fails, keep the normal restore path so cache use still works.
			console.warn('[Reforge Cache] Failed to probe cache entry count.', error);
			return true;
		} finally {
			db?.close();
		}
	}

	private parseCachedGear(gear: string): EquipmentSpec | null {
		if (gear.startsWith(REFORGE_CACHE_EQUIPMENT_SPEC_PREFIX)) {
			return EquipmentSpec.fromJsonString(gear.slice(REFORGE_CACHE_EQUIPMENT_SPEC_PREFIX.length), { ignoreUnknownFields: true });
		}

		return IndividualLinkImporter.tryParseUrlLocation(new URL(gear, window.location.href))?.settings.player?.equipment || null;
	}

	private async getDb(): Promise<IDBPDatabase<ReforgeGearCacheDb>> {
		await this.storeReadyPromise;
		return ReforgeGearCache.openDb();
	}

	private async putRecord(db: IDBPDatabase<ReforgeGearCacheDb>, key: string, record: ReforgeGearCacheRecord): Promise<void> {
		try {
			await db.put(this.storeName, record, key);
		} catch (error) {
			if (!ReforgeGearCache.isQuotaExceededError(error)) {
				throw error;
			}

			await this.prune(db, true);
			await db.put(this.storeName, record, key);
		}
	}

	private async putRecords(db: IDBPDatabase<ReforgeGearCacheDb>, entries: Array<{ key: string; record: ReforgeGearCacheRecord }>): Promise<void> {
		try {
			let tx = db.transaction(this.storeName, 'readwrite');
			let store = tx.objectStore(this.storeName);
			for (const entry of entries) {
				await store.put(entry.record, entry.key);
			}
			await tx.done;
		} catch (error) {
			if (!ReforgeGearCache.isQuotaExceededError(error)) {
				throw error;
			}

			await this.prune(db, true);
			const tx = db.transaction(this.storeName, 'readwrite');
			const store = tx.objectStore(this.storeName);
			for (const entry of entries) {
				await store.put(entry.record, entry.key);
			}
			await tx.done;
		}
	}

	private async prune(db: IDBPDatabase<ReforgeGearCacheDb>, force = false): Promise<void> {
		try {
			const now = Date.now();
			if (!force && now - this.lastPrunedAt < REFORGE_CACHE_PRUNE_INTERVAL_MS) {
				return;
			}
			this.lastPrunedAt = now;

			const tx = db.transaction(this.storeName, 'readwrite');
			const store = tx.objectStore(this.storeName);
			const oldestAllowedAccess = now - REFORGE_CACHE_MAX_AGE_MS;

			let staleEntriesDeleted = 0;
			let cursor = await store.openCursor();
			while (cursor) {
				const record = cursor.value as ReforgeGearCacheRecord;
				if (typeof cursor.key !== 'string' || !cursor.key.startsWith(REFORGE_CACHE_KEY_PREFIX) || record.lastAccessedAt < oldestAllowedAccess) {
					await cursor.delete();
					staleEntriesDeleted++;
				}
				cursor = await cursor.continue();
			}

			const count = await store.count();
			let entriesToDelete = Math.max(0, count - REFORGE_CACHE_MAX_ENTRIES);
			if (force && staleEntriesDeleted == 0 && entriesToDelete == 0) {
				entriesToDelete = Math.max(1, Math.ceil(count * 0.2));
			}

			cursor = await store.index('byLastAccessedAt').openCursor();
			while (cursor && entriesToDelete > 0) {
				await cursor.delete();
				entriesToDelete--;
				cursor = await cursor.continue();
			}
			await tx.done;
		} catch (error) {
			console.warn('[Reforge Cache] Failed to prune old cache entries.', error);
		}
	}

	private static getStoreName<SpecType extends Spec>(playerSpec: PlayerSpec<SpecType>): ReforgeGearCacheStoreName {
		return `${PlayerSpecs.getLocalStorageKey(playerSpec)}_reforgeGearSets`;
	}

	private static openDb(): Promise<IDBPDatabase<ReforgeGearCacheDb>> {
		return openDB<ReforgeGearCacheDb>(REFORGE_CACHE_DB_NAME);
	}

	private static async ensureStore(storeName: ReforgeGearCacheStoreName): Promise<void> {
		const db = await ReforgeGearCache.openDb();
		try {
			if (db.objectStoreNames.contains(storeName)) {
				return;
			}
		} finally {
			db.close();
		}

		await ReforgeGearCache.createStore(storeName);
	}

	private static async createStore(storeName: ReforgeGearCacheStoreName): Promise<void> {
		const createStore = async () => {
			const db = await ReforgeGearCache.openDb();
			try {
				if (db.objectStoreNames.contains(storeName)) {
					return;
				}

				const nextVersion = db.version + 1;
				db.close();
				const upgradeDb = await openDB<ReforgeGearCacheDb>(REFORGE_CACHE_DB_NAME, nextVersion, {
					upgrade(upgradeDb) {
						if (!upgradeDb.objectStoreNames.contains(storeName)) {
							const store = upgradeDb.createObjectStore(storeName);
							store.createIndex('byLastAccessedAt', 'lastAccessedAt');
						}
					},
				});
				upgradeDb.close();
			} finally {
				db.close();
			}
		};

		const task = ReforgeGearCache.storeCreationQueue.catch(() => {}).then(createStore);
		ReforgeGearCache.storeCreationQueue = task;
		await task;
	}

	private static isQuotaExceededError(error: unknown): boolean {
		return error instanceof DOMException && error.name === 'QuotaExceededError';
	}

	private static async digestString(value: string): Promise<string> {
		const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
		return Array.from(new Uint8Array(hashBuffer))
			.map(byte => byte.toString(16).padStart(2, '0'))
			.join('');
	}

	private static equipmentSpecToLinkHash(optimizedGear: EquipmentSpec): string {
		return new URL(
			IndividualLinkExporter.createLink(
				{
					toProto: () =>
						IndividualSimSettings.create({
							apiVersion: CURRENT_API_VERSION,
							player: {
								equipment: optimizedGear,
							},
						}),
				} as IndividualSimUI<any>,
				[SimSettingCategories.Gear],
			),
		).hash;
	}
}
