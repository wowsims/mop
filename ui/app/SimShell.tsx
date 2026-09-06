import { SOCIALS } from '@domain/constants/other';
import type { PlayerSpec } from '@domain/player_spec';
import type { Sim } from '@domain/sim';
import { subscribeAll, subscribeUiField } from '@domain/state/subscriptions';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import clsx from 'clsx';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { SimTitleDropdown } from './header/SimTitleDropdown';
import { SimToolbar } from './header/SimToolbar';
import { showsEpRatios, simUiClasses } from './shell_classes';
import type { ShellDom } from './shell_dom';
import { SocialLink } from './SocialLink';

type UiToggle = 'showDamageMetrics' | 'showThreatMetrics' | 'showHealingMetrics' | 'showExperimental';

const DAMAGE_FIELDS: UiToggle[] = ['showDamageMetrics'];
const THREAT_FIELDS: UiToggle[] = ['showThreatMetrics'];
const HEALING_FIELDS: UiToggle[] = ['showHealingMetrics', 'showThreatMetrics'];
const EXPERIMENTAL_FIELDS: UiToggle[] = ['showExperimental'];
const EP_RATIO_FIELDS: UiToggle[] = ['showDamageMetrics', 'showHealingMetrics', 'showThreatMetrics'];

const useMetricFlag = (sim: Sim, fields: UiToggle[], read: () => boolean) => {
	const subscribe = useMemo(() => subscribeAll(fields.map(field => subscribeUiField(sim, field))), [sim, fields]);
	return useStoreSubscribe(subscribe, read);
};

export interface SimShellProps {
	domRef: RefObject<ShellDom | null>;
	sim: Sim;
	cssClass: string;
	spec: PlayerSpec<any>;
	noticeText?: string;
	knownIssues: ReadonlyArray<ReactNode>;
	onOpenSettings: () => void;
}

export const SimShell = ({ domRef, sim, cssClass, spec, noticeText, knownIssues, onOpenSettings }: SimShellProps) => {
	const root = useRef<HTMLDivElement>(null);
	const sidebarActions = useRef<HTMLDivElement>(null);
	const sidebarResults = useRef<HTMLDivElement>(null);
	const sidebarStats = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const main = useRef<HTMLElement>(null);
	const header = useRef<HTMLElement>(null);
	const tabsMount = useRef<HTMLDivElement>(null);
	const importExport = useRef<HTMLDivElement>(null);

	const damage = useMetricFlag(sim, DAMAGE_FIELDS, () => sim.getShowDamageMetrics());
	const threat = useMetricFlag(sim, THREAT_FIELDS, () => sim.getShowThreatMetrics());
	const healing = useMetricFlag(sim, HEALING_FIELDS, () => sim.getShowHealingMetrics());
	const experimental = useMetricFlag(sim, EXPERIMENTAL_FIELDS, () => sim.getShowExperimental());
	const epRatios = useMetricFlag(sim, EP_RATIO_FIELDS, () =>
		showsEpRatios({ damage: sim.getShowDamageMetrics(), healing: sim.getShowHealingMetrics(), threat: sim.getShowThreatMetrics() }),
	);
	const metrics = { damage, threat, healing, epRatios, experimental };

	const [stuck, setStuck] = useState(false);
	useEffect(() => {
		const element = header.current;
		if (!element) return;
		const observer = new IntersectionObserver(([entry]) => setStuck(entry.intersectionRatio < 1), { threshold: [1] });
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
		<div ref={root} className={simUiClasses({ cssClass, spec, metrics })}>
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
