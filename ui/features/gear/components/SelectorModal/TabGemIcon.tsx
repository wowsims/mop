import type { GemColor } from '@generated/proto/common';
import type { UIGem as Gem } from '@generated/proto/ui';
import { ActionId } from '@sim/proto/action_id';
import { getEmptyGemSocketIconUrl } from '@sim/proto/gems';
import { useActionId } from '@ui-kit/hooks/useActionId';
import type { CSSProperties } from 'react';

export interface TabGemIconProps {
	socketColor: GemColor;
	gem: Gem | null;
}

// Not `GemSocket`: this one goes inside the tab's own <button>, and `GemSocket` is an anchor.
export const TabGemIcon = ({ socketColor, gem }: TabGemIconProps) => {
	const actionId = gem ? ActionId.fromItemId(gem.id) : undefined;
	const { iconUrl } = useActionId(actionId);
	const emptyIconUrl = getEmptyGemSocketIconUrl(socketColor);

	return (
		<span
			className="relative size-(--gem-width) shrink-0 not-last:mr-px"
			data-testid="gem-socket-container"
			style={{ '--gem-width': '2rem' } as CSSProperties}>
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
		</span>
	);
};
