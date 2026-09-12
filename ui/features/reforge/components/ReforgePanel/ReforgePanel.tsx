import './ReforgePanel.scss';

import type { ReforgeOptimizerModel, ReforgeOptimizerOptions } from '@features/reforge/model/reforge_optimizer';
import type { ItemSlot } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSimRun } from '@sim/hooks/useSimRun';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { SimRunKind } from '@sim/state/sim_store';
import { isDevMode } from '@sim/utils/env';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Popover } from '@ui-kit/Popover';
import { ProgressTrackerDialog } from '@ui-kit/ProgressTrackerDialog';
import { toastManager, type ToastOptions } from '@ui-kit/Toast';
import { Tooltip, tooltipAnchorProps, type TooltipRefProps } from '@ui-kit/Tooltip';
import { type ReactNode, useCallback, useId, useRef, useState } from 'react';

import { trackEvent, trackPageView } from '../../../../tracking/analytics';
import { ReforgeDoneToast } from './ReforgeDoneToast';
import { ReforgeSettingsPanel } from './ReforgeSettingsPanel';
import { ReforgeSoftCapsTooltip } from './ReforgeSoftCapsTooltip';

export interface ReforgePanelProps {
	model: ReforgeOptimizerModel;
	options?: ReforgeOptimizerOptions;
	/** Where the popover mounts: this same action group, whose containing block is the sticky `aside` — `--settings-button-width` resolves there. */
	container?: HTMLElement | null;
}

/**
 * The optimizer's sidebar controls: the run button with its breakpoint tooltip, the settings
 * popover, the progress dialog and the run's outcome toasts. Everything below it is the model,
 * which `individual_sim_ui` owns and every un-ported caller still reads as `simUI.reforger`.
 */
export const ReforgePanel = ({ model, options, container }: ReforgePanelProps) => {
	const host = useSimHost();
	const player = host.player;
	const sim = host.sim;

	const [open, setOpen] = useState(false);
	const [progressOpen, setProgressOpen] = useState(false);
	const toastId = useRef<string | null>(null);

	const wasCM = useRef(false);
	const isCancelling = useRef(false);

	const { isRunning } = useSimRun(SimRunKind.ReforgeOptimize);
	const softCapsTooltipId = useId();
	const settingsTooltipId = useId();
	const settingsTooltipRef = useRef<TooltipRefProps>(null);

	const hideToast = useCallback(() => {
		// Without the id this would close every toast in the standard area, not just this one.
		if (toastId.current) toastManager.close(toastId.current);
		toastId.current = null;
	}, []);

	const showToast = useCallback((node: ReactNode, toastOptions: Omit<ToastOptions, 'body'>) => {
		toastId.current = toastManager.add({ ...toastOptions, body: node });
	}, []);

	const onReforgeDone = useCallback(() => {
		const currentGear = player.getGear();
		const itemSlots = currentGear.getItemSlots();
		const changedSlots = new Map<ItemSlot, EquippedItem | undefined>();
		for (const slot of itemSlots) {
			const previous = model.previousGear?.getEquippedItem(slot);
			const current = currentGear?.getEquippedItem(slot);
			if ((!previous && current) || (previous && current && !previous?.equals(current))) changedSlots.set(slot, current);
		}

		trackEvent({ action: 'settings', category: 'reforging', label: 'suggest_success' });

		if (!changedSlots.size) {
			toastId.current = toastManager.add({
				className: 'suggest-reforges-toast',
				variant: 'success',
				body: i18n.t('gear_tab.reforge_success.no_changes'),
				autohide: true,
				delay: 3000,
			});
			return;
		}

		const settingsExport = IndividualSimSettings.toJson(host.toProto());
		showToast(
			<ReforgeDoneToast
				itemSlots={itemSlots}
				changedSlots={changedSlots}
				previousGear={model.previousGear}
				settingsExport={settingsExport}
				onCopied={hideToast}
			/>,
			{ className: 'suggest-reforges-toast', variant: 'success', autohide: false, delay: 3000 },
		);
	}, [host, model, player, showToast, hideToast]);

	const onReforgeError = useCallback(
		(error: unknown) => {
			if (isDevMode()) console.log(error);
			if (model.previousGear) void player.setGearAsync(model.previousGear);
			trackEvent({ action: 'settings', category: 'reforging', label: 'suggest_error', value: String(error) });

			showToast(
				<>
					{i18n.t('sidebar.buttons.suggest_reforges.reforge_optimization_failed')}
					<p />
					<p>
						<b>Reason for failure:</b> <i>{String(error)}</i>
					</p>
				</>,
				{ variant: 'error', delay: 10000 },
			);
		},
		[model, player, showToast],
	);

	const onReforgeFinally = useCallback(() => {
		setProgressOpen(false);
		if (wasCM.current) player.setChallengeModeEnabled(true);
		performance.mark('reforge-optimization-end');
		const completionTimeInMs = performance.measure('reforge-optimization-measure', 'reforge-optimization-start', 'reforge-optimization-end').duration;
		if (isDevMode()) console.log('Reforge optimization took:', `${completionTimeInMs.toFixed(2)}ms`);
		trackEvent({ action: 'settings', category: 'reforging', label: 'suggest_duration', value: Math.ceil(completionTimeInMs / 1000) });
	}, [player]);

	const onOptimize = async () => {
		if (sim.runs.isRunning(SimRunKind.ReforgeOptimize)) return;
		hideToast();
		setProgressOpen(true);
		trackEvent({ action: 'settings', category: 'reforging', label: 'suggest_start' });

		wasCM.current = player.getChallengeModeEnabled();
		// Reset per run, so an error after the first cancel is not swallowed and the gear is restored.
		isCancelling.current = false;
		try {
			performance.mark('reforge-optimization-start');
			if (wasCM.current) player.setChallengeModeEnabled(false);
			const gear = await model.optimizeReforges();
			await player.setGearAsync(gear);
			onReforgeDone();
		} catch (error) {
			if (isCancelling.current) return;
			onReforgeError(error);
		} finally {
			onReforgeFinally();
		}
	};

	const onCancel = async () => {
		isCancelling.current = true;
		if (isDevMode()) console.log('User cancelled reforge optimization');
		try {
			await model.abortReforgeOptimization();
		} catch {
			// The abort races the solve finishing on its own; either way the run is over.
		}
		if (model.previousGear) player.setGear(model.previousGear);
		setProgressOpen(false);
		trackEvent({ action: 'settings', category: 'reforging', label: 'suggest_cancel' });

		toastManager.add({ variant: 'warning', body: i18n.t('sidebar.buttons.suggest_reforges.reforge_optimization_cancelled'), delay: 3000 });
	};

	return (
		<>
			<Button
				className="sim-sidebar-action-button suggest-reforges-action-button flex-grow-1"
				disabled={isRunning}
				onClick={onOptimize}
				{...tooltipAnchorProps(softCapsTooltipId)}>
				{i18n.t('sidebar.buttons.suggest_reforges.title')}
				<span className="sim-sidebar-action-button-loading-icon">
					<Icon name="spinner" spin />
				</span>
			</Button>
			<Popover
				open={open}
				onOpenChange={nextOpen => {
					setOpen(nextOpen);
					if (!nextOpen) return;
					// Closed through the ref rather than unmounted: `hidden` leaves react-tooltip open on the remount, with no anchor hover left to close it.
					settingsTooltipRef.current?.close();
					trackPageView('Reforge Settings', 'reforge-settings');
				}}
				container={container ?? host.rootElem}
				side="right"
				align="start"
				className="reforge-optimiser-popover"
				triggerClassName="sim-sidebar-action-button btn btn-primary suggest-reforges-button-settings"
				triggerProps={tooltipAnchorProps(settingsTooltipId)}
				trigger={
					<>
						<Icon name="cog" />
						<span className="sim-sidebar-action-button-loading-icon">
							<Icon name="spinner" spin />
						</span>
					</>
				}>
				<ReforgeSettingsPanel model={model} options={options} onClose={() => setOpen(false)} />
			</Popover>
			<Tooltip ref={settingsTooltipRef} id={settingsTooltipId} place="bottom" content={i18n.t('sidebar.buttons.suggest_reforges.tooltip')} />
			<Tooltip
				id={softCapsTooltipId}
				place="bottom"
				clickable
				className="suggest-reforges-softcaps"
				// The limits are read per open.
				render={() => {
					const softCaps = model.softCapsConfigWithLimits;
					if (!softCaps?.length) return null;
					return (
						<ReforgeSoftCapsTooltip
							player={player}
							softCaps={softCaps}
							additionalInformation={options?.additionalSoftCapTooltipInformation ?? {}}
						/>
					);
				}}
			/>
			{progressOpen && (
				<ProgressTrackerDialog
					open
					container={host.rootElem}
					className="reforge-optimizer-progress-tracker"
					title="Optimizing Reforges"
					state={{ stage: 'initializing' }}
					warning={
						<>
							<p>
								Reforging can be a lengthy process, especially as specific stat caps and breakpoints come into play for classes. This may take a
								while, but be assured that the calculation will eventually complete.
							</p>
							<p className="mb-0">You may cancel this operation at any time using the button below.</p>
						</>
					}
					onCancel={onCancel}
				/>
			)}
		</>
	);
};
