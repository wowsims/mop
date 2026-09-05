import type { PlayerSpec } from '@domain/player_spec';
import type { Sim } from '@domain/sim';
import { subscribeAll, subscribeUiField } from '@domain/state/subscriptions';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { type RefObject, useLayoutEffect, useMemo, useRef } from 'react';

import { showsEpRatios, simUiClasses } from './shell_classes';
import type { ShellDom } from './shell_dom';

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
}

/**
 * The sim's skeleton — everything parent to the tabs. It renders **once** and is never re-rendered:
 * `SimApp` holds the element in a `useMemo`, which is load-bearing three times over.
 *
 * - Every container here is filled imperatively afterwards. React must not own their children, and
 *   a re-render that re-created any of these nodes would take the vanilla content with it.
 * - Bootstrap rewrites `aria-expanded` on the dropdown toggles and `.show` on their menus. React
 *   diffs against its own last props rather than the DOM, so a re-render with identical props is
 *   already safe — but not re-rendering at all makes that independent of React's bail-out rules.
 * - `sticky_toolbar.ts` measures `.sim-header`'s `offsetHeight` while the tabs are constructed, so
 *   the header has to be laid out in this first render, not a later one.
 *
 * The root's class list is React's, all of it — see `shell_classes.ts`. It has to be all or
 * nothing: React writes `className` wholesale, so an element cannot have half its list from React
 * and half from `classList` without the next render dropping the other half. `.sim-header` still
 * gets its class from `Component`'s `rootCssClass`, which owns that element's list outright.
 */
export const SimShell = ({ domRef, sim, cssClass, spec, noticeText }: SimShellProps) => {
	const root = useRef<HTMLDivElement>(null);
	const title = useRef<HTMLDivElement>(null);
	const sidebarActions = useRef<HTMLDivElement>(null);
	const sidebarResults = useRef<HTMLDivElement>(null);
	const sidebarStats = useRef<HTMLDivElement>(null);
	const sidebarSocials = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const main = useRef<HTMLElement>(null);
	const header = useRef<HTMLElement>(null);
	const tabsMount = useRef<HTMLDivElement>(null);
	const toolbar = useRef<HTMLDivElement>(null);

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

	// A child's layout effect runs before its parent's, which is what lets `SimApp` construct
	// against a populated bundle in the very same commit.
	useLayoutEffect(() => {
		domRef.current = {
			root: root.current!,
			title: title.current!,
			sidebarActions: sidebarActions.current!,
			sidebarResults: sidebarResults.current!,
			sidebarStats: sidebarStats.current!,
			sidebarSocials: sidebarSocials.current!,
			content: content.current!,
			main: main.current!,
			header: header.current!,
			tabsMount: tabsMount.current!,
			toolbar: toolbar.current!,
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
							<div ref={sidebarSocials} className="sim-sidebar-socials" />
						</div>
					</aside>
					<div ref={content} className="sim-content container-fluid">
						<header ref={header}>
							<div className="sim-header-container">
								<div ref={tabsMount} className="sim-tabs-mount" />
								<div className="import-export nav">
									<div className="dropdown sim-dropdown-menu import-dropdown">
										{/* Literal, not derived: Bootstrap owns this attribute once the plugin takes over. */}
										<button className="import-link" aria-expanded="false" data-bs-toggle="dropdown" data-bs-display="dynamic">
											<i className="fa fa-download" /> {i18n.t('import.title')}
										</button>
										<ul className="dropdown-menu" />
									</div>
									<div className="dropdown sim-dropdown-menu export-dropdown">
										<button className="export-link" aria-expanded="false" data-bs-toggle="dropdown" data-bs-display="dynamic">
											<i className="fa fa-right-from-bracket" /> {i18n.t('export.title')}
										</button>
										<ul className="dropdown-menu" />
									</div>
								</div>
								<div ref={toolbar} className="sim-toolbar nav" />
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
