import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar';
import type { ButtonProps } from '@ui-kit/Button';
import { Button } from '@ui-kit/Button';

export type ToolbarButtonProps = ButtonProps & {
	testId?: string;
	focusableWhenDisabled?: boolean;
};

export const ToolbarButton = ({ testId, focusableWhenDisabled, ...buttonProps }: ToolbarButtonProps) => (
	<BaseToolbar.Button
		disabled={'disabled' in buttonProps ? buttonProps.disabled : undefined}
		focusableWhenDisabled={focusableWhenDisabled}
		render={<Button {...buttonProps} />}
		data-testid={testId}
	/>
);
