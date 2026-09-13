import type { ReforgeOptimizerModel, ReforgeOptimizerOptions } from '@features/reforge/model/reforge_optimizer';
import { ButtonGroup } from '@ui-kit/ButtonGroup';
import { useState } from 'react';

import { ReforgePanel } from './ReforgePanel';

export interface ReforgeSidebarGroupProps {
	model: ReforgeOptimizerModel;
	options?: ReforgeOptimizerOptions;
}

export const ReforgeSidebarGroup = ({ model, options }: ReforgeSidebarGroupProps) => {
	const [group, setGroup] = useState<HTMLDivElement | null>(null);

	return (
		<ButtonGroup
			ref={setGroup}
			className="[--settings-button-width:36px] w-full grid grid-cols-[auto_calc(var(--settings-button-width))] order-last suggest-reforges-settings-group">
			{group && <ReforgePanel model={model} options={options} container={group} />}
		</ButtonGroup>
	);
};
