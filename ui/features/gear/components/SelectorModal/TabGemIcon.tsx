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
		<span className="gem-socket-container relative size-(--gem-width) shrink-0 not-last:mr-px" style={{ '--gem-width': '2rem' } as CSSProperties}>
			{gem && (
				<img
					className="gem-icon absolute inline-block size-[calc(4*var(--gem-width)/5)] inset-[calc(var(--gem-width)/10)] rounded-full z-1 bg-no-repeat bg-cover bg-center cursor-pointer"
					src={iconUrl || undefined}
					alt=""
				/>
			)}
			<img className="socket-icon absolute inline-block size-full inset-0 bg-no-repeat bg-cover bg-center cursor-pointer" src={emptyIconUrl} alt="" />

		</span>
	);
};
