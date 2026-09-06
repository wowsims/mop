import type { Player } from '@domain/player';
import { CharacterStats } from '@features/character-stats';
import { EncounterPicker } from '@features/encounter';
import { CustomSection, OtherSettings, StatOptionIcons } from '@features/settings';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import { relevantStatOptions } from '@features/settings/model/stat_options';
import { SimHostProvider } from '@features/SimHostContext';
import type { SpecDefinition } from '@features/spec_config';
import type { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ImportExportMenu } from './header/ImportExportMenu';
import { useSimReady } from './hooks/useSimReady';
import { IndividualSimUI } from './individual_sim_ui';
import { knownIssuesFor } from './known_issues';
import type { ShellDom } from './shell_dom';
import { SimShell } from './SimShell';
import { SimTabs } from './SimTabs';
import { TalentsTabBody } from './tabs/TalentsTabBody';

export interface SimAppProps<SpecType extends Spec> {
	player: Player<SpecType>;
	def: SpecDefinition<SpecType>;
}

export const SimApp = <SpecType extends Spec>({ player, def }: SimAppProps<SpecType>) => {
	const domRef = useRef<ShellDom | null>(null);
	// The same object as `simUI` below, reachable from callbacks the shell captured before it existed.
	const simUIRef = useRef<IndividualSimUI<SpecType> | null>(null);
	// Constructing the shell is not undoable — loadIndividualSettings subscribes autosave and returns
	// no unsubscribe — so it happens once and StrictMode's second pass is a no-op.
	const constructed = useRef(false);
	const [simUI, setSimUI] = useState<IndividualSimUI<SpecType> | null>(null);
	// `SettingsTab` builds its content blocks on init, so the encounter container is not there before.
	const ready = useSimReady(player.sim);

	// Rendered once and held: everything inside is filled imperatively, so a re-render that recreated
	// any of those nodes would take the vanilla content with it. See SimShell's own note.
	const shell = useMemo(
		() => (
			<SimShell
				domRef={domRef}
				sim={player.sim}
				cssClass={def.cssClass}
				spec={player.getPlayerSpec()}
				knownIssues={knownIssuesFor(player.getPlayerSpec().launch, def.knownIssues)}
				// Created once with the element, so the toolbar's props never change identity. It fires
				// long after the shell exists, which is what makes reaching through the ref safe.
				onOpenSettings={() => simUIRef.current?.simHeader.openSettings()}
			/>
		),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	useLayoutEffect(() => {
		if (constructed.current || !domRef.current) return;
		constructed.current = true;
		simUIRef.current = new IndividualSimUI(domRef.current, player, def);
		setSimUI(simUIRef.current);
	}, [player, def]);

	// The skeleton renders immediately; everything that needs the constructed shell hangs off `simUI`,
	// which only exists after the effect above has run.
	return (
		<>
			<div className="sim-app">{shell}</div>
			{simUI && (
				<SimHostProvider host={simUI}>
					<SimTabs registry={simUI.tabs} strip={simUI.simHeader.simTabsContainer} panes={simUI.simTabContentsContainer} />
					{createPortal(
						<>
							<ImportExportMenu kind="import" registry={simUI.simHeader.importExport} icon="fa fa-download" title={i18n.t('import.title')} />
							<ImportExportMenu
								kind="export"
								registry={simUI.simHeader.importExport}
								icon="fa fa-right-from-bracket"
								title={i18n.t('export.title')}
							/>
						</>,
						simUI.simHeader.importExportContainer,
					)}
					{/* Context reaches through a portal: it follows the React tree, not the DOM one. */}
					{createPortal(<CharacterStats />, simUI.sidebarStatsContainer)}
					{createPortal(<TalentsTabBody />, simUI.talentsTab.contentContainer)}
					{ready &&
						createPortal(
							<EncounterPicker showExecuteProportion={def.encounterPicker.showExecuteProportion} />,
							simUI.settingsTab.encounterContainer,
						)}
					{/* The block itself is absent when the spec declares neither inputs nor swap slots. */}
					{ready &&
						simUI.settingsTab.otherSettingsContainer &&
						createPortal(
							<OtherSettings inputs={def.otherInputs.inputs} itemSlots={def.itemSwapSlots ?? []} />,
							simUI.settingsTab.otherSettingsContainer,
						)}
					{/* Both cooldown blocks are the same shape; the tab decides whether each exists. */}
					{ready &&
						simUI.settingsTab.externalDamageCooldownContainer &&
						createPortal(
							<StatOptionIcons options={relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_EXTERNAL_DAMAGE_COOLDOWN, simUI)} />,
							simUI.settingsTab.externalDamageCooldownContainer,
						)}
					{ready &&
						simUI.settingsTab.externalDefensiveCooldownContainer &&
						createPortal(
							<StatOptionIcons options={relevantStatOptions(BuffDebuffInputs.RAID_BUFFS_EXTERNAL_DEFENSIVE_COOLDOWN, simUI)} />,
							simUI.settingsTab.externalDefensiveCooldownContainer,
						)}
					{/* One per `sections` entry the spec declares; most declare none. */}
					{ready &&
						simUI.settingsTab.customSectionContainers.map(({ section, body }) =>
							createPortal(<CustomSection section={section} />, body, section.id),
						)}
				</SimHostProvider>
			)}
		</>
	);
};
