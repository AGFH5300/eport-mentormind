import { MessageWithUser } from '@shared/schema';
import { UserAvatar } from './UserAvatar';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Clock, Check, CheckCheck, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface MessageBubbleProps {
  message: MessageWithUser;
  showAvatar?: boolean;
  onReply?: (message: MessageWithUser) => void;
  hideAvatar?: boolean;
  hideHeader?: boolean;
}


export function MessageBubble({ message, showAvatar = true, onReply, hideAvatar, hideHeader }: MessageBubbleProps) {
  const showAvatarFinal = showAvatar && !hideAvatar;
  const { user } = useAuth();
  const isOwn = message.user_id === user?.id;
  const { toast } = useToast();

  const formatTime = (date: string | Date | null) => {
    if (!date) return '';
    return format(new Date(date), 'HH:mm');
  };

  const getStatusIcon = () => {
    if (!isOwn) return null;

    const iconClass = "w-3 h-3 inline-block ml-[1px]";
    switch (message.status) {
      case "pending":
        return <Clock className={cn(iconClass, "text-gray-400 opacity-60")} />;
      case "sent":
        return <Check className={cn(iconClass, "text-gray-400")} />;
      case "delivered":
        return <CheckCheck className={cn(iconClass, "text-gray-400")} />;
      case "read":
        return <CheckCheck className={cn(iconClass, "text-blue-500")} />;
      default:
        return <CheckCheck className={cn(iconClass, "text-gray-400")} />;
    }
  };


  return (
    <div
      className={cn(
        'flex gap-3 group',
        isOwn ? 'justify-end' : 'justify-start'
      )}
      data-testid={`message-${message.id}`}
    >
      {!isOwn && (
        showAvatarFinal ? (
          <UserAvatar
            user={message.user}
            size="sm"
            className="flex-shrink-0 mt-1"
          />
        ) : (
          <div className="flex-shrink-0 mt-1 w-8 h-8" />
        )
      )}
      
      <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && !hideHeader && (
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-foreground text-sm">
              {message.user.full_name}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(message.created_at)}
            </span>
          </div>
        )}

        {/* Reply reference */}
        {message.reply_to_message && (
          <div className="bg-border border-l-4 border-primary pl-3 py-2 mb-2 rounded max-w-xs">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">@{message.reply_to_message.user.username}</span>
              {' '}
              {message.reply_to_message.content.length > 50
                ? `${message.reply_to_message.content.substring(0, 50)}...`
                : message.reply_to_message.content
              }
            </p>
          </div>
        )}

        <div
          className={cn(
            'message-bubble relative pr-7 rounded-lg p-3 max-w-md break-words',
            isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center bg-black/10 hover:bg-black/20',
                    isOwn ? 'text-primary-foreground' : 'text-foreground'
                  )}
                  aria-label="Message actions"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
                <DropdownMenuItem onClick={() => onReply?.(message)}>
                  Reply
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(message.content || '');
                      toast?.({ title: 'Copied', description: 'Message copied to clipboard' });
                    } catch {
                      console.log('Copy failed');
                    }
                  }}
                >
                  Copy
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p>{message.content}</p>
          
          {isOwn && (
            <div className="flex items-center justify-end gap-1 mt-[2px]">
              <span className="text-[10px] opacity-70 flex items-center gap-[2px]">
                {formatTime(message.created_at)}
                {getStatusIcon()}
              </span>
            </div>
          )}
        </div>
      </div>

      {isOwn && (
        showAvatarFinal ? (
          <UserAvatar
            user={message.user}
            size="sm"
            className="flex-shrink-0 mt-1"
          />
        ) : (
          <div className="flex-shrink-0 mt-1 w-8 h-8" />
        )
      )}
    </div>
  );
}
