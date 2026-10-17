import type { LucideIcon } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: LucideIcon
  error?: string
  hint?: ReactNode
}

export default function FormField({
  label,
  icon: Icon,
  error,
  hint,
  id,
  className = '',
  ...inputProps
}: FormFieldProps) {
  const fieldId = id ?? inputProps.name

  return (
    <div className={`form-field${error ? ' form-field--error' : ''} ${className}`.trim()}>
      <label htmlFor={fieldId}>{label}</label>
      <div className="form-field-input-wrap">
        <Icon className="form-field-icon" size={18} strokeWidth={2} aria-hidden />
        <input id={fieldId} {...inputProps} />
      </div>
      {error && <p className="form-error">{error}</p>}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  )
}
