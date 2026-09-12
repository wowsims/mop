import { GearPicker } from '@features/gear/components/GearPicker';
import { SavedGear } from '@features/gear/components/SavedGear';
import { SelectorModal } from '@features/gear/components/SelectorModal';
import { GemSummary, ReforgeSummary, UpgradeCostsSummary } from '@features/gear/components/SummaryTable';
import { OpenSelectorModalContext, useSelectorModalState } from '@features/gear/hooks/useSelectorModal';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimReady } from '@sim/hooks/useSimReady';

import { PresetConfigurationPicker } from '../PresetConfigurationPicker';

const GEAR_PRESETS = [PresetConfigurationCategory.Gear];

export const GearTabBody = () => {
	const ready = useSimReady();
	const selector = useSelectorModalState();

	return (
		<OpenSelectorModalContext value={selector.openTab}>
			<div className="gear-tab-left tab-panel-left">
				<GearPicker ready={ready} />
				<div className="summary-tables-container">
					<GemSummary />
					<ReforgeSummary />
					<UpgradeCostsSummary />
				</div>
			</div>
			<div className="gear-tab-right tab-panel-right">
				<PresetConfigurationPicker categories={GEAR_PRESETS} />
				<SavedGear />
			</div>
			<SelectorModal state={selector} />
		</OpenSelectorModalContext>
	);
};
