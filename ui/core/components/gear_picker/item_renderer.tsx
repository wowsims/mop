import { ref } from 'tsx-vanilla';

import i18n from '../../../i18n/config';
import { translateProtoStatName, translateSlotName, translateStat } from '../../../i18n/localization';
import { MISSING_RANDOM_SUFFIX_WARNING } from '../../constants/item_notices';
import { setItemQualityCssClass } from '../../css_utils';
import { Player } from '../../player';
import { ItemLevelState, ItemSlot } from '../../proto/common';
import { UIEnchant as Enchant } from '../../proto/ui';
import { ActionId } from '../../proto_utils/action_id';
import { getEnchantDescription } from '../../proto_utils/enchants';
import { EquippedItem } from '../../proto_utils/equipped_item';
import { Disposable } from '../../typed_event';
import { Component } from '../component';
import { ItemNotice } from '../item_notice/item_notice';
import { createItemSockets, createNameDescriptionLabel, getEmptySlotIconUrl } from './utils';

export type ItemRendererConfig = {
	/** Slot this cell belongs to. Drives the empty-state icon and the empty-state name. */
	slot: ItemSlot;
	/** Root class, for consumers whose SCSS keys off something other than the gear picker's. */
	rootCssClass?: string;
};

/**
 * Renders one equipped item: icon, item level, name, enchant, tinker, reforge and gem sockets.
 *
 * Consumers attach their own listeners and popovers to the exposed elements. The cell is built
 * from one protected method per concern -- icon, item level, labels, sockets -- each paired with
 * the reset that clears it, so a variant subclasses and overrides the one piece it needs instead
 * of reimplementing the whole cell.
 */
export class ItemRenderer extends Component {
	readonly iconElem: HTMLAnchorElement;
	readonly nameElem: HTMLAnchorElement;
	readonly enchantElem: HTMLAnchorElement;
	readonly tinkerElem: HTMLAnchorElement;
	readonly reforgeElem: HTMLAnchorElement;
	socketsElem: HTMLAnchorElement[] = [];

	protected readonly player: Player<any>;
	protected readonly slot: ItemSlot;

	private readonly nameContainerElem: HTMLDivElement;
	private readonly ilvlElem: HTMLSpanElement;
	private readonly socketsContainerElem: HTMLElement;
	private notice: ItemNotice | null = null;
	private professionSubscription: Disposable | null = null;

	// Guards the async icon, enchant and tooltip lookups so a slow response for a previous item
	// cannot land on top of the current one.
	private abortController?: AbortController;
	protected signal?: AbortSignal;

	constructor(parent: HTMLElement, root: HTMLElement, player: Player<any>, config: ItemRendererConfig) {
		super(parent, config.rootCssClass ?? 'item-picker-root', root);
		this.player = player;
		this.slot = config.slot;

		const iconElem = ref<HTMLAnchorElement>();
		const nameContainerElem = ref<HTMLDivElement>();
		const nameElem = ref<HTMLAnchorElement>();
		const ilvlElem = ref<HTMLSpanElement>();
		const enchantElem = ref<HTMLAnchorElement>();
		const tinkerElem = ref<HTMLAnchorElement>();
		const reforgeElem = ref<HTMLAnchorElement>();
		const socketsContainerElem = ref<HTMLDivElement>();

		this.rootElem.appendChild(
			<>
				<div className="item-picker-icon-wrapper">
					<span className="item-picker-ilvl" ref={ilvlElem} />
					<a ref={iconElem} className="item-picker-icon" href="javascript:void(0)" attributes={{ role: 'button' }} />
					<div ref={socketsContainerElem} className="item-picker-sockets-container"></div>
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
		this.ilvlElem = ilvlElem.value!;
		this.socketsContainerElem = socketsContainerElem.value!;
		this.nameContainerElem = nameContainerElem.value!;
		this.nameElem = nameElem.value!;
		this.enchantElem = enchantElem.value!;
		this.tinkerElem = tinkerElem.value!;
		this.reforgeElem = reforgeElem.value!;
	}

	/** Renders the given item, or the empty state when there is none. */
	render(newItem: EquippedItem | null) {
		this.reset();
		if (newItem) this.apply(newItem);
	}

	/**
	 * Returns the cell to its empty state.
	 *
	 * This is a separate phase on purpose: apply() only ever sets what the new item has, so
	 * clearing what the previous one left behind has to happen here.
	 */
	protected reset() {
		this.abortController?.abort();
		this.professionSubscription?.dispose();
		this.professionSubscription = null;
		this.notice?.dispose();
		this.notice = null;

		this.resetIcon();
		this.ilvlElem.replaceChildren();
		this.resetSockets();
		this.resetLabels();
	}

	protected apply(newItem: EquippedItem) {
		this.abortController = new AbortController();
		this.signal = this.abortController.signal;

		this.renderIcon(newItem);
		this.renderIlvl(newItem);
		this.renderLabels(newItem);
		this.renderSockets(newItem);
	}

	protected resetIcon() {
		this.iconElem.removeAttribute('data-wowhead');
		this.iconElem.removeAttribute('href');
		this.iconElem.style.backgroundImage = `url('${getEmptySlotIconUrl(this.slot)}')`;
	}

	protected renderIcon(newItem: EquippedItem) {
		this.player.setWowheadData(newItem, [this.iconElem, this.nameElem]);

		newItem
			.asActionId()
			.fill(undefined, { signal: this.signal })
			.then(filledId => {
				if (this.signal?.aborted) return;
				filledId.setBackgroundAndHref(this.iconElem);
				filledId.setWowheadHref(this.nameElem);
			});
	}

	protected renderIlvl(newItem: EquippedItem) {
		this.ilvlElem.replaceChildren(
			<>
				{newItem.ilvl.toString()}
				{!!(newItem.upgrade !== ItemLevelState.ChallengeMode && newItem.ilvlFromBase) && (
					<span className="item-quality-uncommon">+{newItem.ilvlFromBase}</span>
				)}
			</>,
		);
	}

	protected resetSockets() {
		this.socketsContainerElem.replaceChildren();
		this.socketsElem = [];
	}

	protected renderSockets(newItem: EquippedItem) {
		const sockets = createItemSockets(this.player, newItem);
		this.professionSubscription = sockets.professionSubscription;
		this.socketsElem = sockets.elems;
		this.socketsContainerElem.replaceChildren(...sockets.elems);
	}

	protected resetLabels() {
		for (const elem of [this.nameElem, this.enchantElem, this.tinkerElem]) {
			elem.removeAttribute('data-wowhead');
			elem.removeAttribute('href');
		}
		this.enchantElem.replaceChildren();
		this.tinkerElem.replaceChildren();
		this.reforgeElem.replaceChildren();
		this.enchantElem.classList.add('hide');
		this.tinkerElem.classList.add('hide');
		this.reforgeElem.classList.add('hide');

		this.nameElem.textContent = translateSlotName(this.slot);
		setItemQualityCssClass(this.nameElem, null);
	}

	protected renderLabels(newItem: EquippedItem) {
		this.renderName(newItem);
		if (newItem.enchant) this.renderEnchantLabel(this.enchantElem, newItem.enchant);
		if (newItem.tinker) this.renderEnchantLabel(this.tinkerElem, newItem.tinker);
		this.renderReforge(newItem);
	}

	protected renderName(newItem: EquippedItem) {
		const nameSpan = <span className="item-picker-name">{newItem.item.name}</span>;
		const isEligibleForRandomSuffix = !!newItem.hasRandomSuffixOptions();
		const hasRandomSuffix = !!newItem.randomSuffix;

		this.nameElem.replaceChildren(nameSpan);
		if (hasRandomSuffix) {
			nameSpan.textContent += ' ' + translateProtoStatName(newItem.randomSuffix.name);
		}
		if (newItem.item.nameDescription) {
			this.nameElem.appendChild(createNameDescriptionLabel(newItem.item.nameDescription));
		}
		setItemQualityCssClass(this.nameElem, newItem.item.quality);

		this.notice = new ItemNotice(this.player, {
			itemId: newItem.item.id,
			additionalNoticeData: isEligibleForRandomSuffix && !hasRandomSuffix ? MISSING_RANDOM_SUFFIX_WARNING : undefined,
		});
		if (this.notice.hasNotice) {
			this.nameContainerElem.appendChild(this.notice.rootElem);
		}
	}

	protected renderReforge(newItem: EquippedItem) {
		const reforgeData = newItem.getReforgeData();
		if (!reforgeData) return;

		this.reforgeElem.innerText = i18n.t('gear_tab.gear_picker.reforge_text', {
			fromAmount: Math.abs(reforgeData.fromAmount),
			fromStat: translateStat(reforgeData.reforge?.fromStat),
			toAmount: reforgeData.toAmount,
			toStat: translateStat(reforgeData.reforge?.toStat),
		});
		this.reforgeElem.classList.remove('hide');
	}

	protected renderEnchantLabel(elem: HTMLAnchorElement, enchant: Enchant) {
		getEnchantDescription(enchant).then(description => {
			if (this.signal?.aborted) return;
			elem.textContent = description;
		});

		// Make the label hover have a tooltip.
		const [url, tooltipData] = enchant.spellId
			? [ActionId.makeSpellUrl(enchant.spellId), ActionId.makeSpellTooltipData(enchant.spellId)]
			: [ActionId.makeItemUrl(enchant.itemId), ActionId.makeItemTooltipData(enchant.itemId)];

		elem.href = url;
		tooltipData.then(dataset => {
			if (this.signal?.aborted) return;
			elem.dataset.wowhead = dataset;
		});
		elem.dataset.whtticon = 'false';
		elem.classList.remove('hide');
	}
}
