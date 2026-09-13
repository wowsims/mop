import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { ButtonGroup } from '@ui-kit/ButtonGroup';
import { Chip } from '@ui-kit/Chip';
import { DropdownPicker } from '@ui-kit/DropdownPicker';
import { Input } from '@ui-kit/FormControl';
import { Icon } from '@ui-kit/Icon';
import { useMemo, useState } from 'react';

import type { SuggestionSource } from '../../model/log/search/indexes';
import { isNumericFilter } from '../../model/log/search/indexes';
import type { IdentifiedSearchGroup } from './utils';
import { labelOf, sentenceCase, TYPED_FIELDS, valueCandidates } from './utils';

// The group sits in the bottom bar's drawer, which clips its overflow; an out-of-flow menu is the one
// that still opens past its edge, and up is the direction that has room down there. Both only hold
// while `.log-fab-panel` drops its transform when expanded — see the stylesheet.
const DROPUP = { side: 'top', positionMethod: 'fixed' } as const;

// Nameless to a screen reader: giving it one needs a translation key the locale files do not have,
// and inventing untranslated English here is the worse trade. Flagged.
const DeleteButton = ({ onClick }: { onClick: () => void }) => (
	<button type="button" className="saved-data-set-delete" data-testid="saved-data-set-delete" onClick={onClick}>
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
				icon: suggestions.spellIcons.get(value) ? <img className="icon-sm mr-1" src={suggestions.spellIcons.get(value)} alt="" /> : undefined,
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
				<ButtonGroup className="log-search-group-join ml-auto" size="sm">
					{(['and', 'or'] as const).map(join => (
						<Button
							key={join}
							size="sm"
							variant={group.join === join ? 'primary' : 'outline-primary'}
							aria-pressed={group.join === join}
							onClick={() => {
								if (group.join === join) return;
								onChange({ ...group, join });
							}}>
							{join.toUpperCase()}
						</Button>
					))}
				</ButtonGroup>
				<DeleteButton onClick={onRemove} />
			</div>
			<div className="log-search-group-items flex flex-wrap items-center gap-1">
				{group.values.map((value, valueIndex) => (
					<Chip
						key={value}
						className="log-search-chip"
						nameAs="span"
						label={labelOf(group.field, value)}
						deleteSlot={<DeleteButton onClick={() => onChange({ ...group, values: group.values.filter((_, index) => index !== valueIndex) })} />}
					/>
				))}
				<div className="input-group">
					{placeholder ? (
						<>
							<Input
								type="text"
								className="form-control log-search-group-input w-32"
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
							<Button size="sm" aria-label={i18n.t('results_tab.details.logs.search_add_value')} onClick={commitDraft}>
								<Icon name="check" style="base" />
							</Button>
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
