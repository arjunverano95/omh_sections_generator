'use client'
import { type RowLabelProps, useRowLabel } from '@payloadcms/ui'

type Props = RowLabelProps & {
  /** The row field whose value titles the row; set through `rowLabel(field)`. */
  field: string
}

const labelOf = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (typeof value === 'number') return String(value)
  // A link group: title the row by the link's label.
  if (typeof value === 'object' && value !== null && 'label' in value) return labelOf(value.label)
  return undefined
}

export const RowLabel: React.FC<Props> = ({ field }) => {
  const { data, rowNumber } = useRowLabel<Record<string, unknown> | undefined>()

  const label = labelOf(data?.[field])
  const fallback = rowNumber !== undefined ? `Row ${rowNumber + 1}` : 'Row'

  return <div>{label ?? fallback}</div>
}
