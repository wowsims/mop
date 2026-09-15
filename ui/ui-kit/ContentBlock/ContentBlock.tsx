import { LocaleHtml } from '@ui-kit/Tooltip';
import { TooltipButton } from '@ui-kit/TooltipButton';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ElementType, ReactNode, Ref } from 'react';

export interface ContentBlockHeaderProps {
	title: string;
	className?: ClassValue;
	titleTag?: string;
	tooltip?: string;
}

export interface ContentBlockConfigProps {
	bodyClassName?: ClassValue;
	/** For a block whose body would be empty: the body element is not rendered at all. */
	withoutBody?: boolean;
	header?: ContentBlockHeaderProps;
}

export interface ContentBlockProps {
	className?: ClassValue;
	config: ContentBlockConfigProps;
	children?: ReactNode;
	headerChildren?: ReactNode;
	bodyRef?: Ref<HTMLDivElement>;
	headerRef?: Ref<HTMLDivElement>;
	flush?: boolean;
	testId?: string;
	rootDataAttributes?: Record<string, string>;
}

export const ContentBlock = ({
	className,
	config,
	children,
	headerChildren,
	bodyRef,
	headerRef,
	flush,
	testId = 'content-block',
	rootDataAttributes,
}: ContentBlockProps) => {
	const header = config.header;
	const hasHeader = !!header && Object.keys(header).length > 0;
	const TitleTag = (header?.titleTag || 'h6') as ElementType;

	return (
		<div className={clsx('ui-content-block', className, flush && 'mb-0', 'flex flex-col')} data-testid={testId} {...rootDataAttributes}>
			{hasHeader && header && (
				<div ref={headerRef} className={clsx('ui-content-block-header flex items-baseline gap-2', header.className)} data-testid="content-block-header">
					<TitleTag className="mb-0 flex items-center font-bold" data-testid="content-block-title">
						{header.title}
						{header.tooltip && <TooltipButton tooltip={<LocaleHtml html={header.tooltip} />} className="ml-2" />}
					</TitleTag>
					{headerChildren}
				</div>
			)}
			{!config.withoutBody && (
				<div ref={bodyRef} className={clsx('ui-content-block-body flex-col', config.bodyClassName)} data-testid="content-block-body">
					{children}
				</div>
			)}
		</div>
	);
};
