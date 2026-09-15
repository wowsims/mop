import type { ActionId } from '@sim/proto/action_id';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import clsx from 'clsx';

import { wowheadAnchorProps } from '../utils/wowhead';

export interface ImprovedAnchorProps {
	actionId: ActionId;
	testId: string;
	active: boolean;
	hidden: boolean;
}

export const ImprovedAnchor = ({ actionId, testId, active, hidden }: ImprovedAnchorProps) => {
	const { iconUrl, href } = useActionId(actionId);
	return (
		<a
			className={clsx(
				'ui-icon-picker-swatch pointer-events-auto absolute right-0 bottom-0 size-5 min-w-5',
				active ? 'filter-none' : 'border-gray-600 grayscale',
			)}
			data-testid={testId}
			data-active={active ? '' : undefined}
			{...wowheadAnchorProps()}
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
			hidden={hidden}
		/>
	);
};
