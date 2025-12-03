
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/contexts/ChatContext';
import { apiRequest } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Bell, Check, X, UserPlus } from 'lucide-react';

interface FriendRequest {
  id: string;
  is_sender: boolean;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  user: {
    id: string;
    username: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsModal({ open, onOpenChange }: NotificationsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refreshFriends } = useChat();

  // Fetch friend requests
  const { data: friendRequests = [], isLoading } = useQuery<FriendRequest[]>({
    queryKey: ['/api/friend-requests'],
    queryFn: () => {
      console.log('[NOTIFICATIONS DEBUG] Fetching friend requests...');
      return apiRequest('/api/friend-requests');
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: open, // Only fetch when modal is open
  });

  // Accept friend request mutation
  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const session = await supabase.auth.getSession();
      const response = await fetch(`/api/friend-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ action: 'accept' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
      refreshFriends();
      toast({
        title: 'Friend request accepted',
        description: 'You are now friends!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept friend request',
        variant: 'destructive',
      });
    },
  });

  // Reject friend request mutation
  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const session = await supabase.auth.getSession();
      const response = await fetch(`/api/friend-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
      toast({
        title: 'Friend request rejected',
        description: 'Friend request has been declined.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject friend request',
        variant: 'destructive',
      });
    },
  });

  const handleAcceptRequest = (requestId: string) => {
    acceptFriendRequestMutation.mutate(requestId);
  };

  const handleRejectRequest = (requestId: string) => {
    rejectFriendRequestMutation.mutate(requestId);
  };

  // Filter to only show incoming requests (where user is NOT the sender)
  const incomingRequests = friendRequests.filter(req => !req.is_sender && req.status === 'pending');

  console.log('[NOTIFICATIONS DEBUG] Incoming requests:', {
    total: friendRequests.length,
    incoming: incomingRequests.length,
    requests: incomingRequests.map(req => ({
      id: req.id,
      from: req.user?.username,
      is_sender: req.is_sender,
      status: req.status
    }))
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
            {incomingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {incomingRequests.length}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="min-h-[200px] max-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-sm text-muted-foreground">Loading notifications...</span>
              </div>
            ) : incomingRequests.length > 0 ? (
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Friend Requests ({incomingRequests.length})
                  </h4>
                  {incomingRequests.map((request) => (
                    <div 
                      key={request.id} 
                      className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800"
                    >
                      <div className="flex items-center space-x-3">
                        <UserAvatar user={request.user} size="sm" />
                        <div>
                          <p className="font-medium text-foreground">{request.user.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            @{request.user.username} • Wants to be friends
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id)}
                          disabled={acceptFriendRequestMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectRequest(request.id)}
                          disabled={rejectFriendRequestMutation.isPending}
                          className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No new notifications</p>
                <p className="text-sm text-muted-foreground">You're all caught up!</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
