// Automatic-runtime entry point for files carrying `/** @jsxImportSource @jsx-vanilla */`.
// tsx-vanilla's `element` already accepts children inside `props`, so no adaptation is needed.
// Exports no `JSX` namespace on purpose — TypeScript then uses the global one tsx-vanilla declares.
import { externalRel } from '@domain/links';
import { element, fragment } from 'tsx-vanilla';

export const Fragment = fragment;

const withExternalRel = (type: unknown, props: unknown): unknown => {
	if (type !== 'a' || props == null || typeof props !== 'object') return props;
	const { href, rel } = props as { href?: unknown; rel?: unknown };
	if (typeof href !== 'string') return props;
	const merged = externalRel(href, typeof rel === 'string' ? rel : undefined);
	return merged === rel ? props : { ...props, rel: merged };
};

export const jsx = (type: unknown, props: unknown): unknown => (element as (t: unknown, p: unknown) => unknown)(type, withExternalRel(type, props));

export const jsxs = jsx;
