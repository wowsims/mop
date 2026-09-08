import type { CombatLog, Outcome } from '@sim/proto/combat_log';
import { formattedTimestamp, rawWithoutTimestamp } from '@sim/proto/combat_log';
import { OUTCOMES } from '@sim/proto/combat_log/types';

import type { SimResultData } from '../../model/result_data';
import type { SuggestionSource } from '../../view/log/search/indexes';
import { TYPE_SUGGESTIONS } from '../../view/log/search/indexes';
import type { ClauseField, SearchGroup } from '../../view/log/search/query';

/**
 * A `SearchGroup` with the identity React needs to keep a group's half-typed value across the removal
 * of an earlier one — the guarantee vanilla got from a `WeakMap` keyed on the group object.
 */
export type IdentifiedSearchGroup = SearchGroup & { id: number };

export const DEBUG_MARKER = '[DEBUG]';

/**
 * A copy of the map in `view/log/components/results.tsx`, which stays alive for the still-vanilla
 * timeline (`tooltip_content.tsx` and `rotation_items.tsx` both render its `Results`). Importing that
 * module here would pull `tsx-vanilla`'s JSX runtime into a React file for one constant; the two
 * collapse into this one when the timeline ports.
 */
export const OUTCOME_LABEL: Record<Outcome, string> = {
	miss: 'Miss',
	dodge: 'Dodge',
	parry: 'Parry',
	'critical-block': 'Critical Block',
	'blocked-glance': 'Blocked Glance',
	block: 'Block',
	glance: 'Glance',
	crit: 'Crit',
	hit: 'Hit',
};

/** Fields whose values are typed into a box rather than picked, and the placeholder each shows. */
export const TYPED_FIELDS: Partial<Record<ClauseField, string>> = { time: '10-30', amount: '>5000' };

export const sentenceCase = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

export const labelOf = (field: ClauseField, value: string): string => {
	switch (field) {
		case 'outcome':
			return OUTCOME_LABEL[value as Outcome] ?? value;
		case 'type':
			return sentenceCase(value.replace(/-/g, ' '));
		default:
			return value;
	}
};

/** Quoted phrases stay whole, everything else splits on whitespace. */
export const keywordsOf = (text: string): Array<string> => {
	const keywords: Array<string> = [];
	for (const match of text.matchAll(/"([^"]+)"|\S+/g)) keywords.push(match[1] ?? match[0]);
	return keywords;
};

/**
 * Timeline and CombatReplay narrow their unit list with this filter; the log has no unit rows, so the
 * equivalent is to keep the lines naming that target. Null whenever it would be a no-op, which
 * includes every single-target encounter.
 */
export const selectedTargetNumber = (resultData: SimResultData): number | null => {
	if (resultData.result.getTargets().length < 2) return null;
	const selected = resultData.result.getTargets(resultData.filter);
	return selected.length === 1 ? selected[0].index + 1 : null;
};

/** The values a picked field offers. A typed field (see `TYPED_FIELDS`) offers none. */
export const valueCandidates = (field: ClauseField, suggestions: SuggestionSource): ReadonlyArray<string> => {
	switch (field) {
		case 'type':
			return TYPE_SUGGESTIONS;
		case 'outcome':
			return OUTCOMES;
		case 'school':
			return suggestions.schools;
		case 'spell':
			return suggestions.spells;
		case 'source':
		case 'target':
			return suggestions.units;
		default:
			return [];
	}
};

/** What the exporter dialog writes out: every line, unfiltered, timestamp first. */
export const combinedLogText = (logs: ReadonlyArray<CombatLog>): string =>
	logs.map(log => `${formattedTimestamp(log)};${rawWithoutTimestamp(log.raw)}`).join('\n');
