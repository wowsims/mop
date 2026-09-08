import { SOCIALS } from '@sim/constants/other';
import type { PlayerSpec } from '@sim/player/player_spec';
import type { Sim } from '@sim/sim';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { useShowExperimental } from '@sim/hooks/useShowExperimental';
import clsx from 'clsx';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { SimTitleDropdown } from './header/SimTitleDropdown';
import { SimToolbar } from './header/SimToolbar';
import { showsEpRatios, simUiClasses } from './shell_classes';
import type { ShellDom } from './shell_dom';
import { SocialLink } from '@ui-kit/SocialLink';

export interface SimShellProps {
	domRef: RefObject<ShellDom | null>;
	sim: Sim;
	className: string;
	spec: PlayerSpec<any>;
	noticeText?: string;
	knownIssues: ReadonlyArray<ReactNode>;
	onOpenSettings: () => void;
}

export const SimShell = ({ domRef, sim, className, spec, noticeText, knownIssues, onOpenSettings }: SimShellProps) => {
	const root = useRef<HTMLDivElement>(null);
	const sidebarActions = useRef<HTMLDivElement>(null);
	const sidebarResults = useRef<HTMLDivElement>(null);
	const sidebarStats = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const main = useRef<HTMLElement>(null);
	const header = useRef<HTMLElement>(null);
	const tabsMount = useRef<HTMLDivElement>(null);
	const importExport = useRef<HTMLDivElement>(null);

	const display = useDisplayMetrics(sim);
	const metrics = { ...display, epRatios: showsEpRatios(display), experimental: useShowExperimental(sim) };

	const [stuck, setStuck] = useState(false);
	useEffect(() => {
		const element = header.current;
		if (!element) return;
		// One delivery can carry several records, oldest first, so the last is the current state — reading `[entry]` leaves the bar stuck on a stale ratio.
		const observer = new IntersectionObserver(entries => setStuck(entries[entries.length - 1].intersectionRatio < 1), { threshold: [1] });
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	// A child's layout effect runs before its parent's, which is what lets `SimApp` construct against a populated bundle in the very same commit.
	useLayoutEffect(() => {
		domRef.current = {
			root: root.current!,
			sidebarActions: sidebarActions.current!,
			sidebarResults: sidebarResults.current!,
			sidebarStats: sidebarStats.current!,
			content: content.current!,
			main: main.current!,
			header: header.current!,
			tabsMount: tabsMount.current!,
			importExport: importExport.current!,
		};
	}, [domRef]);

	return (
		<div ref={root} className={simUiClasses({ className, spec, metrics })}>
			<div className="sim-root">
				<div className="sim-bg" />
				{noticeText ? <div className="notices-banner alert border-bottom mb-0 text-center">{noticeText}</div> : null}
				<div className="sim-container">
					<aside className="sim-sidebar">
						<div className="sim-title">
							<SimTitleDropdown currentSpec={spec} />
						</div>
						<div className="sim-sidebar-content">
							<div ref={sidebarActions} className="sim-sidebar-actions" />
							<div ref={sidebarResults} className="sim-sidebar-results" />
							<div ref={sidebarStats} className="sim-sidebar-stats" />
							<div className="sim-sidebar-socials">
								{SOCIALS.map(social => (
									<SocialLink key={social.key} social={social} />
								))}
							</div>
						</div>
					</aside>
					<div ref={content} className="sim-content container-fluid">
						<header ref={header} className={clsx('sim-header', stuck && 'stuck')}>
							<div className="sim-header-container">
								<div ref={tabsMount} className="sim-tabs-mount" />
								<div ref={importExport} className="import-export nav" />
								<div className="sim-toolbar nav">
									<SimToolbar sim={sim} knownIssues={knownIssues} onOpenSettings={onOpenSettings} />
								</div>
							</div>
						</header>
						<main ref={main} className="sim-main" />
					</div>
				</div>
			</div>
			<div className="sim-toast-container p-3 bottom-0 right-0" id="toastContainer" />
		</div>
	);
};
