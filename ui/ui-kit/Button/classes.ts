export const BASE =
	'inline-block border rounded-none text-sm leading-normal font-normal text-center align-middle no-underline cursor-pointer select-none transition-[color,background-color,border-color] duration-150 ease-in-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-65';

export const LINK_BASE =
	'p-0 border-0 rounded-none text-sm leading-normal font-normal text-center align-middle no-underline cursor-pointer select-none transition-[color,background-color,border-color] duration-150 ease-in-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-65';

export const ICON_BASE = 'border-0 bg-transparent cursor-pointer';

export const SIZE = {
	default: 'px-3 py-2',
	sm: 'px-2 py-1',
	inline: 'px-2 py-0',
	none: '',
} as const;

export const VARIANT = {
	primary:
		'bg-primary border-primary text-primary-foreground hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active active:border-primary-active data-[popup-open]:bg-primary-active data-[popup-open]:border-primary-active focus-visible:bg-primary-hover focus-visible:border-primary-hover focus-visible:shadow-focus-primary disabled:bg-primary-disabled disabled:border-primary-disabled',
	secondary:
		'bg-secondary border-secondary text-white hover:bg-secondary-hover hover:border-secondary-hover active:bg-secondary-active active:border-secondary-active focus-visible:bg-secondary-hover focus-visible:border-secondary-hover focus-visible:shadow-focus-secondary',
	danger: 'bg-danger border-danger text-white hover:bg-danger-hover hover:border-danger-hover active:bg-danger-active active:border-danger-active focus-visible:bg-danger-hover focus-visible:border-danger-hover focus-visible:shadow-focus-danger',
	cancel: 'bg-cancel border-cancel text-black hover:bg-cancel-hover hover:border-cancel-hover active:bg-cancel-active active:border-cancel-active focus-visible:bg-cancel-hover focus-visible:border-cancel-hover focus-visible:shadow-focus-cancel',
	link: 'text-link hover:text-link-hover focus-visible:shadow-focus-link disabled:text-gray-600',
	'link-danger':
		'text-link-danger hover:text-foreground focus-visible:text-foreground focus-visible:shadow-focus-link-danger disabled:text-foreground-disabled',
	'outline-primary':
		'border-primary text-primary hover:bg-primary-hover hover:border-primary-hover hover:text-primary-foreground active:bg-primary active:border-primary active:text-primary-foreground focus-visible:bg-primary-hover focus-visible:border-primary-hover focus-visible:text-primary-foreground focus-visible:shadow-focus-outline-primary disabled:text-primary disabled:border-primary',
	'outline-light':
		'border-light text-light hover:bg-light hover:border-light hover:text-black active:bg-light active:border-light active:text-black focus-visible:bg-light focus-visible:border-light focus-visible:text-black focus-visible:shadow-focus-outline-light',
	'outline-cancel':
		'border-cancel text-cancel hover:bg-cancel hover:border-cancel hover:text-black active:bg-cancel active:border-cancel active:text-black focus-visible:bg-cancel focus-visible:border-cancel focus-visible:text-black focus-visible:shadow-focus-outline-cancel',
	warning: 'text-link-warning',
} as const;
