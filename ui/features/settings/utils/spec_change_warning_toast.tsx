import type { Player } from '@sim/player/player';
import { toastManager, type ToastOptions } from '@ui-kit/Toast';

export type SpecCheckWarning = {
	condition: (player: Player<any>) => boolean;
	message: string;
};

export const makeSpecChangeWarningToast = (checks: SpecCheckWarning[], player: Player<any>, options?: Partial<ToastOptions>) => {
	const messages = checks.filter(({ condition }) => condition(player)).map(({ message }) => message);
	if (!messages.length) return;

	const body = messages.map((message, index) => <p key={index}>{message}</p>);

	toastManager.add({ variant: 'warning', body, delay: 5000 * messages.length, ...options });
};
