import type { Player } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import { setActionIdWowheadHref } from '@domain/proto_utils/action_id/dom';
import type { EquippedItem } from '@domain/proto_utils/equipped_item';
import { getEmptyGemSocketIconUrl } from '@domain/proto_utils/gems';
import { subscribeAll, subscribePlayerField } from '@domain/state/subscriptions';
import { GemColor, ItemSlot } from '@generated/proto/common';
import { UIGem as Gem } from '@generated/proto/ui';

const emptySlotIcons: Record<ItemSlot, string> = {
	[ItemSlot.ItemSlotHead]: '/mop/assets/item_slots/head.jpg',
	[ItemSlot.ItemSlotNeck]: '/mop/assets/item_slots/neck.jpg',
	[ItemSlot.ItemSlotShoulder]: '/mop/assets/item_slots/shoulders.jpg',
	[ItemSlot.ItemSlotBack]: '/mop/assets/item_slots/chest.jpg',
	[ItemSlot.ItemSlotChest]: '/mop/assets/item_slots/chest.jpg',
	[ItemSlot.ItemSlotWrist]: '/mop/assets/item_slots/wrists.jpg',
	[ItemSlot.ItemSlotHands]: '/mop/assets/item_slots/hands.jpg',
	[ItemSlot.ItemSlotWaist]: '/mop/assets/item_slots/waist.jpg',
	[ItemSlot.ItemSlotLegs]: '/mop/assets/item_slots/legs.jpg',
	[ItemSlot.ItemSlotFeet]: '/mop/assets/item_slots/feet.jpg',
	[ItemSlot.ItemSlotFinger1]: '/mop/assets/item_slots/finger.jpg',
	[ItemSlot.ItemSlotFinger2]: '/mop/assets/item_slots/finger.jpg',
	[ItemSlot.ItemSlotTrinket1]: '/mop/assets/item_slots/trinket.jpg',
	[ItemSlot.ItemSlotTrinket2]: '/mop/assets/item_slots/trinket.jpg',
	[ItemSlot.ItemSlotMainHand]: '/mop/assets/item_slots/mainhand.jpg',
	[ItemSlot.ItemSlotOffHand]: '/mop/assets/item_slots/offhand.jpg',
};
export function getEmptySlotIconUrl(slot: ItemSlot): string {
	return emptySlotIcons[slot];
}

export const createNameDescriptionLabel = (nameDesc: string) => {
	return <small className="heroic-label">({nameDesc})</small>;
};

// Points the gem icon inside a container built by createGemContainer at `gem`, or hides it when
// the socket is empty. Resolves with the filled ActionId so callers can wire up extra state.
export const setGemInContainer = async (container: HTMLElement, gem: Gem | null, emptySocketIconUrl: string): Promise<ActionId | null> => {
	const gemIconElem = container.querySelector<HTMLImageElement>('.gem-icon')!;
	if (!gem) {
		gemIconElem.classList.add('hide');
		gemIconElem.src = emptySocketIconUrl;
		return null;
	}

	gemIconElem.classList.remove('hide');
	const filledId = await ActionId.fromItemId(gem.id).fill();
	gemIconElem.src = filledId.iconUrl;
	return filledId;
};

export const createGemContainer = (socketColor: GemColor, gem: Gem | null, index: number) => {
	const gemContainer = (
		<a className="gem-socket-container" href="javascript:void(0)" dataset={{ socketIdx: index }}>
			<img className="gem-icon hide" />
			<img className="socket-icon" src={getEmptyGemSocketIconUrl(socketColor)} />
		</a>
	) as HTMLAnchorElement;

	setGemInContainer(gemContainer, gem, getEmptyGemSocketIconUrl(socketColor)).then(filledId => filledId && setActionIdWowheadHref(filledId, gemContainer));
	return gemContainer;
};

// Builds the gem sockets for an item, including the extra socket that Blacksmithing grants.
// The profession subscription is handed back rather than swallowed: the caller owns it and must
// dispose it before the next render, otherwise listeners pile up on every gear change.
export const createItemSockets = (player: Player<any>, item: EquippedItem): { elems: HTMLAnchorElement[]; professionSubscription: (() => void) | null } => {
	let professionSubscription: (() => void) | null = null;

	const elems = item.allSocketColors().map((socketColor, gemIdx) => {
		const gemContainer = createGemContainer(socketColor, item.gems[gemIdx], gemIdx);
		if (gemIdx === item.numPossibleSockets - 1 && item.couldHaveExtraSocket()) {
			const updateProfession = () => {
				gemContainer.classList[player.isBlacksmithing() ? 'remove' : 'add']('hide');
			};
			professionSubscription = subscribeAll([subscribePlayerField(player, 'profession1'), subscribePlayerField(player, 'profession2')])(updateProfession);
			updateProfession();
		}
		return gemContainer;
	});

	return { elems, professionSubscription };
};
