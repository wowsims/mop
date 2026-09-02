import { Glyphs, ItemQuality } from '@core/proto/common';
import { Player } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import { Database } from '@domain/proto_utils/database';
import { EventID, nextEventID } from '@domain/state/batch';
import { subscribePlayerField } from '@domain/state/subscriptions';
import type { GlyphsConfig } from '@domain/talents/config';
import { stringComparator } from '@domain/utils';
import i18n from '@i18n/config';
import { getClassI18nKey } from '@i18n/entity_mapping';
import { BaseModal } from '@ui-kit/base_modal';
import { Component } from '@ui-kit/component';
import { ContentBlock } from '@ui-kit/content_block';
import { setItemQualityCssClass } from '@ui-kit/css_utils';
import { Input } from '@ui-kit/input';
import { ref } from 'tsx-vanilla';
interface GlyphData {
	id: number;
	name: string;
	description: string;
	iconUrl: string;
	quality: ItemQuality | null;
	spellId: number;
}

const emptyGlyphData: GlyphData = {
	id: 0,
	name: i18n.t('talents_tab.glyphs.empty'),
	description: '',
	iconUrl: 'https://wow.zamimg.com/images/wow/icons/medium/inventoryslot_empty.jpg',
	quality: null,
	spellId: 0,
};

export class GlyphsPicker extends Component {
	private readonly glyphsConfig: GlyphsConfig;
	readonly selectorModal: GlyphSelectorModal;
	readonly player: Player<any>;
	majorGlyphPickers: Array<GlyphPicker> = [];
	minorGlyphPickers: Array<GlyphPicker> = [];

	constructor(parent: HTMLElement, player: Player<any>, glyphsConfig: GlyphsConfig) {
		super(parent, 'glyphs-picker-root');
		this.glyphsConfig = glyphsConfig;
		this.player = player;

		const majorGlyphs = Object.keys(glyphsConfig.majorGlyphs).map(idStr => Number(idStr));
		const minorGlyphs = Object.keys(glyphsConfig.minorGlyphs).map(idStr => Number(idStr));

		const majorGlyphsBlock = new ContentBlock(this.rootElem, 'major-glyphs', {
			header: { title: i18n.t('talents_tab.glyphs.major'), extraCssClasses: ['border-0'] },
		});

		const minorGlyphsBlock = new ContentBlock(this.rootElem, 'minor-glyphs', {
			header: { title: i18n.t('talents_tab.glyphs.minor'), extraCssClasses: ['border-0'] },
		});
		this.selectorModal = new GlyphSelectorModal(this.rootElem.closest('.individual-sim-ui')!);

		Database.get().then(db => {
			const majorGlyphsData = majorGlyphs.map(glyph => this.getGlyphData(glyph, db));
			const minorGlyphsData = minorGlyphs.map(glyph => this.getGlyphData(glyph, db));

			majorGlyphsData.sort((a, b) => stringComparator(a.name, b.name));
			minorGlyphsData.sort((a, b) => stringComparator(a.name, b.name));

			this.majorGlyphPickers = (['major1', 'major2', 'major3'] as Array<keyof Glyphs>).map(
				glyphField =>
					new GlyphPicker(majorGlyphsBlock.bodyElement, {
						label: 'Major',
						player,
						selectorModal: this.selectorModal,
						glyphOptions: majorGlyphsData,
						glyphField,
					}),
			);

			this.minorGlyphPickers = (['minor1', 'minor2', 'minor3'] as Array<keyof Glyphs>).map(
				glyphField =>
					new GlyphPicker(minorGlyphsBlock.bodyElement, {
						label: 'Minor',
						player,
						selectorModal: this.selectorModal,
						glyphOptions: minorGlyphsData,
						glyphField,
					}),
			);
		});
	}

	// In case we ever want to parse description from tooltip HTML.
	//static descriptionRegex = /<a href=\\"\/wotlk.*>(.*)<\/a>/g;
	getGlyphData(glyph: number, db: Database): GlyphData {
		const glyphType = this.glyphsConfig.majorGlyphs[glyph] ? 'major' : 'minor';
		const glyphConfig = glyphType === 'major' ? this.glyphsConfig.majorGlyphs[glyph] : this.glyphsConfig.minorGlyphs[glyph];
		const translationKey = `${getClassI18nKey(this.player.getClass())}.${glyphType}.${glyphConfig.name
			.toLowerCase()
			.replace(/[':]/g, '')
			.replace(/[\s-]+/g, '_')}`;

		return {
			id: glyph,
			name: i18n.t(`${translationKey}.name`, { ns: 'glyphs' }),
			description: i18n.t(`${translationKey}.description`, { ns: 'glyphs' }),
			iconUrl: glyphConfig.iconUrl,
			quality: ItemQuality.ItemQualityCommon,
			spellId: db.glyphItemToSpellId(glyph),
		};
	}
}

type GlyphPickerConfig = {
	label: string;
	player: Player<any>;
	glyphOptions: GlyphData[];
	glyphField: keyof Glyphs;
	selectorModal: GlyphSelectorModal;
};

class GlyphPicker extends Input<Player<any>, number> {
	readonly player: Player<any>;

	selectedGlyph: GlyphData | undefined;

	private readonly glyphOptions: GlyphData[];

	private readonly anchorElem: HTMLAnchorElement;
	private readonly iconElem: HTMLImageElement;
	private readonly nameElem: HTMLSpanElement;

	constructor(parent: HTMLElement, { player, selectorModal, glyphOptions, glyphField }: GlyphPickerConfig) {
		super(parent, 'glyph-picker-root', player, {
			id: `glyph-picker-glyph-${glyphField}`,
			inline: true,
			storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'glyphs'),
			getValue: (player: Player<any>) => player.getGlyphs()[glyphField] as number,
			setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
				const glyphs = player.getGlyphs();
				(glyphs[glyphField] as number) = newValue;
				player.setGlyphs(eventID, glyphs);
			},
		});
		this.rootElem.classList.add('item-picker-root');

		this.player = player;
		this.glyphOptions = glyphOptions;
		this.selectedGlyph = emptyGlyphData;

		const anchorElemRef = ref<HTMLAnchorElement>();
		const iconElemRef = ref<HTMLImageElement>();
		const nameElemRef = ref<HTMLSpanElement>();

		this.rootElem.appendChild(
			<a ref={anchorElemRef} attributes={{ role: 'button' }} className="glyph-link">
				<img ref={iconElemRef} className="item-picker-icon" />
				<div className="item-picker-labels-container">
					<span ref={nameElemRef} className="item-picker-name-container" />
				</div>
			</a>,
		);

		this.anchorElem = anchorElemRef.value!;
		this.iconElem = iconElemRef.value!;
		this.nameElem = nameElemRef.value!;

		this.anchorElem.addEventListener(
			'click',
			event => {
				event.preventDefault();
				selectorModal.openTab(this, glyphOptions);
			},
			{ signal: this.signal },
		);

		this.init();
	}

	getInputElem(): HTMLElement {
		return this.iconElem;
	}

	getInputValue(): number {
		return this.selectedGlyph?.id ?? 0;
	}

	setInputValue(newValue: number) {
		this.selectedGlyph = this.glyphOptions.find(glyphData => glyphData.id == newValue);

		if (this.selectedGlyph) {
			if (this.selectedGlyph.spellId) {
				this.anchorElem.href = ActionId.makeSpellUrl(this.selectedGlyph.spellId);
				ActionId.makeSpellTooltipData(this.selectedGlyph.spellId).then(url => {
					this.anchorElem.dataset.wowhead = url;
					this.anchorElem.dataset.whtticon = 'false';
				});
			} else {
				this.anchorElem.href = ActionId.makeItemUrl(this.selectedGlyph.id);
				ActionId.makeItemTooltipData(this.selectedGlyph.id).then(url => {
					this.anchorElem.dataset.wowhead = url;
					this.anchorElem.dataset.whtticon = 'false';
				});
			}

			this.iconElem.src = this.selectedGlyph.iconUrl;
			this.nameElem.textContent = this.selectedGlyph.name;
		} else {
			this.clear();
		}
	}

	private clear() {
		this.anchorElem.removeAttribute('data-wowhead');
		this.anchorElem.removeAttribute('href');

		this.iconElem.src = emptyGlyphData.iconUrl;
		this.nameElem.textContent = emptyGlyphData.name;
	}
}

class GlyphSelectorModal extends BaseModal {
	list: HTMLUListElement;
	listItems: HTMLLIElement[] = [];
	search: HTMLInputElement;
	glyphOptions: GlyphData[] = [];
	glyphPicker: GlyphPicker | null = null;
	constructor(parent: HTMLElement) {
		super(parent, 'glyph-modal', { title: i18n.t('talents_tab.glyphs.modal.title'), disposeOnClose: false });

		const list = ref<HTMLUListElement>();
		const search = ref<HTMLInputElement>();

		this.body.appendChild(
			<>
				<div className="input-root">
					<input ref={search} className="selector-modal-search form-control" type="text" placeholder={i18n.t('common.search')} />
				</div>
				<ul ref={list} className="selector-modal-list"></ul>
			</>,
		);

		this.list = list.value!;
		this.search = search.value!;

		this.search.addEventListener('input', () => this.applyFilters());
	}

	openTab(glyphPicker: GlyphPicker, glyphOptions: GlyphData[]) {
		this.setData(glyphPicker, glyphOptions);
		this.applyFilters();
		this.open();
	}

	private setData(glyphPicker: GlyphPicker, glyphOptions: GlyphData[]) {
		this.glyphPicker = glyphPicker;
		this.list.innerHTML = '';
		this.listItems = [];
		this.glyphOptions = [emptyGlyphData, ...glyphOptions];

		const listItemElems = this.glyphOptions.map((glyphData, glyphIdx) => {
			const anchorElem = ref<HTMLAnchorElement>();
			const iconElem = ref<HTMLImageElement>();
			const nameElem = ref<HTMLLabelElement>();

			const listItemElem = (
				<li
					className="selector-modal-list-item"
					dataset={{
						idx: String(glyphIdx),
					}}>
					<a ref={anchorElem} className="selector-modal-list-item-link">
						<img ref={iconElem} className="selector-modal-list-item-icon" />
						<label ref={nameElem} className="selector-modal-list-item-name">
							{glyphData.name}
						</label>
						<span className="selector-modal-list-item-description">{glyphData.description}</span>
					</a>
				</li>
			);

			if (anchorElem.value) {
				if (glyphData.spellId) {
					anchorElem.value.href = ActionId.makeSpellUrl(glyphData.spellId);
				} else {
					anchorElem.value.href = ActionId.makeItemUrl(glyphData.id);
				}
				anchorElem.value.addEventListener('click', event => {
					event.preventDefault();
					this.glyphPicker?.setValue(nextEventID(), glyphData.id);
				});
			}
			if (iconElem.value) {
				iconElem.value.src = glyphData.iconUrl;
			}
			if (nameElem.value) setItemQualityCssClass(nameElem.value, glyphData.quality);

			return listItemElem as HTMLLIElement;
		});

		this.listItems = listItemElems;
		this.list.appendChild(<>{this.listItems}</>);

		subscribePlayerField(
			this.glyphPicker.player,
			'glyphs',
		)(() => {
			this.applyFilters();
		});
	}

	applyFilters() {
		if (!this.glyphPicker) return;
		const selectedGlyphId = this.glyphPicker.selectedGlyph?.id ?? 0;

		this.listItems.forEach(elem => {
			const listItemIdx = parseInt(elem.dataset.idx!);
			const listItemData = this.glyphOptions[listItemIdx];
			elem.classList[listItemData.id == selectedGlyphId ? 'add' : 'remove']('active');
		});

		this.listItems.map(elem => {
			const listItemIdx = parseInt(elem.dataset.idx!);
			const listItemData = this.glyphOptions[listItemIdx];
			let action: 'add' | 'remove' = 'remove';

			if (this.search.value.length > 0) {
				const searchQuery = this.search.value.toLowerCase().split(' ');
				const name = listItemData.name.toLowerCase();

				searchQuery.forEach(v => {
					if (!name.includes(v) && action === 'remove') action = 'add';
				});
			}

			elem.classList[action]('d-none');
		});
	}
}
