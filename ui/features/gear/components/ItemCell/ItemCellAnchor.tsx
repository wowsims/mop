import { externalRel } from '@sim/utils/links';
import type { ComponentPropsWithRef, KeyboardEvent, MouseEvent, ReactNode } from 'react';

export interface ItemCellAnchorProps extends Omit<ComponentPropsWithRef<'a'>, 'onClick' | 'href'> {
	href?: string;
	onActivate?: () => void;
	children?: ReactNode;
}

export const ItemCellAnchor = ({ href, onActivate, children, ...rest }: ItemCellAnchorProps) => (
	<a
		{...rest}
		href={href || undefined}
		role={href ? undefined : rest.role}
		rel={externalRel(href, rest.rel)}
		tabIndex={rest.tabIndex ?? (onActivate && !href ? 0 : undefined)}
		onClick={
			onActivate &&
			((event: MouseEvent<HTMLAnchorElement>) => {
				event.preventDefault();
				onActivate();
			})
		}
		onKeyDown={
			onActivate && !href
				? (event: KeyboardEvent<HTMLAnchorElement>) => {
						if (event.key !== 'Enter' && event.key !== ' ') return;
						event.preventDefault();
						onActivate();
					}
				: undefined
		}>
		{children}
	</a>
);
