import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { GearPicker } from '@features/gear/components/GearPicker';
import { SavedGear } from '@features/gear/components/SavedGear';
import { GemSummary, ReforgeSummary, UpgradeCostsSummary } from '@features/gear/components/SummaryTable';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';

import { PresetConfigurationPicker } from '../preset_configuration_picker';

export const GearTabBody = () => {
	const host = useSimHost();
	const ready = useSimReady(host.sim);

	const mountRight = useLegacyMount(
		parent => {
			const presets = new PresetConfigurationPicker(parent, host, [PresetConfigurationCategory.Gear]);
			parent.insertBefore(presets.rootElem, parent.firstChild);
			return [presets];
		},
		[host],
	);

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
			<div className="gear-tab-right tab-panel-right" ref={mountRight}>
				<SavedGear />
			</div>
		</>
	);
};
