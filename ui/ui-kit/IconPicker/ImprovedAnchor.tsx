import { externalRel } from '@domain/links';
import type { ActionId } from '@domain/proto_utils/action_id';
import { useActionId } from '@ui-kit/hooks/useActionId';
import clsx from 'clsx';

export interface ImprovedAnchorProps {
	actionId?: ActionId;
	className: string;
	active: boolean;
	hidden: boolean;
}

// Both improved anchors exist at every `states` — vanilla builds them once and only ever gates the
// FILL, leaving an unfilled one without an href, which `.icon-input-improved:not([href])` hides.
// Each needs its own `useActionId`, so each is its own component.
export const ImprovedAnchor = ({ actionId, className, active, hidden }: ImprovedAnchorProps) => {
	const { iconUrl, href } = useActionId(actionId);
	return (
		<a
			className={clsx('icon-picker-button icon-input-improved', className, active && 'active')}
			data-whtticon="false"
			data-disable-wowhead-touch-tooltip="true"
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
			hidden={hidden}
		/>
	);
};
