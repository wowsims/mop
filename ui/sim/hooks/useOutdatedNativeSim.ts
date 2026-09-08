import { useEffect, useState } from 'react';

import type { Sim } from '../sim';
import { noop } from '../utils';
import { useSimStatus } from './useSimStatus';

/** Whether the local Go host is running an out-of-date build. Always false in the browser. */
export const useOutdatedNativeSim = (sim: Sim): boolean => {
	const ready = useSimStatus(sim).status === 'ready';
	const [outdated, setOutdated] = useState(false);

	useEffect(() => {
		// `sim.isNative` is decided during init, so this cannot be asked any earlier.
		if (!ready || !sim.isNative) return;
		let cancelled = false;
		fetch('/version')
			.then(response =>
				response
					.json()
					.then(versionInfo => {
						if (!cancelled && versionInfo.outdated == 2) setOutdated(true);
					})
					.catch(() => console.warn('No version info found!')),
			)
			.catch(noop);
		return () => {
			cancelled = true;
		};
	}, [ready, sim]);

	return outdated;
};
