import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useChat } from "@/contexts/ChatContext";
import { useRealtime } from "@/hooks/use-realtime";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { MessageWithUser, RoomWithDetails } from "@shared/schema";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/chat/UserAvatar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Users,
  MessageSquare,
  Send,
  Settings,
  Plus,
  UserPlus,
  Check,
  X,
  MoreVertical,
  Hash,
  Bell,
  ChevronDown,
  GraduationCap,
  BookOpen,
  Compass,
} from "lucide-react";

import { AddFriendModal } from "@/components/modals/AddFriendModal";
import { NotificationsModal } from "@/components/modals/NotificationsModal";
import { CreateGroupModal } from "@/components/modals/CreateGroupModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { MentorNavbar } from "@/components/layout/MentorNavbar";

interface FriendRequest {
  id: string;
  is_sender: boolean;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  user: {
    id: string;
    username: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface FriendWithStatus {
  id: string;
  username: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_online?: boolean;
  last_seen?: string;
}

type MentorProfile = {
  id?: string;
  full_name?: string;
  username?: string;
  avatar_url?: string | null;
};

function MentorInfoCard({ mentor }: { mentor?: MentorProfile }) {
  return (
    <Card className="h-full border-border/80 shadow-sm bg-card/80">
      <CardHeader>
        <div className="flex items-center gap-3">
          <UserAvatar
            user={{
              id: mentor?.id || "mentor",
              full_name: mentor?.full_name || "Your mentor",
              username: mentor?.username || "mentor",
              avatar_url: mentor?.avatar_url || null,
            }}
            size="md"
          />
          <div>
            <CardTitle className="text-lg">Mentor profile</CardTitle>
            <p className="text-sm text-muted-foreground">
              {mentor?.full_name || "Alumni mentor"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="w-4 h-4" />
            <span>University: Example University</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="w-4 h-4" />
            <span>Course: Example Course</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Compass className="w-4 h-4" />
            <span>Can help with:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "Subject choices",
              "University applications",
              "Career questions",
            ].map((item) => (
              <Badge key={item} variant="outline" className="rounded-full">
                {item}
              </Badge>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/60 p-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            "Let's focus on your goals. I can share my experience and connect you
            with resources that make the next step clearer."
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Next steps
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Plan your next mentorship session
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary/70" />
              Share your recent wins or questions
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary/50" />
              Keep notes from each conversation
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    friends,
    friendsLoading,
    rooms,
    messages,
    activeRoom,
    setActiveRoom,
    refreshFriends,
    refreshRooms,
    sendMessage: sendChatMessage,
    markAsRead,
    createDirectMessage,
  } = useChat();

  const { typingUsers } = useRealtime();

  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<MessageWithUser | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [creatingChat, setCreatingChat] = useState<string | null>(null);

  const lastSentTextRef = useRef<string>("");

  // Fetch friend requests
  const { data: friendRequests = [] } = useQuery<FriendRequest[]>({
    queryKey: ["/api/friend-requests"],
    queryFn: () => {
      console.log("[CHAT DEBUG] Fetching friend requests...");
      return apiRequest("/api/friend-requests");
    },
    refetchInterval: 30000,
  });

  // Log friend requests when data changes
  useEffect(() => {
    if (friendRequests) {
      console.log("[CHAT DEBUG] Friend requests received:", {
        total: friendRequests?.length || 0,
        pending:
          friendRequests?.filter(
            (req: FriendRequest) => !req.is_sender && req.status === "pending",
          ).length || 0,
        sent:
          friendRequests?.filter(
            (req: FriendRequest) => req.is_sender && req.status === "pending",
          ).length || 0,
        data: friendRequests,
      });
    }
  }, [friendRequests]);

  // Friend request mutations
  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!supabase) throw new Error("Supabase not available");
      const session = await supabase.auth.getSession();
      const response = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ action: "accept" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests"] });
      refreshFriends();
      toast({
        title: "Friend request accepted",
        description: "You are now friends!",
      });
    },
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!supabase) throw new Error("Supabase not available");
      const session = await supabase.auth.getSession();
      const response = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests"] });
      toast({
        title: "Friend request rejected",
      });
    },
  });

  // Current room typing users
  const currentRoomTypingUsers = activeRoom
    ? typingUsers.get(activeRoom.id) || []
    : [];

  const typingUsersData = currentRoomTypingUsers
    .filter((userId: string) => userId !== user?.id)
    .map((userId: string) => friends.find((friend) => friend.id === userId))
    .filter(Boolean) as FriendWithStatus[];

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isOwnMessage = lastMessage.user_id === user?.id;

      if (isAtBottom) {
        setTimeout(() => scrollToBottom(true), 100);
      } else {
        if (!isOwnMessage) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    }
  }, [messages.length, isAtBottom, user?.id]);

  useEffect(() => {
    setUnreadCount(0);
    setIsAtBottom(true);
  }, [activeRoom?.id]);

  useEffect(() => {
    const sentinel = messagesEndRef.current;
    const rootEl = scrollAreaRef.current;
    if (!sentinel || !rootEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const atBottom = entries[0]?.isIntersecting ?? false;
        setIsAtBottom(atBottom);
        if (atBottom) setUnreadCount(0);
      },
      { root: rootEl, threshold: 1.0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [messagesEndRef, scrollAreaRef, activeRoom?.id]);


  useEffect(() => {
    if (!activeRoom) return;
    const id = setTimeout(() => scrollToBottom(false), 0);
    return () => clearTimeout(id);
  }, [activeRoom?.id, messages.length]);

  if (!user) {
    return <div>Loading...</div>;
  }

  const scrollToBottom = (smooth = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
  };

  const handleScrollToBottom = () => {
    scrollToBottom(false); 
    setUnreadCount(0);
    setIsAtBottom(true);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;

    const textNow = newMessage.trim();
    if (!textNow) return;

    // Remember what we tried to send
    lastSentTextRef.current = textNow;

    // Optimistically clear, but ONLY if the user hasn't changed the input since we read it
    setNewMessage((prev) => (prev.trim() === textNow ? "" : prev));

    try {
      await sendChatMessage(activeRoom.id, textNow, replyingTo?.id);

      // Only clear the reply target on success
      setReplyingTo(null);

      // Always scroll to bottom after sending a message
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error: any) {
      console.error("Error sending message:", error);

      // If the box is still empty, restore what we tried to send.
      // If the user already typed something new, don't clobber it.
      setNewMessage((prev) =>
        prev.trim().length === 0 ? lastSentTextRef.current : prev,
      );

      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRoomSelect = (room: RoomWithDetails) => {
    setActiveRoom(room);
    if (room.unread_count && room.unread_count > 0) {
      markAsRead(room.id);
    }
  };

  const handleStartChat = async (friendId: string) => {
    setCreatingChat(friendId);
    try {
      console.log("[CHAT START DEBUG] ===== STARTING CHAT =====");
      console.log("[CHAT START DEBUG] Starting chat with friend:", friendId);
      console.log("[CHAT START DEBUG] Current user:", user?.id);
      console.log("[CHAT START DEBUG] Total rooms loaded:", rooms.length);
      console.log(
        "[CHAT START DEBUG] Current rooms:",
        rooms.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          isPrivate: r.is_private,
          memberCount: r.members?.length,
          members: r.members?.map((m) => ({ id: m.id, username: m.username })),
        })),
      );

      // Force refresh rooms to make sure we have the latest data
      console.log(
        "[CHAT START DEBUG] Refreshing rooms to ensure latest data...",
      );
      await refreshRooms();

      // Wait a bit for the refresh to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check again after refresh
      console.log(
        "[CHAT START DEBUG] After refresh - Total rooms:",
        rooms.length,
      );

      // First check if an existing room already exists and is loaded
      let existingRoom = null;

      for (const room of rooms) {
        console.log("[CHAT START DEBUG] Examining room:", {
          roomId: room.id,
          roomName: room.name,
          roomType: room.type,
          isPrivate: room.is_private,
          memberCount: room.members?.length,
          members: room.members?.map((m) => ({
            id: m.id,
            username: m.username,
            fullName: m.full_name,
          })),
        });

        const isDirectRoom =
          room.type === "direct" ||
          (room.is_private && room.members?.length === 2);
        const hasFriend = room.members?.some(
          (member) => member.id === friendId,
        );
        const hasCurrentUser = room.members?.some(
          (member) => member.id === user?.id,
        );

        console.log("[CHAT START DEBUG] Room analysis:", {
          roomId: room.id,
          isDirectRoom,
          hasFriend,
          hasCurrentUser,
          qualifies: isDirectRoom && hasFriend && hasCurrentUser,
        });

        if (isDirectRoom && hasFriend && hasCurrentUser) {
          existingRoom = room;
          break;
        }
      }

      if (existingRoom) {
        console.log("[CHAT START DEBUG] Found existing room:", {
          roomId: existingRoom.id,
          roomName: existingRoom.name,
          memberCount: existingRoom.members?.length,
        });
        setActiveRoom(existingRoom);
        if (existingRoom.unread_count && existingRoom.unread_count > 0) {
          markAsRead(existingRoom.id);
        }
        toast({
          title: "Chat opened",
          description: "Existing conversation loaded!",
        });
        return;
      }

      console.log(
        "[CHAT START DEBUG] No existing room found, creating new one",
      );
      // Create new room if none exists
      const room = await createDirectMessage(friendId);
      if (room) {
        console.log("[CHAT START DEBUG] New room created successfully:", {
          roomId: room.id,
          memberCount: room.members?.length,
        });
        setActiveRoom(room);
        toast({
          title: "Chat started",
          description: "You can now start messaging!",
        });
      } else {
        console.error(
          "[CHAT START DEBUG] Failed to create room - null returned",
        );
        throw new Error("Failed to create room");
      }
    } catch (error) {
      console.error("[CHAT START DEBUG] Error starting chat:", {
        error: error.message,
        stack: error.stack,
        friendId,
        userId: user?.id,
      });
      toast({
        title: "Error",
        description: "Failed to start chat. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingChat(null);
    }
  };

  // Helper function to format last seen time
  const formatLastSeen = (lastSeen: Date | string | null | undefined) => {
    const lastSeenDate =
      lastSeen instanceof Date
        ? lastSeen
        : lastSeen
          ? new Date(lastSeen)
          : null;
    if (!lastSeenDate) return "Last seen recently";

    try {
      const now = new Date();

      // Check if the date is valid
      if (isNaN(lastSeenDate.getTime())) {
        return "Last seen recently";
      }

      const diffInSeconds = Math.floor(
        (now.getTime() - lastSeenDate.getTime()) / 1000,
      );

      if (diffInSeconds < 60) {
        return "Last seen just now";
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `Last seen ${minutes} min${minutes !== 1 ? "s" : ""} ago`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `Last seen ${hours} hour${hours !== 1 ? "s" : ""} ago`;
      } else {
        const days = Math.floor(diffInSeconds / 86400);
        if (days < 7) {
          return `Last seen ${days} day${days !== 1 ? "s" : ""} ago`;
        } else {
          // Format as readable date and time
          return `Last seen ${lastSeenDate.toLocaleDateString()} at ${lastSeenDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        }
      }
    } catch (error) {
      console.error("Error formatting last seen:", error);
      return "Last seen recently";
    }
  };

  // Helper function to format message timestamps
  const formatMessageTime = (timestamp?: string | Date) => {
    if (!timestamp) return "";

    const messageDate =
      timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(messageDate.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return messageDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const pendingRequests = (friendRequests || []).filter(
    (req: FriendRequest) => !req.is_sender && req.status === "pending",
  );

  console.log("[CHAT DEBUG] Pending requests calculation:", {
    totalRequests: (friendRequests || []).length,
    pendingReceived: pendingRequests.length,
    allRequests: (friendRequests || []).map((req: FriendRequest) => ({
      id: req.id,
      is_sender: req.is_sender,
      status: req.status,
      user: req.user?.username,
    })),
  });

  const mentorMember =
    activeRoom?.members?.find((m) => m.id !== user?.id) ||
    activeRoom?.members?.[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MentorNavbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 h-[calc(100vh-64px)]">
        <div className="rounded-3xl bg-gradient-to-r from-primary/15 via-white to-accent/10 border border-border shadow-md p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-primary">
                Mentorship hub
              </p>
              <h1 className="text-3xl font-semibold leading-tight">
                MentorMind – Alumni–Student Mentorship Hub
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Connect with alumni mentors, plan your mentorship sessions, and keep every conversation focused on your goals.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Card className="min-w-[160px] border-border/70 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Active sessions</p>
                  <p className="text-2xl font-semibold">{rooms.length}</p>
                </CardContent>
              </Card>
              <Card className="min-w-[160px] border-border/70 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Connections</p>
                  <p className="text-2xl font-semibold">{friends.length}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="flex-1 rounded-3xl bg-card shadow-lg border border-border/80 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Sidebar */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <div className="flex flex-col h-full border-r border-border/70 bg-muted/40">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/70 bg-card/80">
              <div className="flex items-center space-x-3">
                <UserAvatar user={user} size="sm" />
                <div>
                  <p className="font-medium text-foreground">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Student • @{user.username}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotifications(true)}
                  className="relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {pendingRequests.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {pendingRequests.length}
                    </Badge>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Navigation */}
            <Tabs defaultValue="rooms" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 m-3 rounded-xl bg-card/80">
                <TabsTrigger
                  value="friends"
                  className="flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Network
                  {pendingRequests.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {pendingRequests.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="rooms" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Mentorship Sessions
                  {rooms.some(
                    (room) => room.unread_count && room.unread_count > 0,
                  ) && (
                    <Badge
                      variant="destructive"
                      className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {rooms.reduce(
                        (total, room) => total + (room.unread_count || 0),
                        0,
                      )}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="friends" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    {/* Header Actions */}
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          People
                        </p>
                        <h4 className="font-semibold text-foreground">
                          Alumni & student connections
                        </h4>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddFriend(true)}
                          data-testid="button-add-friend"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invite mentor
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCreateGroup(true)}
                          data-testid="button-create-group-from-contacts"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Start mentorship circle
                        </Button>
                      </div>
                    </div>

                    {/* Friend Requests Section */}
                    {pendingRequests.length > 0 && (
                      <div className="mb-6">
                        <h5 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          Mentorship invitations ({pendingRequests.length})
                        </h5>
                        <div className="space-y-2">
                          {pendingRequests.map((request) => (
                            <div
                              key={request.id}
                              className="flex items-center justify-between p-3 bg-card rounded-xl border border-border/70 shadow-sm"
                            >
                              <div className="flex items-center space-x-3">
                                <UserAvatar user={request.user} size="sm" />
                                <div>
                                  <p className="font-medium text-foreground">
                                    {request.user.full_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    @{request.user.username} • Wants to mentor
                                  </p>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    acceptFriendRequestMutation.mutate(
                                      request.id,
                                    )
                                  }
                                  disabled={
                                    acceptFriendRequestMutation.isPending
                                  }
                                  data-testid={`button-accept-${request.id}`}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    rejectFriendRequestMutation.mutate(
                                      request.id,
                                    )
                                  }
                                  disabled={
                                    rejectFriendRequestMutation.isPending
                                  }
                                  data-testid={`button-reject-${request.id}`}
                                  className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Decline
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sent Requests Section */}
                    {(friendRequests || []).some(
                      (req: FriendRequest) => req.is_sender,
                    ) && (
                      <div className="mb-6">
                        <h5 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          Sent Requests (
                          {
                            (friendRequests || []).filter(
                              (req: FriendRequest) => req.is_sender,
                            ).length
                          }
                          )
                        </h5>
                        <div className="space-y-2">
                          {/* Sent Requests */}
                          {(friendRequests || [])
                            .filter((req: FriendRequest) => req.is_sender)
                            .map((request: FriendRequest) => (
                              <div
                                key={request.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700"
                              >
                                <div className="flex items-center space-x-3">
                                  <UserAvatar user={request.user} size="sm" />
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {request.user.full_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      @{request.user.username} • Request sent
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Pending
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Current Friends */}
                    {friendsLoading ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <LoadingSpinner size="lg" />
                        <p className="text-muted-foreground mt-4">
                          Loading your contacts...
                        </p>
                      </div>
                    ) : friends.length > 0 ? (
                      <div>
                        <h5 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Your Contacts ({friends.length})
                        </h5>

                        {/* Online Friends */}
                        <div className="mb-4">
                          <h6 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                            Online
                          </h6>
                          <div className="space-y-1">
                            {friends
                              .filter((friend) => friend.is_online)
                              .map((friend) => (
                                <div
                                  key={friend.id}
                                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                                >
                                  <div
                                    className="flex items-center space-x-3 flex-1 cursor-pointer"
                                    onClick={() => handleStartChat(friend.id)}
                                  >
                                    <UserAvatar
                                      user={friend}
                                      size="sm"
                                      showOnline
                                    />
                                    <div>
                                      <p className="font-medium text-foreground">
                                        {friend.full_name}
                                      </p>
                                      <p className="text-xs text-green-600 dark:text-green-400">
                                        @{friend.username} • Online
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStartChat(friend.id)}
                                      disabled={creatingChat === friend.id}
                                      data-testid={`button-chat-${friend.id}`}
                                    >
                                      {creatingChat === friend.id ? (
                                        <LoadingSpinner size="sm" />
                                      ) : (
                                        <MessageSquare className="w-4 h-4" />
                                      )}
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleStartChat(friend.id)
                                          }
                                        >
                                          <MessageSquare className="w-4 h-4 mr-2" />
                                          Send Message
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                          <Users className="w-4 h-4 mr-2" />
                                          View Profile
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600">
                                          <X className="w-4 h-4 mr-2" />
                                          Remove Friend
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Offline Friends */}
                        {friends.filter((friend) => !friend.is_online).length >
                          0 && (
                          <div>
                            <h6 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                              Offline
                            </h6>
                            <div className="space-y-1">
                              {friends
                                .filter((friend) => !friend.is_online)
                                .map((friend) => (
                                  <div
                                    key={friend.id}
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                                  >
                                    <div
                                      className="flex items-center space-x-3 flex-1 cursor-pointer"
                                      onClick={() => handleStartChat(friend.id)}
                                    >
                                      <UserAvatar user={friend} size="sm" />
                                      <div>
                                        <p className="font-medium text-foreground">
                                          {friend.full_name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          @{friend.username} •{" "}
                                          {formatLastSeen(friend.last_seen)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleStartChat(friend.id)
                                        }
                                        disabled={creatingChat === friend.id}
                                        data-testid={`button-chat-${friend.id}`}
                                      >
                                        {creatingChat === friend.id ? (
                                          <LoadingSpinner size="sm" />
                                        ) : (
                                          <MessageSquare className="w-4 h-4" />
                                        )}
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm">
                                            <MoreVertical className="w-4 h-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleStartChat(friend.id)
                                            }
                                          >
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Send Message
                                          </DropdownMenuItem>
                                          <DropdownMenuItem>
                                            <Users className="w-4 h-4 mr-2" />
                                            View Profile
                                          </DropdownMenuItem>
                                          <DropdownMenuItem className="text-red-600">
                                            <X className="w-4 h-4 mr-2" />
                                            Remove Friend
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-2">
                          No contacts yet
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Add friends to start chatting and create groups
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddFriend(true)}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add your first contact
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="rooms" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          My mentorship sessions
                        </p>
                        <h4 className="font-semibold">Guided conversations</h4>
                      </div>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {rooms.length} active
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {rooms.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => handleRoomSelect(room)}
                          className={cn(
                            "w-full flex items-center space-x-3 p-4 rounded-2xl transition-colors text-left border",
                            activeRoom?.id === room.id
                              ? "bg-primary/10 border-primary/40 shadow-sm"
                              : "hover:bg-muted/60 border-border/70 bg-card"
                          )}
                        >
                          {room.type === "direct" ? (
                            <UserAvatar
                              user={
                                room.members.find((m) => m.id !== user?.id) ||
                                room.members[0]
                              }
                              size="sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
                              <Hash className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold truncate">
                                {room.type === "direct"
                                  ? room.members.find((m) => m.id !== user?.id)
                                      ?.full_name || room.name
                                  : room.name}
                              </p>
                              {room.unread_count && room.unread_count > 0 && (
                                <Badge variant="destructive" className="ml-2 rounded-full">
                                  {room.unread_count}
                                </Badge>
                              )}
                            </div>
                            {room.last_message && (
                              <div className="flex justify-between items-center gap-2 mt-1">
                                <p className="text-xs text-muted-foreground truncate flex-1">
                                  {room.last_message.user.username}:{" "}
                                  {room.last_message.content}
                                </p>
                                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                                  {formatMessageTime(
                                    room.last_message.created_at,
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Main Content */}
        <ResizablePanel defaultSize={70} minSize={50}>
          <div className="flex flex-col h-full bg-gradient-to-br from-card to-primary/10">
            {activeRoom ? (
              <>
                <div className="flex flex-col gap-3 p-5 border-b border-border/70 bg-card/90">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {activeRoom.type === "direct" ? (
                        <UserAvatar
                          user={
                            activeRoom.members.find((m) => m.id !== user?.id) ||
                            activeRoom.members[0]
                          }
                          size="md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                          <Hash className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs uppercase tracking-wide text-primary">
                          Active mentorship
                        </p>
                        <h3 className="text-xl font-semibold text-foreground">
                          {activeRoom.type === "direct"
                            ? activeRoom.members.find((m) => m.id !== user?.id)
                                ?.full_name || activeRoom.name
                            : activeRoom.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {activeRoom.type === "group"
                            ? `${(activeRoom.members ?? []).length} mentors & students`
                            : "Planning next session • Share your questions"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full">
                        {activeRoom.type === "group"
                          ? `${(activeRoom.members ?? []).length} members`
                          : (() => {
                              const otherMember = (activeRoom.members ?? []).find(
                                (m) => m.id !== user?.id,
                              );
                              return otherMember?.is_online
                                ? "Online now"
                                : formatLastSeen(otherMember?.last_seen);
                            })()}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="rounded-full">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              console.log("View profile for", activeRoom);
                            }}
                          >
                            <Users className="w-4 h-4 mr-2" />
                            View profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              toast({
                                title: "Notifications muted",
                                description:
                                  "You will no longer receive notifications from this chat.",
                              });
                            }}
                          >
                            <Bell className="w-4 h-4 mr-2" />
                            Mute notifications
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setActiveRoom(null);
                              toast({
                                title: "Left chat",
                                description: "You have left this conversation.",
                              });
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Leave session
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 flex-1 min-h-0 p-4">
                  <div className="xl:col-span-3 bg-card border border-border/80 rounded-2xl shadow-sm flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 relative">
                      <ScrollArea className="h-full px-4 py-3" ref={scrollAreaRef}>
                        <div className="space-y-0">
                          {(() => {
                            console.log(
                              "[CHAT RENDER DEBUG] ===== RENDERING MESSAGES =====",
                            );
                            console.log("[CHAT RENDER DEBUG] Messages to render:", {
                              count: messages.length,
                              timestamp: new Date().toISOString(),
                              activeRoomId: activeRoom?.id,
                              messages: messages.map((m) => ({
                                id: m.id,
                                tempId: m.tempId,
                                content: m.content?.substring(0, 50),
                                user_id: m.user_id,
                                username: m.user?.username,
                                created_at: m.created_at,
                                status: m.status,
                              })),
                            });
                            return null;
                          })()}
                          {[...messages]
                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                            .map((message, index, arr) => {
                              console.log('[CHAT RENDER DEBUG] Rendering individual message:', {
                                id: message.id,
                                tempId: message.tempId,
                                content: message.content?.substring(0, 30),
                                username: message.user?.username,
                                status: message.status
                              });

                              const prev = index > 0 ? arr[index - 1] : undefined;
                              const next = index < arr.length - 1 ? arr[index + 1] : undefined;
                              const groupedWithPrev = !!prev && prev.user_id === message.user_id;
                              const groupedWithNext = !!next && next.user_id === message.user_id;

                              const itemMargin = groupedWithPrev ? 'mt-[3px]' : 'mt-3';

                              const hideAvatar = groupedWithNext;
                              const hideHeader = groupedWithPrev;

                              return (
                                <div
                                  key={message.id ?? message.tempId ?? `${message.user_id}-${message.created_at}`}
                                  className={itemMargin}
                                >
                                  <MessageBubble
                                    message={message}
                                    onReply={(msg) => setReplyingTo(msg)}
                                    hideAvatar={hideAvatar}
                                    hideHeader={hideHeader}
                                  />
                                </div>
                              );
                            })}
                          {typingUsersData.length > 0 && (
                            <TypingIndicator users={typingUsersData} />
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      {/* Scroll to bottom button */}
                      {!isAtBottom && (
                        <div className="absolute bottom-4 right-4 z-10">
                          <Button
                            onClick={handleScrollToBottom}
                            className="rounded-full w-12 h-12 shadow-lg"
                            size="icon"
                            data-testid="scroll-to-bottom"
                          >
                            {unreadCount > 0 && (
                              <Badge
                                className="absolute -top-2 -right-2 min-w-[20px] h-5 text-xs"
                                data-testid="unread-count"
                              >
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </Badge>
                            )}
                            <ChevronDown className="w-5 h-5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 bg-muted/40 border-t border-border/70 rounded-b-2xl">
                      <form
                        onSubmit={handleSendMessage}
                        className="p-4"
                      >
                        {/* Reply Preview */}
                        {replyingTo && (
                          <div className="mb-3 p-3 bg-card rounded-xl border border-primary/30">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  Replying to @{replyingTo.user.username}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {replyingTo.content.length > 50
                                    ? `${replyingTo.content.substring(0, 50)}...`
                                    : replyingTo.content}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setReplyingTo(null)}
                                data-testid="cancel-reply"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={
                              activeRoom.type === "direct"
                                ? "Ask your mentor a question…"
                                : "Share an update with your mentorship circle…"
                            }
                            className="flex-1 rounded-full bg-white/90 border-border/80"
                            data-testid="message-input"
                          />
                          <Button
                            type="submit"
                            disabled={!newMessage.trim()}
                            data-testid="send-button"
                            className="rounded-full"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>

                  <div className="hidden xl:block h-full">
                    <MentorInfoCard mentor={mentorMember} />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div className="max-w-md">
                  <MessageSquare className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">
                    Welcome to MentorMind
                  </h3>
                  <p className="text-muted-foreground">
                    Select a mentorship session from the left or start a new one to begin chatting.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Modals */}
      <AddFriendModal open={showAddFriend} onOpenChange={setShowAddFriend} />
      <NotificationsModal
        open={showNotifications}
        onOpenChange={setShowNotifications}
      />
      <CreateGroupModal
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        friends={friends}
      />
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
    </div>
  );
}
