import type { Player } from '@domain/player';
import { type StoreSubscribe, subscribePlayerChange } from '@domain/state/subscriptions';
import { usePlayer } from '@features/SimHostContext';
import type { CustomSection as CustomSectionConfig } from '@features/spec_config';
import type { Spec } from '@generated/proto/common';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { IconPicker } from '@ui-kit/IconPicker';
import clsx from 'clsx';
import { useMemo } from 'react';

import { InputPicker } from '../InputPicker';

export interface CustomSectionProps {
	section: CustomSectionConfig<any>;
}

/** A section with no `when` subscribes to nothing, as the vanilla builder only subscribed when one existed. */
const NEVER: StoreSubscribe = () => () => {};

/**
 * A spec's own settings section, from the `sections` entry that declares it: an optional row of icon
 * toggles above an optional list of generic inputs, inside the block that titles them.
 *
 * The block is this component's now that the tab body is React, and so are the two things that used
 * to stay behind in `settings_tab.tsx` because they live on the block's *root*: the `custom-section`
 * class and the `when` visibility. `when` only reads the player, so there is still nothing to move
 * into `model/`.
 *
 * `inline` is forced on everything, icon pickers included, because the vanilla builder walked every
 * `.input-root` in the body afterwards. Neither live section declares an `iconEnum` input, so this
 * has no branch for one even though `IconEnumPicker` is ported; the narrowing below means a spec
 * that adds one fails to compile rather than rendering a section silently short.
 */
export const CustomSection = ({ section }: CustomSectionProps) => {
	const player = usePlayer() as Player<Spec>;
	const when = section.when;
	// `subscribePlayerChange` builds a new source per call, and `useStoreSubscribe` re-subscribes
	// whenever that identity changes.
	const subscribe = useMemo(() => (when ? subscribePlayerChange(player) : NEVER), [player, when]);
	const visible = useStoreSubscribe(subscribe, () => !when || when(player));

	return (
		<ContentBlock
			cssClass={section.cssClass || section.id}
			config={{
				header: { title: section.title, tooltip: section.tooltip },
				extraCssClasses: visible ? ['custom-section'] : ['custom-section', 'hide'],
			}}>
			{!!section.iconInputs?.length && (
				<div className={clsx('picker-group', section.iconGroupCssClass, 'icon-group')}>
					{section.iconInputs.map((config, index) => {
						if (config.type !== 'icon')
							throw new Error(`custom section ${section.id}: ${config.type} inputs need a React picker that does not exist yet`);
						// The configs carry no id of their own, and the list is declared statically.
						return <IconPicker key={index} modObject={player} config={{ ...config, inline: true }} />;
					})}
				</div>
			)}
			{section.inputs?.map(config => (
				<InputPicker key={config.id} config={{ ...config, inline: true }} />
			))}
		</ContentBlock>
	);
};
