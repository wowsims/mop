// Which deployment this page is running as.

export type Environments = 'local' | 'external';

// Pure classification of a hostname. The browser probe that reads the actual
// page hostname lives in ui/ui-kit/utils/dom.ts; anything with an `Env` in hand
// (e.g. Sim) passes `env.location.hostname` here instead.
export const environmentOf = (hostname: string): Environments => (hostname.includes('localhost') ? 'local' : 'external');
export const isDevMode = () => {
	return import.meta.env.DEV;
};
