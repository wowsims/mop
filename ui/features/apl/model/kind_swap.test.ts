import { APLAction, APLValue } from '@generated/proto/apl';
import { describe, expect, it } from 'vitest';

import { swapActionKind, swapValueKind } from './kind_swap';

const value = (kind: string, impl: unknown = {}): APLValue =>
	APLValue.create({ value: { oneofKind: kind, [kind]: impl } as APLValue['value'], uuid: { value: 'uuid-' + kind } });

const kindOf = (result: APLValue) => result.value.oneofKind;
const impl = (result: APLValue) => (result.value as Record<string, any>)[result.value.oneofKind as string];

describe('swapValueKind', () => {
	it('makes a fresh value when there is nothing to carry over', () => {
		const result = swapValueKind(undefined, 'const', () => ({ val: '' }));

		expect(kindOf(result)).toBe('const');
		expect(impl(result)).toEqual({ val: '' });
		expect(result.uuid?.value).toBeTruthy();
	});

	it('wraps the current value when the new kind is a negation', () => {
		const result = swapValueKind(value('const', { val: '5' }), 'not', () => ({ val: undefined }));

		expect(kindOf(result)).toBe('not');
		expect(kindOf(impl(result).val)).toBe('const');
		expect(impl(impl(result).val)).toEqual({ val: '5' });
	});

	// `APLValue.create` copies what it is handed, so identity is asserted against the message read
	// back out of the built fixture — which is the object the live rotation tree actually holds.
	it('unwraps a negation when the new kind is what it held', () => {
		const negation = value('not', { val: value('const', { val: '5' }) });
		const inner = (negation.value as Record<string, any>).not.val;

		expect(swapValueKind(negation, 'const', () => ({ val: '' }))).toBe(inner);
	});

	it('makes the current value the first operand of a new list kind', () => {
		const result = swapValueKind(value('const', { val: '5' }), 'and', () => ({ vals: [] }));

		expect(kindOf(result)).toBe('and');
		expect(impl(result).vals).toHaveLength(1);
		expect(kindOf(impl(result).vals[0])).toBe('const');
	});

	it('carries the operand list across the four paired list kinds', () => {
		for (const [from, to] of [
			['and', 'or'],
			['or', 'and'],
			['min', 'max'],
			['max', 'min'],
		]) {
			const source = value(from, { vals: [value('const', { val: '1' }), value('const', { val: '2' })] });
			const operands = (source.value as Record<string, any>)[from].vals;
			const result = swapValueKind(source, to as never, () => ({ vals: [] }));

			expect(kindOf(result)).toBe(to);
			expect(impl(result).vals).toBe(operands);
		}
	});

	it('does not carry a list across an unpaired pair', () => {
		const operands = [value('const', { val: '1' })];
		const result = swapValueKind(value('and', { vals: operands }), 'min', () => ({ vals: [] }));

		expect(kindOf(result)).toBe('min');
		// The whole `and` becomes min's single operand rather than min adopting and's operands.
		expect(impl(result).vals).toHaveLength(1);
		expect(kindOf(impl(result).vals[0])).toBe('and');
	});

	it('keeps a list kind’s first operand when the new kind is that operand’s kind', () => {
		for (const listKind of ['and', 'or', 'min', 'max']) {
			const source = value(listKind, { vals: [value('const', { val: '1' }), value('math')] });
			const first = (source.value as Record<string, any>)[listKind].vals[0];

			expect(swapValueKind(source, 'const', () => ({ val: '' }))).toBe(first);
		}
	});

	it('promotes the current value into a comparison’s left-hand side', () => {
		const result = swapValueKind(value('const', { val: '5' }), 'cmp', () => ({ op: 0 }));

		expect(kindOf(result)).toBe('cmp');
		expect(kindOf(impl(result).lhs)).toBe('const');
	});

	it('falls back to a fresh value when no rule applies', () => {
		const result = swapValueKind(value('const', { val: '5' }), 'math', () => ({ op: 1 }));

		expect(kindOf(result)).toBe('math');
		expect(impl(result)).toEqual({ op: 1 });
	});
});

const action = (kind: string, impl: unknown = {}): APLAction =>
	APLAction.create({ action: { oneofKind: kind, [kind]: impl } as APLAction['action'] });

const actionKind = (result: APLAction) => result.action.oneofKind;
const actionImpl = (result: APLAction) => (result.action as Record<string, any>)[result.action.oneofKind as string];

describe('swapActionKind', () => {
	it('makes a fresh action when there is nothing to carry over', () => {
		expect(actionKind(swapActionKind(undefined, 'castSpell', () => ({})))).toBe('castSpell');
	});

	it('makes the current action the first step of a new sequence', () => {
		const result = swapActionKind(action('castSpell', { spellId: {} }), 'sequence', () => ({ actions: [] }));

		expect(actionKind(result)).toBe('sequence');
		expect(actionImpl(result).actions).toHaveLength(1);
		expect(actionKind(actionImpl(result).actions[0])).toBe('castSpell');
	});

	it('carries the steps between the two sequence kinds', () => {
		for (const [from, to] of [
			['sequence', 'strictSequence'],
			['strictSequence', 'sequence'],
		] as const) {
			const source = action(from, { actions: [action('castSpell'), action('wait')] });
			const steps = (source.action as Record<string, any>)[from].actions;

			expect(actionImpl(swapActionKind(source, to, () => ({ actions: [] }))).actions).toBe(steps);
		}
	});

	it('keeps a sequence’s first step when the new kind is that step’s kind', () => {
		for (const listKind of ['sequence', 'strictSequence']) {
			const source = action(listKind, { actions: [action('castSpell', { spellId: {} }), action('wait')] });
			const first = (source.action as Record<string, any>)[listKind].actions[0];

			expect(swapActionKind(source, 'castSpell', () => ({}))).toBe(first);
		}
	});

	it('falls back to a fresh action when no rule applies', () => {
		const result = swapActionKind(action('castSpell', { spellId: {} }), 'wait', () => ({ duration: {} }));

		expect(actionKind(result)).toBe('wait');
		// `create` fills the nested message out, so only the shape of the fresh impl is asserted.
		expect(actionImpl(result)).toHaveProperty('duration');
	});
});
