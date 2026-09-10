import i18n from '@i18n/config';
import { DropdownPicker } from '@ui-kit/DropdownPicker';
import { useRef } from 'react';

import type { SuggestionSource } from '../../model/log/search/indexes';
import type { ClauseField } from '../../model/log/search/query';
import { FIELD_NAMES } from '../../model/log/search/query';
import { LogSearchGroup } from './LogSearchGroup';
import type { IdentifiedSearchGroup } from './utils';
import { sentenceCase } from './utils';

// Same reason as the group pickers': the drawer clips its overflow and has room upwards.
const DROPUP = { side: 'top', positionMethod: 'fixed' } as const;

const FIELD_OPTIONS = FIELD_NAMES.map(field => ({ value: field, label: sentenceCase(field) }));

export interface LogSearchBarProps {
	groups: ReadonlyArray<IdentifiedSearchGroup>;
	suggestions: SuggestionSource;
	onChange: (groups: Array<IdentifiedSearchGroup>) => void;
}

/** The filter groups in the bottom bar's drawer. The free-text box is the sticky header's, not this. */
export const LogSearchBar = ({ groups, suggestions, onChange }: LogSearchBarProps) => {
	const nextId = useRef(0);

	const addField = (field: ClauseField) => onChange([...groups, { id: nextId.current++, field, join: 'or', values: [] }]);

	return (
		<div className="log-search-bar">
			<div className="log-search-groups d-flex flex-wrap align-items-start row-gap-1 column-gap-2">
				{groups.map((group, index) => (
					<LogSearchGroup
						key={group.id}
						group={group}
						suggestions={suggestions}
						onChange={next => onChange(groups.map((current, other) => (other === index ? next : current)))}
						onRemove={() => onChange(groups.filter((_, other) => other !== index))}
					/>
				))}
			</div>
			<div className="log-search-add-field">
				<DropdownPicker
					id="log-search-add-filter"
					className="log-search-add-picker"
					options={FIELD_OPTIONS}
					value={undefined}
					onChange={addField}
					equals={(a, b) => a === b}
					defaultLabel={i18n.t('results_tab.details.logs.search_add_filter')}
					{...DROPUP}
				/>
			</div>
		</div>
	);
};
