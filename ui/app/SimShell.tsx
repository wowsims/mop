import { CharacterStats } from '@features/character-stats';
import { SimResultsPanel } from '@features/results/components/SimResultsPanel';
import { SOCIALS } from '@sim/constants/other';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { useShowExperimental } from '@sim/hooks/useShowExperimental';
import type { PlayerSpec } from '@sim/player/player_spec';
import type { Sim } from '@sim/sim';
import { SocialLink } from '@ui-kit/SocialLink';
import { ToastArea, toastManager } from '@ui-kit/Toast';
import clsx from 'clsx';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { SimTitleDropdown } from './header/SimTitleDropdown';
import { SimToolbar } from './header/SimToolbar';
import type { SimHostObject } from './individual_sim_ui';
import { IterationsPicker } from './IterationsPicker';
import { showsEpRatios, simUiClasses } from './shell_classes';
import type { ShellDom } from './shell_dom';
import { SimImportExport } from './SimImportExport';
import { SimSidebarActions } from './SimSidebarActions';
import { SimTabsSection } from './SimTabsSection';

export interface SimShellProps {
	domRef: RefObject<ShellDom | null>;
	/** Null on the render that builds the containers it is constructed from, so everything reaching through it waits a render. */
	host: SimHostObject<any> | null;
	sim: Sim;
	className: string;
	spec: PlayerSpec<any>;
	noticeText?: string;
	knownIssues: ReadonlyArray<ReactNode>;
	onOpenSettings: () => void;
}

export const SimShell = ({ domRef, host, sim, className, spec, noticeText, knownIssues, onOpenSettings }: SimShellProps) => {
	const root = useRef<HTMLDivElement>(null);
	const sidebarActions = useRef<HTMLDivElement>(null);
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
							{/* The picker is the shell's own and has to stay ahead of every action the registry adds. */}
							<div ref={sidebarActions} className="sim-sidebar-actions">
								<IterationsPicker sim={sim} />
								{host && <SimSidebarActions host={host} />}
							</div>
							<div className="sim-sidebar-results">
								{host && <SimResultsPanel panel={host.resultsPanel} warnings={host.warnings} results={host.raidSimResultsManager} />}
							</div>
							<div className="sim-sidebar-stats">{host && <CharacterStats />}</div>
							<div className="sim-sidebar-socials">
								{SOCIALS.map(social => (
									<SocialLink key={social.key} social={social} />
								))}
							</div>
						</div>
					</aside>
					<div className="sim-content container-fluid">
						<header ref={header} className={clsx('sim-header', stuck && 'stuck')}>
							<div className="sim-header-container">
								<div className="sim-tabs-mount">{host && <SimTabsSection host={host} />}</div>
								<div className="import-export nav">{host && <SimImportExport />}</div>
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
