import type { ContentBlockConfig } from '@ui-kit/content_block';
import { TooltipButton } from '@ui-kit/TooltipButton';
import clsx from 'clsx';
import type { ElementType, ReactNode, Ref } from 'react';

export interface ContentBlockProps {
	/** Positional in the vanilla constructor: layered onto `content-block` before `extraCssClasses`. */
	cssClass: string;
	config: ContentBlockConfig;
	children?: ReactNode;
	/** Rendered after the title, inside the header — where the four call sites that append into
	 * `headerElement` (a description paragraph, the gear summaries' reset button) put their nodes. */
	headerChildren?: ReactNode;
	bodyRef?: Ref<HTMLDivElement>;
	headerRef?: Ref<HTMLDivElement>;
}

/**
 * Ports `ui/ui-kit/content_block.tsx`. Parameterises `cssClass`, `config` (the same shape the
 * vanilla constructor takes) and `children`, which is React content for the body; fixes the
 * two-div `content-block-header`/`content-block-body` markup and the header-only-when-non-empty
 * rule (`config.header && Object.keys(config.header).length` — an empty `{}` renders no header).
 *
 * The header tooltip is HTML, because the vanilla `TooltipButton` passes `allowHTML: true` and five
 * of the eight shipped header tooltips are translation strings containing `<strong>` or `<br>`.
 * The content comes from `assets/locales/*\/translation.json`, not from anything a user types.
 *
 * Every current call site is still vanilla and reaches `bodyElement`/`headerElement` imperatively
 * after construction (~40 sites; two of them subclass `ContentBlock`, which this port does not
 * carry forward — composition only). `bodyRef`/`headerRef` are the transition shape for that: they
 * hand back the same two DOM nodes as `.current`, so a vanilla `Component` or a `LegacyHost` island
 * can still be mounted into a React `ContentBlock`'s body exactly as it is mounted into the vanilla
 * one today.
 *
 * `config.rootElem` is ignored: it exists so the vanilla `Component` can adopt an element that
 * already exists, which React does not do. No call site passes one.
 */
export const ContentBlock = ({ cssClass, config, children, headerChildren, bodyRef, headerRef }: ContentBlockProps) => {
	const header = config.header;
	const hasHeader = !!header && Object.keys(header).length > 0;
	const TitleTag = (header?.titleTag || 'h6') as ElementType;

	return (
		<div className={clsx('content-block', cssClass, config.extraCssClasses)}>
			{hasHeader && header && (
				<div ref={headerRef} className={clsx('content-block-header', header.extraCssClasses)}>
					<TitleTag className="content-block-title">
						{header.title}
						{header.tooltip && <TooltipButton tooltip={<span dangerouslySetInnerHTML={{ __html: header.tooltip }} />} className="ms-2" />}
					</TitleTag>
					{headerChildren}
				</div>
			)}
			<div ref={bodyRef} className={clsx('content-block-body', config.bodyClasses)}>
				{children}
			</div>
		</div>
	);
};
