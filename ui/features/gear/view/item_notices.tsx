/** @jsxImportSource @jsx-vanilla */
import { createElement, Fragment, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
// The one place a root is created outside the shell, and it is a shim, not an island: a throwaway
// root that renders static markup once and unmounts before this returns. It dies with the vanilla
// `ItemNotice` that needs DOM.
// eslint-disable-next-line no-restricted-imports
import { createRoot } from 'react-dom/client';

export {
	GENERIC_MISSING_SET_BONUS_NOTICE_DATA,
	ITEM_NOTICES,
	MISSING_RANDOM_SUFFIX_WARNING,
	registerSetBonusNotices,
	SET_BONUS_NOTICES,
	type ItemNoticeData,
	type SetBonusNoticeData,
} from '../item_notices';

// The notice bodies are React; the vanilla `ItemNotice` hands its content to tippy, which takes DOM.
// They are static markup with no state or handlers, so one synchronous render is the whole bridge:
// mount a throwaway root, copy what it produced, unmount it again. Nothing outlives the call, which
// is what the vanilla side needs — `item_list.tsx:495` builds an `ItemNotice` per row and never
// disposes it, so a root kept alive here would leak one per row per list render.
// `react-dom/server` would express this in one line and cost 57 kB gzipped in the entry chunk.
//
// Call this from an event or from plain code, never from a React commit — an effect, a layout effect
// or a ref callback. `flushSync` is a no-op there, so the render is only scheduled and this returns
// an empty fragment; dev logs a warning and production logs nothing at all. `item_notice.tsx` builds
// its fragment in tippy's `onShow` for exactly that reason.
export const noticeElement = (...notices: ReadonlyArray<ReactNode>): DocumentFragment => {
	const host = document.createElement('div');
	const root = createRoot(host);
	flushSync(() => root.render(createElement(Fragment, null, ...notices)));

	const fragment = document.createDocumentFragment();
	fragment.append(...[...host.childNodes].map(node => node.cloneNode(true)));
	root.unmount();
	return fragment;
};
