import type { Player } from '@domain/player';
import { subscribeAll, subscribePlayerField } from '@domain/state/subscriptions';
import { usePlayer } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { iconEnumPickerShown } from '@ui-kit/IconEnumPicker';
import type { IconEnumPickerConfig } from '@ui-kit/pickers/icon_enum_picker';
import clsx from 'clsx';
import { type ReactNode, useId, useMemo } from 'react';

export interface ConsumeRowProps {
	name: 'potions' | 'elixirs' | 'food' | 'engineering' | 'pet';
	configs?: ReadonlyArray<IconEnumPickerConfig<Player<any>, any>>;
	children: ReactNode;
}

export const ConsumeRow = ({ name, configs, children }: ConsumeRowProps) => {
	const player = usePlayer();
	const subscribe = useMemo(() => subscribeAll([subscribePlayerField(player, 'profession1'), subscribePlayerField(player, 'profession2')]), [player]);
	const labelId = useId();
	const shown = useStoreSubscribe(subscribe, () => !configs || configs.some(config => iconEnumPickerShown(config, player)));

	return (
		<div className={clsx('consumes-row', 'input-root', 'input-inline', !shown && 'hide')} role="group" aria-labelledby={labelId}>
			<span className="form-label" id={labelId}>
				{i18n.t(`settings_tab.consumables.${name}.title`)}
			</span>
			{children}
		</div>
	);
};
