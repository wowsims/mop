// Anything that leaves this origin gets `rel="noopener noreferrer"` — from `Button` on the React
// side and from the `@jsx-vanilla` runtime on the vanilla side, so no call site has to remember it. `noopener` is the security half: a target="_blank" link without it hands the
// opened page a live `window.opener` reference back into this one.
const EXTERNAL_REL = ['noopener', 'noreferrer'];

/**
 * True for an absolute http(s) URL, and for a protocol-relative `//host`.
 *
 * Deliberately not an origin comparison: this module is in `ui/domain`, which may not touch DOM
 * globals, so there is no `location` to compare against. It does not need one — every internal link
 * in this app is relative (`/mop/warrior/arms/`, `#gear-tab`) and every absolute http(s) URL it
 * emits points at wowhead, github or discord. An absolute same-origin URL would pick up a `rel` it
 * does not need, which costs nothing.
 *
 * Fragments and non-http schemes are not external: `mailto:` and `tel:` open no browsing context,
 * and `javascript:void(0)` is how an unstyled anchor-shaped control spells "no navigation".
 */
export const isExternalHref = (href: string | undefined): boolean => {
	if (!href) return false;
	if (href.startsWith('//')) return true;
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1].toLowerCase();
	return scheme === 'http' || scheme === 'https';
};

/** Merges the caller's `rel` with the external tokens, preserving order and dropping duplicates. */
export const externalRel = (href: string | undefined, rel: string | undefined): string | undefined => {
	if (!isExternalHref(href)) return rel;
	const tokens = rel ? rel.split(/\s+/).filter(Boolean) : [];
	EXTERNAL_REL.forEach(token => {
		if (!tokens.includes(token)) tokens.push(token);
	});
	return tokens.join(' ');
};

/** Sets `href` on an anchor and keeps its `rel` correct for a cross-origin target. */
export const setExternalAwareHref = (elem: HTMLAnchorElement, href: string) => {
	elem.href = href;
	const rel = externalRel(href, elem.getAttribute('rel') ?? undefined);
	if (rel) elem.setAttribute('rel', rel);
};
