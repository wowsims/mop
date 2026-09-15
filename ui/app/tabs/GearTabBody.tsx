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
			<TabPanelColumns.Left variant="auto-columns">
				<GearPicker ready={ready} />
				<div className="grid grid-flow-row grid-cols-2 gap-section max-md:grid-cols-1">
					<GemSummary />
					<ReforgeSummary />
					<UpgradeCostsSummary />
				</div>
			</TabPanelColumns.Left>
			<TabPanelColumns.Right>
				<PresetConfigurationPicker categories={GEAR_PRESETS} />
				<SavedGear />
			</TabPanelColumns.Right>
			<SelectorModal state={selector} />
		</OpenSelectorModalContext>
	);
};
