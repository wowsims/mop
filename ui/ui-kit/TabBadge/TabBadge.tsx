export interface TabBadgeProps {
	label?: string;
}

// The parentheses are content, not decoration: they are text nodes either side of the span, and the
// tab strip is compared as text by the parity gates.
export const TabBadge = ({ label }: TabBadgeProps) =>
	label ? (
		<>
			{' ('}
			<span className="text-success">{label}</span>
			{')'}
		</>
	) : null;
