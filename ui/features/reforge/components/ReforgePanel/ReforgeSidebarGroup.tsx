import type { ReforgeOptimizerModel, ReforgeOptimizerOptions } from '@features/reforge/model/reforge_optimizer';
import { useState } from 'react';

import { ReforgePanel } from './ReforgePanel';

export interface ReforgeSidebarGroupProps {
	model: ReforgeOptimizerModel;
	options?: ReforgeOptimizerOptions;
}

export const ReforgeSidebarGroup = ({ model, options }: ReforgeSidebarGroupProps) => {
	const [group, setGroup] = useState<HTMLDivElement | null>(null);

	return (
		<div ref={setGroup} className="flex btn-group w-full suggest-reforges-settings-group" role="group">
			{group && <ReforgePanel model={model} options={options} container={group} />}
		</div>
	);
};
