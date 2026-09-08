import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { subscribePlayerField } from '@sim/state/subscriptions';
import type { DropdownOption } from '@ui-kit/DropdownPicker';
import { DropdownField } from '@ui-kit/DropdownPicker';
import type { InputConfig } from '@ui-kit/input';
import { useMemo } from 'react';

/** Auto / Simple / APL. Simple is offered only by a spec that ships a rotation generator. */
export const RotationTypePicker = () => {
	const host = useSimHost();
	const player = host.player;
	const hasSimple = player.hasSimpleRotationGenerator();

	const options = useMemo(
		(): Array<DropdownOption<APLRotationType>> =>
			[
				{ value: APLRotationType.TypeAuto, label: i18n.t('rotation_tab.common.rotation_type.auto') },
				...(hasSimple ? [{ value: APLRotationType.TypeSimple, label: i18n.t('rotation_tab.common.rotation_type.simple') }] : []),
				{ value: APLRotationType.TypeAPL, label: i18n.t('rotation_tab.common.rotation_type.apl') },
			] satisfies Array<DropdownOption<APLRotationType>>,
		[hasSimple],
	);

	const config = useMemo(
		(): InputConfig<Player<any>, APLRotationType> & { id: string } => ({
			id: 'rotation-tab-rotation-type',
			storeSubscribe: (subject: Player<any>) => subscribePlayerField(subject, 'rotation'),
			getValue: (subject: Player<any>) => subject.getRotationType(),
			setValue: (subject: Player<any>, newValue: APLRotationType) => {
				subject.modifyAplRotation(rotation => {
					rotation.type = newValue;
				});
			},
		}),
		[],
	);

	return <DropdownField<Player<any>, APLRotationType> modObject={player} config={config} options={options} defaultLabel="" />;
};
