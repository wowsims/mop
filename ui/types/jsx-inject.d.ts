// Vite injects `import { element, fragment } from 'tsx-vanilla'` into every module
// at build time (see oxc.jsxInject in vite.config.mts), so both names are always
// in scope. This mirrors that for the type-checker.
import type { element as jsxElement, fragment as jsxFragment } from 'tsx-vanilla';

declare global {
	const element: typeof jsxElement;
	const fragment: typeof jsxFragment;
}

export {};
