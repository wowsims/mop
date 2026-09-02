/// <reference types="vite/client" />
import './shared/bootstrap_overrides';

import { Class } from '@core/proto/common';
import { LaunchStatus } from '@domain/constants/other';
import { PlayerClass } from '@domain/player_class';
import { PlayerClasses } from '@domain/player_classes/index';
import { PlayerSpec } from '@domain/player_spec';
import { textCssClassForClass, textCssClassForSpec } from '@domain/proto_utils/utils';
import * as Popper from '@popperjs/core';
import { Dropdown, Modal, Tab } from 'bootstrap';
import { Chart, registerables } from 'chart.js';
import tippy from 'tippy.js';

// Class order for the landing page sim-links list. This is presentation order
// only (not PlayerClasses.naturalOrder, which is alphabetical).
const LANDING_CLASS_ORDER: Class[] = [
	Class.ClassDeathKnight,
	Class.ClassPriest,
	Class.ClassDruid,
	Class.ClassRogue,
	Class.ClassHunter,
	Class.ClassShaman,
	Class.ClassMage,
	Class.ClassMonk,
	Class.ClassWarlock,
	Class.ClassPaladin,
	Class.ClassWarrior,
];

// Derives the class-level launch badge from its specs' individual statuses:
// all launched -> launched, all unlaunched -> unlaunched, mixed -> beta.
function classLaunchStatusKey(klass: PlayerClass<Class>): string {
	const statuses = Object.values(klass.specs).map(spec => spec.launch.status);
	if (statuses.every(status => status === LaunchStatus.Launched)) return 'launched';
	if (statuses.every(status => status === LaunchStatus.Unlaunched)) return 'unlaunched';
	return 'beta';
}

function specSlug(spec: PlayerSpec<any>): { classSlug: string; specSlug: string } {
	const [, , classSlug, specSlugPart] = spec.simLink.split('/');
	return { classSlug, specSlug: specSlugPart };
}

function buildLandingSpecLink(spec: PlayerSpec<any>): string {
	const { classSlug, specSlug: slug } = specSlug(spec);
	const statusKey = LaunchStatus[spec.launch.status].toLowerCase();
	return `
		<li>
			<a href="${spec.simLink}" class="sim-link ${textCssClassForSpec(spec)}">
				<div class="sim-link-content">
					<img src="${spec.getIcon('large')}" class="sim-link-icon">
					<div class="d-flex flex-column">
						<span class="sim-link-label" data-i18n-ns="character" data-i18n="classes.${classSlug}"></span>
						<span class="sim-link-title" data-i18n-ns="character" data-i18n="specs.${classSlug}.${slug}"></span>
						<span class="launch-status-label text-brand" data-i18n="common.status.${statusKey}"></span>
					</div>
				</div>
			</a>
		</li>`;
}

function buildLandingClassBlock(klass: PlayerClass<Class>): string {
	const classSlugValue = specSlug(Object.values(klass.specs)[0]).classSlug;
	const textKlass = textCssClassForClass(klass);
	const borderKlass = `border-${PlayerClasses.getCssClass(klass)}`;
	const specLinks = Object.values(klass.specs).map(buildLandingSpecLink).join('');
	return `
		<div class="dropend sim-link-dropdown">
			<button class="sim-link ${textKlass}" data-bs-toggle="dropdown" aria-expanded="false">
				<div class="sim-link-content">
					<img src="${klass.getIcon('large')}" class="sim-link-icon ${borderKlass}">
					<div class="d-flex flex-column">
						<span class="sim-link-title" data-i18n-ns="character" data-i18n="classes.${classSlugValue}"></span>
						<span class="launch-status-label text-brand" data-i18n="common.status.${classLaunchStatusKey(klass)}"></span>
					</div>
				</div>
			</button>
			<ul class="dropdown-menu w-100">
				${specLinks}
			</ul>
		</div>`;
}

function renderLandingSimLinks(): void {
	const container = document.getElementById('sim-links');
	if (!container) return;
	container.innerHTML = LANDING_CLASS_ORDER.map(classId => buildLandingClassBlock(PlayerClasses.fromProto(classId))).join('');
}

renderLandingSimLinks();

declare global {
	interface Window {
		Popper: any;
		bootstrap: any;
	}
}

Chart.register(...registerables);
Chart.defaults.color = 'white';

tippy.setDefaultProps({ arrow: false, allowHTML: true });
window.Popper = Popper;
window.bootstrap = { Dropdown, Modal, Tab };

// Force scroll to top when refreshing
if (history.scrollRestoration) {
	history.scrollRestoration = 'manual';
} else {
	window.onbeforeunload = function () {
		window.scrollTo(0, 0);
	};
}

function docReady(fn: any) {
	// see if DOM is already available
	if (document.readyState === 'complete' || document.readyState === 'interactive') {
		// call on next available tick
		setTimeout(fn, 1);
	} else {
		document.addEventListener('DOMContentLoaded', fn);
	}
}

docReady(function () {
	document.body.classList.add('ready');
});
