import { useLocalStorage } from 'react-use';

export type LocalStorageParser<T> = (value: unknown) => T | undefined;

export const useTypedLocalStorage = <T>(key: string, parse: LocalStorageParser<T>, initialValue?: T): [T | undefined, (value: T) => void, () => void] =>
	useLocalStorage<T>(key, initialValue, {
		raw: false,
		serializer: JSON.stringify,
		deserializer: raw => {
			try {
				return parse(JSON.parse(raw)) as T;
			} catch {
				return undefined as unknown as T;
			}
		},
	});
