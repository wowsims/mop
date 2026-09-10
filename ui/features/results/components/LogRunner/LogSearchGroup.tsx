import i18n from '@i18n/config';
import { DropdownPicker } from '@ui-kit/DropdownPicker';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type { SuggestionSource } from '../../model/log/search/indexes';
import { isNumericFilter } from '../../model/log/search/indexes';
import type { IdentifiedSearchGroup } from './utils';
import { labelOf, sentenceCase, TYPED_FIELDS, valueCandidates } from './utils';

// The group sits in the bottom bar's drawer, which clips its overflow; an out-of-flow menu is the one
// that still opens past its edge, and up is the direction that has room down there. Both only hold
// while `.log-fab-panel` drops its transform when expanded — see the stylesheet.
const DROPUP = { side: 'top', positionMethod: 'fixed' } as const;

// Nameless to a screen reader, exactly as vanilla's was: giving it one needs a translation key the
// locale files do not have, and inventing untranslated English here is the worse trade. Flagged.
const DeleteButton = ({ onClick }: { onClick: () => void }) => (
	<button type="button" className="saved-data-set-delete" onClick={onClick}>
		<Icon name="times" style="base" size="lg" />
	</button>
);

export interface LogSearchGroupProps {
	group: IdentifiedSearchGroup;
	suggestions: SuggestionSource;
	onChange: (group: IdentifiedSearchGroup) => void;
	onRemove: () => void;
}

export const LogSearchGroup = ({ group, suggestions, onChange, onRemove }: LogSearchGroupProps) => {
	// Local, so it survives the removal of an earlier group: React keeps this component on its key.
	const [draft, setDraft] = useState('');

	const options = useMemo(
		() =>
			valueCandidates(group.field, suggestions).map(value => ({
				value,
				label: labelOf(group.field, value),
				icon: suggestions.spellIcons.get(value) ? <img className="icon-sm me-1" src={suggestions.spellIcons.get(value)} alt="" /> : undefined,
			})),
		[group.field, suggestions],
	);

	const addValue = (value: string) => {
		if (group.values.includes(value)) return;
		onChange({ ...group, values: [...group.values, value] });
	};

	const commitDraft = () => {
		const value = draft.trim();
		if (!value || !isNumericFilter(value) || group.values.includes(value)) return;
		setDraft('');
		addValue(value);
	};

	const placeholder = TYPED_FIELDS[group.field];

	return (
		<div className="log-search-group">
			<div className="log-search-group-head">
				<span className="log-search-group-field">{sentenceCase(group.field)}</span>
				<div className="log-search-group-join btn-group btn-group-sm" role="group">
					{(['and', 'or'] as const).map(join => (
						<button
							key={join}
							type="button"
							className={clsx('btn', 'btn-sm', group.join === join ? 'btn-primary' : 'btn-outline-primary')}
							aria-pressed={group.join === join}
							onClick={() => {
								if (group.join === join) return;
								onChange({ ...group, join });
							}}>
							{join.toUpperCase()}
						</button>
					))}
				</div>
				<DeleteButton onClick={onRemove} />
			</div>
			<div className="log-search-group-items d-flex flex-wrap align-items-center gap-1">
				{group.values.map((value, valueIndex) => (
					<div key={value} className="log-search-chip saved-data-set-chip badge rounded-pill">
						<span className="saved-data-set-name">{labelOf(group.field, value)}</span>
						<DeleteButton onClick={() => onChange({ ...group, values: group.values.filter((_, index) => index !== valueIndex) })} />
					</div>
				))}
				<div className="input-group">
					{placeholder ? (
						<>
							<input
								type="text"
								className="form-control form-control-sm log-search-group-input"
								placeholder={placeholder}
								autoComplete="off"
								value={draft}
								onChange={event => setDraft(event.target.value)}
								onKeyDown={event => {
									if (event.key !== 'Enter') return;
									event.preventDefault();
									commitDraft();
								}}
							/>
							<button
								type="button"
								className="btn btn-sm btn-primary"
								aria-label={i18n.t('results_tab.details.logs.search_add_value')}
								onClick={commitDraft}>
								<Icon name="check" style="base" />
							</button>
						</>
					) : (
						<DropdownPicker
							id={`log-search-group-${group.id}`}
							options={options}
							value={undefined}
							onChange={addValue}
							equals={(a, b) => a === b}
							defaultLabel={i18n.t('results_tab.details.logs.search_add_value')}
							{...DROPUP}
						/>
					)}
				</div>
			</div>
		</div>
	);
};
