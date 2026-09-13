import { usePlayer } from '@sim/context/SimHostContext';
import i18n from '@i18n/config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { FieldLabel } from '@ui-kit/FormControl';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useBulkState } from '../../hooks/useBulkState';
import { availableSetBonuses, setBonusFeasibility } from '../../model/selectors';
import { canEnableRequiredFourPiece, canEnableRequiredTwoPiece } from '../../model/set_bonuses';
import type { BulkSetBonusOption } from '../../model/set_bonuses';
import { setBulkRequiredSetBonus } from '../../model/settings';

const setBonusDomId = (setBonus: BulkSetBonusOption) => `required-set-bonus-${setBonus.setId}-${setBonus.setName.replace(/\W+/g, '-')}`;

export const RequiredSetBonuses = () => {
	const player = usePlayer();
	const setBonuses = useBulkState(availableSetBonuses);
	const pickerGroups = useBulkState(slice => slice.pickerGroups);
	const requiredSetBonuses = useBulkState(slice => slice.requiredSetBonuses);
	const canSatisfy = useMemo(() => setBonusFeasibility(player, pickerGroups, requiredSetBonuses), [player, pickerGroups, requiredSetBonuses]);

	return (
		<div className="required-set-bonuses-container flex flex-col gap-2">
			{!!setBonuses.length && <h6>{i18n.t('bulk_tab.settings.required_set_bonuses.label')}</h6>}
			{setBonuses.map(setBonus => (
				<div key={setBonus.setId} className="bulk-required-set-bonus flex flex-col gap-1">
					<FieldLabel as="div">
						{setBonus.setName} {i18n.t('bulk_tab.settings.required_set_bonuses.available_pieces', { count: setBonus.totalPieces })}
					</FieldLabel>
					{setBonus.totalPieces >= 2 && (
						<BooleanPicker
							modObject={player}
							config={{
								id: `${setBonusDomId(setBonus)}-2p`,
								label: i18n.t('bulk_tab.settings.required_set_bonuses.require_2p'),
								inline: true,
								enableWhen: () => canEnableRequiredTwoPiece(requiredSetBonuses, setBonus.setId, canSatisfy),
								value: requiredSetBonuses.get(setBonus.setId)?.pieces === 2,
								onChange: (newValue: boolean) => {
									setBulkRequiredSetBonus(player, setBonus, newValue ? 2 : 0);
									trackEvent({ action: 'settings', category: 'batch_sim', label: 'required_set_bonus', value: newValue ? 2 : 0 });
								},
							}}
						/>
					)}
					{setBonus.totalPieces >= 4 && (
						<BooleanPicker
							modObject={player}
							config={{
								id: `${setBonusDomId(setBonus)}-4p`,
								label: i18n.t('bulk_tab.settings.required_set_bonuses.require_4p'),
								inline: true,
								extraClassNames: ['bulk-required-set-bonus'],
								enableWhen: () => canEnableRequiredFourPiece(requiredSetBonuses, setBonus, canSatisfy),
								value: requiredSetBonuses.get(setBonus.setId)?.pieces === 4,
								onChange: (newValue: boolean) => {
									setBulkRequiredSetBonus(player, setBonus, newValue ? 4 : 0);
									trackEvent({ action: 'settings', category: 'batch_sim', label: 'required_set_bonus', value: newValue ? 4 : 0 });
								},
							}}
						/>
					)}
				</div>
			))}
		</div>
	);
};
