import type { ActionId } from '@sim/proto/action_id';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import clsx from 'clsx';

import { wowheadAnchorProps } from '../utils/wowhead';

export interface ImprovedAnchorProps {
	actionId?: ActionId;
	className: string;
	active: boolean;
	hidden: boolean;
}

export const ImprovedAnchor = ({ actionId, className, active, hidden }: ImprovedAnchorProps) => {
	const { iconUrl, href } = useActionId(actionId);
	return (
		<a
			className={clsx('icon-picker-button icon-input-improved', className, active && 'active')}
			data-testid={className}
			data-active={active ? '' : undefined}
			{...wowheadAnchorProps()}
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
			hidden={hidden}
		/>
	);
};
