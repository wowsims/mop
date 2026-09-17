import type { GemColor } from '@generated/proto/common';
import type { UIGem as Gem } from '@generated/proto/ui';
import { ActionId } from '@sim/proto/action_id';
import { getEmptyGemSocketIconUrl } from '@sim/proto/gems';
import { useActionId } from '@ui-kit/hooks/useActionId';
import clsx from 'clsx';

import { ItemCellAnchor, type ItemCellAnchorProps } from './ItemCellAnchor';

export interface GemSocketProps extends Omit<ItemCellAnchorProps, 'href' | 'children'> {
	socketColor: GemColor;
	gem: Gem | null;
	hidden?: boolean;
}

export const GemSocket = ({ socketColor, gem, hidden, className, ...rest }: GemSocketProps) => {
	const actionId = gem ? ActionId.fromItemId(gem.id) : undefined;
	const { iconUrl, href } = useActionId(actionId);
	const emptyIconUrl = getEmptyGemSocketIconUrl(socketColor);

	if (hidden) return null;

	return (
		<ItemCellAnchor
			{...rest}
			className={clsx('ui-gem-socket ui-gem-socket-focus-scope relative size-(--gem-width) shrink-0 not-last:mr-px', className)}
			data-testid="gem-socket-container"
			href={href}>
			{gem && (
				<img
					className="absolute inset-gem z-1 inline-block size-gem-inner cursor-pointer rounded-full bg-cover bg-center bg-no-repeat"
					data-testid="gem-icon"
					src={iconUrl || undefined}
					alt=""
				/>
			)}
			<img
				className="absolute inset-0 inline-block size-full cursor-pointer bg-cover bg-center bg-no-repeat"
				data-testid="socket-icon"
				src={emptyIconUrl}
				alt=""
			/>
		</ItemCellAnchor>
	);
};
