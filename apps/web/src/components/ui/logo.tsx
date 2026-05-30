import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;
  const textClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="36" height="36" rx="9" fill="#2563EB" />
        {/* Central hub */}
        <circle cx="18" cy="18" r="3.5" fill="white" />
        {/* Connector lines */}
        <path d="M18 10v5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M18 21v5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10 18h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M21 18h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        {/* Endpoint nodes */}
        <circle cx="18" cy="9" r="2" fill="#93C5FD" />
        <circle cx="18" cy="27" r="2" fill="#93C5FD" />
        <circle cx="9" cy="18" r="2" fill="#93C5FD" />
        <circle cx="27" cy="18" r="2" fill="#93C5FD" />
      </svg>
      {showText && (
        <span className={cn('font-bold tracking-tight text-gray-900', textClass)}>
          DX<span className="text-blue-600">Solutions</span>
        </span>
      )}
    </div>
  );
}
