import { CharacterStats } from '@features/character-stats';
import { SimResultsPanel } from '@features/results/components/SimResultsPanel';
import { SOCIALS } from '@sim/constants/other';
import type { PlayerSpec } from '@sim/player/player_spec';
import type { Sim } from '@sim/sim';
import { StickyHeaderContext } from '@ui-kit/hooks/useStickyToolbar';
import { SocialLink } from '@ui-kit/SocialLink';
import { ToastArea, toastManager } from '@ui-kit/Toast';
import clsx from 'clsx';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { SimTitleDropdown } from './header/SimTitleDropdown';
import { SimToolbar } from './header/SimToolbar';
import type { SimHostObject } from './individual_sim_ui';
import { IterationsPicker } from './IterationsPicker';
import { simUiAttributes, simUiClasses } from './shell_classes';
import { SimImportExport } from './SimImportExport';
import { SimSidebarActions } from './SimSidebarActions';
import { SimTabsSection } from './SimTabsSection';
import type { ShellDom } from './types/shell_dom';

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
	const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);

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
		};
		setHeaderEl(header.current);
	}, [domRef]);

	return (
		<StickyHeaderContext value={headerEl}>
			<div
				ref={root}
				className={clsx(simUiClasses({ className, spec }), 'max-h-screen overflow-y-auto')}
				data-testid="sim-ui"
				{...simUiAttributes({ spec })}>
				<div className="flex h-full min-h-screen flex-col" data-testid="sim-root">
					<div className="fixed top-0 left-0 -z-1 h-screen w-screen bg-sim bg-cover bg-no-repeat" data-testid="sim-bg" />
					{noticeText ? (
						<div className="relative mb-0 w-full border border-transparent bg-overlay p-4 text-center" data-testid="notices-banner">
							{noticeText}
						</div>
					) : null}
					<div className="flex flex-1 max-lg:flex-col" data-testid="sim-container">
						<aside
							className="sticky -top-px z-sidebar flex h-dvh flex-1 flex-col items-stretch bg-background max-lg:relative max-lg:top-0 max-lg:h-auto max-lg:min-h-auto max-lg:w-full"
							data-testid="sim-sidebar">
							<div className="z-sim-title h-sim-header-plus border-b border-b-border max-lg:sticky max-lg:-top-px" data-testid="sim-title">
								<SimTitleDropdown currentSpec={spec} />
							</div>
							<div
								className="flex flex-1 flex-col overflow-y-auto p-6 max-xxl:px-4 max-lg:min-h-0 max-lg:px-2 max-lg:py-4 [&>*:not(:last-child)]:mb-6"
								data-testid="sim-sidebar-content">
								{/* The picker is the shell's own and has to stay ahead of every action the registry adds. */}
								<div
									ref={sidebarActions}
									className="ui-sim-sidebar-actions -mx-6 flex flex-col items-center gap-3 px-page *:mb-0 max-xxl:mx-0 max-xxl:p-0"
									data-testid="sim-sidebar-actions">
									<IterationsPicker sim={sim} />
									{host && <SimSidebarActions host={host} />}
								</div>
								<div className="flex items-center justify-center" data-testid="sim-sidebar-results">
									{host && <SimResultsPanel panel={host.resultsPanel} warnings={host.warnings} results={host.raidSimResultsManager} />}
								</div>
								<div className="mt-auto max-lg:mt-0" data-testid="sim-sidebar-stats">
									{host && <CharacterStats />}
								</div>
								<div className="flex justify-center gap-4" data-testid="sim-sidebar-socials">
									{SOCIALS.map(social => (
										<SocialLink key={social.key} social={social} />
									))}
								</div>
							</div>
						</aside>
						<div
							className="z-1 mx-auto flex w-full min-w-[calc(275px+1vw)] flex-4 flex-col pt-0 pr-page pb-page pl-page max-lg:min-h-auto"
							data-testid="sim-content">
							<header
								ref={header}
								className={clsx(
									'sticky -top-px z-header -mx-page h-sim-header pt-6 pr-page pl-page whitespace-nowrap transition-colors duration-150 ease-in-out max-lg:pt-2',
									"after:absolute after:inset-x-0 after:-bottom-px after:mx-auto after:h-px after:w-page-inset-w after:bg-border after:transition-[width] after:duration-150 after:ease-in-out after:content-[''] data-stuck:after:w-full",
									'data-stuck:bg-background',
								)}
								data-testid="sim-header"
								data-stuck={stuck ? '' : undefined}>
								<div
									className="flex h-full flex-1 scrollbar-none items-stretch overflow-x-scroll [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
									data-testid="sim-header-container">
									<div className="contents" data-testid="sim-tabs-mount">
										{host && <SimTabsSection host={host} />}
									</div>
									<div className="mb-0 flex list-none flex-nowrap items-end pl-0 font-bold" data-testid="import-export">
										{host && <SimImportExport />}
									</div>
									<div
										className="mb-0 ml-auto flex list-none flex-nowrap items-end pl-0 text-(length:--text-ui) font-bold"
										data-testid="sim-toolbar">
										<SimToolbar sim={sim} knownIssues={knownIssues} onOpenSettings={onOpenSettings} />
									</div>
								</div>
							</header>
							<main ref={main} className="flex h-4/5 grow" data-testid="sim-main" />
						</div>
					</div>
				</div>
				<ToastArea manager={toastManager} />
			</div>
		</StickyHeaderContext>
	);
};
