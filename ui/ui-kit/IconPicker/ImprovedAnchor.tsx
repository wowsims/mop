import { externalRel } from '@domain/links';
import type { ActionId } from '@domain/proto_utils/action_id';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { wowheadAnchorProps } from '@ui-kit/wowhead';
import clsx from 'clsx';

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
			{...wowheadAnchorProps()}
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
			hidden={hidden}
		/>
	);
};
