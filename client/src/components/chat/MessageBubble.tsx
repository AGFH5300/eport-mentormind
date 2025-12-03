import { MessageWithUser } from "@shared/schema";
import { UserAvatar } from "./UserAvatar";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Clock, Check, CheckCheck, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessageBubbleProps {
  message: MessageWithUser;
  showAvatar?: boolean;
  onReply?: (message: MessageWithUser) => void;
  hideAvatar?: boolean;
  hideHeader?: boolean;
}


export function MessageBubble({
  message,
  showAvatar = true,
  onReply,
  hideAvatar,
  hideHeader,
}: MessageBubbleProps) {
  const showAvatarFinal = showAvatar && !hideAvatar;
  const { user } = useAuth();
  const isOwn = message.user_id === user?.id;
  const { toast } = useToast();

  const formatTime = (date: string | Date | null) => {
    if (!date) return '';
    return format(new Date(date), "HH:mm");
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
        "flex gap-3 group w-full",
        isOwn ? "justify-end" : "justify-start"
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
      
      <div
        className={cn(
          "flex flex-col max-w-[calc(100%-72px)]",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {!isOwn && !hideHeader && (
          <div className="flex items-center gap-2 mb-1 text-muted-foreground">
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
          <div className="bg-muted/80 border border-border text-muted-foreground pl-3 pr-2 py-2 mb-2 rounded-xl max-w-md">
            <p className="text-sm leading-relaxed">
              <span className="font-medium text-foreground">
                @{message.reply_to_message.user.username}
              </span>{" "}
              {message.reply_to_message.content.length > 50
                ? `${message.reply_to_message.content.substring(0, 50)}...`
                : message.reply_to_message.content}
            </p>
          </div>
        )}

        <div
          className={cn(
            "relative rounded-2xl p-3 sm:p-4 max-w-xl break-words border shadow-sm",
            isOwn
              ? "bg-primary/10 text-foreground border-primary/30"
              : "bg-card text-foreground border-border"
          )}
        >

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
                    isOwn ? "text-foreground" : "text-foreground"
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

          <p className="leading-relaxed text-[15px] whitespace-pre-line">
            {message.content}
          </p>

          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            {!isOwn && <span>Mentor</span>}
            <span className="flex items-center gap-1">
              {formatTime(message.created_at)}
              {isOwn && getStatusIcon()}
            </span>
          </div>
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
