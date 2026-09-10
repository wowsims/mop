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
	header?: ContentBlockHeaderProps;
}

export interface ContentBlockProps {
	className?: ClassValue;
	config: ContentBlockConfigProps;
	children?: ReactNode;
	headerChildren?: ReactNode;
	bodyRef?: Ref<HTMLDivElement>;
	headerRef?: Ref<HTMLDivElement>;
}

export const ContentBlock = ({ className, config, children, headerChildren, bodyRef, headerRef }: ContentBlockProps) => {
	const header = config.header;
	const hasHeader = !!header && Object.keys(header).length > 0;
	const TitleTag = (header?.titleTag || 'h6') as ElementType;

	return (
		<div className={clsx('content-block', className)}>
			{hasHeader && header && (
				<div ref={headerRef} className={clsx('content-block-header', header.className)}>
					<TitleTag className="content-block-title">
						{header.title}
						{header.tooltip && <TooltipButton tooltip={<LocaleHtml html={header.tooltip} />} className="ms-2" />}
					</TitleTag>
					{headerChildren}
				</div>
			)}
			<div ref={bodyRef} className={clsx('content-block-body', config.bodyClassName)}>
				{children}
			</div>
		</div>
	);
};
