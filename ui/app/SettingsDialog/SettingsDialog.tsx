import i18n from '@i18n/config';
import { setLang, supportedLanguages } from '@i18n/locale_service';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Sim } from '@sim/sim';
import { subscribeSimField, subscribeUiField } from '@sim/state/subscriptions';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';
import type { BooleanPickerConfig } from '@ui-kit/pickers/boolean_picker';
import type { EnumPickerConfig, EnumValueConfig } from '@ui-kit/pickers/enum_picker';
import type { NumberPickerConfig } from '@ui-kit/pickers/number_picker';
import { toastManager } from '@ui-kit/Toast';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useEffect, useId, useMemo, useState } from 'react';

import { trackEvent } from '../../tracking/analytics';
import type { SimHostObject } from '../individual_sim_ui';

export interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	host: SimHostObject<any>;
}

const FIREFOX_WORKER_NOTE = `Too many workers can cause significant memory usage! If sim doesn't finish due to RAM running out use a lower number.`;

export const SettingsDialog = ({ open, onOpenChange, host }: SettingsDialogProps) => {
	const sim = host.sim;
	const restoreTooltipId = useId();
	const firefox = navigator.userAgent.toLowerCase().includes('firefox');

	// Local sim has native threading, so the row is only meaningful on wasm. It starts shown because
	// the answer is a promise, which is what vanilla's `.then(… hidden = true)` did.
	const [isWasm, setIsWasm] = useState(true);
	useEffect(() => {
		let live = true;
		sim.isWasm().then(wasm => {
			if (live) setIsWasm(wasm);
		});
		return () => {
			live = false;
		};
	}, [sim]);

	const lastUsedRngSeed = useStoreSubscribe(
		useMemo(() => subscribeSimField(sim, 'lastUsedRngSeedVersion'), [sim]),
		() => sim.getLastUsedRngSeed(),
	);

	const fixedRngSeedConfig = useMemo(
		(): NumberPickerConfig<Sim> => ({
			id: 'simui-fixed-rng-seed',
			label: i18n.t('info.options.fixed_rng_seed.label'),
			labelTooltip: i18n.t('info.options.fixed_rng_seed.tooltip'),
			extraCssClasses: ['mb-0'],
			storeSubscribe: (subject: Sim) => subscribeSimField(subject, 'fixedRngSeed'),
			getValue: (subject: Sim) => subject.getFixedRngSeed(),
			setValue: (subject: Sim, newValue: number) => {
				subject.setFixedRngSeed(newValue);
			},
		}),
		[],
	);

	const languageConfig = useMemo((): EnumPickerConfig<Sim> => {
		const langs = Object.keys(supportedLanguages);
		const defaultLang = langs.indexOf('en');
		return {
			id: 'simui-language-picker',
			label: i18n.t('info.options.language.label'),
			labelTooltip: i18n.t('info.options.language.tooltip'),
			values: langs.map((lang, index) => ({ name: supportedLanguages[lang], value: index })),
			storeSubscribe: (subject: Sim) => subscribeUiField(subject, 'language'),
			getValue: (subject: Sim) => {
				const index = langs.indexOf(subject.getLanguage());
				return index == -1 ? defaultLang : index;
			},
			setValue: (subject: Sim, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'language',
					label: 'update',
					value: langs[newValue],
				});
				subject.setLanguage(langs[newValue] || 'en');
				setLang(langs[newValue] || 'en');
				// Every string on the page was read at render, so the new language only lands on a reload.
				setTimeout(() => location.reload(), 300);
			},
		};
	}, []);

	const showThreatMetricsConfig = useMemo(
		(): BooleanPickerConfig<Sim> => ({
			id: 'simui-show-threat-metrics',
			label: i18n.t('info.options.feature_toggles.show_threat_metrics'),
			labelTooltip: 'Shows all options and metrics relevant to tanks, like TPS/DTPS.',
			inline: true,
			storeSubscribe: (subject: Sim) => subscribeUiField(subject, 'showThreatMetrics'),
			getValue: (subject: Sim) => subject.getShowThreatMetrics(),
			setValue: (subject: Sim, newValue: boolean) => {
				subject.setShowThreatMetrics(newValue);
			},
		}),
		[],
	);

	const showExperimentalConfig = useMemo(
		(): BooleanPickerConfig<Sim> => ({
			id: 'simui-show-experimental',
			label: i18n.t('info.options.feature_toggles.show_experimental'),
			labelTooltip: 'Shows experimental options, if there are any active experiments.',
			inline: true,
			storeSubscribe: (subject: Sim) => subscribeUiField(subject, 'showExperimental'),
			getValue: (subject: Sim) => subject.getShowExperimental(),
			setValue: (subject: Sim, newValue: boolean) => {
				trackEvent({
					action: 'settings',
					category: 'show-experimental',
					label: 'update',
					value: newValue,
				});
				subject.setShowExperimental(newValue);
			},
		}),
		[],
	);

	const showQuickSwapConfig = useMemo(
		(): BooleanPickerConfig<Sim> => ({
			id: 'simui-show-quick-swap',
			label: i18n.t('info.options.feature_toggles.show_quick_swap'),
			labelTooltip: 'Allows you to quickly swap between Gems/Enchants through your favorites. (Disabled on touch devices)',
			inline: true,
			storeSubscribe: (subject: Sim) => subscribeUiField(subject, 'showQuickSwap'),
			getValue: (subject: Sim) => subject.getShowQuickSwap(),
			setValue: (subject: Sim, newValue: boolean) => {
				subject.setShowQuickSwap(newValue);
			},
		}),
		[],
	);

	const concurrencyConfig = useMemo((): EnumPickerConfig<Sim> => {
		const values: Array<EnumValueConfig> = [{ value: 0, name: 'Off' }];
		for (let workers = 2; workers <= navigator.hardwareConcurrency; workers++) {
			values.push({ value: workers, name: workers.toString() });
		}
		return {
			id: 'simui-concurrent-workers-picker',
			label: i18n.t('info.options.use_multiple_cpu_cores.label'),
			labelTooltip: 'Use web workers to spread sim workload over multiple CPU cores.',
			storeSubscribe: (subject: Sim) => subscribeUiField(subject, 'wasmConcurrency'),
			getValue: (subject: Sim) => subject.getWasmConcurrency(),
			setValue: (subject: Sim, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'concurrency',
					label: 'update',
					value: newValue,
				});
				subject.setWasmConcurrency(newValue);
			},
			values: values,
		};
	}, []);

	const restoreDefaults = () => {
		trackEvent({
			action: 'settings',
			category: 'restore-defaults',
			label: 'restore',
		});
		host.applyDefaults();
		toastManager.add({
			variant: 'success',
			body: i18n.t('info.options.restore_defaults.success_message'),
		});
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			className="settings-menu"
			container={host.rootElem}
			keepMounted
			title={i18n.t('info.options.title')}
			footer={
				<>
					<Button variant="primary" className="restore-defaults-button" {...tooltipAnchorProps(restoreTooltipId)} onClick={restoreDefaults}>
						{i18n.t('info.options.restore_defaults.button')}
					</Button>
					<Tooltip id={restoreTooltipId} content={i18n.t('info.options.restore_defaults.tooltip')} />
				</>
			}>
			<div>
				<div className="picker-group">
					<div className="fixed-rng-seed-container">
						<div className="fixed-rng-seed">
							<NumberPicker modObject={sim} config={fixedRngSeedConfig} />
						</div>
						<div className="form-text">
							<span>{i18n.t('info.options.fixed_rng_seed.last_used')}</span>&nbsp;
							<span className="last-used-rng-seed">{lastUsedRngSeed}</span>
						</div>
					</div>
					<div className="language-picker">
						<EnumPicker modObject={sim} config={languageConfig} />
					</div>
				</div>
				<div className="show-threat-metrics-picker w-50 pe-2">
					<BooleanPicker modObject={sim} config={showThreatMetricsConfig} />
				</div>
				<div className="show-experimental-picker w-50 pe-2">
					<BooleanPicker modObject={sim} config={showExperimentalConfig} />
				</div>
				<div className="show-quick-swap-picker w-50 pe-2">
					<BooleanPicker modObject={sim} config={showQuickSwapConfig} />
				</div>
				<div className="use-concurrency-container w-50 pe-2" hidden={!isWasm}>
					<div className="use-concurrent-workers-picker">
						<EnumPicker modObject={sim} config={concurrencyConfig} />
					</div>
					<div className="form-text" hidden={!firefox}>
						{firefox ? FIREFOX_WORKER_NOTE : ''}
					</div>
				</div>
			</div>
		</Dialog>
	);
};
