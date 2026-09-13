import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useWowheadDataset } from './useWowheadDataset';

const deferred = () => {
	let settle: (url: string) => void = () => {};
	const promise = new Promise<string>(resolve => {
		settle = resolve;
	});
	return { resolve: () => promise, settle };
};

const Probe = ({ resolve }: { resolve: (() => Promise<string>) | null }) => {
	const wowhead = useWowheadDataset(resolve);
	return <a data-testid="anchor" {...wowhead} />;
};

const anchor = (container: HTMLElement) => container.querySelector('a')!;

describe('useWowheadDataset', () => {
	it('writes the resolved dataset onto the element', async () => {
		const { container } = render(<Probe resolve={() => Promise.resolve('item=1')} />);

		await waitFor(() => expect(anchor(container).dataset.wowhead).toBe('item=1'));
	});

	it('writes nothing when there is nothing to show', async () => {
		const { container } = render(<Probe resolve={null} />);

		await Promise.resolve();
		expect(anchor(container).hasAttribute('data-wowhead')).toBe(false);
	});

	it('clears the previous dataset in the same render the subject changes', async () => {
		const next = deferred();
		const { container, rerender } = render(<Probe resolve={() => Promise.resolve('item=1')} />);
		await waitFor(() => expect(anchor(container).dataset.wowhead).toBe('item=1'));

		rerender(<Probe resolve={next.resolve} />);
		expect(anchor(container).hasAttribute('data-wowhead')).toBe(false);

		next.settle('item=2');
		await waitFor(() => expect(anchor(container).dataset.wowhead).toBe('item=2'));
	});

	it('drops a resolution that lost the race to a newer one', async () => {
		const slow = deferred();
		const fast = deferred();
		const { container, rerender } = render(<Probe resolve={slow.resolve} />);

		rerender(<Probe resolve={fast.resolve} />);
		fast.settle('item=new');
		await waitFor(() => expect(anchor(container).dataset.wowhead).toBe('item=new'));

		slow.settle('item=old');
		await Promise.resolve();
		await Promise.resolve();
		expect(anchor(container).dataset.wowhead).toBe('item=new');
	});
});
