import { useSavedData } from '@ui-kit/hooks/useSavedData';
import type { SavedDataPanelEntry, SavedDataPanelProps } from '@ui-kit/SavedDataPanel';
import { useCallback, useMemo, useRef } from 'react';

import { trackEvent } from '../../tracking/analytics';

export interface SavedPanelOptions<T> {
	label: string;
	storage: ReturnType<typeof useSavedData<T>>;
	current: T | null;
	serialize: (data: T) => string;
	load: (entry: SavedDataPanelEntry<T>) => void;
}

export type SavedPanelProps<T> = Pick<SavedDataPanelProps<T>, 'label' | 'userData' | 'currentJson' | 'onLoad' | 'onSave' | 'onDelete'>;

export const useSavedPanel = <T>({ label, storage, current, serialize, load }: SavedPanelOptions<T>): SavedPanelProps<T> => {
	const { entries: userData, save, remove } = storage;

	const currentRef = useRef(current);
	currentRef.current = current;
	const loadRef = useRef(load);
	loadRef.current = load;

	const currentJson = useMemo(() => (current ? serialize(current) : ''), [current, serialize]);

	const onLoad = useCallback(
		(entry: SavedDataPanelEntry<T>) => {
			loadRef.current(entry);
			trackEvent({ action: 'settings', category: 'load', label });
		},
		[label],
	);

	const onSave = useCallback(
		(name: string) => {
			const data = currentRef.current;
			if (data === null) return;
			save(name, data);
			trackEvent({ action: 'settings', category: 'save', label });
		},
		[label, save],
	);

	const onDelete = useCallback(
		(entry: SavedDataPanelEntry<T>) => {
			remove(entry.name);
			trackEvent({ action: 'settings', category: 'delete', label });
		},
		[label, remove],
	);

	return { label, userData, currentJson, onLoad, onSave, onDelete };
};
