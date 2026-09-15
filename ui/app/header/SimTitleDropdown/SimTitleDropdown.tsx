import { Menu } from '@base-ui/react/menu';
import type { Class } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translatePlayerClass, translatePlayerSpec, translateStatus } from '@i18n/localization';
import { PlayerClasses } from '@sim/player/classes/index';
import type { PlayerClass } from '@sim/player/player_class';
import type { PlayerSpec } from '@sim/player/player_spec';
import { PlayerSpecs } from '@sim/player/specs/index';
import { textClassNameForClass, textClassNameForSpec } from '@sim/proto/utils';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import { SimLinkContent } from '@ui-kit/SimLinkContent';
import clsx from 'clsx';

export interface SimTitleDropdownProps {
	currentSpec: PlayerSpec<any>;
}

const SIM_LINK_CLASSES =
	'block w-full border-0 bg-background text-left no-underline hover:bg-surface-hover focus:bg-surface-hover data-highlighted:bg-surface-hover data-popup-open:bg-surface-hover';

const launchLabel = (launch: { phase: number; status: number }) =>
	i18n.t('sidebar.header.phase', { phase: i18n.t(`common.phases.${launch.phase}`), status: translateStatus(launch.status) });

const ClassSubmenu = ({ playerClass }: { playerClass: PlayerClass<Class> }) => {
	const portalContainer = usePortalContainer();
	return (
		<Menu.SubmenuRoot>
			<li role="none">
				<Menu.SubmenuTrigger
					render={<button type="button" />}
					className={clsx(SIM_LINK_CLASSES, textClassNameForClass(playerClass))}
					data-testid="sim-link">
					<SimLinkContent iconPath={playerClass.getIcon('large')} title={translatePlayerClass(playerClass)} />
				</Menu.SubmenuTrigger>
				<Menu.Portal container={portalContainer ?? undefined}>
					<Menu.Positioner side="right" align="start" sideOffset={0} className="ui-menu-positioner-plain" data-testid="sim-title-positioner">
						<Menu.Popup
							render={<ul />}
							className={clsx('m-0 list-none p-0', 'ui-sim-title-popup', 'ui-menu-plain', 'w-auto min-w-popup-min-w')}
							data-testid="sim-title-popup">
							{Object.values(playerClass.specs).map(spec => (
								<li key={spec.simLink} role="none">
									<Menu.LinkItem
										href={new URL(spec.simLink, window.location.href).toString()}
										className={clsx(SIM_LINK_CLASSES, textClassNameForSpec(spec))}
										data-testid="sim-link">
										<SimLinkContent
											iconPath={spec.getIcon('large')}
											label={translatePlayerClass(PlayerSpecs.getPlayerClass(spec))}
											title={translatePlayerSpec(spec)}
											status={launchLabel(spec.launch)}
										/>
									</Menu.LinkItem>
								</li>
							))}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</li>
		</Menu.SubmenuRoot>
	);
};

export const SimTitleDropdown = ({ currentSpec }: SimTitleDropdownProps) => {
	const portalContainer = usePortalContainer();
	return (
		<div className="h-sim-header-minus" data-testid="sim-title-dropdown-root">
			<div className="relative h-full" data-testid="sim-link-dropdown">
				<Menu.Root modal={false}>
					<Menu.Trigger
						className={clsx(
							'ui-sim-title-trigger flex h-full w-full bg-background hover:bg-surface-hover focus:bg-surface-hover data-popup-open:bg-surface-hover',
							textClassNameForSpec(currentSpec),
						)}
						data-testid="sim-link">
						<SimLinkContent
							iconPath={currentSpec.getIcon('large')}
							label={i18n.t('sidebar.header.title')}
							labelClassName="text-white"
							title={PlayerSpecs.getFullSpecName(currentSpec)}
							status={launchLabel(currentSpec.launch)}
						/>
					</Menu.Trigger>
					<Menu.Portal container={portalContainer ?? undefined}>
						<Menu.Positioner
							align="start"
							sideOffset={0}
							className={clsx('ui-sim-title-positioner', 'ui-menu-positioner-plain')}
							data-testid="sim-title-positioner">
							<Menu.Popup
								render={<ul />}
								className={clsx('m-0 list-none p-0', 'ui-sim-title-popup', 'ui-menu-plain', 'ui-menu-anchor-width')}
								data-testid="sim-title-popup">
								{PlayerClasses.naturalOrder.map(playerClass => (
									<ClassSubmenu key={playerClass.friendlyName} playerClass={playerClass} />
								))}
							</Menu.Popup>
						</Menu.Positioner>
					</Menu.Portal>
				</Menu.Root>
			</div>
		</div>
	);
};
