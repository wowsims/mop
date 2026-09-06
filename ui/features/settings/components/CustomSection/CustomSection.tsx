import type { Player } from '@domain/player';
import { usePlayer } from '@features/SimHostContext';
import type { CustomSection as CustomSectionConfig } from '@features/spec_config';
import type { Spec } from '@generated/proto/common';
import { IconPicker } from '@ui-kit/IconPicker';
import clsx from 'clsx';

import { InputPicker } from '../InputPicker';

export interface CustomSectionProps {
	section: CustomSectionConfig<any>;
}

/**
 * A spec's own settings section, from the `sections` entry that declares it: an optional row of icon
 * toggles above an optional list of generic inputs.
 *
 * The `ContentBlock` around this, its `custom-section` class and its `when` visibility all stay in
 * `settings_tab.tsx`. `when` toggles `hide` on the block's *root*, which React does not own — and it
 * only reads the player, so there is nothing to move into `model/`.
 *
 * `inline` is forced on everything, icon pickers included, because the vanilla builder walked every
 * `.input-root` in the body afterwards. `iconEnum` inputs would need a picker that is not ported
 * yet; neither live section declares one, and the narrowing below means a spec that adds one fails
 * to compile rather than rendering a section silently short.
 */
export const CustomSection = ({ section }: CustomSectionProps) => {
	const player = usePlayer() as Player<Spec>;

	return (
		<>
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
		</>
	);
};
