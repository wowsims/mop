export interface TooltipRowProps {
	label: string;
	value: string;
}

export const TooltipRow = ({ label, value }: TooltipRowProps) => (
	<div className="character-stats-tooltip-row">
		<span>{label}</span>
		<span>{value}</span>
	</div>
);
