import { render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
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
	const anchor = useRef<HTMLAnchorElement>(null);
	useWowheadDataset(anchor, resolve);
	return <a ref={anchor} data-testid="anchor" />;
};

const Pair = ({ resolve }: { resolve: (() => Promise<string>) | null }) => {
	const first = useRef<HTMLAnchorElement>(null);
	const second = useRef<HTMLAnchorElement>(null);
	useWowheadDataset([first, second], resolve);
	return (
		<>
			<a ref={first} className="first" />
			<a ref={second} className="second" />
		</>
	);
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

	it('clears the previous dataset before the next one resolves', async () => {
		const next = deferred();
		const { container, rerender } = render(<Probe resolve={() => Promise.resolve('item=1')} />);
		await waitFor(() => expect(anchor(container).dataset.wowhead).toBe('item=1'));

		rerender(<Probe resolve={next.resolve} />);
		expect(anchor(container).hasAttribute('data-wowhead')).toBe(false);

		next.settle('item=2');
		await waitFor(() => expect(anchor(container).dataset.wowhead).toBe('item=2'));
	});

	// The defect this hook exists to hold shut: the slow first request must not land on an element
	// whose selection has already moved on.
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

	it('writes to every element it is given', async () => {
		const { container } = render(<Pair resolve={() => Promise.resolve('spell=7')} />);

		await waitFor(() => expect(container.querySelector<HTMLElement>('.first')!.dataset.wowhead).toBe('spell=7'));
		expect(container.querySelector<HTMLElement>('.second')!.dataset.wowhead).toBe('spell=7');
	});
});
