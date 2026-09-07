export interface SavedDataPanelEntry<T> {
	name: string;
	data: T;
	json: string;
	isPreset?: boolean;
	disabled?: boolean;
	afterLoad?: () => void;
}
