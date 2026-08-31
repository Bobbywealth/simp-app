import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { forwardRef, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, className = '', id, type, ...rest },
  ref
) {
  const inputId = id || rest.name;
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);
  const descriptionId = error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined;

  return (
    <div>
      {label && <label htmlFor={inputId} className="label-luxe">{label}</label>}
      <div className="relative">
        <input ref={ref} id={inputId} type={isPassword && showPassword ? 'text' : type} aria-invalid={error ? true : undefined} aria-describedby={descriptionId} className={`input-luxe pr-10 ${className}`} {...rest} />
        {isPassword && (
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-gold-100" aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          </button>
        )}
      </div>
      {helperText && !error && <p id={`${inputId}-help`} className="mt-2 text-[11px] leading-relaxed text-white/42">{helperText}</p>}
      {error && <p id={`${inputId}-error`} className="mt-2 text-xs text-red-300" role="alert">{error}</p>}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, helperText, className = '', id, ...rest },
  ref
) {
  const inputId = id || rest.name;
  const descriptionId = error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined;
  return (
    <div>
      {label && <label htmlFor={inputId} className="label-luxe">{label}</label>}
      <textarea ref={ref} id={inputId} aria-invalid={error ? true : undefined} aria-describedby={descriptionId} className={`input-luxe min-h-[104px] resize-none leading-relaxed ${className}`} {...rest} />
      {helperText && !error && <p id={`${inputId}-help`} className="mt-2 text-[11px] leading-relaxed text-white/42">{helperText}</p>}
      {error && <p id={`${inputId}-error`} className="mt-2 text-xs text-red-300" role="alert">{error}</p>}
    </div>
  );
});
