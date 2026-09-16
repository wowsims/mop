import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SimHostProvider } from '../context/SimHostContext';
import { createSimStore, patchSlice } from '../state/sim_store';
import { useSimStore } from './useSimStore';

const mount = (children: ReactNode) => {
	const store = createSimStore();
	const host = { sim: { store } } as never;
	return { store, ...render(<SimHostProvider host={host}>{children}</SimHostProvider>) };
};

describe('useSimStore', () => {
	it('renders the field value and re-renders when it changes', () => {
		const renders = { n: 0 };
		const Probe = () => {
			const phase = useSimStore('phase');
			renders.n++;
			return <span>{phase}</span>;
		};

		const { store, container } = mount(<Probe />);
		const initial = container.textContent;
		const afterMount = renders.n;

		act(() => patchSlice(store, 'sim', { phase: Number(initial) + 1 }));

		expect(container.textContent).toBe(String(Number(initial) + 1));
		expect(renders.n).toBe(afterMount + 1);
	});

	it('does not re-render when another sim field changes', () => {
		const renders = { n: 0 };
		const Probe = () => {
			useSimStore('phase');
			renders.n++;
			return null;
		};

		const { store } = mount(<Probe />);
		const afterMount = renders.n;

		act(() => patchSlice(store, 'sim', { iterations: 999 }));

		expect(renders.n).toBe(afterMount);
	});
});
