import { useSimHost } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { useEffect, useMemo, useRef } from 'react';

import { AdvancedEncounterModal, makeTargetInputsPicker } from '../../view/encounter_picker';
import { durationConfigs, executeConfigs, minBaseDamageConfig, numAlliesConfig, presetEncounterConfig } from './utils/configs';

export interface EncounterPickerProps {
	showExecuteProportion: boolean;
}

/**
 * The encounter block in the settings tab.
 *
 * Rendered whole rather than in two stages. The vanilla constructor added the duration fields
 * synchronously and everything else in a `waitForInit` callback — but the constructor itself ran
 * inside `SettingsTab.buildTabContent`, which is already on `waitForInit`, so the first stage never
 * had a moment of its own. `SimApp` waits for the same signal before portalling this in, because the
 * content block it renders into does not exist until then.
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

	// A ref, not state: nothing renders from it, and the click that reads it happens long after the
	// effect has run. Holding it in state would re-render the whole block once for nothing and leave
	// the button inert for that first frame.
	const advanced = useRef<AdvancedEncounterModal | null>(null);
	useEffect(() => {
		// Built into the sim root rather than into this block, which is where vanilla put it — and
		// eagerly, so it joins the set `parity.mjs` compares at load.
		const modal = new AdvancedEncounterModal(host.rootElem, encounter);
		advanced.current = modal;
		return () => {
			modal.dispose();
			modal.rootElem.remove();
			advanced.current = null;
		};
	}, [host, encounter]);

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
			<Button className="advanced-button" onClick={() => advanced.current?.open()}>
				{i18n.t('settings_tab.encounter.advanced')}
			</Button>
		</div>
	);
};
