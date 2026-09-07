import { usePlayer } from '@sim/context/SimHostContext';
import { Spec } from '@generated/proto/common';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId, useMemo } from 'react';

import { ITEM_NOTICES } from '../../view/item_notices';

export interface ItemNoticeIconProps {
	itemId: number;
	additionalNotice?: Element;
}

const NoticeContent = ({ notices }: { notices: ReadonlyArray<Element> }) => (
	<div
		ref={element => {
			element?.replaceChildren(...notices.map(notice => notice.cloneNode(true)));
		}}
	/>
);

export const ItemNoticeIcon = ({ itemId, additionalNotice }: ItemNoticeIconProps) => {
	const player = usePlayer();
	const tooltipId = useId();
	const spec = player.getSpec();

	const notices = useMemo(() => {
		const itemNotice = ITEM_NOTICES.get(itemId);
		const own = itemNotice?.[spec] || itemNotice?.[Spec.SpecUnknown];
		return [...(own ? [own] : []), ...(additionalNotice ? [additionalNotice] : [])];
	}, [itemId, spec, additionalNotice]);

	if (!notices.length) return null;

	return (
		<div className="item-notice d-inline">
			<button type="button" className="warning fa fa-exclamation-triangle fa-xl me-2" {...tooltipAnchorProps(tooltipId)} />
			<Tooltip id={tooltipId} content={<NoticeContent notices={notices} />} clickable />
		</div>
	);
};
