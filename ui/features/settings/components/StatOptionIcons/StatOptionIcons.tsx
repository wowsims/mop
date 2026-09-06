import { subscribeSimChange } from '@domain/state/subscriptions';
import { clearMultiIconInputs } from '@features/settings/model/multi_icon';
import type { MultiIconPickerStatOption, RenderableStatOptions } from '@features/settings/model/stat_options';
import { usePlayer, useSim } from '@features/SimHostContext';
import { IconPicker } from '@ui-kit/IconPicker';
import { MultiIconPicker } from '@ui-kit/MultiIconPicker';
import { useMemo } from 'react';

export interface StatOptionIconsProps {
	options: ReadonlyArray<RenderableStatOptions>;
}

const isMultiIcon = (option: RenderableStatOptions): option is MultiIconPickerStatOption => 'inputs' in option.config;

export const StatOptionIcons = ({ options }: StatOptionIconsProps) => {
	const player = usePlayer();
	const sim = useSim();
	const subscribe = useMemo(() => subscribeSimChange(sim), [sim]);

	return (
		<>
			{options.map((option, index) =>
				isMultiIcon(option) ? (
					<MultiIconPicker
						key={index}
						modObject={player}
						config={option.config}
						subscribe={subscribe}
						onClear={() => clearMultiIconInputs(player, option.config)}
					/>
				) : (
					<IconPicker key={index} modObject={player} config={option.config} />
				),
			)}
		</>
	);
};
