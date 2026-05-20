import { openDB, IDBPDatabase } from 'idb';

import { LOCAL_STORAGE_PREFIX } from './constants/other';
import { PlayerSpec } from './player_spec';
import { PlayerSpecs } from './player_specs';
import { EquipmentSpec, Spec } from './proto/common';
import { IndividualLinkImporter } from './components/individual_sim_ui/importers/individual_link_importer';

const REFORGE_CACHE_DB_NAME = `${LOCAL_STORAGE_PREFIX}_reforge-cache`;
const REFORGE_CACHE_DB_VERSION = 1;
const REFORGE_CACHE_MAX_ENTRIES = 200_000;
const REFORGE_CACHE_KEY_PREFIX = `v${REFORGE_CACHE_DB_VERSION}:`;
const REFORGE_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // Store reforge results for 14 days
const REFORGE_CACHE_PRUNE_INTERVAL_MS = 60 * 60 * 1000;

interface ReforgeGearCacheRecord {
	gear: string;
	createdAt: number;
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
	private static dbPromise: Promise<IDBPDatabase<ReforgeGearCacheDb>> | null = null;
	private static storeCreationQueue: Promise<void> = Promise.resolve();
	private static caches = new Map<string, ReforgeGearCache<any>>();

	private readonly storeName: ReforgeGearCacheStoreName;
	private readonly storeReadyPromise: Promise<void>;
	private lastPrunedAt = 0;

	constructor(playerSpec: PlayerSpec<SpecType>) {
		this.storeName = ReforgeGearCache.getStoreName(playerSpec);
		this.storeReadyPromise = ReforgeGearCache.getDbWithStore(this.storeName).then(() => undefined);
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
		try {
			const db = await this.getDb();
			const record = await db.get(this.storeName, key);
			if (!record) {
				return null;
			}

			record.lastAccessedAt = Date.now();
			await this.putRecord(db, key, record);
			return IndividualLinkImporter.tryParseUrlLocation(new URL(record.gear, window.location.href))?.settings.player?.equipment || null;
		} catch (error) {
			console.warn('[Reforge Cache] Failed to read cached reforge result.', error);
			return null;
		}
	}

	async set(key: string, optimizedGearLink: string): Promise<void> {
		try {
			const db = await this.getDb();
			const now = Date.now();
			await this.putRecord(db, key, {
				gear: optimizedGearLink,
				createdAt: now,
				lastAccessedAt: now,
			});
			void this.prune(db);
		} catch (error) {
			console.warn('[Reforge Cache] Failed to store reforge result.', error);
		}
	}

	private async getDb(): Promise<IDBPDatabase<ReforgeGearCacheDb>> {
		await this.storeReadyPromise;
		return ReforgeGearCache.getDb();
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

	private static getDb() {
		if (!ReforgeGearCache.dbPromise) {
			ReforgeGearCache.dbPromise = openDB<ReforgeGearCacheDb>(REFORGE_CACHE_DB_NAME);
		}
		return ReforgeGearCache.dbPromise;
	}

	private static async getDbWithStore(storeName: ReforgeGearCacheStoreName): Promise<IDBPDatabase<ReforgeGearCacheDb>> {
		let db = await ReforgeGearCache.getDb();
		if (db.objectStoreNames.contains(storeName)) {
			return db;
		}

		await ReforgeGearCache.createStore(storeName);
		return ReforgeGearCache.getDb();
	}

	private static async createStore(storeName: ReforgeGearCacheStoreName): Promise<void> {
		const createStore = async () => {
			let db = await ReforgeGearCache.getDb();
			if (db.objectStoreNames.contains(storeName)) {
				return;
			}

			const nextVersion = db.version + 1;
			db.close();
			ReforgeGearCache.dbPromise = null;
			db = await openDB<ReforgeGearCacheDb>(REFORGE_CACHE_DB_NAME, nextVersion, {
				upgrade(upgradeDb) {
					if (!upgradeDb.objectStoreNames.contains(storeName)) {
						const store = upgradeDb.createObjectStore(storeName);
						store.createIndex('byLastAccessedAt', 'lastAccessedAt');
					}
				},
			});
			db.close();
			ReforgeGearCache.dbPromise = null;
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
}
