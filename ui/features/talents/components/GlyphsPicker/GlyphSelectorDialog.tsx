import { useSimHost } from '@sim/context/SimHostContext';
import i18n from '@i18n/config';
import { itemQualityClassName } from '@ui-kit/utils/css';
import { Dialog } from '@ui-kit/Dialog';
import { SearchBar } from '@ui-kit/SearchBar';
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
	const host = useSimHost();
	const [search, setSearch] = useState('');
	const entries = useMemo(() => [emptyGlyphData, ...options], [options]);
	const activeId = entries.some(entry => entry.id === selectedId) ? selectedId : emptyGlyphData.id;

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			className="glyph-modal"
			container={host.rootElem}
			keepMounted
			title={i18n.t('talents_tab.glyphs.modal.title')}>
			<SearchBar className="selector-modal-search" placeholder={i18n.t('common.search')} value={search} onChange={setSearch} />
			<ul className="selector-modal-list">
				{entries.map(entry => (
					<li
						key={entry.id}
						className={clsx('selector-modal-list-item', entry.id === activeId && 'active', !matchesGlyphSearch(entry.name, search) && 'd-none')}>
						<a
							className="selector-modal-list-item-link"
							href={glyphUrl(entry)}
							onClick={event => {
								event.preventDefault();
								onSelect(entry.id);
							}}>
							<img className="selector-modal-list-item-icon" src={entry.iconUrl} />
							<label className={clsx('selector-modal-list-item-name', itemQualityClassName(entry.quality))}>{entry.name}</label>
							<span className="selector-modal-list-item-description">{entry.description}</span>
						</a>
					</li>
				))}
			</ul>
		</Dialog>
	);
};
