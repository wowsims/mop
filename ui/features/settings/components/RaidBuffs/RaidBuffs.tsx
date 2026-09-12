import { usePlayer, useSim } from '@sim/context/SimHostContext';
import { subscribeSimChange } from '@sim/state/subscriptions';
import { clearMultiIconInputs } from '@features/settings/model/multi_icon';
import type { IconPickerStatOption, RenderableStatOptions } from '@features/settings/model/stat_options';
import i18n from '@i18n/config';
import { MultiIconPicker } from '@ui-kit/MultiIconPicker';
import { useMemo } from 'react';

import { StatOptionIcons } from '../StatOptionIcons';

export interface RaidBuffsProps {
	options: ReadonlyArray<RenderableStatOptions>;
	miscOptions: ReadonlyArray<IconPickerStatOption>;
}

export const RaidBuffs = ({ options, miscOptions }: RaidBuffsProps) => {
	const player = usePlayer();
	const sim = useSim();
	const subscribe = subscribeSimChange(sim);
	const miscConfig = useMemo(
		() => ({ inputs: miscOptions.map(option => option.config), label: i18n.t('settings_tab.raid_buffs.misc.label') }),
		[miscOptions],
	);

	return (
		<>
			<StatOptionIcons options={options} />
			{miscOptions.length > 0 && (
				<MultiIconPicker modObject={player} config={miscConfig} subscribe={subscribe} onClear={() => clearMultiIconInputs(player, miscConfig)} />
			)}
		</>
	);
};
