import { ActionID as ActionIdProto, Cooldown } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import type { IconEnumPickerConfig, IconEnumValueConfig } from '@ui-kit/IconEnumPicker/types';
import type { NumberListPickerConfig } from '@ui-kit/NumberListPicker/types';

export const availableCooldowns = (player: Player<any>): Array<ActionId> =>
	player
		.getMetadata()
		.getSpells()
		.filter(spell => spell.data.isMajorCooldown)
		.map(spell => spell.id)
		.filter(actionId => !player.hiddenMCDs.includes(actionId.spellId !== 0 ? actionId.spellId : actionId.itemId));

export const actionPickerConfig = (available: ReadonlyArray<ActionId>, index: number): IconEnumPickerConfig<Player<any>, ActionIdProto> => ({
	extraClassNames: ['cooldown-action-picker'],
	numColumns: 3,
	values: ([{ color: '#grey', value: ActionIdProto.create() }] as Array<IconEnumValueConfig<Player<any>, ActionIdProto>>).concat(
		available.map(cooldownAction => ({ actionId: cooldownAction, value: cooldownAction.toProto() })),
	),
	equals: (a: ActionIdProto, b: ActionIdProto) => ActionIdProto.equals(a, b),
	zeroValue: ActionIdProto.create(),
	backupIconUrl: (value: ActionIdProto) => ActionId.fromProto(value),
	storeField: 'rotation',
	getValue: (player: Player<any>) => player.getSimpleCooldowns().cooldowns[index]?.id || ActionIdProto.create(),
	setValue: (player: Player<any>, newValue: ActionIdProto) => {
		if (!newValue.rawId.oneofKind) return;
		const newCooldowns = player.getSimpleCooldowns();

		while (newCooldowns.cooldowns.length < index) {
			newCooldowns.cooldowns.push(Cooldown.create());
		}
		newCooldowns.cooldowns[index] = Cooldown.create({ id: newValue, timings: [] });

		player.setSimpleCooldowns(newCooldowns);
	},
});

export const timingsPickerConfig = (index: number): NumberListPickerConfig<Player<any>> => ({
	id: `cooldown-timings-${index}`,
	extraClassNames: ['cooldown-timings-picker'],
	placeholder: i18n.t('rotation_tab.cooldowns.timings_placeholder'),
	storeField: 'rotation' as const,
	getValue: (player: Player<any>) => player.getSimpleCooldowns().cooldowns[index]?.timings || [],
	setValue: (player: Player<any>, newValue: Array<number>) => {
		const newCooldowns = player.getSimpleCooldowns();
		newCooldowns.cooldowns[index].timings = newValue;
		player.setSimpleCooldowns(newCooldowns);
	},
	enableWhen: (player: Player<any>) => {
		const curCooldown = player.getSimpleCooldowns().cooldowns[index];
		return curCooldown && !ActionIdProto.equals(curCooldown.id, ActionIdProto.create());
	},
});

export const deleteCooldown = (player: Player<any>, index: number) => {
	const newCooldowns = player.getSimpleCooldowns();
	newCooldowns.cooldowns.splice(index, 1);
	player.setSimpleCooldowns(newCooldowns);
};
