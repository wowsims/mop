import { useSimHost } from '@sim/context/SimHostContext';
import { useTypedLocalStorage } from '@ui-kit/hooks/useTypedLocalStorage';
import { useState } from 'react';

const STORAGE_SUFFIX = '__bulkSettingsGroups';

export const BULK_SETTINGS_GROUP = {
	options: 'options',
	freezes: 'freezes',
	reforge: 'reforge',
} as const;

const DEFAULT_OPEN_GROUPS = [BULK_SETTINGS_GROUP.options];

const parseGroups = (value: unknown): string[] | undefined =>
	Array.isArray(value) && value.every(entry => typeof entry === 'string') ? (value as string[]) : undefined;

/** The open groups live in React state, not in storage: a blocked `localStorage` writes nothing and reads back null, which would leave the accordion unable to open. */
export const useBulkSettingsGroups = (): [string[], (groups: string[]) => void] => {
	const host = useSimHost();
	const [stored, setStored] = useTypedLocalStorage<string[]>(host.getStorageKey(STORAGE_SUFFIX), parseGroups);
	const [openGroups, setOpenGroups] = useState(stored ?? DEFAULT_OPEN_GROUPS);

	return [
		openGroups,
		groups => {
			setOpenGroups(groups);
			setStored(groups);
		},
	];
};
