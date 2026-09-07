export interface SavedDataPanelEntry<T> {
	name: string;
	data: T;
	json: string;
	tooltip?: string;
	isPreset?: boolean;
	disabled?: boolean;
	afterLoad?: () => void;
}
