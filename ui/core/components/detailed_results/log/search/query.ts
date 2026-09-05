export type ClauseField = 'source' | 'target' | 'spell' | 'type' | 'school' | 'outcome' | 'time' | 'amount';

export type Clause = {
	field: ClauseField | null;
	values: Array<string>;
};

export const FIELD_NAMES: Array<ClauseField> = ['source', 'target', 'spell', 'type', 'school', 'outcome', 'time', 'amount'];

// Filters are built rather than typed, so this is only ever assembled in code: a clause per picked
// value, joined by the group's AND/OR, and one free-text clause for whatever is in the search box.
export type QueryNode = { kind: 'clause'; clause: Clause } | { kind: 'and'; children: Array<QueryNode> } | { kind: 'or'; children: Array<QueryNode> };
