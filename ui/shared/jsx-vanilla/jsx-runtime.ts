// Automatic-runtime entry point for files carrying `/** @jsxImportSource @jsx-vanilla */`.
// tsx-vanilla's `element` already accepts children inside `props`, so no adaptation is needed.
// Exports no `JSX` namespace on purpose — TypeScript then uses the global one tsx-vanilla declares.
import { externalRel } from '@domain/links';
import { element, fragment } from 'tsx-vanilla';

export const Fragment = fragment;

// Cross-origin anchors get `rel="noopener noreferrer"` here, which is the only seam the whole
// vanilla stack shares — the alternative is remembering it at ~220 hand-written `<a href>` sites.
// The React side does the same in `Button`. This goes away with the shim itself in Phase 5.
const withExternalRel = (type: unknown, props: unknown): unknown => {
	if (type !== 'a' || props == null || typeof props !== 'object') return props;
	const { href, rel } = props as { href?: unknown; rel?: unknown };
	if (typeof href !== 'string') return props;
	const merged = externalRel(href, typeof rel === 'string' ? rel : undefined);
	return merged === rel ? props : { ...props, rel: merged };
};

export const jsx = (type: unknown, props: unknown): unknown => (element as (t: unknown, p: unknown) => unknown)(type, withExternalRel(type, props));

export const jsxs = jsx;
