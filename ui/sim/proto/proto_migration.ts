// Bringing older stored protos up to the current shape.
import { Player } from '@generated/proto/api';
import { Consumable } from '@generated/proto/db';
import { SpellEffect } from '@generated/proto/spell';

import { CURRENT_API_VERSION } from '../constants/other';
import { Database } from './database';

export const extendPlayerProtoWithMissingEffects = (playerProto: Player, db: Database) => {
	const newConsumables: Consumable[] = [];
	const newSpellEffects: SpellEffect[] = [];
	const seenConsumableIds = new Set<number>();
	const seenEffectIds = new Set<number>();

	const { consumableIds = [], ...consumables } = playerProto.consumables || {};
	const allConsumableIds = Object.values(consumables).filter((c): c is number => typeof c === 'number');
	const allConsumables = [...consumableIds, ...allConsumableIds];

	allConsumables.forEach((cid: number) => {
		if (!cid || seenConsumableIds.has(cid)) return;
		const consume = db.getConsumable(cid);
		if (!consume) return;
		seenConsumableIds.add(consume.id);
		newConsumables.push(consume);
		for (const eid of consume.effectIds) {
			if (seenEffectIds.has(eid)) continue;
			const effect = db.getSpellEffect(eid);
			if (!effect) continue;

			seenEffectIds.add(effect.id);
			newSpellEffects.push(effect);
		}
	});

	if (playerProto.database) {
		// swap in the fresh arrays
		playerProto.database.consumables = newConsumables;
		playerProto.database.spellEffects = newSpellEffects;
	}
};

// Utilities for migrating protos between versions

// Each key is an API version, each value is a function that up-converts a proto
// to that version from the previous one. If there are missing keys between
// successive entries, then it is assumed that no intermediate conversions are
// required (i.e. the intermediate version changes did not affect this
// particular proto).
export type ProtoConversionMap<Type> = Map<number, (arg: Type) => Type>;

export function migrateOldProto<Type>(oldProto: Type, oldApiVersion: number, conversionMap: ProtoConversionMap<Type>, targetApiVersion?: number): Type {
	let migratedProto = oldProto;
	const finalVersion = targetApiVersion || CURRENT_API_VERSION;
	for (let nextVersion = oldApiVersion + 1; nextVersion <= finalVersion; nextVersion++) {
		if (conversionMap.has(nextVersion)) {
			migratedProto = conversionMap.get(nextVersion)!(migratedProto);
		}
	}

	return migratedProto;
}

/**
 * Fingerprint for comparing or deduplicating gear sets: item, random suffix, enchant,
 * tinker, upgrade step, challenge mode, plus the head meta gem. Reforges and non-meta gems
 * are deliberately excluded — two sets differing only there are the same bulk-sim input.
 *
 * NOT a cache key. Use getReforgeCacheGearKey for anything that keys an optimizer result.
 */
