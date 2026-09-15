import i18n from '@i18n/config';
import { Dialog } from '@ui-kit/Dialog';
import { SearchBar } from '@ui-kit/SearchBar';
import { itemQualityClassName } from '@ui-kit/utils/css';
import clsx from 'clsx';
import { useMemo, useState } from 'react';

import { emptyGlyphData, type GlyphData, glyphUrl, matchesGlyphSearch } from './utils';

export interface GlyphSelectorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	options: GlyphData[];
	selectedId: number;
	onSelect: (id: number) => void;
}

export const GlyphSelectorDialog = ({ open, onOpenChange, options, selectedId, onSelect }: GlyphSelectorDialogProps) => {
	const [search, setSearch] = useState('');
	const entries = useMemo(() => [emptyGlyphData, ...options], [options]);
	const activeId = entries.some(entry => entry.id === selectedId) ? selectedId : emptyGlyphData.id;

	return (
		<Dialog open={open} onOpenChange={onOpenChange} testId="glyph-modal" title={i18n.t('talents_tab.glyphs.modal.title')}>
			<SearchBar className="max-w-48" inputTestId="selector-modal-search" placeholder={i18n.t('common.search')} value={search} onChange={setSearch} />
			<ul data-testid="selector-modal-list">
				{entries.map(entry => (
					<li
						key={entry.id}
						className={clsx('ui-selector-modal-list-item', !matchesGlyphSearch(entry.name, search) && 'hidden')}
						data-testid="selector-modal-list-item"
						data-active={entry.id === activeId ? '' : undefined}
						hidden={!matchesGlyphSearch(entry.name, search)}>
						<a
							className="ui-selector-modal-list-item-link flex-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-link"
							data-testid="selector-modal-list-item-link"
							href={glyphUrl(entry)}
							onClick={event => {
								event.preventDefault();
								onSelect(entry.id);
							}}>
							<img className="ui-selector-modal-list-item-icon" data-testid="selector-modal-list-item-icon" src={entry.iconUrl} alt="" />
							<span
								className={clsx('ui-selector-modal-list-item-name flex-2', itemQualityClassName(entry.quality))}
								data-testid="selector-modal-list-item-name">
								{entry.name}
							</span>
							<span className="ml-4 flex-3 tracking-normal text-quality-junk">{entry.description}</span>
						</a>
					</li>
				))}
			</ul>
		</Dialog>
	);
};
