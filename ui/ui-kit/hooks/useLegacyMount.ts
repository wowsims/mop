import type { Component } from '@ui-kit/component';
import { useCallback, useRef } from 'react';

/** Constructs not-yet-ported `Component`s **directly into** a React-rendered element, as a ref callback. */
export const useLegacyMount = (create: (parent: HTMLElement) => Component | Array<Component> | void, deps: ReadonlyArray<unknown> = []) => {
	// Held in a ref so only `deps` decides when the components are rebuilt.
	const createRef = useRef(create);
	createRef.current = create;

	return useCallback((parent: HTMLElement | null) => {
		if (!parent) return;
		const made = createRef.current(parent);
		const components = Array.isArray(made) ? made : made ? [made] : [];
		return () => {
			for (const component of [...components].reverse()) {
				component.dispose();
				component.rootElem.remove();
			}
		};
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, deps);
};
