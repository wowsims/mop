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

const NEVER: StoreSubscribe = () => () => {};

export const CustomSection = ({ section }: CustomSectionProps) => {
	const player = usePlayer() as Player<Spec>;
	const when = section.when;
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
