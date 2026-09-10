import { usePlayer } from '@sim/context/SimHostContext';
import { subscribeBulkChange } from '@sim/state/subscriptions';
import i18n from '@i18n/config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
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
		<div className="required-set-bonuses-container d-flex flex-column gap-2">
			{!!setBonuses.length && <h6>{i18n.t('bulk_tab.settings.required_set_bonuses.label')}</h6>}
			{setBonuses.map(setBonus => (
				<div key={setBonus.setId} className="bulk-required-set-bonus d-flex flex-column gap-1">
					<div className="form-label">
						{setBonus.setName} {i18n.t('bulk_tab.settings.required_set_bonuses.available_pieces', { count: setBonus.totalPieces })}
					</div>
					{setBonus.totalPieces >= 2 && (
						<BooleanPicker
							modObject={player}
							config={{
								id: `${setBonusDomId(setBonus)}-2p`,
								label: i18n.t('bulk_tab.settings.required_set_bonuses.require_2p'),
								inline: true,
								storeSubscribe: () => subscribeBulkChange(player),
								enableWhen: () => canEnableRequiredTwoPiece(requiredSetBonuses, setBonus.setId, canSatisfy),
								getValue: () => requiredSetBonuses.get(setBonus.setId)?.pieces === 2,
								setValue: (_modObj, newValue) => {
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
								storeSubscribe: () => subscribeBulkChange(player),
								enableWhen: () => canEnableRequiredFourPiece(requiredSetBonuses, setBonus, canSatisfy),
								getValue: () => requiredSetBonuses.get(setBonus.setId)?.pieces === 4,
								setValue: (_modObj, newValue) => {
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
