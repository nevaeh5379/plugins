/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Input, type InputProps } from './input';
import { cn } from '@/lib/utils';

export interface InputNumberProps extends Omit<InputProps, 'onChange' | 'value'> {
  value?: number | string | null;
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  addonAfter?: React.ReactNode;
  formatter?: (value: any) => string;
  parser?: (displayValue: any) => number | string;
}

export const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(
  ({ value, onChange, min, max, step = 1, addonAfter, formatter, parser, className, style, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let valStr = e.target.value;
      if (parser) {
        const parsed = parser(valStr);
        valStr = String(parsed);
      }
      if (valStr === '') {
        onChange?.(null);
        return;
      }
      const num = Number(valStr);
      if (!isNaN(num)) {
        let finalNum = num;
        if (min !== undefined && finalNum < min) finalNum = min;
        if (max !== undefined && finalNum > max) finalNum = max;
        onChange?.(finalNum);
      }
    };

    const displayValue = formatter && value !== undefined && value !== null ? formatter(value) : (value ?? '');

    return (
      <Input
        ref={ref}
        type={formatter ? "text" : "number"}
        min={min}
        max={max}
        step={step}
        value={displayValue}
        onChange={handleChange}
        addonAfter={addonAfter}
        style={style}
        className={cn("text-center font-medium tabular-nums", className)}
        {...props}
      />
    );
  }
);

InputNumber.displayName = 'InputNumber';
