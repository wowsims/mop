// Cross-origin links get rel="noopener noreferrer" here: noopener stops the opened page reaching window.opener.
const EXTERNAL_REL = ['noopener', 'noreferrer'];

/** Absolute http(s) or protocol-relative. Not an origin check: ui/domain may not read location, and every internal link here is relative. */
export const isExternalHref = (href: string | undefined): boolean => {
	if (!href) return false;
	if (href.startsWith('//')) return true;
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1].toLowerCase();
	return scheme === 'http' || scheme === 'https';
};

export const externalRel = (href: string | undefined, rel: string | undefined): string | undefined => {
	if (!isExternalHref(href)) return rel;
	const tokens = rel ? rel.split(/\s+/).filter(Boolean) : [];
	EXTERNAL_REL.forEach(token => {
		if (!tokens.includes(token)) tokens.push(token);
	});
	return tokens.join(' ');
};

export const setExternalAwareHref = (elem: HTMLAnchorElement, href: string) => {
	elem.href = href;
	const rel = externalRel(href, elem.getAttribute('rel') ?? undefined);
	if (rel) elem.setAttribute('rel', rel);
};
