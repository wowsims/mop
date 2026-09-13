import { UnitReference, UnitReference_Type as UnitType } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { type ActionId, defaultTargetIcon, getPetIconFromName } from '@sim/proto/action_id';
import type { UnitValue } from '@ui-kit/UnitPicker/types';

import { type UNIT_SET, unitSets } from './unit_sets';

const label = (key: string) => i18n.t(`rotation_tab.apl.helpers.unit_labels.${key}`);

/** The icon, text and reference one unit shows as. */
export const refToValue = (ref: UnitReference | undefined, player: Player<any>, targetUI: boolean | undefined): UnitValue => {
	if (!ref || ref.type == UnitType.Unknown) {
		return { value: ref, iconUrl: targetUI ? 'fa-bullseye' : 'fa-user', text: targetUI ? label('current_target') : label('self') };
	}
	switch (ref.type) {
		case UnitType.Self:
			return { value: ref, iconUrl: 'fa-user', text: label('self') };
		case UnitType.CurrentTarget:
			return { value: ref, iconUrl: 'fa-bullseye', text: label('current_target') };
		case UnitType.PreviousTarget:
			return { value: ref, iconUrl: 'fa-arrow-left', text: label('previous_target') };
		case UnitType.NextTarget:
			return { value: ref, iconUrl: 'fa-arrow-right', text: label('next_target') };
		case UnitType.Player: {
			const other = player.sim.raid.getPlayer(ref.index);
			return other ? { value: ref, iconUrl: other.getSpecIcon(), text: `${label('player')} ${ref.index + 1}` } : { value: ref };
		}
		case UnitType.Target: {
			const targetMetadata = player.sim.encounter.targetsMetadata.asList()[ref.index];
			return targetMetadata ? { value: ref, iconUrl: defaultTargetIcon, text: `${label('target')} ${ref.index + 1}` } : { value: ref };
		}
		case UnitType.Pet: {
			const petMetadata = player.sim.getUnitMetadata(ref, player, UnitReference.create({ type: UnitType.Self }));
			let text = `${label('pet')} ${ref.index + 1}`;
			let iconUrl: string | ActionId = 'fa-paw';
			const petName = petMetadata?.getName();
			if (petName) {
				text = petName.substring(petName.indexOf(' - ') + ' - '.length);
				iconUrl = getPetIconFromName(text) || iconUrl;
			}
			return { value: ref, iconUrl, text };
		}
		default:
			return { value: ref };
	}
};

export interface UnitOptionModel {
	unit: UnitValue;
	/** A pet is filed under its owner (or under the default unit, off the target UI). */
	submenu?: Array<UnitValue>;
}

/** The unit set's options, each already resolved to what it displays as. */
export const unitOptionModels = (unitSet: UNIT_SET, player: Player<any>): Array<UnitOptionModel> => {
	const set = unitSets[unitSet];
	return set.getUnits(player).map(ref => {
		const unit = refToValue(ref, player, set.targetUI);
		if (ref?.type != UnitType.Pet) return { unit };
		return { unit, submenu: [refToValue(set.targetUI ? ref.owner! : undefined, player, set.targetUI)] };
	});
};
