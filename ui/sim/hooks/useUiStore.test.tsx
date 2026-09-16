import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SimHostProvider } from '../context/SimHostContext';
import { createSimStore, patchSlice } from '../state/sim_store';
import { useUiStore } from './useUiStore';

const mount = (children: ReactNode) => {
	const store = createSimStore();
	const host = { sim: { store } } as never;
	return { store, ...render(<SimHostProvider host={host}>{children}</SimHostProvider>) };
};

describe('useUiStore', () => {
	it('renders the field value and re-renders when it changes', () => {
		const renders = { n: 0 };
		const Probe = () => {
			const showEPValues = useUiStore('showEPValues');
			renders.n++;
			return <span>{String(showEPValues)}</span>;
		};

		const { store, container } = mount(<Probe />);
		expect(container.textContent).toBe('false');
		const afterMount = renders.n;

		act(() => patchSlice(store, 'ui', { showEPValues: true }));

		expect(container.textContent).toBe('true');
		expect(renders.n).toBe(afterMount + 1);
	});

	it('does not re-render when another ui field changes', () => {
		const renders = { n: 0 };
		const Probe = () => {
			useUiStore('showEPValues');
			renders.n++;
			return null;
		};

		const { store } = mount(<Probe />);
		const afterMount = renders.n;

		act(() => patchSlice(store, 'ui', { showQuickSwap: false }));

		expect(renders.n).toBe(afterMount);
	});
});
