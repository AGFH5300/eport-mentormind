import { useState, useEffect } from 'react';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserPlus, Search, Check, X, Send } from 'lucide-react';

interface SearchUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  relationship_status: 'none' | 'friends' | 'request_sent' | 'request_received';
}

interface RequestMentorshipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestMentorshipModal({ open, onOpenChange }: RequestMentorshipModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refreshMentorships } = useChat();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search users query
  const { data: searchResults = [], isLoading: isSearching } = useQuery<SearchUser[]>({
    queryKey: ['/api/users/search', debouncedSearchTerm],
    queryFn: () => apiRequest(`/api/users/search?q=${encodeURIComponent(debouncedSearchTerm)}`),
    enabled: debouncedSearchTerm.length > 0,
    staleTime: 30000,
  });

  // Send mentorship request mutation
  const sendFriendRequestMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      const session = await supabase.auth.getSession();
      const response = await fetch('/api/friend-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ recipient_id: recipientId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/search'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
      toast({
        title: 'Mentorship request sent',
        description: 'Your request has been shared with the mentor.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send friend request',
        variant: 'destructive',
      });
    },
  });

  // Accept mentorship request mutation
  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      const session = await supabase.auth.getSession();
      
      // First, find the mentorship request
      const requestsResponse = await fetch('/api/friend-requests', {
        headers: {
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
      });
      
      if (!requestsResponse.ok) {
        throw new Error('Failed to fetch mentorship requests');
      }
      
      const requests = await requestsResponse.json();
      const request = requests.find((req: any) =>
        req.user.id === userId && !req.is_sender
      );

      if (!request) {
        throw new Error('Mentorship request not found');
      }

      // Accept the request
      const response = await fetch(`/api/friend-requests/${request.id}`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/users/search'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
      refreshMentorships();
      toast({
        title: 'Mentorship request accepted',
        description: 'You can now start a mentorship session.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept mentorship request',
        variant: 'destructive',
      });
    },
  });

  // Reject mentorship request mutation
  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      const session = await supabase.auth.getSession();
      
      // First, find the mentorship request
      const requestsResponse = await fetch('/api/friend-requests', {
        headers: {
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
      });
      
      if (!requestsResponse.ok) {
        throw new Error('Failed to fetch mentorship requests');
      }
      
      const requests = await requestsResponse.json();
      const request = requests.find((req: any) =>
        req.user.id === userId && !req.is_sender
      );
      
      if (!request) {
        throw new Error('Mentorship request not found');
      }

      // Reject the request
      const response = await fetch(`/api/friend-requests/${request.id}`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/users/search'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
      toast({
        title: 'Mentorship request declined',
        description: 'Mentorship request has been declined.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to decline mentorship request',
        variant: 'destructive',
      });
    },
  });

  const handleSendRequest = (userId: string) => {
    sendFriendRequestMutation.mutate(userId);
  };

  const handleAcceptRequest = (userId: string) => {
    acceptFriendRequestMutation.mutate(userId);
  };

  const handleRejectRequest = (userId: string) => {
    rejectFriendRequestMutation.mutate(userId);
  };

  const getActionButton = (user: SearchUser) => {
    switch (user.relationship_status) {
      case 'friends':
        return (
          <Badge variant="secondary" className="text-xs">
            <Check className="w-3 h-3 mr-1" />
            Mentorship in progress
          </Badge>
        );
      case 'request_sent':
        return (
          <Badge variant="outline" className="text-xs">
            Mentorship Request Pending
          </Badge>
        );
      case 'request_received':
        return (
          <div className="flex space-x-2">
            <Button
              size="sm"
              onClick={() => handleAcceptRequest(user.id)}
              disabled={acceptFriendRequestMutation.isPending || rejectFriendRequestMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="w-4 h-4 mr-1" />
              Accept Mentorship
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRejectRequest(user.id)}
              disabled={acceptFriendRequestMutation.isPending || rejectFriendRequestMutation.isPending}
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <X className="w-4 h-4 mr-1" />
              Decline
            </Button>
          </div>
        );
      default:
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSendRequest(user.id)}
            disabled={sendFriendRequestMutation.isPending}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            Request Mentorship
          </Button>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Request Mentorship
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, university, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Search Results */}
          <div className="min-h-[200px] max-h-[400px]">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <UserAvatar user={user} size="sm" />
                        <div>
                          <p className="font-medium text-foreground">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                          {user.relationship_status === 'request_received' && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              Sent you a mentorship request
                            </p>
                          )}
                        </div>
                      </div>
                      {getActionButton(user)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : debouncedSearchTerm.length > 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No mentors found</p>
                <p className="text-sm text-muted-foreground">Try searching with a different term</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <UserPlus className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Search for mentors</p>
                <p className="text-sm text-muted-foreground">Enter a name, university, or email to find support</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
