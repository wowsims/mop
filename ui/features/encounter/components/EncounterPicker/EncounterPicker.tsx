import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { Button } from '@ui-kit/Button';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { PickerGroup } from '@ui-kit/PickerGroup';
import { useMemo, useState } from 'react';

import { AdvancedEncounterModal } from '../AdvancedEncounterModal';
import { TargetInputsPicker } from '../TargetsPicker';
import { durationConfigs, executeConfigs, minBaseDamageConfig, numAlliesConfig, presetEncounterConfig } from './utils/configs';

export interface EncounterPickerProps {
	showExecuteProportion: boolean;
}

export const EncounterPicker = ({ showExecuteProportion }: EncounterPickerProps) => {
	const host = useSimHost();
	const encounter = host.sim.encounter;
	const player = host.player;
	const { damage: showDamage } = useDisplayMetrics(host.sim);

	const duration = useMemo(() => durationConfigs(encounter), [encounter]);
	const execute = useMemo(() => (showExecuteProportion ? executeConfigs(encounter) : []), [encounter, showExecuteProportion]);
	const preset = useMemo(() => presetEncounterConfig(encounter), [encounter]);
	const allies = useMemo(() => numAlliesConfig(player), [player]);
	const minBaseDamage = useMemo(() => minBaseDamageConfig(), []);

	const [advancedOpen, setAdvancedOpen] = useState(false);

	return (
		<div className="flex flex-wrap gap-3 [&_.ui-list-picker-compact_.ui-field]:mb-0" data-testid="encounter-picker-root">
			<PickerGroup>
				{duration.map(config => (
					<NumberPicker key={config.id} modObject={encounter} config={config} />
				))}
			</PickerGroup>
			{showExecuteProportion && (
				<PickerGroup className="w-full flex-col flex-nowrap">
					{execute.map(config => (
						<NumberPicker key={config.id} modObject={encounter} config={config} />
					))}
				</PickerGroup>
			)}
			{showDamage && <EnumPicker modObject={encounter} config={preset} />}
			{player.canEnableTargetDummies() && <NumberPicker modObject={host.sim.raid} config={allies} />}
			{player.getPlayerSpec().isTankSpec && <NumberPicker modObject={encounter} config={minBaseDamage} />}
			<TargetInputsPicker encounter={encounter} targetIndex={0} />
			<Button className="min-w-[calc(50%-0.5rem)] max-xxl:w-full" data-testid="advanced-button" onClick={() => setAdvancedOpen(true)}>
				{i18n.t('settings_tab.encounter.advanced')}
			</Button>
			<AdvancedEncounterModal open={advancedOpen} onOpenChange={setAdvancedOpen} />
		</div>
	);
};
