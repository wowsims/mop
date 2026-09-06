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

/**
 * The encounter block in the settings tab.
 *
 * Rendered whole rather than in two stages. The vanilla constructor added the duration fields
 * synchronously and everything else in a `waitForInit` callback — but the constructor itself ran
 * inside the settings tab's own `waitForInit` callback, so the first stage never had a moment of its
 * own. `SettingsTabBody` renders this behind the same signal, which is that callback's React form.
 *
 * Two of that constructor's jobs are **not** here: re-seeding the primary target's inputs from its
 * preset, and zeroing the raid's dummy count when the player stops being able to enable it. Both
 * were store writes inside a view; they live in `features/encounter/model/` now and are wired in
 * `individual_sim_ui.tsx`.
 */
export const EncounterPicker = ({ showExecuteProportion }: EncounterPickerProps) => {
	const host = useSimHost();
	const encounter = host.sim.encounter;
	const player = host.player;

	const duration = useMemo(() => durationConfigs(encounter), [encounter]);
	const execute = useMemo(() => (showExecuteProportion ? executeConfigs(encounter) : []), [encounter, showExecuteProportion]);
	const preset = useMemo(() => presetEncounterConfig(encounter), [encounter]);
	const allies = useMemo(() => numAlliesConfig(player), [player]);
	const minBaseDamage = useMemo(() => minBaseDamageConfig(), []);

	// `ListPicker` is still vanilla, and the advanced modal behind the button below is a `BaseModal`
	// waiting on the Base UI `Dialog` adapter. Both are built into the root element itself rather
	// than into a wrapper, so the block's DOM is the shape it always was — and the list is moved back
	// above the button, which React has already committed by the time a ref callback runs.
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
