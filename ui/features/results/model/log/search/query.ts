export const FIELD_NAMES = ['source', 'target', 'spell', 'type', 'school', 'outcome', 'time', 'amount'] as const;

export type ClauseField = (typeof FIELD_NAMES)[number];

export type SearchGroup = { field: ClauseField; join: 'and' | 'or'; values: Array<string> };
