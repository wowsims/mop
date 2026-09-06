export const FIELD_NAMES = ['source', 'target', 'spell', 'type', 'school', 'outcome', 'time', 'amount'] as const;

export type ClauseField = (typeof FIELD_NAMES)[number];

// A field, the values picked under it, and how they join. Filters are built rather than typed, so
// this is the whole query: groups AND together, and the search box's keywords AND with them.
export type SearchGroup = { field: ClauseField; join: 'and' | 'or'; values: Array<string> };
