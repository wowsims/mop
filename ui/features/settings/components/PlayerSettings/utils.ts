import { Profession } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateProfession, translateRace } from '@i18n/localization';
import type { Player } from '@sim/player/player';
import { getEnumValues } from '@sim/utils/collections';
import type { EnumPickerConfig } from '@ui-kit/EnumPicker/types';

// Shared with the rotation tab's icon row, so the rule has one home.
export { iconGridColumns } from '@ui-kit/icon_inputs';

export const raceInput = (player: Player<any>): EnumPickerConfig<Player<any>> => ({
	id: 'simui-race',
	label: i18n.t('settings_tab.player.race'),
	values: player.getPlayerClass().races.map(race => ({ name: translateRace(race), value: race })),
	storeField: 'race' as const,
	getValue: modObject => modObject.getRace(),
	setValue: (modObject, newValue) => modObject.setRace(newValue),
});

export const professionInput = (which: 1 | 2): EnumPickerConfig<Player<any>> => ({
	id: `simui-profession${which}`,
	label: i18n.t(`settings_tab.player.profession_${which}`),
	values: (getEnumValues(Profession) as Array<Profession>)
		.filter(profession => profession != Profession.Archeology)
		.map(profession => ({ name: translateProfession(profession), value: profession })),
	storeField: ['profession1', 'profession2'] as const,
	getValue: modObject => (which === 1 ? modObject.getProfession1() : modObject.getProfession2()),
	setValue: (modObject, newValue) => (which === 1 ? modObject.setProfession1(newValue) : modObject.setProfession2(newValue)),
});
