import i18n from '@i18n/config';
import { DropdownPicker } from '@ui-kit/DropdownPicker';

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
	const nextId = groups.reduce((highest, group) => Math.max(highest, group.id), -1) + 1;

	const addField = (field: ClauseField) => onChange([...groups, { id: nextId, field, join: 'or', values: [] }]);

	return (
		<div data-testid="log-search-bar" className="flex flex-col gap-2">
			<div data-testid="log-search-groups" className="flex flex-wrap items-start gap-x-2 gap-y-1">
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
			<div data-testid="log-search-add-field">
				<DropdownPicker
					id="log-search-add-filter"
					options={FIELD_OPTIONS}
					value={undefined}
					onChange={addField}
					equals={(a, b) => a === b}
					defaultLabel={i18n.t('results_tab.details.logs.search_add_filter')}
					triggerClassName="border-0 p-0"
					{...DROPUP}
				/>
			</div>
		</div>
	);
};
