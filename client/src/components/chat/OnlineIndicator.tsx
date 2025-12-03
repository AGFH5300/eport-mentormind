import { cn } from '@/lib/utils';

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function OnlineIndicator({ isOnline, size = 'sm', className }: OnlineIndicatorProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
  };

  return (
    <div
      className={cn(
        'rounded-full border-2 border-background',
        sizeClasses[size],
        isOnline ? 'bg-green-500' : 'bg-gray-400',
        className
      )}
      data-testid={`online-indicator-${isOnline ? 'online' : 'offline'}`}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}
