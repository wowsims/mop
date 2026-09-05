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

// Splits on unquoted whitespace only, so 'spell:"Death Coil"' stays one token while its
// internal space is preserved for splitValues to see. Parentheses are their own tokens so a
// group can be written without spacing it out.
function tokenize(input: string, splitParens = true): Array<string> {
	const tokens: Array<string> = [];
	let current = '';
	let inQuotes = false;
	const flush = () => {
		if (current) tokens.push(current);
		current = '';
	};
	for (const ch of input) {
		if (ch === '"') {
			inQuotes = !inQuotes;
			current += ch;
			continue;
		}
		if (splitParens && !inQuotes && (ch === '(' || ch === ')')) {
			flush();
			tokens.push(ch);
			continue;
		}
		if (!inQuotes && /\s/.test(ch)) {
			flush();
			continue;
		}
		current += ch;
	}
	flush();
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

// The grammar has one owner: the chip parser and the autocomplete both split a token here, so a
// change to the negation prefix or the field separator cannot desync them.
export type TokenParts = { negated: boolean; text: string; field: ClauseField | null; fieldName: string | null; valuePart: string | null };

export function splitToken(token: string): TokenParts {
	let negated = false;
	let text = token;
	if (text.startsWith('-') && text.length > 1) {
		negated = true;
		text = text.slice(1);
	}

	const match = FIELD_PREFIX_REGEX.exec(text);
	if (!match) return { negated, text, field: null, fieldName: null, valuePart: null };
	return { negated, text, field: FIELD_ALIASES[match[1].toLowerCase()] ?? null, fieldName: match[1], valuePart: match[2] };
}

function parseToken(token: string): Clause {
	const raw = token;
	const { negated, text, field, valuePart } = splitToken(token);
	if (field && valuePart !== null) {
		return { field, values: splitValues(valuePart), negated, raw };
	}
	// No field prefix, or an unrecognised one: the whole clause becomes a single free-text term
	// rather than silently matching nothing, so a typo in a field name still finds something.
	return { field: null, values: [stripQuotes(text)], negated, raw };
}

// A query is a boolean expression, not a flat list: `source:Player AND (Frostbolt OR Fireball)`.
// AND binds tighter than OR, parentheses override, and an omitted operator means AND - which is
// what makes every query written before this still mean the same thing.
export type QueryNode =
	| { kind: 'clause'; clause: Clause }
	| { kind: 'and'; children: Array<QueryNode> }
	| { kind: 'or'; children: Array<QueryNode> }
	| { kind: 'not'; child: QueryNode };

function isOperator(token: string | undefined, name: string): boolean {
	return token !== undefined && !token.startsWith('"') && token.toLowerCase() === name;
}

class ExpressionParser {
	private pos = 0;
	constructor(private readonly tokens: Array<string>) {}

	private peek(): string | undefined {
		return this.tokens[this.pos];
	}

	parse(): QueryNode | null {
		const node = this.parseOr();
		// Trailing junk (an unmatched ')') means the text is not a well-formed expression; the
		// caller falls back to reading it as plain terms rather than silently dropping the tail.
		return this.pos === this.tokens.length ? node : null;
	}

	private parseOr(): QueryNode | null {
		const children: Array<QueryNode> = [];
		for (;;) {
			const next = this.parseAnd();
			if (!next) return null;
			children.push(next);
			if (!isOperator(this.peek(), 'or')) break;
			this.pos++;
		}
		return children.length === 1 ? children[0] : { kind: 'or', children };
	}

	private parseAnd(): QueryNode | null {
		const children: Array<QueryNode> = [];
		for (;;) {
			const next = this.parseUnary();
			if (!next) return null;
			children.push(next);
			if (isOperator(this.peek(), 'and')) {
				this.pos++;
				continue;
			}
			// Juxtaposition is AND, so keep going unless the next token ends this group.
			const ahead = this.peek();
			if (ahead === undefined || ahead === ')' || isOperator(ahead, 'or')) break;
		}
		return children.length === 1 ? children[0] : { kind: 'and', children };
	}

	private parseUnary(): QueryNode | null {
		if (isOperator(this.peek(), 'not')) {
			this.pos++;
			const child = this.parseUnary();
			return child && { kind: 'not', child };
		}
		return this.parsePrimary();
	}

	private parsePrimary(): QueryNode | null {
		const token = this.peek();
		if (token === undefined || token === ')') return null;
		if (token === '(') {
			this.pos++;
			const inner = this.parseOr();
			if (!inner || this.peek() !== ')') return null;
			this.pos++;
			return inner;
		}
		if (isOperator(token, 'and') || isOperator(token, 'or')) return null;
		this.pos++;
		return { kind: 'clause', clause: parseToken(token) };
	}
}

// Parentheses stay inside the token here: this is the path taken when the text is not a valid
// expression, and log lines are full of them - `(Threat: 12.30)` should search for that text, not
// leave a stray '(' behind as its own term.
export function parseQuery(input: string): Array<Clause> {
	return tokenize(input, false).map(parseToken);
}

// The chip row ANDs its chips, so a top-level AND splits into one chip per operand and anything
// else stays a single chip. Unparseable text degrades to one plain term per token, which is what
// it did before expressions existed.
export function parseChips(input: string): Array<QueryNode> {
	const tokens = tokenize(input).filter(token => token !== '');
	if (!tokens.length) return [];
	const node = new ExpressionParser(tokens).parse();
	if (!node) return parseQuery(input).map(clause => ({ kind: 'clause', clause }) as QueryNode);
	return node.kind === 'and' ? node.children : [node];
}

function quoteIfNeeded(value: string): string {
	return /\s/.test(value) ? `"${value}"` : value;
}

export function clauseText(clause: Clause): string {
	const body = clause.field ? `${clause.field}:${clause.values.map(quoteIfNeeded).join('|')}` : quoteIfNeeded(clause.values[0] ?? '');
	return clause.negated ? `-${body}` : body;
}

// Round-trips: editing a chip puts this text back in the input, where it must parse to the same
// node. Groups are parenthesised for that reason, not for display.
export function nodeText(node: QueryNode): string {
	switch (node.kind) {
		case 'clause':
			return clauseText(node.clause);
		case 'not':
			return `NOT ${nodeText(node.child)}`;
		case 'and':
		case 'or': {
			const joined = node.children.map(child => nodeText(child)).join(node.kind === 'and' ? ' AND ' : ' OR ');
			return `(${joined})`;
		}
	}
}
