import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };
