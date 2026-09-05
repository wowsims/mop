import { SOCIALS } from '@domain/constants/other';
import type { PlayerSpec } from '@domain/player_spec';
import type { Sim } from '@domain/sim';
import { subscribeAll, subscribeUiField } from '@domain/state/subscriptions';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import clsx from 'clsx';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { SimToolbar } from './header/SimToolbar';
import { showsEpRatios, simUiClasses } from './shell_classes';
import type { ShellDom } from './shell_dom';
import { SocialLink } from './SocialLink';

type UiToggle = 'showDamageMetrics' | 'showThreatMetrics' | 'showHealingMetrics' | 'showExperimental';

// Module-level so each array has a stable identity across renders, which is what lets the
// subscription below depend on it directly instead of on a joined string.
const DAMAGE_FIELDS: UiToggle[] = ['showDamageMetrics'];
const THREAT_FIELDS: UiToggle[] = ['showThreatMetrics'];
const HEALING_FIELDS: UiToggle[] = ['showHealingMetrics', 'showThreatMetrics'];
const EXPERIMENTAL_FIELDS: UiToggle[] = ['showExperimental'];
const EP_RATIO_FIELDS: UiToggle[] = ['showDamageMetrics', 'showHealingMetrics', 'showThreatMetrics'];

/** One class, one subscription, over the fields that class actually depends on. */
const useMetricFlag = (sim: Sim, fields: UiToggle[], read: () => boolean) => {
	const subscribe = useMemo(() => subscribeAll(fields.map(field => subscribeUiField(sim, field))), [sim, fields]);
	return useStoreSubscribe(subscribe, read);
};

export interface SimShellProps {
	/** Filled in a layout effect, before `SimApp`'s own effect constructs the shell into it. */
	domRef: RefObject<ShellDom | null>;
	sim: Sim;
	/** The spec's own class, e.g. `arms-warrior-sim-ui`. */
	cssClass: string;
	spec: PlayerSpec<any>;
	noticeText?: string;
	/** Already derived — the launch-status notice is part of the list by the time it arrives. */
	knownIssues: ReadonlyArray<ReactNode>;
	/** Opens the still-vanilla settings modal, which `SimHeader` owns. */
	onOpenSettings: () => void;
}

/**
 * The sim's skeleton — everything parent to the tabs. It renders **once** and is never re-rendered:
 * `SimApp` holds the element in a `useMemo`, which is load-bearing three times over.
 *
 * - Every container still in `ShellDom` is filled imperatively afterwards. React must not own their
 *   children, and a re-render that re-created any of these nodes would take the vanilla content with
 *   it. `.sim-toolbar` and `.sim-sidebar-socials` are the exceptions and no longer in the bundle: their
 *   contents are React's, and a container leaves `ShellDom` as that becomes true of it.
 * - Bootstrap rewrites `aria-expanded` on the dropdown toggles and `.show` on their menus. React
 *   diffs against its own last props rather than the DOM, so a re-render with identical props is
 *   already safe — but not re-rendering at all makes that independent of React's bail-out rules.
 * - `sticky_toolbar.ts` measures `.sim-header`'s `offsetHeight` while the tabs are constructed, so
 *   the header has to be laid out in this first render, not a later one.
 *
 * Both roots' class lists are React's, all of them — see `shell_classes.ts`. It has to be all or
 * nothing: React writes `className` wholesale, so an element cannot have half its list from React
 * and half from `classList` without the next render dropping the other half. That is why `.stuck`
 * moving to React state also means `.sim-header` stops coming from `Component`'s `rootCssClass`.
 */
export const SimShell = ({ domRef, sim, cssClass, spec, noticeText, knownIssues, onOpenSettings }: SimShellProps) => {
	const root = useRef<HTMLDivElement>(null);
	const title = useRef<HTMLDivElement>(null);
	const sidebarActions = useRef<HTMLDivElement>(null);
	const sidebarResults = useRef<HTMLDivElement>(null);
	const sidebarStats = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const main = useRef<HTMLElement>(null);
	const header = useRef<HTMLElement>(null);
	const tabsMount = useRef<HTMLDivElement>(null);

	// One subscription per class, listing the fields that class actually depends on.
	//
	// Healing subscribes to threat as well as to itself, which the vanilla shell did not:
	// `Sim.getShowHealingMetrics()` is `showHealingMetrics || (showThreatMetrics && <tank spec>)`,
	// and vanilla only re-ran that updater on `showHealingMetrics`. So a tank whose saved settings
	// turned threat on kept `hide-healing-metrics` from construction and hid columns its own rule
	// says to show. Fixed rather than reproduced, and recorded as an intended divergence in
	// `parity.mjs` — it is visible at load on every tank spec.
	const damage = useMetricFlag(sim, DAMAGE_FIELDS, () => sim.getShowDamageMetrics());
	const threat = useMetricFlag(sim, THREAT_FIELDS, () => sim.getShowThreatMetrics());
	const healing = useMetricFlag(sim, HEALING_FIELDS, () => sim.getShowHealingMetrics());
	const experimental = useMetricFlag(sim, EXPERIMENTAL_FIELDS, () => sim.getShowExperimental());
	const epRatios = useMetricFlag(sim, EP_RATIO_FIELDS, () =>
		showsEpRatios({ damage: sim.getShowDamageMetrics(), healing: sim.getShowHealingMetrics(), threat: sim.getShowThreatMetrics() }),
	);
	const metrics = { damage, threat, healing, epRatios, experimental };

	// `.stuck` styles the header once it has scrolled off its resting position. The observer watches
	// for the header ceasing to be fully visible, which is what `threshold: [1]` means — it fires when
	// the ratio drops below 1, not when the header leaves the viewport.
	const [stuck, setStuck] = useState(false);
	useEffect(() => {
		const element = header.current;
		if (!element) return;
		const observer = new IntersectionObserver(([entry]) => setStuck(entry.intersectionRatio < 1), { threshold: [1] });
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	// A child's layout effect runs before its parent's, which is what lets `SimApp` construct
	// against a populated bundle in the very same commit.
	useLayoutEffect(() => {
		domRef.current = {
			root: root.current!,
			title: title.current!,
			sidebarActions: sidebarActions.current!,
			sidebarResults: sidebarResults.current!,
			sidebarStats: sidebarStats.current!,
			content: content.current!,
			main: main.current!,
			header: header.current!,
			tabsMount: tabsMount.current!,
		};
	}, [domRef]);

	return (
		<div ref={root} className={simUiClasses({ cssClass, spec, metrics })}>
			<div className="sim-root">
				<div className="sim-bg" />
				{noticeText ? <div className="notices-banner alert border-bottom mb-0 text-center">{noticeText}</div> : null}
				<div className="sim-container">
					<aside className="sim-sidebar">
						<div ref={title} className="sim-title" />
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
								<div className="import-export nav">
									<div className="dropdown sim-dropdown-menu import-dropdown">
										{/* Literal, not derived: Bootstrap owns this attribute once the plugin takes over. */}
										<Button
											variant="unstyled"
											className="import-link"
											aria-expanded="false"
											data-bs-toggle="dropdown"
											data-bs-display="dynamic">
											<i className="fa fa-download" aria-hidden="true" /> {i18n.t('import.title')}
										</Button>
										<ul className="dropdown-menu" />
									</div>
									<div className="dropdown sim-dropdown-menu export-dropdown">
										<Button
											variant="unstyled"
											className="export-link"
											aria-expanded="false"
											data-bs-toggle="dropdown"
											data-bs-display="dynamic">
											<i className="fa fa-right-from-bracket" aria-hidden="true" /> {i18n.t('export.title')}
										</Button>
										<ul className="dropdown-menu" />
									</div>
								</div>
								<div className="sim-toolbar nav">
									<SimToolbar knownIssues={knownIssues} onOpenSettings={onOpenSettings} />
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
