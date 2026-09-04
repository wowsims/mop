// Which deployment this page is running as.

export function isRightClick(event: MouseEvent): boolean {
	return event.button == 2;
}

// Converts from '#ffffff' --> 'rgba(255, 255, 255, alpha)'
export type Environments = 'local' | 'external';

// Pure classification of a hostname. The browser probe that reads the actual
// page hostname lives in ui/ui-kit/dom_utils.ts; anything with an `Env` in hand
// (e.g. Sim) passes `env.location.hostname` here instead.
export const environmentOf = (hostname: string): Environments => (hostname.includes('localhost') ? 'local' : 'external');
export const isDevMode = () => {
	return import.meta.env.DEV;
};
