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
import { ToastArea, toastManager } from '@ui-kit/Toast';

/** Filled once the shell is constructed, so each is null on the render that builds the containers they go in. */
export interface SimShellSlots {
	tabs: ReactNode;
	importExport: ReactNode;
	sidebarActions: ReactNode;
	sidebarResults: ReactNode;
	sidebarStats: ReactNode;
}

export interface SimShellProps {
	domRef: RefObject<ShellDom | null>;
	sim: Sim;
	className: string;
	spec: PlayerSpec<any>;
	noticeText?: string;
	knownIssues: ReadonlyArray<ReactNode>;
	onOpenSettings: () => void;
	slots: SimShellSlots;
}

export const SimShell = ({ domRef, sim, className, spec, noticeText, knownIssues, onOpenSettings, slots }: SimShellProps) => {
	const root = useRef<HTMLDivElement>(null);
	const sidebarActions = useRef<HTMLDivElement>(null);
	const sidebarResults = useRef<HTMLDivElement>(null);
	const sidebarStats = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const main = useRef<HTMLElement>(null);
	const header = useRef<HTMLElement>(null);
	const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);

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
		};
		setRootEl(root.current);
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
							{/* The iterations picker is appended here by the constructor, before these children mount, and that is what keeps it first. */}
							<div ref={sidebarActions} className="sim-sidebar-actions">
								{slots.sidebarActions}
							</div>
							<div ref={sidebarResults} className="sim-sidebar-results">
								{slots.sidebarResults}
							</div>
							<div ref={sidebarStats} className="sim-sidebar-stats">
								{slots.sidebarStats}
							</div>
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
								<div className="sim-tabs-mount">{slots.tabs}</div>
								<div className="import-export nav">{slots.importExport}</div>
								<div className="sim-toolbar nav">
									<SimToolbar sim={sim} knownIssues={knownIssues} onOpenSettings={onOpenSettings} />
								</div>
							</div>
						</header>
						<main ref={main} className="sim-main" />
					</div>
				</div>
			</div>
			<ToastArea manager={toastManager} container={rootEl} />
		</div>
	);
};
