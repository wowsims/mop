export interface LocaleHtmlProps {
	html: string;
}

/**
 * Markup that came out of a locale file. The vanilla tree rendered every tooltip through tippy's
 * global `allowHTML: true`, and 58 translation strings still carry `<p>`, `<ul>` and `<br />`.
 *
 * Only ever pass `i18n.t(...)` output or a frozen spec config string. i18next runs with
 * `escapeValue: false` (`ui/i18n/config.ts:12`), so an interpolated value reaches this unescaped —
 * `Tooltip.locale-html.test.ts` fails if any HTML-bearing key gains an interpolation that is not a
 * plain number.
 */
export const LocaleHtml = ({ html }: LocaleHtmlProps) => <span dangerouslySetInnerHTML={{ __html: html }} />;
