import type { Player } from '@sim/player/player';
import Toast, { ToastOptions } from '@ui-kit/toast';

export type SpecCheckWarning = {
	condition: (player: Player<any>) => boolean;
	message: string;
};

export const makeSpecChangeWarningToast = (checks: SpecCheckWarning[], player: Player<any>, options?: Partial<ToastOptions>) => {
	const messages = checks.filter(({ condition }) => condition(player)).map(({ message }) => message);
	if (!messages.length) return;

	const body = document.createDocumentFragment();
	for (const message of messages) {
		const paragraph = document.createElement('p');
		paragraph.textContent = message;
		body.appendChild(paragraph);
	}

	new Toast({ variant: 'warning', body, delay: 5000 * messages.length, ...options });
};
