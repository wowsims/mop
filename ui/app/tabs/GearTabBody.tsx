import { GearPicker } from '@features/gear/components/GearPicker';
import { SavedGear } from '@features/gear/components/SavedGear';
import { SelectorModal } from '@features/gear/components/SelectorModal';
import { GemSummary, ReforgeSummary, UpgradeCostsSummary } from '@features/gear/components/SummaryTable';
import { OpenSelectorModalContext, useSelectorModalState } from '@features/gear/hooks/useSelectorModal';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimReady } from '@sim/hooks/useSimReady';
import { TabPanelColumns } from '@ui-kit/TabPanelColumns';

import { PresetConfigurationPicker } from '../PresetConfigurationPicker';

const GEAR_PRESETS = [PresetConfigurationCategory.Gear];

export const GearTabBody = () => {
	const ready = useSimReady();
	const selector = useSelectorModalState();

	return (
		<OpenSelectorModalContext value={selector.openTab}>
			<TabPanelColumns.Left className="gear-tab-left" variant="auto-columns">
				<GearPicker ready={ready} />
				<div className="summary-tables-container">
					<GemSummary />
					<ReforgeSummary />
					<UpgradeCostsSummary />
				</div>
			</TabPanelColumns.Left>
			<TabPanelColumns.Right className="gear-tab-right">
				<PresetConfigurationPicker categories={GEAR_PRESETS} />
				<SavedGear />
			</TabPanelColumns.Right>
			<SelectorModal state={selector} />
		</OpenSelectorModalContext>
	);
};
