import { Menu } from '@base-ui/react/menu';
import type { Class } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translatePlayerClass, translatePlayerSpec, translateStatus } from '@i18n/localization';
import { PlayerClasses } from '@sim/player/classes/index';
import type { PlayerClass } from '@sim/player/player_class';
import type { PlayerSpec } from '@sim/player/player_spec';
import { PlayerSpecs } from '@sim/player/specs/index';
import { textClassNameForClass, textClassNameForSpec } from '@sim/proto/utils';
import { menuPositionerZClasses, menuSurfaceClasses, menuWidthClasses } from '@ui-kit/Menu/classes';
import { SimLinkContent } from '@ui-kit/SimLinkContent';
import clsx from 'clsx';

export interface SimTitleDropdownProps {
	currentSpec: PlayerSpec<any>;
}

const SIM_LINK_CLASSES =
	'block w-full border-0 bg-background text-left no-underline hover:bg-surface-hover focus:bg-surface-hover data-[highlighted]:bg-surface-hover data-[popup-open]:bg-surface-hover';

const launchLabel = (launch: { phase: number; status: number }) =>
	i18n.t('sidebar.header.phase', { phase: i18n.t(`common.phases.${launch.phase}`), status: translateStatus(launch.status) });

const ClassSubmenu = ({ playerClass }: { playerClass: PlayerClass<Class> }) => (
	<Menu.SubmenuRoot>
		{/* A real `<button>`: `SubmenuTrigger` renders a `<div>` by default, and this row is a control. */}
		<Menu.SubmenuTrigger
			render={<button type="button" />}
			className={clsx('sim-link', SIM_LINK_CLASSES, textClassNameForClass(playerClass))}
			data-testid="sim-link">
			<SimLinkContent iconPath={playerClass.getIcon('large')} title={translatePlayerClass(playerClass)} />
		</Menu.SubmenuTrigger>
		<Menu.Portal>
			<Menu.Positioner
				side="right"
				align="start"
				sideOffset={0}
				className={clsx('sim-title-positioner', menuPositionerZClasses.plain)}
				data-testid="sim-title-positioner">
				<Menu.Popup className={clsx('sim-title-popup', menuSurfaceClasses.plain, 'w-auto min-w-[300px]')} data-testid="sim-title-popup">
					{Object.values(playerClass.specs).map(spec => (
						<Menu.LinkItem
							key={spec.simLink}
							href={new URL(spec.simLink, window.location.href).toString()}
							className={clsx('sim-link', SIM_LINK_CLASSES, textClassNameForSpec(spec))}
							data-testid="sim-link">
							<SimLinkContent
								iconPath={spec.getIcon('large')}
								label={translatePlayerClass(PlayerSpecs.getPlayerClass(spec))}
								title={translatePlayerSpec(spec)}
								status={launchLabel(spec.launch)}
							/>
						</Menu.LinkItem>
					))}
				</Menu.Popup>
			</Menu.Positioner>
		</Menu.Portal>
	</Menu.SubmenuRoot>
);

export const SimTitleDropdown = ({ currentSpec }: SimTitleDropdownProps) => (
	<div className="h-[calc(var(--sim-header-height)-1px)]" data-testid="sim-title-dropdown-root">
		<div className="dropdown sim-link-dropdown h-full">
			<Menu.Root modal={false}>
				<Menu.Trigger className={clsx('sim-link', textClassNameForSpec(currentSpec))} data-testid="sim-link">
					<SimLinkContent
						iconPath={currentSpec.getIcon('large')}
						label={i18n.t('sidebar.header.title')}
						labelClassName="text-white"
						title={PlayerSpecs.getFullSpecName(currentSpec)}
						status={launchLabel(currentSpec.launch)}
					/>
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Positioner
						align="start"
						sideOffset={0}
						className={clsx('sim-title-positioner', menuPositionerZClasses.plain)}
						data-testid="sim-title-positioner">
						<Menu.Popup className={clsx('sim-title-popup', menuSurfaceClasses.plain, menuWidthClasses.anchor)} data-testid="sim-title-popup">
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
