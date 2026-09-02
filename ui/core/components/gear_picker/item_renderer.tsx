import { ref } from 'tsx-vanilla';

import i18n from '../../../i18n/config';
import { translateProtoStatName, translateSlotName, translateStat } from '../../../i18n/localization';
import { MISSING_RANDOM_SUFFIX_WARNING } from '../../constants/item_notices';
import { setItemQualityCssClass } from '../../css_utils';
import { Player } from '../../player';
import { ItemLevelState, ItemSlot } from '../../proto/common';
import { ActionId } from '../../proto_utils/action_id';
import { getEnchantDescription } from '../../proto_utils/enchants';
import { EquippedItem } from '../../proto_utils/equipped_item';
import { Disposable } from '../../typed_event';
import { Component } from '../component';
import { ItemNotice } from '../item_notice/item_notice';
import { createItemSockets, createNameDescriptionLabel, getEmptySlotIconUrl } from './utils';

// Renders one equipped item: icon, item level, name, enchant, tinker, reforge and gem sockets.
// Consumers attach their own listeners and popovers to the exposed elements.
export class ItemRenderer extends Component {
	readonly iconElem: HTMLAnchorElement;
	readonly nameElem: HTMLAnchorElement;
	readonly enchantElem: HTMLAnchorElement;
	readonly tinkerElem: HTMLAnchorElement;
	readonly reforgeElem: HTMLAnchorElement;
	socketsElem: HTMLAnchorElement[] = [];

	private readonly player: Player<any>;
	private readonly slot: ItemSlot;
	private readonly nameContainerElem: HTMLDivElement;
	private readonly ilvlElem: HTMLSpanElement;
	private readonly socketsContainerElem: HTMLElement;
	private notice: ItemNotice | null = null;
	private professionSubscription: Disposable | null = null;

	// Guards the async icon/enchant lookups so a slow response for a previous item cannot land
	// on top of the current one.
	// https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#add_an_abortable_listener
	private abortController?: AbortController;
	private signal?: AbortSignal;

	constructor(parent: HTMLElement, root: HTMLElement, player: Player<any>, slot: ItemSlot) {
		super(parent, 'item-picker-root', root);
		this.player = player;
		this.slot = slot;

		const iconElem = ref<HTMLAnchorElement>();
		const nameContainerElem = ref<HTMLDivElement>();
		const nameElem = ref<HTMLAnchorElement>();
		const ilvlElem = ref<HTMLSpanElement>();
		const enchantElem = ref<HTMLAnchorElement>();
		const tinkerElem = ref<HTMLAnchorElement>();
		const reforgeElem = ref<HTMLAnchorElement>();
		const sce = ref<HTMLDivElement>();

		this.rootElem.appendChild(
			<>
				<div className="item-picker-icon-wrapper">
					<span className="item-picker-ilvl" ref={ilvlElem} />
					<a ref={iconElem} className="item-picker-icon" href="javascript:void(0)" attributes={{ role: 'button' }} />
					<div ref={sce} className="item-picker-sockets-container"></div>
				</div>
				<div className="item-picker-labels-container">
					<div ref={nameContainerElem} className="item-picker-name-row d-flex gap-1">
						<a ref={nameElem} className="item-picker-name-container" href="javascript:void(0)" attributes={{ role: 'button' }} />
					</div>
					<a ref={enchantElem} className="item-picker-enchant hide" href="javascript:void(0)" attributes={{ role: 'button' }} />
					<a ref={tinkerElem} className="item-picker-tinker hide" href="javascript:void(0)" attributes={{ role: 'button' }} />
					<a ref={reforgeElem} className="item-picker-reforge hide" href="javascript:void(0)" attributes={{ role: 'button' }} />
				</div>
			</>,
		);

		this.iconElem = iconElem.value!;
		this.nameContainerElem = nameContainerElem.value!;
		this.nameElem = nameElem.value!;
		this.ilvlElem = ilvlElem.value!;
		this.reforgeElem = reforgeElem.value!;
		this.enchantElem = enchantElem.value!;
		this.tinkerElem = tinkerElem.value!;
		this.socketsContainerElem = sce.value!;
	}

	// Renders the given item, or the empty state when there is none.
	render(newItem: EquippedItem | null) {
		this.reset();
		if (newItem) this.apply(newItem);
	}

	private reset() {
		this.abortController?.abort();
		this.professionSubscription?.dispose();
		this.professionSubscription = null;
		this.notice?.dispose();
		this.notice = null;

		this.nameElem.removeAttribute('data-wowhead');
		this.nameElem.removeAttribute('href');
		this.iconElem.removeAttribute('data-wowhead');
		this.iconElem.removeAttribute('href');
		this.enchantElem.removeAttribute('data-wowhead');
		this.enchantElem.removeAttribute('href');
		this.tinkerElem.removeAttribute('data-wowhead');
		this.tinkerElem.removeAttribute('href');
		this.enchantElem.classList.add('hide');
		this.tinkerElem.classList.add('hide');
		this.reforgeElem.classList.add('hide');

		this.iconElem.style.backgroundImage = `url('${getEmptySlotIconUrl(this.slot)}')`;

		this.enchantElem.replaceChildren();
		this.tinkerElem.replaceChildren();
		this.reforgeElem.replaceChildren();
		this.socketsContainerElem.replaceChildren();
		this.ilvlElem.replaceChildren();

		this.nameElem.textContent = translateSlotName(this.slot);
		setItemQualityCssClass(this.nameElem, null);

		this.socketsElem = [];
	}

	private apply(newItem: EquippedItem) {
		this.abortController = new AbortController();
		this.signal = this.abortController.signal;

		const nameSpan = <span className="item-picker-name">{newItem.item.name}</span>;
		const isEligibleForRandomSuffix = !!newItem.hasRandomSuffixOptions();
		const hasRandomSuffix = !!newItem.randomSuffix;
		this.nameElem.replaceChildren(nameSpan);
		this.ilvlElem.replaceChildren(
			<>
				{newItem.ilvl.toString()}
				{!!(newItem.upgrade !== ItemLevelState.ChallengeMode && newItem.ilvlFromBase) && (
					<span className="item-quality-uncommon">+{newItem.ilvlFromBase}</span>
				)}
			</>,
		);

		if (hasRandomSuffix) {
			nameSpan.textContent += ' ' + translateProtoStatName(newItem.randomSuffix.name);
		}

		if (newItem.item.nameDescription) {
			this.nameElem.appendChild(createNameDescriptionLabel(newItem.item.nameDescription));
		}

		this.notice = new ItemNotice(this.player, {
			itemId: newItem.item.id,
			additionalNoticeData: isEligibleForRandomSuffix && !hasRandomSuffix ? MISSING_RANDOM_SUFFIX_WARNING : undefined,
		});

		if (this.notice.hasNotice) {
			this.nameContainerElem.appendChild(this.notice.rootElem);
		}

		const reforgeData = newItem.getReforgeData();
		if (reforgeData) {
			const fromText = translateStat(reforgeData.reforge?.fromStat);
			const toText = translateStat(reforgeData.reforge?.toStat);
			this.reforgeElem.innerText = i18n.t('gear_tab.gear_picker.reforge_text', {
				fromAmount: Math.abs(reforgeData.fromAmount),
				fromStat: fromText,
				toAmount: reforgeData.toAmount,
				toStat: toText,
			});
			this.reforgeElem.classList.remove('hide');
		}

		setItemQualityCssClass(this.nameElem, newItem.item.quality);

		this.player.setWowheadData(newItem, [this.iconElem, this.nameElem]);

		newItem
			.asActionId()
			.fill(undefined, { signal: this.signal })
			.then(filledId => {
				if (this.signal?.aborted) return;
				filledId.setBackgroundAndHref(this.iconElem);
				filledId.setWowheadHref(this.nameElem);
			});

		if (newItem.enchant) this.applyEnchantLabel(this.enchantElem, newItem.enchant);
		if (newItem.tinker) this.applyEnchantLabel(this.tinkerElem, newItem.tinker);

		const sockets = createItemSockets(this.player, newItem);
		this.professionSubscription = sockets.professionSubscription;
		this.socketsElem = sockets.elems;
		this.socketsContainerElem.replaceChildren(...sockets.elems);
	}

	private applyEnchantLabel(elem: HTMLAnchorElement, enchant: EquippedItem['enchant'] & {}) {
		getEnchantDescription(enchant).then(description => {
			if (this.signal?.aborted) return;
			elem.textContent = description;
		});

		// Make the label hover have a tooltip.
		if (enchant.spellId) {
			elem.href = ActionId.makeSpellUrl(enchant.spellId);
			ActionId.makeSpellTooltipData(enchant.spellId).then(url => {
				if (this.signal?.aborted) return;
				elem.dataset.wowhead = url;
			});
		} else {
			elem.href = ActionId.makeItemUrl(enchant.itemId);
			ActionId.makeItemTooltipData(enchant.itemId).then(url => {
				if (this.signal?.aborted) return;
				elem.dataset.wowhead = url;
			});
		}
		elem.dataset.whtticon = 'false';
		elem.classList.remove('hide');
	}
}
