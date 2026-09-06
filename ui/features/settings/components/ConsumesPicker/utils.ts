import type { Player } from '@domain/player';
import type { Database } from '@domain/proto_utils/database';
import type { ConsumableStatOption } from '@features/settings/model/consumables';
import * as ConsumablesInputs from '@features/settings/model/consumables';
import { Class, ConsumableType, Spec, type Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { TypedIconEnumPickerConfig } from '@ui-kit/input_helpers';

export type ConsumeConfig = TypedIconEnumPickerConfig<Player<any>, number>;

/** One config per icon-enum picker the block renders, in the order they appear. */
export interface ConsumeConfigs {
	prepot: ConsumeConfig;
	potion: ConsumeConfig;
	conjured: ConsumeConfig;
	flask: ConsumeConfig;
	battleElixir: ConsumeConfig;
	guardianElixir: ConsumeConfig;
	food: ConsumeConfig;
	explosive: ConsumeConfig;
}

/**
 * Mighty Rage Potion is offered to warriors and to guardian druids only — the one class-specific cut
 * in a list the database otherwise filters by the spec's own stats.
 */
const potionsFor = (player: Player<any>, db: Database, stats: Array<Stat>) => {
	const potions = db.getConsumablesByTypeAndStats(ConsumableType.ConsumableTypePotion, stats);
	if (player.getClass() === Class.ClassWarrior || player.getSpec() === Spec.SpecGuardianDruid) return potions;
	return potions.filter(potion => potion.id !== 13442);
};

/**
 * Every picker config the block needs, built in one pass.
 *
 * They belong together because they share a database snapshot — the potion list feeds two of them —
 * and because each `makeConsumableInput` closes over the item list it is handed, so a caller that
 * rebuilt one per render would give its picker a fresh config on every notification.
 *
 * The two elixir configs and the flask are separate pickers that write to each other's fields:
 * `makeConsumableInput` zeroes the elixirs when a flask is chosen and the flask when an elixir is,
 * which is the model's business rather than this block's.
 */
export const consumeConfigs = (
	player: Player<any>,
	db: Database,
	consumableStats: ReadonlyArray<Stat>,
	conjuredOptions: ReadonlyArray<ConsumableStatOption<number>>,
	explosiveOptions: ReadonlyArray<ConsumableStatOption<number>>,
): ConsumeConfigs => {
	const stats = [...consumableStats];
	const byType = (type: ConsumableType) => db.getConsumablesByTypeAndStats(type, stats);
	const potions = potionsFor(player, db, stats);

	return {
		prepot: ConsumablesInputs.makeConsumableInput(potions, { consumesFieldName: 'prepotId' }, i18n.t('settings_tab.consumables.potions.prepop')),
		potion: ConsumablesInputs.makeConsumableInput(potions, { consumesFieldName: 'potId' }, i18n.t('settings_tab.consumables.potions.combat')),
		conjured: ConsumablesInputs.makeConjuredInput([...conjuredOptions]),
		flask: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeFlask), { consumesFieldName: 'flaskId' }, ''),
		battleElixir: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeBattleElixir), { consumesFieldName: 'battleElixirId' }, ''),
		guardianElixir: ConsumablesInputs.makeConsumableInput(
			byType(ConsumableType.ConsumableTypeGuardianElixir),
			{ consumesFieldName: 'guardianElixirId' },
			'',
		),
		food: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeFood), { consumesFieldName: 'foodId' }, ''),
		explosive: ConsumablesInputs.makeExplosivesInput([...explosiveOptions], i18n.t('settings_tab.consumables.engineering.explosives')),
	};
};
