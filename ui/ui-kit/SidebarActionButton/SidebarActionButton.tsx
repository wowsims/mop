import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import { type MouseEvent, type ReactNode, useContext } from 'react';

import { SidebarDisabledContext } from './sidebar_disabled';

export interface SidebarActionButtonProps {
	children: ReactNode;
	className?: string;
	onClick: (event: MouseEvent<HTMLButtonElement>) => void;
	disabled?: boolean;
	loading?: boolean;
}

export const SidebarActionButton = ({ children, className, onClick, disabled, loading }: SidebarActionButtonProps) => {
	const sidebarDisabled = useContext(SidebarDisabledContext);

	return (
		<Button
			variant="unstyled"
			className={clsx('btn btn-primary sim-sidebar-action-button w-full', className, loading && 'loading')}
			onClick={onClick}
			disabled={disabled || sidebarDisabled}
			aria-busy={loading || undefined}>
			{children}
			<span className="sim-sidebar-action-button-loading-icon">
				<Icon name="spinner" spin />
			</span>
		</Button>
	);
};
