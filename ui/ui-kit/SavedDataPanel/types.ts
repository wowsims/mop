export type SavedDataConfig<ModObject, T> = {
	name: string;
	data: T;
	tooltip?: string;
	isPreset?: boolean;
	// If set, will automatically hide the saved data when this evaluates to false.
	enableWhen?: (obj: ModObject) => boolean;
	// Will execute when the saved data is loaded.
	onLoad?: (obj: ModObject) => void;
};

export interface SavedDataPanelEntry<T> {
	name: string;
	data: T;
	json: string;
	tooltip?: string;
	isPreset?: boolean;
	disabled?: boolean;
	afterLoad?: () => void;
}
