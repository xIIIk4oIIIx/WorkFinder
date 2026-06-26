'use client';

import { Range } from 'react-range';

interface DualRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  className?: string;
  disabled?: boolean;
}

export function DualRangeSlider({
  min,
  max,
  step = 1000,
  value,
  onChange,
  className,
  disabled,
}: DualRangeSliderProps) {
  return (
    <div style={{ overflow: 'visible', padding: '0 10px' }}>
      <Range
        min={min}
        max={max}
        step={step}
        values={value}
        disabled={disabled}
        onChange={(vals) => onChange(vals as [number, number])}
        renderTrack={({ props, children }) => (
          <div
            {...props}
            className="h-1.5 bg-muted/50 rounded-full relative"
            style={{
              ...props.style,
              cursor: disabled ? 'not-allowed' : 'pointer',
              overflow: 'visible',
            }}
          >
            <div
              className="absolute h-full bg-accent/40 rounded-full"
              style={{
                left: `${((value[0] - min) / (max - min)) * 100}%`,
                right: `${100 - ((value[1] - min) / (max - min)) * 100}%`,
              }}
            />
            {children}
          </div>
        )}
        renderThumb={({ props, index }) => (
          <div
            {...props}
            key={index}
            className={`w-5 h-5 rounded-full bg-accent border-[2.5px] border-background shadow-md ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
            }`}
            style={{
              ...props.style,
              outline: 'none',
              overflow: 'visible',
            }}
          />
        )}
      />
    </div>
  );
}
