import type { Component } from '@ui-kit/component';
import { useCallback, useRef } from 'react';

/**
 * Constructs not-yet-ported `Component`s **directly into** a React-rendered element, as a ref
 * callback. `LegacyHost` renders a wrapper div of its own, which is fine in isolation but changes
 * the pane's DOM — and a tab body is exactly where `panes-parity.mjs` compares this branch against
 * the parent one element for element. Here the React element is the parent, so the tree is the
 * shape vanilla built.
 *
 * The element must have no React children: React does not diff the childNodes of an element it
 * rendered empty, which is what makes handing it to a vanilla constructor safe.
 *
 * Cleanup runs when the element detaches (React 19 ref callbacks may return one), disposing in
 * reverse order and detaching each root — `dispose()` tears down children and callbacks but leaves
 * `rootElem` in the DOM.
 */
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
