import { subscribeBulkChange } from '@sim/state/subscriptions';
import i18n from '@i18n/config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';

import { trackEvent } from '../../../../tracking/analytics';
import type { BulkTab } from '../../bulk_tab';
import { useBulkTab } from '../../hooks/useBulkTab';
import { useBulkVersion } from '../../hooks/useBulkVersion';
import type { BulkSetBonusOption } from '../../model/set_bonuses';

const setBonusDomId = (setBonus: BulkSetBonusOption) => `required-set-bonus-${setBonus.setId}-${setBonus.setName.replace(/\W+/g, '-')}`;

export const RequiredSetBonuses = () => {
	const bt = useBulkTab();
	// The list of offered set bonuses is derived from what the batch holds.
	useBulkVersion('items');
	const setBonuses = bt.getAvailableBulkSetBonuses();

	return (
		<div className="required-set-bonuses-container d-flex flex-column gap-2">
			{!!setBonuses.length && <h6>{i18n.t('bulk_tab.settings.required_set_bonuses.label')}</h6>}
			{setBonuses.map(setBonus => (
				<div key={setBonus.setId} className="bulk-required-set-bonus d-flex flex-column gap-1">
					<div className="form-label">
						{setBonus.setName} {i18n.t('bulk_tab.settings.required_set_bonuses.available_pieces', { count: setBonus.totalPieces })}
					</div>
					{setBonus.totalPieces >= 2 && (
						<BooleanPicker<BulkTab>
							modObject={bt}
							config={{
								id: `${setBonusDomId(setBonus)}-2p`,
								label: i18n.t('bulk_tab.settings.required_set_bonuses.require_2p'),
								inline: true,
								storeSubscribe: () => subscribeBulkChange(bt),
								enableWhen: () => bt.canEnableRequiredTwoPiece(setBonus.setId),
								getValue: () => bt.requiredSetBonuses.get(setBonus.setId)?.pieces === 2,
								setValue: (_modObj, newValue) => {
									bt.setRequiredSetBonus(setBonus, newValue ? 2 : 0);
									trackEvent({ action: 'settings', category: 'batch_sim', label: 'required_set_bonus', value: newValue ? 2 : 0 });
								},
							}}
						/>
					)}
					{setBonus.totalPieces >= 4 && (
						<BooleanPicker<BulkTab>
							modObject={bt}
							config={{
								id: `${setBonusDomId(setBonus)}-4p`,
								label: i18n.t('bulk_tab.settings.required_set_bonuses.require_4p'),
								inline: true,
								extraCssClasses: ['bulk-required-set-bonus'],
								storeSubscribe: () => subscribeBulkChange(bt),
								enableWhen: () => bt.canEnableRequiredFourPiece(setBonus),
								getValue: () => bt.requiredSetBonuses.get(setBonus.setId)?.pieces === 4,
								setValue: (_modObj, newValue) => {
									bt.setRequiredSetBonus(setBonus, newValue ? 4 : 0);
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
