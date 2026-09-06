import './SimTitleDropdown.scss';

import { Menu } from '@base-ui/react/menu';
import type { PlayerClass } from '@domain/player_class';
import { PlayerClasses } from '@domain/player_classes/index';
import type { PlayerSpec } from '@domain/player_spec';
import { PlayerSpecs } from '@domain/player_specs/index';
import { textCssClassForClass, textCssClassForSpec } from '@domain/proto_utils/utils';
import type { Class } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translatePlayerClass, translatePlayerSpec } from '@i18n/localization';
import clsx from 'clsx';

import { SimLinkContent } from './SimLinkContent';

export interface SimTitleDropdownProps {
	currentSpec: PlayerSpec<any>;
}

const ClassSubmenu = ({ playerClass }: { playerClass: PlayerClass<Class> }) => (
	<Menu.SubmenuRoot>
		{/* A real `<button>`: `SubmenuTrigger` renders a `<div>` by default, and this row is a control. */}
		<Menu.SubmenuTrigger render={<button type="button" />} className={clsx('sim-link', textCssClassForClass(playerClass))}>
			<SimLinkContent iconPath={playerClass.getIcon('large')} title={translatePlayerClass(playerClass)} />
		</Menu.SubmenuTrigger>
		<Menu.Portal>
			<Menu.Positioner side="right" align="start" sideOffset={0} className="sim-title-positioner">
				<Menu.Popup className="sim-title-popup sim-title-popup--specs">
					{Object.values(playerClass.specs).map(spec => (
						<Menu.LinkItem
							key={spec.simLink}
							href={new URL(spec.simLink, window.location.href).toString()}
							className={clsx('sim-link', textCssClassForSpec(spec))}>
							<SimLinkContent
								iconPath={spec.getIcon('large')}
								label={translatePlayerClass(PlayerSpecs.getPlayerClass(spec))}
								title={translatePlayerSpec(spec)}
								launch={spec.launch}
							/>
						</Menu.LinkItem>
					))}
				</Menu.Popup>
			</Menu.Positioner>
		</Menu.Portal>
	</Menu.SubmenuRoot>
);

export const SimTitleDropdown = ({ currentSpec }: SimTitleDropdownProps) => (
	<div className="sim-title-dropdown-root">
		<div className="dropdown sim-link-dropdown">
			<Menu.Root modal={false}>
				<Menu.Trigger className={clsx('sim-link', textCssClassForSpec(currentSpec))}>
					<SimLinkContent
						iconPath={currentSpec.getIcon('large')}
						label={i18n.t('sidebar.header.title')}
						labelIsWhite
						title={PlayerSpecs.getFullSpecName(currentSpec)}
						launch={currentSpec.launch}
					/>
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Positioner align="start" sideOffset={0} className="sim-title-positioner">
						<Menu.Popup className="sim-title-popup">
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
