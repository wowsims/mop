import { createContext } from 'react';

// An unlaunched sim disables every sidebar action. It rides a context rather than a prop so a spec
// rendering its own button through the registry's escape hatch cannot silently opt out of it.
export const SidebarDisabledContext = createContext(false);
