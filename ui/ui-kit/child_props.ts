import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';

// The props of the declaration children a compound component reads. Fragments are flattened, so a
// `condition && <>…</>` group of declarations reads as its items rather than as one child.
export const childProps = <P>(children: ReactNode): ReadonlyArray<P> =>
	Children.toArray(children).flatMap((child): ReadonlyArray<P> => {
		if (!isValidElement(child)) return [];
		if (child.type === Fragment) return childProps<P>((child as ReactElement<{ children?: ReactNode }>).props.children);
		return [child.props as P];
	});
