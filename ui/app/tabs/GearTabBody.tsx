import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { GearPicker } from '@features/gear/components/GearPicker';
import { SavedGear } from '@features/gear/components/SavedGear';
import { GemSummary, ReforgeSummary, UpgradeCostsSummary } from '@features/gear/components/SummaryTable';

import { PresetConfigurationPicker } from '../PresetConfigurationPicker';

const GEAR_PRESETS = [PresetConfigurationCategory.Gear];

export const GearTabBody = () => {
	const host = useSimHost();
	const ready = useSimReady();

	return (
		<>
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
		</>
	);
};
