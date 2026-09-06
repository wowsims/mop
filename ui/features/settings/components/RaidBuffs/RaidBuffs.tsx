import { subscribeSimChange } from '@domain/state/subscriptions';
import { clearMultiIconInputs } from '@features/settings/model/multi_icon';
import type { IconPickerStatOption, RenderableStatOptions } from '@features/settings/model/stat_options';
import { usePlayer, useSim } from '@features/SimHostContext';
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
	const subscribe = useMemo(() => subscribeSimChange(sim), [sim]);
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
