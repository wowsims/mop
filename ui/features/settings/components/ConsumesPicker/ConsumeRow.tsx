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
	/** The key under `settings_tab.consumables` whose `title` labels the row. */
	name: 'potions' | 'elixirs' | 'food' | 'engineering' | 'pet';
	/**
	 * The pickers whose visibility decides the row's. Omitted on the three rows vanilla never called
	 * `updateRow` for — elixirs, food and pet are always shown.
	 */
	configs?: ReadonlyArray<IconEnumPickerConfig<Player<any>, any>>;
	children: ReactNode;
}

/**
 * One labelled row of the consumables block.
 *
 * `updateRow` is where this block inverts React's data flow: the row's `hide` is decided by its
 * *children's* visibility, which vanilla read off the constructed picker instances. Asking the
 * configs instead — `iconEnumPickerShown` is that same override, lifted out of the picker — keeps
 * the answer flowing down.
 *
 * Subscribed to the two professions and nothing else, as vanilla was. That is narrower than what the
 * pickers themselves watch, and narrower than what their values depend on (faction, hence race), so
 * a row whose last option goes away for some other reason stays shown until a profession changes.
 * Matched rather than corrected.
 */
export const ConsumeRow = ({ name, configs, children }: ConsumeRowProps) => {
	const player = usePlayer();
	// `subscribeAll` builds a new source on every call, and `useStoreSubscribe` re-subscribes whenever
	// that identity changes.
	const subscribe = useMemo(() => subscribeAll([subscribePlayerField(player, 'profession1'), subscribePlayerField(player, 'profession2')]), [player]);
	const labelId = useId();
	const shown = useStoreSubscribe(subscribe, () => !configs || configs.some(config => iconEnumPickerShown(config, player)));

	return (
		<div className={clsx('consumes-row', 'input-root', 'input-inline', !shown && 'hide')} role="group" aria-labelledby={labelId}>
			{/* A `<label>` that labels nothing is not a label: this names the row's icon group, which is
			    not a form control. The row says so itself instead. */}
			<span className="form-label" id={labelId}>
				{i18n.t(`settings_tab.consumables.${name}.title`)}
			</span>
			{children}
		</div>
	);
};
