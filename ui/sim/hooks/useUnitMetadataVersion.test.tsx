import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createSimStore, patchSlice } from '../state/sim_store';
import { useUnitMetadataVersion } from './useUnitMetadataVersion';

describe('useUnitMetadataVersion', () => {
	it('renders the version and re-renders when it bumps', () => {
		const renders = { n: 0 };
		const store = createSimStore();
		const sim = { store } as never;
		const Probe = () => {
			const version = useUnitMetadataVersion(sim);
			renders.n++;
			return <span>{version}</span>;
		};

		const { container } = render(<Probe />);
		expect(container.textContent).toBe('0');
		const afterMount = renders.n;

		act(() => patchSlice(store, 'sim', { metadataVersion: 1 }));

		expect(container.textContent).toBe('1');
		expect(renders.n).toBe(afterMount + 1);
	});

	it('does not re-render when an unrelated sim field changes', () => {
		const renders = { n: 0 };
		const store = createSimStore();
		const sim = { store } as never;
		const Probe = () => {
			useUnitMetadataVersion(sim);
			renders.n++;
			return null;
		};

		render(<Probe />);
		const afterMount = renders.n;

		act(() => patchSlice(store, 'sim', { iterations: 999 }));

		expect(renders.n).toBe(afterMount);
	});
});
