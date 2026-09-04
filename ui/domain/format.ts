// Turning values into the strings and colours the UI shows.

export const sanitizeId = (id: string) => id.split(' ').join('').toLocaleLowerCase();

export interface FormatDurationSecondsOptions {
	showMilliseconds?: boolean;
	millisecondDigits?: 1 | 2 | 3;
	separatorStyle?: 'colon' | 'unit';
	minimumUnit?: 'seconds' | 'minutes' | 'hours';
}

export function formatDurationSeconds(seconds: number, options: FormatDurationSecondsOptions = {}): string {
	const showMilliseconds = options.showMilliseconds ?? false;
	const millisecondDigits = options.millisecondDigits ?? 1;
	const precision = showMilliseconds ? Math.pow(10, millisecondDigits) : 1;
	const totalUnits = Math.max(0, Math.round(seconds * precision));
	const totalSeconds = Math.floor(totalUnits / precision);
	const fractionalUnits = totalUnits % precision;
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const remainingSeconds = totalSeconds % 60;
	const secondsSuffix = showMilliseconds ? `.${String(fractionalUnits).padStart(millisecondDigits, '0')}` : '';
	const paddedSeconds = String(remainingSeconds).padStart(2, '0');

	if (options.separatorStyle === 'colon') {
		const showHours = hours > 0 || options.minimumUnit === 'hours';
		const showMinutes = showHours || minutes > 0 || options.minimumUnit === 'minutes';

		if (showHours) {
			return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}${secondsSuffix}`;
		}
		if (showMinutes) {
			return `${minutes}:${paddedSeconds}${secondsSuffix}`;
		}
		return `${remainingSeconds}${secondsSuffix}s`;
	}

	if (hours > 0) {
		return `${hours}h ${String(minutes).padStart(2, '0')}m ${paddedSeconds}${secondsSuffix}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${paddedSeconds}${secondsSuffix}s`;
	}
	return `${remainingSeconds}${secondsSuffix}s`;
}
export function formatDeltaTextElem(
	elem: HTMLElement,
	before: number,
	after: number,
	precision: number,
	lowerIsBetter?: boolean,
	noColor?: boolean,
	showPercentage?: boolean,
) {
	const delta = after - before;
	const denom = Math.min(before, after);
	const deltaPct = Math.abs((delta / (denom === 0 ? 1 : denom)) * 100).toFixed(precision);
	let deltaStr = delta.toFixed(precision);
	if (delta >= 0) {
		deltaStr = `+${deltaStr}`;
	}
	if (showPercentage) {
		deltaStr = `${deltaStr} (${deltaPct}%)`;
	}

	elem.textContent = deltaStr;

	if (noColor || delta == 0) {
		elem.classList.remove('positive');
		elem.classList.remove('negative');
	} else if (delta > 0 != Boolean(lowerIsBetter)) {
		elem.classList.remove('negative');
		elem.classList.add('positive');
	} else {
		elem.classList.remove('positive');
		elem.classList.add('negative');
	}
}
// JavaScript's built in modulo (%) has several issues. This is a fix that works similar to the intuitive way modulo works in most languages
export const formatToCompactNumber: typeof formatToNumber = (number, options) => formatToNumber(number, { notation: 'compact', ...options });

export const formatToPercent: typeof formatToNumber = (number, options) => formatToNumber(number / 100, { style: 'percent', ...options });

export const formatToNumber = (number: number, options?: Intl.NumberFormatOptions & { fallbackString?: string }) => {
	if (!number && options?.fallbackString) return options.fallbackString;
	return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, ...options }).format(number);
};

export const normalizeName = (name: string): string => {
	return name
		.replace(/[^\w\s]/g, '')
		.split(/\s+/)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join('');
};
export const formatName = (name: string): string => {
	return name.replace('Food', '');
};
