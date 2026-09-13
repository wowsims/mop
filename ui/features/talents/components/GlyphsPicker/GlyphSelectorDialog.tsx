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
		<Dialog open={open} onOpenChange={onOpenChange} className="glyph-modal" title={i18n.t('talents_tab.glyphs.modal.title')}>
			<SearchBar className="selector-modal-search max-w-48" placeholder={i18n.t('common.search')} value={search} onChange={setSearch} />
			<ul className="selector-modal-list">
				{entries.map(entry => (
					<li
						key={entry.id}
						className={clsx(
							'selector-modal-list-item ui-selector-modal-list-item',
							entry.id === activeId && 'active',
							!matchesGlyphSearch(entry.name, search) && 'hidden',
						)}
						data-active={entry.id === activeId ? '' : undefined}
						hidden={!matchesGlyphSearch(entry.name, search)}>
						<a
							className="selector-modal-list-item-link ui-selector-modal-list-item-link flex-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-link focus-visible:outline-offset-1"
							href={glyphUrl(entry)}
							onClick={event => {
								event.preventDefault();
								onSelect(entry.id);
							}}>
							<img className="selector-modal-list-item-icon ui-selector-modal-list-item-icon" src={entry.iconUrl} alt="" />
							<span
								className={clsx('selector-modal-list-item-name ui-selector-modal-list-item-name flex-2', itemQualityClassName(entry.quality))}>
								{entry.name}
							</span>
							<span className="selector-modal-list-item-description ml-4 tracking-normal text-quality-junk flex-3">{entry.description}</span>
						</a>
					</li>
				))}
			</ul>
		</Dialog>
	);
};
