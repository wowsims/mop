import { Menu } from '@base-ui/react/menu';
import { getLang, setLang, supportedLanguages } from '@i18n/locale_service';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import { Icon } from '@ui-kit/Icon';

export const LandingLanguageMenu = () => {
	const portalContainer = usePortalContainer();
	const currentLang = getLang();

	const selectLang = (lang: string) => {
		setLang(lang);
		window.location.reload();
	};

	return (
		<div className="relative">
			<Menu.Root modal={false}>
				<Menu.Trigger
					id="languageDropdown"
					className="ui-landing-language-caret flex items-center px-0 py-4 text-sm whitespace-nowrap text-white-55 max-md:pt-2 md:px-2"
					aria-label={supportedLanguages[currentLang]}>
					<Icon name="globe" size="2x" />
				</Menu.Trigger>
				<Menu.Portal container={portalContainer ?? undefined} keepMounted>
					<Menu.Positioner align="end" sideOffset={0} className="z-dropdown">
						<Menu.Popup className="ui-landing-language-popup">
							{Object.entries(supportedLanguages).map(([code, name]) => (
								<Menu.Item
									key={code}
									render={<button type="button" />}
									className="block w-full font-normal text-start whitespace-nowrap bg-transparent border-0 rounded-none no-underline clear-both text-white"
									data-active={code === currentLang ? '' : undefined}
									data-lang={code}
									data-testid="dropdown-item"
									onClick={() => selectLang(code)}>
									{name}
								</Menu.Item>
							))}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
		</div>
	);
};
