const INPUT_BASE = 'block text-ui leading-normal text-foreground bg-surface border border-surface-border';

const INPUT_STATE = 'disabled:bg-[color-mix(in_srgb,#15171e,white_20%)] disabled:opacity-100';

export const INPUT_CLASSES = `${INPUT_BASE} placeholder:text-[#6c757d] ${INPUT_STATE}`;

export const SELECT_CLASSES = `${INPUT_BASE} appearance-none pr-9 bg-no-repeat bg-[position:right_.75rem_center] bg-[size:16px_12px] bg-[url(data:image/svg+xml,%3csvg_xmlns='http://www.w3.org/2000/svg'_viewBox='0_0_16_16'%3e%3cpath_fill='none'_stroke='white'_stroke-linecap='round'_stroke-linejoin='round'_stroke-width='2'_d='m2_5_6_6_6-6'/%3e%3c/svg%3e)] ${INPUT_STATE}`;
