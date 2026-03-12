/**
 * Utility to convert LP Model to CPLEX LP file format for HiGHS solver
 *
 * CPLEX LP Format Reference: http://web.mit.edu/lpsolve/doc/CPLEX-format.htm
 */

import type { LPModel, SerializedConstraints, SerializedVariables } from './reforge_types';

/**
 * Escapes a variable name for CPLEX LP format
 * Variable names must start with a letter and contain only alphanumeric and underscore
 */
function escapeVariableName(name: string): string {
	// Replace any invalid characters with underscore
	let escaped = name.replace(/[^a-zA-Z0-9_]/g, '_');
	// Ensure it starts with a letter
	if (!/^[a-zA-Z]/.test(escaped)) {
		escaped = 'v_' + escaped;
	}
	return escaped;
}

/**
 * Formats a number for LP file, handling special cases
 */
function formatNumber(num: number): string {
	if (!Number.isFinite(num)) {
		if (num === Infinity) return '1e30';
		if (num === -Infinity) return '-1e30';
		// NaN - this shouldn't happen, but handle it defensively
		console.error('[LP] formatNumber received NaN, using 0');
		return '0';
	}
	// Use fixed precision to avoid floating point issues
	return num.toFixed(10).replace(/\.?0+$/, '');
}

/**
 * Builds the objective function string (may be multiple lines if long)
 */
function buildObjective(variables: SerializedVariables, objectiveKey: string, variableNameMap: Map<string, string>): string[] {
	const terms: string[] = [];

	for (const [varName, coefficients] of Object.entries(variables)) {
		const score = coefficients[objectiveKey];
		if (score !== undefined && score !== 0) {
			const escapedName = variableNameMap.get(varName)!;
			// Always include explicit sign for proper LP format
			// First term doesn't need + prefix, but subsequent terms do
			if (terms.length === 0) {
				terms.push(`${formatNumber(score)} ${escapedName}`);
			} else {
				const sign = score >= 0 ? '+ ' : '- ';
				terms.push(`${sign}${formatNumber(Math.abs(score))} ${escapedName}`);
			}
		}
	}

	// If no terms, add a dummy to make it valid
	if (terms.length === 0) {
		return [' obj: 0'];
	}

	const fullLine = ' obj: ' + terms.join(' ');
	return wrapExpression(fullLine, MAX_LINE_LENGTH);
}

/**
 * Builds constraint expressions
 * YALPS constraints have format: { equal?: number, min?: number, max?: number }
 */
// Maximum line length for LP format (HiGHS seems to have issues with very long lines)
const MAX_LINE_LENGTH = 200;

/**
 * Wraps a long expression into multiple lines, each starting with a space (continuation)
 */
function wrapExpression(expression: string, maxLength: number): string[] {
	if (expression.length <= maxLength) {
		return [expression];
	}

	const lines: string[] = [];
	let currentLine = '';
	const tokens = expression.split(' ');

	for (const token of tokens) {
		if (currentLine.length === 0) {
			currentLine = token;
		} else if (currentLine.length + 1 + token.length <= maxLength) {
			currentLine += ' ' + token;
		} else {
			lines.push(currentLine);
			// Continuation lines start with a space
			currentLine = ' ' + token;
		}
	}

	if (currentLine.length > 0) {
		lines.push(currentLine);
	}

	return lines;
}

function buildConstraints(variables: SerializedVariables, constraints: SerializedConstraints, variableNameMap: Map<string, string>): string[] {
	const lines: string[] = [];
	let constraintIndex = 0;

	for (const [constraintName, constraint] of Object.entries(constraints)) {
		// Skip constraints that have no bound values defined
		if (constraint.equal === undefined && constraint.min === undefined && constraint.max === undefined) {
			console.warn(`[LP] Skipping constraint "${constraintName}" with no bounds defined`);
			continue;
		}

		const terms: string[] = [];

		// Find all variables that have this constraint coefficient
		for (const [varName, coefficients] of Object.entries(variables)) {
			const coeff = coefficients[constraintName];
			if (coeff !== undefined && coeff !== 0) {
				const escapedName = variableNameMap.get(varName)!;
				// Always include explicit sign for proper LP format
				if (terms.length === 0) {
					terms.push(`${formatNumber(coeff)} ${escapedName}`);
				} else {
					const sign = coeff >= 0 ? '+ ' : '- ';
					terms.push(`${sign}${formatNumber(Math.abs(coeff))} ${escapedName}`);
				}
			}
		}

		if (terms.length === 0) {
			// Skip constraints with no variables - these are constraints on stats
			// that aren't affected by any reforge options
			console.warn(`[LP] Skipping constraint "${constraintName}" with no variable coefficients`);
			continue;
		}

		const lhs = terms.join(' ');

		// Handle YALPS constraint format: { equal?, min?, max? }
		// Equal takes precedence if defined
		if (constraint.equal !== undefined) {
			const constraintLabel = `c${constraintIndex++}`;
			const fullLine = ` ${constraintLabel}: ${lhs} = ${formatNumber(constraint.equal)}`;
			lines.push(...wrapExpression(fullLine, MAX_LINE_LENGTH));
		} else {
			// Can have both min and max (range constraint)
			if (constraint.max !== undefined) {
				const constraintLabel = `c${constraintIndex++}`;
				const fullLine = ` ${constraintLabel}: ${lhs} <= ${formatNumber(constraint.max)}`;
				lines.push(...wrapExpression(fullLine, MAX_LINE_LENGTH));
			}
			if (constraint.min !== undefined) {
				const constraintLabel = `c${constraintIndex++}`;
				const fullLine = ` ${constraintLabel}: ${lhs} >= ${formatNumber(constraint.min)}`;
				lines.push(...wrapExpression(fullLine, MAX_LINE_LENGTH));
			}
		}
	}

	return lines;
}

/**
 * Builds the bounds section
 * For binary variables, bounds are 0 <= x <= 1
 */
function buildBounds(variableNames: string[], isBinary: boolean): string[] {
	if (isBinary) {
		// Binary variables implicitly have bounds 0 <= x <= 1
		// We can skip explicit bounds for binaries
		return [];
	}

	// For continuous variables, default bounds
	return variableNames.map(name => ` 0 <= ${name}`);
}

/**
 * Builds the binary/integer section
 */
function buildBinaries(variableNames: string[]): string[] {
	return variableNames.map(name => ` ${name}`);
}

/**
 * Converts an LP Model to CPLEX LP format string
 */
export function modelToLPFormat(model: LPModel): {
	lpString: string;
	variableNameMap: Map<string, string>;
	reverseNameMap: Map<string, string>;
} {
	const variableNameMap = new Map<string, string>();
	const reverseNameMap = new Map<string, string>();

	// Build variable name mapping
	let varIndex = 0;
	for (const varName of Object.keys(model.variables)) {
		const escaped = `x${varIndex++}`;
		variableNameMap.set(varName, escaped);
		reverseNameMap.set(escaped, varName);
	}

	const lines: string[] = [];

	// Direction
	lines.push(model.direction === 'maximize' ? 'Maximize' : 'Minimize');

	// Objective (may be multiple lines if long)
	lines.push(...buildObjective(model.variables, model.objective, variableNameMap));

	// Constraints - only add section if there are valid constraints
	const constraintLines = buildConstraints(model.variables, model.constraints, variableNameMap);
	if (constraintLines.length > 0) {
		lines.push('Subject To');
		lines.push(...constraintLines);
	}

	// Bounds
	const escapedVarNames = Array.from(variableNameMap.values());
	const bounds = buildBounds(escapedVarNames, model.binaries);
	if (bounds.length > 0) {
		lines.push('Bounds');
		lines.push(...bounds);
	}

	// Binaries
	if (model.binaries) {
		lines.push('Binary');
		lines.push(...buildBinaries(escapedVarNames));
	}

	// End
	lines.push('End');

	return {
		lpString: lines.join('\n'),
		variableNameMap,
		reverseNameMap,
	};
}

/**
 * Parses HiGHS solution back to our format
 */
export interface HighsSolution {
	Status: string;
	ObjectiveValue: number;
	Columns: Record<
		string,
		{
			Index: number;
			Status: string;
			Lower: number;
			Upper: number;
			Type: string;
			Primal: number;
			Dual: number;
			Name: string;
		}
	>;
	Rows: Array<{
		Index: number;
		Name: string;
		Status: string;
		Lower: number;
		Upper: number;
		Primal: number;
		Dual: number;
	}>;
}

/**
 * Converts HiGHS solution to our LPSolution format
 */
export function highsSolutionToLPSolution(
	highsSolution: HighsSolution,
	reverseNameMap: Map<string, string>,
	tolerance: number = 0.5,
): import('./reforge_types').LPSolution {
	// Map HiGHS status to our status
	let status: import('./reforge_types').SolutionStatus;
	switch (highsSolution.Status) {
		case 'Optimal':
			status = 'optimal';
			break;
		case 'Infeasible':
			status = 'infeasible';
			break;
		case 'Unbounded':
			status = 'unbounded';
			break;
		case 'Time limit reached':
			status = 'timedout';
			break;
		default:
			status = 'unknown';
	}

	// Extract selected variables (for binary, those with value >= tolerance)
	const variables: Array<[string, number]> = [];

	for (const [escapedName, column] of Object.entries(highsSolution.Columns)) {
		const originalName = reverseNameMap.get(escapedName);
		if (originalName && column.Primal >= tolerance) {
			variables.push([originalName, column.Primal]);
		}
	}

	return {
		status,
		result: highsSolution.ObjectiveValue,
		variables,
		bounded: status === 'optimal',
		feasible: status === 'optimal' || status === 'unbounded',
	};
}
