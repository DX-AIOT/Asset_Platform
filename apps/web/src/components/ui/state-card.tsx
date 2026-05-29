import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type StateCardVariant = 'loading' | 'error' | 'empty';

interface StateCardProps {
  variant: StateCardVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const iconByVariant = {
  loading: Loader2,
  error: AlertCircle,
  empty: Inbox,
} as const;

const iconClassByVariant = {
  loading: 'text-blue-600 animate-spin',
  error: 'text-red-600',
  empty: 'text-gray-500',
} as const;

export function StateCard({ variant, title, description, actionLabel, onAction }: StateCardProps) {
  const Icon = iconByVariant[variant];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
        <Icon className={`h-5 w-5 ${iconClassByVariant[variant]}`} />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-4" variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
