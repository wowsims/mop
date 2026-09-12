export const trackPageView = (title: string, slug: string) => {
	const normalizedSlug = slug.startsWith('/') ? slug.slice(1) : slug;
	gtag('event', 'page_view', {
		page_title: title,
		page_location: `${window.location.href}${normalizedSlug}`,
	});
};

export type TrackEventProps = {
	action: 'settings' | 'sim' | 'click';
	category: string;
	label?: string;
	value?: number | string | boolean;
	additionalData?: Record<string, string | number>;
};

export const trackEvent = ({ action, category, label, value, additionalData }: TrackEventProps) => {
	gtag('event', action, {
		event_category: category,
		event_label: label,
		event_value: typeof value !== 'undefined' ? String(value) : undefined,
		...additionalData,
	});
};
