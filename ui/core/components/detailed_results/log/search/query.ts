export type ClauseField = 'source' | 'target' | 'spell' | 'type' | 'school' | 'outcome' | 'time' | 'amount';

export type Clause = {
	field: ClauseField | null;
	values: Array<string>;
	negated: boolean;
	raw: string;
};

const FIELD_ALIASES: Record<string, ClauseField> = {
	source: 'source',
	src: 'source',
	target: 'target',
	tgt: 'target',
	spell: 'spell',
	action: 'spell',
	type: 'type',
	school: 'school',
	outcome: 'outcome',
	time: 'time',
	t: 'time',
	amount: 'amount',
};

export const FIELD_NAMES: Array<ClauseField> = ['source', 'target', 'spell', 'type', 'school', 'outcome', 'time', 'amount'];

export function resolveField(name: string): ClauseField | null {
	return FIELD_ALIASES[name.toLowerCase()] ?? null;
}

// Splits on unquoted whitespace only, so 'spell:"Death Coil"' stays one token while its
// internal space is preserved for splitValues to see.
function tokenize(input: string): Array<string> {
	const tokens: Array<string> = [];
	let current = '';
	let inQuotes = false;
	for (const ch of input) {
		if (ch === '"') {
			inQuotes = !inQuotes;
			current += ch;
			continue;
		}
		if (!inQuotes && /\s/.test(ch)) {
			if (current) tokens.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	if (current) tokens.push(current);
	return tokens;
}

// '|' is OR inside one chip's value, but only outside quotes - splitValues also strips the
// quotes themselves, since they are punctuation, not part of the matched text.
function splitValues(valuePart: string): Array<string> {
	const parts: Array<string> = [];
	let current = '';
	let inQuotes = false;
	for (const ch of valuePart) {
		if (ch === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (ch === '|' && !inQuotes) {
			parts.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	parts.push(current);
	return parts.map(part => part.trim()).filter(part => part.length > 0);
}

function stripQuotes(text: string): string {
	return text.startsWith('"') && text.endsWith('"') && text.length >= 2 ? text.slice(1, -1) : text;
}

const FIELD_PREFIX_REGEX = /^([A-Za-z]+):([\s\S]*)$/;

function parseToken(token: string): Clause {
	const raw = token;
	let negated = false;
	let text = token;
	if (text.startsWith('-') && text.length > 1) {
		negated = true;
		text = text.slice(1);
	}

	const match = FIELD_PREFIX_REGEX.exec(text);
	if (match) {
		const field = FIELD_ALIASES[match[1].toLowerCase()];
		if (field) {
			return { field, values: splitValues(match[2]), negated, raw };
		}
		// Unrecognised field name: the whole clause becomes one free-text term instead of
		// silently matching nothing, so a typo in a field name still finds something.
		return { field: null, values: [stripQuotes(text)], negated, raw };
	}

	return { field: null, values: [stripQuotes(text)], negated, raw };
}

export function parseQuery(input: string): Array<Clause> {
	return tokenize(input).map(parseToken);
}

function quoteIfNeeded(value: string): string {
	return /\s/.test(value) ? `"${value}"` : value;
}

export function clauseText(clause: Clause): string {
	const body = clause.field ? `${clause.field}:${clause.values.map(quoteIfNeeded).join('|')}` : quoteIfNeeded(clause.values[0] ?? '');
	return clause.negated ? `-${body}` : body;
}
