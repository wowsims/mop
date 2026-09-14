import { Menu } from '@base-ui/react/menu';
import { getLang, setLang, supportedLanguages } from '@i18n/locale_service';
import { Icon } from '@ui-kit/Icon';

export const LandingLanguageMenu = () => {
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
					className="nav-link flex items-center text-sm py-4 px-0 md:px-2 max-md:pt-2 whitespace-nowrap text-white-55 ui-landing-language-caret"
					aria-label={supportedLanguages[currentLang]}>
					<Icon name="globe" size="2x" />
				</Menu.Trigger>
				<Menu.Portal keepMounted>
					<Menu.Positioner align="end" sideOffset={0} className="z-dropdown">
						<Menu.Popup className="ui-landing-language-popup">
							{Object.entries(supportedLanguages).map(([code, name]) => (
								<Menu.Item
									key={code}
									render={<button type="button" />}
									className="dropdown-item block w-full font-normal [text-align:start] whitespace-nowrap bg-transparent border-0 rounded-none no-underline clear-both text-white"
									data-active={code === currentLang ? '' : undefined}
									data-lang={code}
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
