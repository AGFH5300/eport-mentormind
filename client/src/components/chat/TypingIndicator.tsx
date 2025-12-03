import { User } from '@shared/schema';
import { UserAvatar } from './UserAvatar';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  users: User[];
  className?: string;
}

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-3 animate-pulse', className)} data-testid="typing-indicator">
      <UserAvatar user={users[0]} size="sm" className="flex-shrink-0" />
      
      <div className="bg-muted rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {users.length === 1
              ? `${users[0].full_name} is typing`
              : users.length === 2
              ? `${users[0].full_name} and ${users[1].full_name} are typing`
              : `${users[0].full_name} and ${users.length - 1} others are typing`
            }
          </span>
          
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
