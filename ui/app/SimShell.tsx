import { CharacterStats } from '@features/character-stats';
import { SimResultsPanel } from '@features/results/components/SimResultsPanel';
import { SOCIALS } from '@sim/constants/other';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { useShowExperimental } from '@sim/hooks/useShowExperimental';
import type { PlayerSpec } from '@sim/player/player_spec';
import type { Sim } from '@sim/sim';
import { PortalContainerContext } from '@ui-kit/hooks/usePortalContainer';
import { StickyHeaderContext } from '@ui-kit/hooks/useStickyToolbar';
import { SocialLink } from '@ui-kit/SocialLink';
import { ToastArea, toastManager } from '@ui-kit/Toast';
import clsx from 'clsx';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { SimTitleDropdown } from './header/SimTitleDropdown';
import { SimToolbar } from './header/SimToolbar';
import type { SimHostObject } from './individual_sim_ui';
import { IterationsPicker } from './IterationsPicker';
import { showsEpRatios, simUiAttributes, simUiClasses } from './shell_classes';
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
	const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
	const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);

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
		};
		setRootEl(root.current);
		setHeaderEl(header.current);
	}, [domRef]);

	return (
		<StickyHeaderContext value={headerEl}>
			<PortalContainerContext value={rootEl}>
				<div
					ref={root}
					className={clsx(
						simUiClasses({ className, spec, metrics }),
						'max-h-screen overflow-y-auto [scrollbar-color:var(--color-primary)_var(--color-background)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[0.2rem] [&::-webkit-scrollbar-track]:bg-(--color-background) [&::-webkit-scrollbar-thumb]:bg-(--color-primary)',
					)}
					data-testid="sim-ui"
					{...simUiAttributes({ spec, metrics })}>
					<div className="sim-root h-full min-h-screen flex flex-col" data-testid="sim-root">
						<div
							className="sim-bg fixed top-0 left-0 w-screen h-screen bg-no-repeat bg-cover -z-[1] bg-[linear-gradient(color-mix(in_srgb,var(--theme-background-color)_calc(var(--theme-background-opacity)*100%),transparent),color-mix(in_srgb,var(--theme-background-color)_calc(var(--theme-background-opacity)*100%),transparent)),var(--theme-background-image)]"
							data-testid="sim-bg"
						/>
						{noticeText ? (
							<div className="notices-banner alert border-b border-border mb-0 text-center" data-testid="notices-banner">
								{noticeText}
							</div>
						) : null}
						<div className="sim-container flex flex-1 max-lg:flex-col" data-testid="sim-container">
							<aside
								className="sim-sidebar sticky top-[-1px] flex-1 flex flex-col items-stretch bg-(--color-background) h-dvh z-(--z-sidebar) max-lg:relative max-lg:top-0 max-lg:h-auto max-lg:w-full max-lg:min-h-[unset]"
								data-testid="sim-sidebar">
								<div
									className="sim-title h-[calc(var(--sim-header-height)+1px)] border-b border-b-(--color-border) z-[calc(var(--z-sidebar)+1)] max-lg:sticky max-lg:top-[-1px]"
									data-testid="sim-title">
									<SimTitleDropdown currentSpec={spec} />
								</div>
								<div
									className="sim-sidebar-content p-(--spacing-gutter) flex flex-1 flex-col overflow-y-auto [scrollbar-color:var(--color-primary)_var(--color-background)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[0.2rem] [&::-webkit-scrollbar-track]:bg-(--color-background) [&::-webkit-scrollbar-thumb]:bg-(--color-primary) max-xxl:px-[calc(var(--spacing-gutter-sm)*2)] max-lg:py-[calc(var(--spacing-gutter-sm)*2)] max-lg:px-(--spacing-gutter-sm) max-lg:min-h-0 [&>*:not(:last-child)]:mb-6"
									data-testid="sim-sidebar-content">
									{/* The picker is the shell's own and has to stay ahead of every action the registry adds. */}
									<div
										ref={sidebarActions}
										className="sim-sidebar-actions px-(--spacing-page) -mx-(--spacing-gutter) flex flex-col items-center gap-(--spacing-stack) max-xxl:p-0 max-xxl:mx-0 [&>*]:mb-0"
										data-testid="sim-sidebar-actions">
										<IterationsPicker sim={sim} />
										{host && <SimSidebarActions host={host} />}
									</div>
									<div className="sim-sidebar-results flex justify-center items-center" data-testid="sim-sidebar-results">
										{host && <SimResultsPanel panel={host.resultsPanel} warnings={host.warnings} results={host.raidSimResultsManager} />}
									</div>
									<div className="sim-sidebar-stats mt-auto max-lg:mt-0" data-testid="sim-sidebar-stats">
										{host && <CharacterStats />}
									</div>
									<div className="sim-sidebar-socials flex justify-center gap-4" data-testid="sim-sidebar-socials">
										{SOCIALS.map(social => (
											<SocialLink key={social.key} social={social} />
										))}
									</div>
								</div>
							</aside>
							<div
								className="sim-content container-fluid flex flex-col min-w-[calc(275px+1vw)] pt-0 pr-(--spacing-page) pb-(--spacing-page) pl-(--spacing-page) flex-[4] z-[1] max-lg:w-full max-lg:min-h-[unset]"
								data-testid="sim-content">
								<header
									ref={header}
									className={clsx(
										'sim-header sticky top-[-1px] h-(--sim-header-height) pt-(--spacing-gutter) pr-(--spacing-page) pl-(--spacing-page) -mx-(--spacing-page) whitespace-nowrap transition-colors duration-150 ease-in-out z-(--z-header) max-lg:pt-(--spacing-gutter-sm)',
										"after:content-[''] after:absolute after:-bottom-px after:inset-x-0 after:mx-auto after:h-px after:w-[calc(100%-2*var(--spacing-page))] after:bg-(--color-border) after:transition-[width] after:duration-150 after:ease-in-out data-[stuck]:after:w-full",
										stuck && 'stuck data-[stuck]:bg-(--color-background)',
									)}
									data-testid="sim-header"
									data-stuck={stuck ? '' : undefined}>
									<div
										className="sim-header-container h-full flex items-stretch flex-1 overflow-x-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
										data-testid="sim-header-container">
										<div className="sim-tabs-mount contents" data-testid="sim-tabs-mount">
											{host && <SimTabsSection host={host} />}
										</div>
										<div className="import-export flex flex-nowrap items-end mb-0 pl-0 list-none font-bold" data-testid="import-export">
											{host && <SimImportExport />}
										</div>
										<div
											className="sim-toolbar flex flex-nowrap items-end mb-0 pl-0 list-none font-bold ml-auto text-(length:--text-ui)"
											data-testid="sim-toolbar">
											<SimToolbar sim={sim} knownIssues={knownIssues} onOpenSettings={onOpenSettings} />
										</div>
									</div>
								</header>
								<main ref={main} className="sim-main h-[80%] flex flex-grow" data-testid="sim-main" />
							</div>
						</div>
					</div>
					<ToastArea manager={toastManager} />
				</div>
			</PortalContainerContext>
		</StickyHeaderContext>
	);
};
