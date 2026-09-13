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
		<ButtonGroup ref={setGroup} className="w-full suggest-reforges-settings-group">
			{group && <ReforgePanel model={model} options={options} container={group} />}
		</ButtonGroup>
	);
};
