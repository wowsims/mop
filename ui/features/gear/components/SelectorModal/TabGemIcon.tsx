import type { GemColor } from '@generated/proto/common';
import type { UIGem as Gem } from '@generated/proto/ui';
import { ActionId } from '@sim/proto/action_id';
import { getEmptyGemSocketIconUrl } from '@sim/proto/gems';
import { useActionId } from '@ui-kit/hooks/useActionId';
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
		<span className="gem-socket-container">
			{gem && <img className="gem-icon" src={iconUrl || undefined} alt="" />}
			<img className="socket-icon" src={emptyIconUrl} alt="" />
		</span>
	);
};
