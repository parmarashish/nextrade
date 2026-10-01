import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon-only';
  inverted?: boolean; // When on dark backgrounds like #032D60 sidebar
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'full',
  inverted = false,
  className,
}) => {
  const iconSizes = {
    sm: 18,
    md: 22,
    lg: 28,
  };

  const textSizes = {
    sm: 'text-base font-bold',
    md: 'text-xl font-bold tracking-tight',
    lg: 'text-2xl font-extrabold tracking-tight',
  };

  return (
    <div className={cn('inline-flex items-center gap-2 select-none', className)}>
      {/* Dual Circular Arrows Icon */}
      <div
        className={cn(
          'flex items-center justify-center rounded transition-transform duration-200',
          inverted ? 'bg-primary text-white p-1' : 'bg-primary/10 text-primary p-1.5'
        )}
      >
        <RefreshCw size={iconSizes[size]} className="stroke-[2.5]" />
      </div>

      {/* Brand Text: "Nex" in #0176D3 + "Trade" in #032D60 or #FFFFFF */}
      {variant === 'full' && (
        <span className={cn('flex items-baseline', textSizes[size])}>
          <span className="text-[#0176D3]">Nex</span>
          <span className={inverted ? 'text-white' : 'text-[#032D60]'}>Trade</span>
        </span>
      )}
    </div>
  );
};
