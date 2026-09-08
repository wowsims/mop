import type { UIEnchant as Enchant } from '@generated/proto/ui';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const tooltip = vi.hoisted(() => ({ settle: new Map<number, (url: string) => void>() }));

vi.mock('@sim/proto/action_id/dom', () => ({
	actionIdWowheadTooltipData: (actionId: { spellId: number }) => new Promise<string>(resolve => tooltip.settle.set(actionId.spellId, resolve)),
}));
vi.mock('@sim/proto/enchants', () => ({ getEnchantDescription: async (enchant: Enchant) => enchant.name }));

const { EnchantLabel } = await import('./EnchantLabel');

const enchant = (spellId: number) => ({ spellId, itemId: 0, effectId: spellId, name: `Enchant ${spellId}`, type: 0, quality: 4 }) as unknown as Enchant;

describe('EnchantLabel', () => {
	const anchor = (container: HTMLElement) => container.querySelector<HTMLAnchorElement>('a')!;

	it('shows the tooltip its enchant resolved to', async () => {
		const { container } = render(<EnchantLabel className="item-picker-enchant" enchant={enchant(10)} />);

		tooltip.settle.get(10)!('spell=10');
		await waitFor(() => expect(anchor(container).dataset.wowhead).toBe('spell=10'));
	});

	// The defect: a tooltip request for the enchant that was in the slot a moment ago must not
	// land on the label after the slot moved on.
	it('drops a tooltip that resolved after the enchant changed', async () => {
		const { container, rerender } = render(<EnchantLabel className="item-picker-enchant" enchant={enchant(1)} />);

		rerender(<EnchantLabel className="item-picker-enchant" enchant={enchant(2)} />);
		expect(anchor(container).hasAttribute('data-wowhead')).toBe(false);

		tooltip.settle.get(2)!('spell=2');
		await waitFor(() => expect(anchor(container).dataset.wowhead).toBe('spell=2'));

		tooltip.settle.get(1)!('spell=1');
		await Promise.resolve();
		await Promise.resolve();
		expect(anchor(container).dataset.wowhead).toBe('spell=2');
	});
});
