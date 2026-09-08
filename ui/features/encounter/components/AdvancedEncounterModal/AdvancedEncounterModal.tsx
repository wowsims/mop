import { useSimHost } from '@sim/context/SimHostContext';
import type { Encounter } from '@sim/encounter';
import { subscribeEncounterChange } from '@sim/state/subscriptions';
import i18n from '@i18n/config';
import { Dialog } from '@ui-kit/Dialog';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import type { EnumPickerConfig } from '@ui-kit/pickers/enum_picker';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { makeTargetsPicker } from '../../view/encounter_picker';
import { durationConfigs, executeConfigs } from '../EncounterPicker/utils/configs';

export interface AdvancedEncounterModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const AdvancedEncounterModal = ({ open, onOpenChange }: AdvancedEncounterModalProps) => {
	const host = useSimHost();
	const encounter = host.sim.encounter;

	const presetConfig = useMemo((): EnumPickerConfig<Encounter> => {
		const presets = encounter.sim.db.getAllPresetEncounters();
		return {
			id: 'aem-encounter-picker',
			label: i18n.t('settings_tab.encounter.encounter_preset.label'),
			extraCssClasses: ['encounter-picker', 'mb-0', 'pe-2', 'order-first'],
			values: [{ name: 'Custom', value: -1 }, ...presets.map((preset, index) => ({ name: preset.path, value: index }))],
			storeSubscribe: subscribeEncounterChange,
			getValue: (subject: Encounter) => presets.findIndex(preset => subject.matchesPreset(preset)),
			setValue: (subject: Encounter, newValue: number) => {
				if (newValue === -1) return;
				const preset = presets[newValue];
				trackEvent({ action: 'settings', category: 'encounter', label: 'preset', value: preset.path });
				subject.applyPreset(preset);
			},
		};
	}, [encounter]);

	const duration = useMemo(() => durationConfigs(encounter), [encounter]);
	const execute = useMemo(() => executeConfigs(encounter), [encounter]);
	const mountTargets = useLegacyMount(parent => makeTargetsPicker(parent, encounter), [encounter]);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			className="advanced-encounter-picker-modal"
			container={host.rootElem}
			keepMounted
			headerChildren={<EnumPicker modObject={encounter} config={presetConfig} />}>
			<div className="encounter-header">
				<div className="picker-group">
					{duration.map(config => (
						<NumberPicker key={config.id} modObject={encounter} config={config} />
					))}
				</div>
				<div className="picker-group execute-group">
					{execute.map(config => (
						<NumberPicker key={config.id} modObject={encounter} config={config} />
					))}
				</div>
			</div>
			<div className="encounter-targets" ref={mountTargets} />
		</Dialog>
	);
};
