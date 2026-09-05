// Automatic-runtime entry point for files carrying `/** @jsxImportSource @jsx-vanilla */`.
// tsx-vanilla's `element` already accepts children inside `props`, so no adaptation is needed.
// Exports no `JSX` namespace on purpose — TypeScript then uses the global one tsx-vanilla declares.
import { element, fragment } from 'tsx-vanilla';

export const Fragment = fragment;

export const jsx = (type: unknown, props: unknown): unknown => (element as (t: unknown, p: unknown) => unknown)(type, props);

export const jsxs = jsx;
