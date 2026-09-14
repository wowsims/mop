import type { ReforgeOptimizerModel, ReforgeOptimizerOptions } from '@features/reforge/model/reforge_optimizer';
import { ButtonGroup } from '@ui-kit/ButtonGroup';

import { ReforgePanel } from './ReforgePanel';

export interface ReforgeSidebarGroupProps {
	model: ReforgeOptimizerModel;
	options?: ReforgeOptimizerOptions;
}

export const ReforgeSidebarGroup = ({ model, options }: ReforgeSidebarGroupProps) => (
	<ButtonGroup
		className="ui-reforge-sidebar-actions order-20 grid w-full grid-cols-reforge [--settings-button-width:36px]"
		data-testid="suggest-reforges-settings-group">
		<ReforgePanel model={model} options={options} />
	</ButtonGroup>
);
