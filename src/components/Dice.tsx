import React, { useEffect, useState } from 'react';

interface DiceProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  rolling?: boolean;
}

export const Dice: React.FC<DiceProps> = ({ value, size = 'md', rolling = false }) => {
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    if (!rolling) { setDisplayValue(value); return; }
    let face = 0;
    const timer = setInterval(() => { face = (face + 1) % 6; setDisplayValue(face + 1); }, 85);
    return () => clearInterval(timer);
  }, [rolling, value]);
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg shadow-sm p-1.5',
    md: 'w-12 h-12 rounded-xl shadow-md p-2',
    lg: 'w-16 h-16 rounded-2xl shadow-xl p-2.5',
  }[size];

  const pipSize = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }[size];

  // Grid coordinates [row, col] 1-indexed for 3x3 grid
  const getPipPositions = (num: number): [number, number][] => {
    switch (num) {
      case 1:
        return [[2, 2]];
      case 2:
        return [[1, 3], [3, 1]];
      case 3:
        return [[1, 3], [2, 2], [3, 1]];
      case 4:
        return [[1, 1], [1, 3], [3, 1], [3, 3]];
      case 5:
        return [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]];
      case 6:
        return [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]];
      default:
        return [[2, 2]];
    }
  };

  const positions = getPipPositions(Math.max(1, Math.min(6, displayValue || 1)));

  return (
    <div
      role="img" aria-label={rolling ? "Würfel wird geworfen" : `Würfel: ${value}`}
      className={`relative bg-gradient-to-br from-stone-50 via-white to-stone-200 border-2 border-stone-300 text-slate-900 grid grid-cols-3 grid-rows-3 select-none transform transition-transform duration-300 ${sizeClasses} ${
        rolling ? 'dice-tumbling' : 'hover:scale-105 shadow-amber-500/10'
      }`}
      style={{
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 10px rgba(0,0,0,0.3)',
      }}
    >
      {positions.map(([row, col], idx) => (
        <span
          key={idx}
          style={{ gridRow: row, gridColumn: col }}
          className={`m-auto rounded-full bg-slate-900 shadow-inner ${pipSize} ${
            displayValue === 1 ? 'bg-red-600' : 'bg-slate-900'
          }`}
        />
      ))}
    </div>
  );
};
