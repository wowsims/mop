import { subscribeSimChange } from '@domain/state/subscriptions';
import { clearMultiIconInputs } from '@features/settings/model/multi_icon';
import type { MultiIconPickerStatOption, RenderableStatOptions } from '@features/settings/model/stat_options';
import { usePlayer, useSim } from '@features/SimHostContext';
import { IconPicker } from '@ui-kit/IconPicker';
import { MultiIconPicker } from '@ui-kit/MultiIconPicker';
import { useMemo } from 'react';

export interface StatOptionIconsProps {
	/** Already filtered through `relevantStatOptions` — this renders whatever it is given. */
	options: ReadonlyArray<RenderableStatOptions>;
}

/**
 * `picker` names the class the vanilla builder instantiated, but a class reference is not a literal
 * type, so comparing it narrows nothing. The config shape does: only the multi picker carries a list
 * of child inputs.
 */
const isMultiIcon = (option: RenderableStatOptions): option is MultiIconPickerStatOption => 'inputs' in option.config;

/**
 * A row of icon toggles built from a `PickerStatOption` list: the shape every buffs-and-debuffs
 * section shares, of which the two external-cooldown blocks are the simplest instances.
 *
 * Debuffs interleaves `IconPicker` and `MultiIconPicker` entries *in config order*, which is why
 * this dispatches rather than being two components rendered one after the other.
 *
 * `RenderableStatOptions` is narrower than the `PickerStatOptions` union its input lists can hold:
 * no live option list names an `IconEnumPicker`, so this has no branch for one, and the type is what
 * stops a section being wired up half working. See that type.
 */
export const StatOptionIcons = ({ options }: StatOptionIconsProps) => {
	const player = usePlayer();
	const sim = useSim();
	// `subscribeSimChange` builds a new source on every call and `useStoreSubscribe` re-subscribes
	// whenever that identity changes.
	const subscribe = useMemo(() => subscribeSimChange(sim), [sim]);

	return (
		<>
			{options.map((option, index) =>
				// The list is derived from a module-level constant and never reorders, so the index is
				// stable — and the configs carry no id of their own to key on.
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
