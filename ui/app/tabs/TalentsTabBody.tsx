import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { classTalentsConfig } from '@sim/talents/factory';
import { SavedTalents } from '@features/talents/components/SavedTalents';
import { TalentsPicker } from '@features/talents/components/TalentsPicker';
import { Class } from '@generated/proto/common';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { PetSpecPicker } from '@ui-kit/PetSpecPicker';
import { useMemo } from 'react';

import { trackEvent } from '../../tracking/analytics';
import { PresetConfigurationPicker } from '../preset_configuration_picker';

export const TalentsTabBody = () => {
	const host = useSimHost();
	const player = host.player;

	const talentsConfig = useMemo(
		() => ({
			tree: classTalentsConfig[player.getClass()]!,
			storeSubscribe: (subject: Player<any>) => subscribePlayerField(subject, 'talentsString'),
			getValue: (subject: Player<any>) => subject.getTalentsString(),
			setValue: (subject: Player<any>, newValue: string) => {
				trackEvent({ action: 'settings', category: 'talents', label: 'update' });
				subject.setTalentsString(newValue);
			},
		}),
		[player],
	);

	const mountRight = useLegacyMount(
		parent => {
			const presets = new PresetConfigurationPicker(parent, host, [PresetConfigurationCategory.Talents]);
			parent.insertBefore(presets.rootElem, parent.firstChild);
			return [presets];
		},
		[host],
	);

	return (
		<>
			<div className="talents-tab-left tab-panel-left">
				<TalentsPicker config={talentsConfig} />
				{player.isClass(Class.ClassHunter) && <PetSpecPicker player={player} />}
			</div>
			<div className="talents-tab-right tab-panel-right" ref={mountRight}>
				<SavedTalents />
			</div>
		</>
	);
};
