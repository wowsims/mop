import { ActionId } from '@sim/proto/action_id';
import { getEmptyGemSocketIconUrl } from '@sim/proto/gems';
import type { GemColor } from '@generated/proto/common';
import type { UIGem as Gem } from '@generated/proto/ui';
import { useActionId } from '@ui-kit/hooks/useActionId';
import clsx from 'clsx';
import { useMemo } from 'react';

import { ItemCellAnchor, type ItemCellAnchorProps } from './ItemCellAnchor';

export interface GemSocketProps extends Omit<ItemCellAnchorProps, 'href' | 'children'> {
	socketColor: GemColor;
	gem: Gem | null;
	hidden?: boolean;
}

export const GemSocket = ({ socketColor, gem, hidden, className, ...rest }: GemSocketProps) => {
	const actionId = useMemo(() => (gem ? ActionId.fromItemId(gem.id) : undefined), [gem]);
	const { iconUrl, href } = useActionId(actionId);
	const emptyIconUrl = getEmptyGemSocketIconUrl(socketColor);

	return (
		<ItemCellAnchor {...rest} className={clsx('gem-socket-container', hidden && 'hide', className)} href={href}>
			<img className={clsx('gem-icon', !gem && 'hide')} src={gem ? iconUrl || undefined : emptyIconUrl} alt="" />
			<img className="socket-icon" src={emptyIconUrl} alt="" />
		</ItemCellAnchor>
	);
};
