import { subscribeSimChange } from '@domain/state/subscriptions';
import { clearMultiIconInputs } from '@features/settings/model/multi_icon';
import type { IconPickerStatOption, RenderableStatOptions } from '@features/settings/model/stat_options';
import { usePlayer, useSim } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { MultiIconPicker } from '@ui-kit/MultiIconPicker';
import { useMemo } from 'react';

import { StatOptionIcons } from '../StatOptionIcons';

export interface RaidBuffsProps {
	/** `RAID_BUFFS_CONFIG` after `relevantStatOptions`. */
	options: ReadonlyArray<RenderableStatOptions>;
	/** `RAID_BUFFS_MISC_CONFIG` after `relevantStatOptions` — empty on most specs. */
	miscOptions: ReadonlyArray<IconPickerStatOption>;
}

/**
 * The raid-buffs block's body: the stat-option walk every icon section shares, plus one extra
 * bundle.
 *
 * The bundle is the axis this block adds and the reason it is not just a `StatOptionIcons`: its
 * children arrive as `IconPickerConfig`s rather than as a `MultiIconPickerConfig`, so the config is
 * assembled here — inputs from the option list, label from the block's own translation, and no
 * `showWhen`, exactly as the vanilla builder assembled it.
 *
 * The block's `<p>` description stays on the vanilla `ContentBlock` header, which React does not own.
 */
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
