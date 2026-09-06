import type { ContentBlockConfig } from '@ui-kit/content_block';
import { TooltipButton } from '@ui-kit/TooltipButton';
import clsx from 'clsx';
import type { ElementType, ReactNode, Ref } from 'react';

export interface ContentBlockProps {
	cssClass: string;
	config: ContentBlockConfig;
	children?: ReactNode;
	headerChildren?: ReactNode;
	bodyRef?: Ref<HTMLDivElement>;
	headerRef?: Ref<HTMLDivElement>;
}

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
