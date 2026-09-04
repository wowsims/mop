// Automatic-runtime entry point for the tsx-vanilla files that have not been ported to React yet.
//
// React owns the global JSX config (`jsx: react-jsx`, `jsxImportSource: react`). Files still
// rendering real DOM nodes opt out with `/** @jsxImportSource @jsx-vanilla */`, which routes their
// JSX here instead.
//
// tsx-vanilla's `element(type, props, ...children)` already accepts children inside `props`:
// intrinsic tags prefer `props.children` over the varargs and never assign it as a DOM property
// (it is in the library's `specialProps` set), and the component branch passes `props` straight
// through when no varargs are present. So the automatic runtime maps onto it with no adaptation.
//
// This module deliberately exports no `JSX` namespace: TypeScript then falls back to the global one,
// which tsx-vanilla declares. React files get React's own module-scoped namespace instead.
import { element, fragment } from 'tsx-vanilla';

export const Fragment = fragment;

export const jsx = (type: unknown, props: unknown): unknown => (element as (t: unknown, p: unknown) => unknown)(type, props);

export const jsxs = jsx;
