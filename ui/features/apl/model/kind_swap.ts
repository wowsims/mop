import { APLAction, APLValue } from '@generated/proto/apl';
import { randomUUID } from '@sim/utils/misc';

import type { APLActionKind } from './action_kinds';
import type { APLValueKind, ValidAPLValueKind } from './value_kinds';

/**
 * What happens to the value the user already built when they pick a different kind for it.
 *
 * This was two long `else if` chains inside the two kind pickers' `setValue`, reading the live
 * picker back through `getInputValue()`. Nothing in it is about the DOM: the old implementation is
 * `source.value[oldKind]`, which is what the picker was showing. Pulled out here it is DOM-free,
 * so the rules — wrap into `not`, unwrap out of it, carry a list across `and`/`or` and
 * `min`/`max`, promote into a `cmp`'s left-hand side — are unit-testable.
 */

const wrapValue = <K extends ValidAPLValueKind>(kind: K, impl: unknown): APLValue => {
	if (!kind) return APLValue.create({ uuid: { value: randomUUID() } });
	return APLValue.create({ value: { oneofKind: kind, [kind]: impl } as APLValue['value'], uuid: { value: randomUUID() } });
};

const implOf = (source: APLValue | undefined, kind: APLValueKind): unknown => (kind && source ? (source.value as Record<string, unknown>)[kind] : undefined);

/** The single-value fields of the four list kinds, so the carry rules read once rather than four times. */
const LIST_KINDS = { and: 'vals', or: 'vals', min: 'vals', max: 'vals' } as const;
const LIST_PAIR: Record<keyof typeof LIST_KINDS, keyof typeof LIST_KINDS> = { and: 'or', or: 'and', min: 'max', max: 'min' };

/**
 * The value to store when the kind picker moves from `oldKind` to `newKind`.
 *
 * Returns the whole `APLValue`; the caller assigns `.value` onto the existing message when there is
 * one (so the uuid survives) and stores the message itself when there is not — which is exactly
 * what the vanilla picker did.
 */
export const swapValueKind = (source: APLValue | undefined, newKind: ValidAPLValueKind, freshImpl: () => unknown): APLValue => {
	const oldKind = source?.value.oneofKind as APLValueKind;
	let next = wrapValue(newKind, freshImpl());
	if (!source || !oldKind) return next;

	const nextValue = next.value as Record<string, any>;
	const sourceValue = source.value as Record<string, any>;

	// Wrapping the current value in a negation.
	if (newKind === 'not') {
		nextValue.not.val = wrapValue(oldKind, implOf(source, oldKind));
		return next;
	}
	// Unwrapping a negation back to whatever it held.
	if (oldKind === 'not' && sourceValue.not?.val?.value.oneofKind === newKind) {
		return sourceValue.not.val as APLValue;
	}

	const listKindName = newKind as keyof typeof LIST_KINDS;
	const listField = LIST_KINDS[listKindName];
	if (listField) {
		const pair = LIST_PAIR[listKindName];
		// and <-> or and min <-> max keep their operand list; anything else becomes the first operand.
		nextValue[newKind][listField] = pair && oldKind === pair ? sourceValue[pair].vals : [wrapValue(oldKind, implOf(source, oldKind))];
		return next;
	}

	// Leaving a list kind for one of its own operands' kind: keep that operand.
	for (const listKind of Object.keys(LIST_KINDS) as Array<keyof typeof LIST_KINDS>) {
		if (oldKind === listKind && sourceValue[listKind]?.vals?.[0]?.value.oneofKind === newKind) {
			return sourceValue[listKind].vals[0] as APLValue;
		}
	}

	// A comparison takes the current value as its left-hand side.
	if (newKind === 'cmp') {
		nextValue.cmp.lhs = wrapValue(oldKind, implOf(source, oldKind));
		return next;
	}

	next = wrapValue(newKind, freshImpl());
	return next;
};

const wrapAction = (kind: NonNullable<APLActionKind>, impl: unknown): APLAction =>
	APLAction.create({ action: { oneofKind: kind, [kind]: impl } as APLAction['action'] });

/** The action picker's half of the same rule: sequence <-> strictSequence, and unwrapping either. */
export const swapActionKind = (source: APLAction | undefined, newKind: NonNullable<APLActionKind>, freshImpl: () => unknown): APLAction => {
	const oldKind = source?.action.oneofKind as APLActionKind;
	const next = wrapAction(newKind, freshImpl());
	if (!source || !oldKind) return next;

	const nextAction = next.action as Record<string, any>;
	const sourceAction = source.action as Record<string, any>;
	const sequenceKinds = ['sequence', 'strictSequence'] as const;

	if (newKind === 'sequence' || newKind === 'strictSequence') {
		const other = newKind === 'sequence' ? 'strictSequence' : 'sequence';
		nextAction[newKind].actions =
			oldKind === other ? sourceAction[other].actions : [wrapAction(oldKind, (sourceAction as Record<string, unknown>)[oldKind])];
		return next;
	}

	for (const listKind of sequenceKinds) {
		if (oldKind === listKind && sourceAction[listKind]?.actions?.[0]?.action.oneofKind === newKind) {
			return sourceAction[listKind].actions[0] as APLAction;
		}
	}

	return next;
};
