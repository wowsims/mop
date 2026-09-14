import { SavedTalents } from '@features/talents/components/SavedTalents';
import { TalentsPicker } from '@features/talents/components/TalentsPicker';
import { Class } from '@generated/proto/common';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { classTalentsConfig } from '@sim/talents/factory';
import { PetSpecPicker } from '@ui-kit/PetSpecPicker';
import { TabPanelColumns } from '@ui-kit/TabPanelColumns';
import { useMemo } from 'react';

import { trackEvent } from '../../tracking/analytics';
import { PresetConfigurationPicker } from '../PresetConfigurationPicker';

const TALENT_PRESETS = [PresetConfigurationCategory.Talents];

export const TalentsTabBody = () => {
	const host = useSimHost();
	const player = host.player;

	const talentsConfig = useMemo(
		() => ({
			tree: classTalentsConfig[player.getClass()]!,
			storeField: 'talentsString' as const,
			getValue: (subject: Player<any>) => subject.getTalentsString(),
			setValue: (subject: Player<any>, newValue: string) => {
				trackEvent({ action: 'settings', category: 'talents', label: 'update' });
				subject.setTalentsString(newValue);
			},
		}),
		[player],
	);

	return (
		<>
			<TabPanelColumns.Left>
				<TalentsPicker config={talentsConfig} />
				{player.isClass(Class.ClassHunter) && <PetSpecPicker player={player} />}
			</TabPanelColumns.Left>
			<TabPanelColumns.Right>
				<PresetConfigurationPicker categories={TALENT_PRESETS} />
				<SavedTalents />
			</TabPanelColumns.Right>
		</>
	);
};
