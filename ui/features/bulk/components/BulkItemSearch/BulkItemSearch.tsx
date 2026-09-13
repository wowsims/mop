import './BulkItemSearch.scss';

import { ItemSpec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { canEquipItem } from '@sim/proto/items';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { NumberPicker } from '@ui-kit/NumberPicker';
import type { NumberPickerConfig } from '@ui-kit/NumberPicker/types';
import { SearchBar } from '@ui-kit/SearchBar';
import clsx from 'clsx';
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
		<ContentBlock className="bulk-item-search-root" config={{ header: { title: i18n.t('bulk_tab.search.title') } }}>
			<div className="bulk-gear-search-container">
				<SearchBar
					id="bulkGearSearch"
					label={i18n.t('common.name')}
					placeholder={i18n.t('common.search')}
					value={query}
					onChange={setQuery}
					clearable
					clearLabel={i18n.t('bulk_tab.search.clear_search')}
					clearClassName="cancel-bulk-gear-search-btn">
					<ul className={clsx('bulk-gear-search-results dropdown-menu no-hover', open && 'show')}>
						{shown?.items.map(item => (
							<BulkItemSearchRow key={item.id} item={item} onAdd={() => addBulkItem(player, ItemSpec.create({ id: item.id }))} />
						))}
						{!!shown && shown.matchCount > MAX_SEARCH_RESULTS && (
							<li className="bulk-item-search-item bulk-item-search-results-note">
								{i18n.t('bulk_tab.search.showing_results', { max: MAX_SEARCH_RESULTS, total: shown.matchCount })}
							</li>
						)}
						{shown?.matchCount === 0 && (
							<li className="bulk-item-search-item bulk-item-search-results-note">{i18n.t('bulk_tab.search.no_results')}</li>
						)}
					</ul>
				</SearchBar>
				<div className="bulk-gear-search-ilvl-filters">
					<NumberPicker modObject={player} config={ilvlConfigs.min} />
					<span className="ilvl-filters-separator">-</span>
					<NumberPicker modObject={player} config={ilvlConfigs.max} />
				</div>
			</div>
		</ContentBlock>
	);
};
