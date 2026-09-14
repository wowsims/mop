import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import type { Encounter } from '@sim/raid/encounter';
import { Dialog } from '@ui-kit/Dialog';
import { EnumPicker } from '@ui-kit/EnumPicker';
import type { EnumPickerConfig } from '@ui-kit/EnumPicker/types';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { PickerGroup } from '@ui-kit/PickerGroup';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { durationConfigs, executeConfigs } from '../EncounterPicker/utils/configs';
import { TargetsPicker } from '../TargetsPicker';

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
			extraClassNames: ['mb-0', 'pr-2', 'order-first', 'w-1/3', 'max-sm:w-1/2'],
			values: [{ name: 'Custom', value: -1 }, ...presets.map((preset, index) => ({ name: preset.path, value: index }))],
			storeField: 'encounter:*',
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

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			testId="advanced-encounter-picker-modal"
			bodyClassName="overflow-auto"
			bodyGap="gap-3"
			headerChildren={<EnumPicker modObject={encounter} config={presetConfig} />}>
			<div className="flex flex-col gap-3" data-testid="encounter-header">
				<PickerGroup>
					{duration.map(config => (
						<NumberPicker key={config.id} modObject={encounter} config={config} />
					))}
				</PickerGroup>
				<PickerGroup className="flex-row">
					{execute.map(config => (
						<NumberPicker key={config.id} modObject={encounter} config={config} />
					))}
				</PickerGroup>
			</div>
			<div>
				<TargetsPicker encounter={encounter} />
			</div>
		</Dialog>
	);
};
