/** @jsxImportSource @jsx-vanilla */
import clsx from 'clsx';

import type { ContentRow, HeaderRow, SeparatorRow } from '../model';

export type RowLabelCellProps = {
	text: string;
	withIcon?: boolean;
	withHide?: boolean;
	iconRef?: JSX.HTMLElementProps<'a'>['ref'];
	hideRef?: JSX.HTMLElementProps<'button'>['ref'];
} & Pick<JSX.HTMLElementProps<'div'>, 'className'>;

export const RowLabelCell = ({ text, withIcon, withHide, iconRef, hideRef, className }: RowLabelCellProps) =>
	(
		<div className={clsx('rotation-row-label', className)}>
			{withHide && (
				<button
					ref={hideRef}
					type="button"
					className="rotation-row-hide fas fa-eye-slash"
					title="Hide row"
					attributes={{ 'aria-label': `Hide ${text}` }}
				/>
			)}
			{/* The 'a' tag exists in both the HTML and MathML tag maps, so TS intersects their ref types. */}
			{withIcon && <a ref={iconRef as never} className="rotation-row-icon" />}
			<span className="rotation-label-text">{text}</span>
		</div>
	) as HTMLDivElement;

export type RotationRowElemProps = {
	row: ContentRow;
	trackRef: JSX.HTMLElementProps<'div'>['ref'];
	iconRef?: JSX.HTMLElementProps<'a'>['ref'];
	hideRef?: JSX.HTMLElementProps<'button'>['ref'];
};

export const RotationRowElem = ({ row, trackRef, iconRef, hideRef }: RotationRowElemProps) =>
	(
		<div className={clsx('rotation-row', `rotation-row-${row.kind}`)} style={{ '--row-h': String(row.height) }} dataset={{ rowKey: row.key }}>
			<RowLabelCell text={row.label} withIcon withHide iconRef={iconRef} hideRef={hideRef} />
			<div ref={trackRef} className="rotation-row-track" />
		</div>
	) as HTMLDivElement;

export const SectionHeaderRow = ({ row, iconRef }: { row: HeaderRow; iconRef?: JSX.HTMLElementProps<'a'>['ref'] }) =>
	(
		<div className="rotation-row rotation-row-header" style={{ '--row-h': String(row.height) }} dataset={{ rowKey: row.key }}>
			<RowLabelCell text={row.label} withIcon={!!row.actionId} iconRef={iconRef} />
			<div className="rotation-row-track" />
		</div>
	) as HTMLDivElement;

export const SeparatorRowElem = ({ row }: { row: SeparatorRow }) =>
	(
		<div className="rotation-row rotation-row-separator" style={{ '--row-h': String(row.height) }} dataset={{ rowKey: row.key }}>
			<div className="rotation-row-label" />
			<div className="rotation-row-track" />
		</div>
	) as HTMLDivElement;
