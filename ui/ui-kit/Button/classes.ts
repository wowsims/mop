export const BASE =
	'inline-block px-3 py-2 border border-transparent rounded-none text-[length:var(--text-sm)] leading-normal font-normal text-center align-middle no-underline cursor-pointer select-none transition-[color,background-color,border-color] duration-150 ease-in-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-65';

export const LINK_BASE =
	'p-0 border-0 rounded-none text-[length:var(--text-sm)] leading-normal font-normal text-center align-middle no-underline cursor-pointer select-none transition-[color,background-color,border-color] duration-150 ease-in-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-65';

export const SIZE = {
	sm: 'px-2 py-1',
	inline: 'px-2 py-0',
} as const;

export const VARIANT = {
	primary:
		'bg-primary border-primary text-primary-foreground hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active active:border-primary-active data-[popup-open]:bg-primary-active data-[popup-open]:border-primary-active focus-visible:bg-primary-hover focus-visible:border-primary-hover focus-visible:shadow-[0_0_0_0.25rem_rgba(49,132,253,0.5)] disabled:bg-primary-disabled disabled:border-primary-disabled',
	secondary:
		'bg-secondary border-secondary text-white hover:bg-secondary-hover hover:border-secondary-hover active:bg-secondary-active active:border-secondary-active focus-visible:bg-secondary-hover focus-visible:border-secondary-hover focus-visible:shadow-[0_0_0_0.25rem_rgba(130,138,144,0.5)]',
	danger: 'bg-danger border-danger text-white hover:bg-danger-hover hover:border-danger-hover active:bg-danger-active active:border-danger-active focus-visible:bg-danger-hover focus-visible:border-danger-hover focus-visible:shadow-[0_0_0_0.25rem_rgba(225,83,97,0.5)]',
	cancel: 'bg-cancel border-cancel text-black hover:bg-cancel-hover hover:border-cancel-hover active:bg-cancel-active active:border-cancel-active focus-visible:bg-cancel-hover focus-visible:border-cancel-hover focus-visible:shadow-[0_0_0_0.25rem_rgba(196,109,87,0.5)]',
	link: 'text-link hover:text-link-hover focus-visible:shadow-[0_0_0_0.25rem_rgba(165,177,214,0.5)] disabled:text-gray-600',
	'link-danger':
		'text-link-danger hover:text-foreground focus-visible:text-foreground focus-visible:shadow-[0_0_0_0.25rem_rgba(239,158,170,0.5)] disabled:text-foreground-disabled',
	'outline-primary':
		'border-primary text-primary hover:bg-primary-hover hover:border-primary-hover hover:text-primary-foreground active:bg-primary-active active:border-primary-active active:text-primary-foreground focus-visible:bg-primary-hover focus-visible:border-primary-hover focus-visible:text-primary-foreground focus-visible:shadow-[0_0_0_0.25rem_rgba(13,110,253,0.5)] disabled:text-primary disabled:border-primary',
	'outline-light':
		'border-light text-light hover:bg-light hover:border-light hover:text-black active:bg-light active:border-light active:text-black focus-visible:bg-light focus-visible:border-light focus-visible:text-black focus-visible:shadow-[0_0_0_0.25rem_rgba(248,249,250,0.5)]',
	'outline-cancel':
		'border-cancel text-cancel hover:bg-cancel hover:border-cancel hover:text-black active:bg-cancel active:border-cancel active:text-black focus-visible:bg-cancel focus-visible:border-cancel focus-visible:text-black focus-visible:shadow-[0_0_0_0.25rem_rgba(230,128,102,0.5)]',
} as const;
