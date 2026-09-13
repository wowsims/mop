import { ItemSpec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { canEquipItem } from '@sim/proto/items';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { NumberPicker } from '@ui-kit/NumberPicker';
import type { NumberPickerConfig } from '@ui-kit/NumberPicker/types';
import { SearchBar } from '@ui-kit/SearchBar';
import { useEffect, useMemo, useRef, useState } from 'react';

import { addBulkItem } from '../../model/items';
import { type BulkSearchResult, byIlvlDescending, MAX_SEARCH_RESULTS, searchBulkItems } from '../../model/search';
import { BulkItemSearchRow } from './BulkItemSearchRow';

export interface BulkItemSearchProps {
	ready: boolean;
}

export const BulkItemSearch = ({ ready }: BulkItemSearchProps) => {
	const player = usePlayer();

	const [query, setQuery] = useState('');
	const [minIlvl, setMinIlvl] = useState(0);
	const [maxIlvl, setMaxIlvl] = useState(0);
	// The configs are built once and read the current filter through a ref, so a picker's
	// `getValue` cannot close over a stale render.
	const filters = useRef({ minIlvl: 0, maxIlvl: 0 });

	const allItems = useMemo(
		() =>
			ready
				? player.sim.db
						.getAllItems()
						.filter(item => canEquipItem(item, player.getPlayerSpec(), undefined))
						.sort(byIlvlDescending)
				: [],
		[ready, player],
	);

	const open = query.length > 0;
	const matches = useMemo(() => (open ? searchBulkItems(allItems, query, minIlvl, maxIlvl) : null), [open, allItems, query, minIlvl, maxIlvl]);
	// Clearing the box hides the list without emptying it.
	const [shown, setShown] = useState<BulkSearchResult | null>(null);
	useEffect(() => {
		if (matches) setShown(matches);
	}, [matches]);

	const ilvlConfigs = useMemo(() => {
		const make = (id: string, label: string, key: 'minIlvl' | 'maxIlvl', commit: (value: number) => void): NumberPickerConfig<Player<any>> => ({
			id,
			label,
			showZeroes: false,
			getValue: () => filters.current[key],
			setValue: (_modObj, newValue: number) => {
				filters.current[key] = newValue;
				commit(newValue);
			},
		});
		return {
			min: make('bulkGearSearchMinIlvl', i18n.t('bulk_tab.search.min_ilvl'), 'minIlvl', setMinIlvl),
			max: make('bulkGearSearchMaxIlvl', i18n.t('bulk_tab.search.max_ilvl'), 'maxIlvl', setMaxIlvl),
		};
	}, []);

	return (
		<ContentBlock className="bulk-item-search-root" config={{ header: { title: i18n.t('bulk_tab.search.title'), className: 'pb-0 border-b-0' } }} flush>
			<div className="bulk-gear-search-container relative grid gap-6 p-4 border border-border bg-background grid-cols-2 md:grid-cols-[1fr_1fr_2fr]">
				<SearchBar
					id="bulkGearSearch"
					className="max-w-[25%]"
					label={i18n.t('common.name')}
					placeholder={i18n.t('common.search')}
					value={query}
					onChange={setQuery}
					clearable
					clearLabel={i18n.t('bulk_tab.search.clear_search')}
					clearClassName="cancel-bulk-gear-search-btn z-2 -ml-px py-1.5 px-3 flex items-center bg-surface border border-surface-border">
					<ul
						className="bulk-gear-search-results absolute hidden data-open:grid gap-2 top-full left-4 right-4 w-full p-2 z-10 m-0 text-base text-white text-left list-none bg-surface-raised bg-clip-padding border border-surface-border rounded-md shadow-[0_0.5rem_1rem_rgba(0,0,0,0.15)] grid-cols-1 md:grid-cols-2 xxl:grid-cols-3"
						data-open={open ? '' : undefined}>
						{shown?.items.map(item => (
							<BulkItemSearchRow key={item.id} item={item} onAdd={() => addBulkItem(player, ItemSpec.create({ id: item.id }))} />
						))}
						{!!shown && shown.matchCount > MAX_SEARCH_RESULTS && (
							<li className="ui-bulk-item-search-item bulk-item-search-results-note border-none col-span-full justify-center">
								{i18n.t('bulk_tab.search.showing_results', { max: MAX_SEARCH_RESULTS, total: shown.matchCount })}
							</li>
						)}
						{shown?.matchCount === 0 && (
							<li className="ui-bulk-item-search-item bulk-item-search-results-note border-none col-span-full justify-center">
								{i18n.t('bulk_tab.search.no_results')}
							</li>
						)}
					</ul>
				</SearchBar>
				<div className="bulk-gear-search-ilvl-filters flex items-center [&_.number-picker-root]:mb-0">
					<NumberPicker modObject={player} config={ilvlConfigs.min} />
					<span className="ilvl-filters-separator mx-3 mt-3">-</span>
					<NumberPicker modObject={player} config={ilvlConfigs.max} />
				</div>
			</div>
		</ContentBlock>
	);
};
