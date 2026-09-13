export const menuSurfaceClasses = {
	menu: 'min-w-(--dropdown-min-width) py-0 border border-surface-border bg-surface-raised text-white text-[length:var(--dropdown-font-size)]',
	plain: 'border-0 bg-background',
} as const;

export const menuPositionerZClasses = {
	menu: 'z-dropdown',
	plain: 'z-[1500]',
} as const;

export const menuWidthClasses = {
	content: '',
	anchor: 'w-(--anchor-width)',
} as const;

export const menuItemLayoutClasses = {
	block: 'block',
	row: 'flex items-center',
} as const;

export const menuItemBaseClasses =
	'w-full py-1 px-4 border-0 bg-transparent text-white font-normal text-left whitespace-nowrap cursor-pointer transition-colors duration-200 ease-in-out data-[highlighted]:bg-surface-hover data-[checked]:bg-surface-raised data-[disabled]:pointer-events-auto data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed';
