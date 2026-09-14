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
	rootDataAttributes?: Record<string, string>;
}

export const ContentBlock = ({ className, config, children, headerChildren, bodyRef, headerRef, flush, rootDataAttributes }: ContentBlockProps) => {
	const header = config.header;
	const hasHeader = !!header && Object.keys(header).length > 0;
	const TitleTag = (header?.titleTag || 'h6') as ElementType;

	return (
		<div
			className={clsx('content-block ui-content-block', className, flush && 'mb-0', 'flex flex-col')}
			data-testid="content-block"
			{...rootDataAttributes}>
			{hasHeader && header && (
				<div
					ref={headerRef}
					className={clsx('content-block-header ui-content-block-header flex items-baseline gap-2', header.className)}
					data-testid="content-block-header">
					<TitleTag className="content-block-title flex items-center font-bold mb-0" data-testid="content-block-title">
						{header.title}
						{header.tooltip && <TooltipButton tooltip={<LocaleHtml html={header.tooltip} />} className="ml-2" />}
					</TitleTag>
					{headerChildren}
				</div>
			)}
			{!config.withoutBody && (
				<div ref={bodyRef} className={clsx('content-block-body ui-content-block-body flex-col', config.bodyClassName)} data-testid="content-block-body">
					{children}
				</div>
			)}
		</div>
	);
};
