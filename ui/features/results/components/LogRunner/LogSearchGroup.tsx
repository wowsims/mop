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

// The group sits in the bottom bar's Drawer sheet; up is the direction that has room below it.
const DROPUP = { side: 'top', positionMethod: 'fixed' } as const;

const DeleteButton = ({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) => (
	<button type="button" className={className} data-testid="log-search-group-remove" aria-label={label} onClick={onClick}>
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
				icon: suggestions.spellIcons.get(value) ? (
					<img data-testid="log-search-suggestion-icon" className="mr-1 icon-sm" src={suggestions.spellIcons.get(value)} alt="" />
				) : undefined,
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
		<div
			data-testid="log-search-group"
			className="flex max-w-62.5 flex-col gap-2 rounded-none border border-border-muted bg-panel p-2 [transition:all_0.2s_ease] hover:border-border hover:bg-panel-hover">
			<div data-testid="log-search-group-head" className="flex items-center gap-2">
				<span data-testid="log-search-group-field" className="text-(length:--btn-font-size) leading-normal">
					{sentenceCase(group.field)}
				</span>
				<ButtonGroup data-testid="log-search-group-join" className="ml-auto" size="sm">
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
				<DeleteButton
					label={i18n.t('common.list_picker.delete_item', { itemLabel: sentenceCase(group.field) })}
					onClick={onRemove}
					className="py-2 text-white"
				/>
			</div>
			<div data-testid="log-search-group-items" className="flex flex-wrap items-center gap-1">
				{group.values.map((value, valueIndex) => (
					<Chip
						key={value}
						testId="log-search-chip"
						nameAs="span"
						label={labelOf(group.field, value)}
						confirmDelete={false}
						onDelete={() => onChange({ ...group, values: group.values.filter((_, index) => index !== valueIndex) })}
					/>
				))}
				<div data-testid="input-group" className="relative flex w-full flex-wrap items-stretch">
					{placeholder ? (
						<>
							<Input
								type="text"
								data-testid="log-search-group-input"
								className="relative w-32 min-w-0 flex-auto focus:z-5"
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
							triggerClassName="border-0 p-0"
							{...DROPUP}
						/>
					)}
				</div>
			</div>
		</div>
	);
};
