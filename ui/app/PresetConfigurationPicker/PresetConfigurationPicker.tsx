import type { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { subscribeSimChange } from '@sim/state/subscriptions';
import { applyBuild } from '@features/settings/model/apply_build';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { useReadyStoreSubscribe } from '@sim/hooks/useReadyStoreSubscribe';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId, useMemo } from 'react';

import { buildCategories, isBuildActive } from '../preset_build_state';
import type { PresetBuild } from '../preset_utils';

export interface PresetConfigurationPickerProps {
	categories: Array<PresetConfigurationCategory>;
}

export const PresetConfigurationPicker = ({ categories }: PresetConfigurationPickerProps) => {
	const host = useSimHost();
	const presets = useSpecPresets();
	const ready = useSimReady();
	const tooltipId = useId();

	const builds = useMemo(() => (presets.builds ?? []).filter(build => categories.some(category => !!build[category])), [presets, categories]);

	// The active check must never run against an uninitialised sim; `useReadyStoreSubscribe` keeps
	// that true here.
	const active = useReadyStoreSubscribe(subscribeSimChange(host.sim), () => builds.map(build => isBuildActive(build, host)), ready);

	if (!builds.length) return null;

	return (
		<div className="preset-configuration-picker-root saved-data-manager-root">
			<ContentBlock
				className="saved-data"
				config={{ header: { title: i18n.t('gear_tab.preset_configurations.title'), tooltip: i18n.t('gear_tab.preset_configurations.tooltip') } }}>
				{ready && (
					<div className="saved-data-container">
						<div className="saved-data-presets">
							{builds.map((build, index) => (
								<Button
									key={build.name}
									variant="unstyled"
									className={clsx('saved-data-set-chip badge rounded-pill', active?.[index] && 'active')}
									{...tooltipAnchorProps(tooltipId, build.name)}>
									<span className="saved-data-set-name" role="button" onClick={() => applyBuild(build, host)}>
										{build.name}
									</span>
								</Button>
							))}
						</div>
					</div>
				)}
			</ContentBlock>
			<Tooltip
				id={tooltipId}
				render={({ activeAnchor }) => {
					const build = builds.find(candidate => candidate.name === activeAnchor?.getAttribute('data-tooltip-content'));
					return build ? <PresetBuildTooltip build={build} /> : null;
				}}
			/>
		</div>
	);
};

const PresetBuildTooltip = ({ build }: { build: PresetBuild }) => (
	<>
		<p className="mb-1">{i18n.t('common.preset.description')}</p>
		<ul className="mb-0">
			{buildCategories(build).map(category => (
				<li key={category}>{category}</li>
			))}
		</ul>
	</>
);
