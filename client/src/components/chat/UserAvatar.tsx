import { User } from '@shared/schema';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OnlineIndicator } from './OnlineIndicator';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  user: Pick<User, 'id' | 'username' | 'full_name' | 'avatar_url'>;
  size?: 'sm' | 'md' | 'lg';
  showOnline?: boolean;
  isOnline?: boolean;
  className?: string;
}

export function UserAvatar({ 
  user, 
  size = 'md', 
  showOnline = false, 
  isOnline = false, 
  className 
}: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className={cn('relative', className)} data-testid={`user-avatar-${user.id}`}>
      <Avatar className={sizeClasses[size]}>
        {user.avatar_url && (
          <AvatarImage src={user.avatar_url} alt={user.full_name} />
        )}
        <AvatarFallback className="bg-primary text-primary-foreground font-medium">
          {getInitials(user.full_name)}
        </AvatarFallback>
      </Avatar>
      
      {showOnline && (
        <OnlineIndicator
          isOnline={isOnline}
          className="absolute -bottom-1 -right-1"
          size={size === 'lg' ? 'md' : 'sm'}
        />
      )}
    </div>
  );
}
