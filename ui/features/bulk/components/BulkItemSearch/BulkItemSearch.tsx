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
		<ContentBlock config={{ header: { title: i18n.t('bulk_tab.search.title'), className: 'pb-0 border-b-0' } }} flush>
			<div className="relative grid grid-cols-2 gap-6 border border-border bg-background p-4 md:grid-cols-halves-wide">
				<SearchBar
					id="bulkGearSearch"
					label={i18n.t('common.name')}
					placeholder={i18n.t('common.search')}
					value={query}
					onChange={setQuery}
					clearable
					clearLabel={i18n.t('bulk_tab.search.clear_search')}
					clearClassName="z-2 -ml-px flex items-center border border-surface-border bg-surface px-3 py-1.5">
					<ul
						className="absolute top-full right-4 left-4 z-10 m-0 hidden w-full min-w-40 list-none grid-cols-1 gap-2 rounded-none border border-surface-border bg-surface-raised bg-clip-padding p-2 text-left text-base text-white shadow-[0_0.5rem_1rem_rgba(0,0,0,0.15)] data-open:grid md:grid-cols-2 xxl:grid-cols-3"
						data-testid="bulk-gear-search-results"
						data-open={open ? '' : undefined}>
						{shown?.items.map(item => (
							<BulkItemSearchRow key={item.id} item={item} onAdd={() => addBulkItem(player, ItemSpec.create({ id: item.id }))} />
						))}
						{!!shown && shown.matchCount > MAX_SEARCH_RESULTS && (
							<li className="ui-bulk-item-search-item col-span-full justify-center border-none" data-testid="bulk-item-search-results-note">
								{i18n.t('bulk_tab.search.showing_results', { max: MAX_SEARCH_RESULTS, total: shown.matchCount })}
							</li>
						)}
						{shown?.matchCount === 0 && (
							<li className="ui-bulk-item-search-item col-span-full justify-center border-none" data-testid="bulk-item-search-results-note">
								{i18n.t('bulk_tab.search.no_results')}
							</li>
						)}
					</ul>
				</SearchBar>
				<div className="flex items-center [&_.ui-number-picker-root]:mb-0">
					<NumberPicker modObject={player} config={ilvlConfigs.min} />
					<span className="mx-3 mt-3">-</span>
					<NumberPicker modObject={player} config={ilvlConfigs.max} />
				</div>
			</div>
		</ContentBlock>
	);
};
