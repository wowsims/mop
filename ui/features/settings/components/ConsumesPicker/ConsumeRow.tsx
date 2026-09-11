import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import type { Player } from '@sim/player/player';
import { iconEnumPickerShown } from '@ui-kit/IconEnumPicker';
import type { IconEnumPickerConfig } from '@ui-kit/IconEnumPicker/types';
import clsx from 'clsx';
import { type ReactNode, useId, useMemo } from 'react';

export interface ConsumeRowProps {
	name: 'potions' | 'elixirs' | 'food' | 'engineering' | 'pet';
	configs?: ReadonlyArray<IconEnumPickerConfig<Player<any>, any>>;
	children: ReactNode;
}

export const ConsumeRow = ({ name, configs, children }: ConsumeRowProps) => {
	const player = usePlayer();
	const profession1 = usePlayerStore('profession1');
	const profession2 = usePlayerStore('profession2');
	const labelId = useId();
	const shown = useMemo(() => !configs || configs.some(config => iconEnumPickerShown(config, player)), [configs, player, profession1, profession2]);

	return (
		<div className={clsx('consumes-row', 'input-root', 'input-inline', !shown && 'hide')} role="group" aria-labelledby={labelId}>
			<span className="form-label" id={labelId}>
				{i18n.t(`settings_tab.consumables.${name}.title`)}
			</span>
			{children}
		</div>
	);
};
