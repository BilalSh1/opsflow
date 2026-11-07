import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function TextField({ label, ...inputProps }: TextFieldProps) {
  const id = useId()

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...inputProps} />
    </div>
  )
}
