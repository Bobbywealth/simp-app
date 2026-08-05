import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...rest },
  ref
) {
  const inputId = id || rest.name;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="label-luxe">
          {label}
        </label>
      )}
      <input ref={ref} id={inputId} className={`input-luxe ${className}`} {...rest} />
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className = '', id, ...rest },
  ref
) {
  const inputId = id || rest.name;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="label-luxe">
          {label}
        </label>
      )}
      <textarea ref={ref} id={inputId} className={`input-luxe min-h-[88px] resize-none ${className}`} {...rest} />
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
});
