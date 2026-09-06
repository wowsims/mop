import { useSimHost } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { useMemo, useState } from 'react';

import { makeTargetInputsPicker } from '../../view/encounter_picker';
import { AdvancedEncounterModal } from '../AdvancedEncounterModal';
import { durationConfigs, executeConfigs, minBaseDamageConfig, numAlliesConfig, presetEncounterConfig } from './utils/configs';

export interface EncounterPickerProps {
	showExecuteProportion: boolean;
}

export const EncounterPicker = ({ showExecuteProportion }: EncounterPickerProps) => {
	const host = useSimHost();
	const encounter = host.sim.encounter;
	const player = host.player;

	const duration = useMemo(() => durationConfigs(encounter), [encounter]);
	const execute = useMemo(() => (showExecuteProportion ? executeConfigs(encounter) : []), [encounter, showExecuteProportion]);
	const preset = useMemo(() => presetEncounterConfig(encounter), [encounter]);
	const allies = useMemo(() => numAlliesConfig(player), [player]);
	const minBaseDamage = useMemo(() => minBaseDamageConfig(), []);

	const mountTargetInputs = useLegacyMount(
		parent => {
			const picker = makeTargetInputsPicker(parent, encounter, 0);
			parent.insertBefore(picker.rootElem, parent.querySelector('.advanced-button'));
			return picker;
		},
		[encounter],
	);

	const [advancedOpen, setAdvancedOpen] = useState(false);

	return (
		<div className="encounter-picker-root" ref={mountTargetInputs}>
			<div className="picker-group">
				{duration.map(config => (
					<NumberPicker key={config.id} modObject={encounter} config={config} />
				))}
			</div>
			{showExecuteProportion && (
				<div className="picker-group execute-group">
					{execute.map(config => (
						<NumberPicker key={config.id} modObject={encounter} config={config} />
					))}
				</div>
			)}
			<EnumPicker modObject={encounter} config={preset} />
			{player.canEnableTargetDummies() && <NumberPicker modObject={host.sim.raid} config={allies} />}
			{player.getPlayerSpec().isTankSpec && <NumberPicker modObject={encounter} config={minBaseDamage} />}
			<Button className="advanced-button" onClick={() => setAdvancedOpen(true)}>
				{i18n.t('settings_tab.encounter.advanced')}
			</Button>
			<AdvancedEncounterModal open={advancedOpen} onOpenChange={setAdvancedOpen} />
		</div>
	);
};
