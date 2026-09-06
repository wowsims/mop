import { getEnumValues } from '@domain/collections';
import type { Player } from '@domain/player';
import { subscribeAll, subscribePlayerField } from '@domain/state/subscriptions';
import { Profession } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateProfession, translateRace } from '@i18n/localization';
import type { EnumPickerConfig } from '@ui-kit/pickers/enum_picker';

/**
 * `configureIconSection`'s `adjustColumns` half, which is the only part of that function this block
 * still needs — the other half hides an empty group, and the group is rendered with `hide` instead.
 *
 * It counts the *declared* inputs, not the visible ones: vanilla measured the array it had just
 * built, and an icon that hides itself later never re-runs this.
 */
export const iconGridColumns = (count: number): string | undefined => {
	if (count === 0 || count >= 8) return undefined;
	return `repeat(${count <= 4 ? count : Math.ceil(count / 2)}, 1fr)`;
};

/** The race select. Hand-rolled here because the spec declares no config for it. */
export const raceInput = (player: Player<any>): EnumPickerConfig<Player<any>> => ({
	id: 'simui-race',
	label: i18n.t('settings_tab.player.race'),
	values: player.getPlayerClass().races.map(race => ({ name: translateRace(race), value: race })),
	storeSubscribe: modObject => subscribePlayerField(modObject, 'race'),
	getValue: modObject => modObject.getRace(),
	setValue: (modObject, newValue) => modObject.setRace(newValue),
});

/**
 * One of the two profession selects. Both subscribe to *both* fields, because picking a profession
 * in one is what makes it unavailable in the other.
 */
export const professionInput = (which: 1 | 2): EnumPickerConfig<Player<any>> => ({
	id: `simui-profession${which}`,
	label: i18n.t(`settings_tab.player.profession_${which}`),
	// Archaeology is the one profession with no sim effect, so it is not offered.
	values: (getEnumValues(Profession) as Array<Profession>)
		.filter(profession => profession != Profession.Archeology)
		.map(profession => ({ name: translateProfession(profession), value: profession })),
	storeSubscribe: modObject => subscribeAll([subscribePlayerField(modObject, 'profession1'), subscribePlayerField(modObject, 'profession2')]),
	getValue: modObject => (which === 1 ? modObject.getProfession1() : modObject.getProfession2()),
	setValue: (modObject, newValue) => (which === 1 ? modObject.setProfession1(newValue) : modObject.setProfession2(newValue)),
});
