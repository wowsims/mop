import i18n from '@i18n/config';
import { createElement, type ReactElement } from 'react';
import { Trans } from 'react-i18next';

export interface LocaleHtmlProps {
	html: string;
}

const OPENING_TAG = /<([a-zA-Z][a-zA-Z0-9-]*)/g;

const componentsIn = (html: string): Record<string, ReactElement> => {
	const components: Record<string, ReactElement> = {};
	for (const [, name] of html.matchAll(OPENING_TAG)) components[name] ??= createElement(name);
	return components;
};

/**
 * Markup that came out of a locale file: pass `i18n.t(...)` output or a frozen spec config string, never
 * anything else. Each tag becomes a React element carrying the locale's own attributes; a tag that cannot
 * be resolved renders as text, so an interpolated value can never become markup.
 */
export const LocaleHtml = ({ html }: LocaleHtmlProps) => (
	<Trans i18n={i18n} defaults={html} components={componentsIn(html)} tOptions={{ nsSeparator: false, keySeparator: false }} />
);
