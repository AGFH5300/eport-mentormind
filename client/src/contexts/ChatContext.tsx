import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { MessageWithUser, RoomWithDetails, FriendWithStatus, MessageStatus } from '@shared/schema';

interface ChatContextType {
  activeRoom: RoomWithDetails | null;
  setActiveRoom: (room: RoomWithDetails | null) => void;
  messages: MessageWithUser[];
  rooms: RoomWithDetails[];
  friends: FriendWithStatus[];
  friendsLoading: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, string[]>;
  sendMessage: (roomId: string, content: string, replyTo?: string) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  refreshRooms: () => void;
  refreshFriends: () => void;
  markAsRead: (roomId: string) => void;
  createDirectMessage: (friendId: string) => Promise<RoomWithDetails | null>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<RoomWithDetails | null>(null);
  const [messages, setMessages] = useState<MessageWithUser[]>([]);

  // Debug messages state changes
  useEffect(() => {
    console.log('[MESSAGES STATE DEBUG] Messages state changed:', {
      count: messages.length,
      timestamp: new Date().toISOString(),
      activeRoomId: activeRoom?.id,
      messages: messages.map(m => ({ 
        id: m.id, 
        tempId: m.tempId, 
        content: m.content?.substring(0, 50), 
        user_id: m.user_id,
        username: m.user?.username,
        created_at: m.created_at,
        status: m.status
      }))
    });
  }, [messages]);
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [friends, setFriends] = useState<FriendWithStatus[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsInitialLoad, setFriendsInitialLoad] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeRoomRef = useRef<RoomWithDetails | null>(null);

  const shouldReconnectRef = useRef(true);

  // WebSocket connection
  useEffect(() => {
    if (!user) return;

    shouldReconnectRef.current = true;

    let isAuthenticated = false;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let authenticationTimeout: NodeJS.Timeout | null = null;

    const connectWebSocket = async () => {
      try {
        // Close existing connection
        if (wsRef.current) {
          console.log('[WS DEBUG] Closing existing WebSocket connection');
          wsRef.current.close();
          wsRef.current = null;
        }

        // Clear any pending reconnection
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }

        // Use the current window location for WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/chat-ws`;

        console.log('[WS DEBUG] Attempting WebSocket connection to:', wsUrl);
        console.log('[WS DEBUG] Connection details:', {
          protocol,
          host,
          fullUrl: wsUrl,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        });

        // Validate URL before creating WebSocket
        if (!host || host === 'localhost:undefined' || host.includes('undefined')) {
          console.error('[WS DEBUG] Invalid host for WebSocket connection:', host);
          reconnectTimeout = setTimeout(() => connectWebSocket(), 5000);
          return;
        }

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        isAuthenticated = false;

        ws.onopen = async () => {
          console.log('[WS DEBUG] WebSocket connected successfully');
          // Authenticate WebSocket connection immediately
          try {
            const session = await supabase.auth.getSession();
            if (session.data.session) {
              const authMessage = {
                type: 'auth',
                token: session.data.session.access_token,
              };
              console.log('[WS DEBUG] Sending auth message:', { type: authMessage.type, tokenLength: authMessage.token.length });
              ws.send(JSON.stringify(authMessage));
              
              // Set timeout for authentication
              authenticationTimeout = setTimeout(() => {
                if (!isAuthenticated && wsRef.current === ws) {
                  console.error('[WS DEBUG] Authentication timeout - no response after 5 seconds');
                  ws.close();
                }
              }, 5000);
            } else {
              console.error('[WS DEBUG] No session found for authentication');
            }
          } catch (error) {
            console.error('[WS DEBUG] Error during authentication:', error);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WS DEBUG] Received message:', {
              type: data.type,
              fullData: data,
              timestamp: new Date().toISOString(),
              activeRoomId: activeRoom?.id
            });

            switch (data.type) {
              case 'authenticated':
                console.log('[WS DEBUG] ===== WEBSOCKET AUTHENTICATED =====');
                console.log('[WS DEBUG] WebSocket authenticated successfully', {
                  userId: data.userId,
                  success: data.success,
                  timestamp: new Date().toISOString()
                });
                isAuthenticated = true;
                
                // Clear any pending authentication timeout
                if (authenticationTimeout) {
                  clearTimeout(authenticationTimeout);
                  authenticationTimeout = null;
                }
                
                // Immediately join current room after authentication
                console.log('[WS DEBUG] Authentication confirmed, joining current room...');
                if (activeRoomRef.current) {
                  console.log('[WS DEBUG] Active room found, attempting to join:', activeRoomRef.current.id);
                  // Small delay to ensure authentication is fully processed
                  setTimeout(() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      joinCurrentRoom();
                    }
                  }, 50);
                } else {
                  console.log('[WS DEBUG] No active room to join after authentication');
                }
                break;

              case 'room_joined':
                console.log('[WS DEBUG] ===== ROOM JOIN CONFIRMATION =====');
                console.log('[WS DEBUG] Room join confirmed:', {
                  roomId: data.roomId,
                  success: data.success,
                  error: data.error,
                  clientsInRoom: data.clientsInRoom,
                  activeRoomId: activeRoomRef.current?.id,
                  isCorrectRoom: data.roomId === activeRoomRef.current?.id,
                  timestamp: new Date().toISOString()
                });
                
                if (data.success) {
                  console.log('[WS DEBUG] ✅ Successfully joined room:', data.roomId);
                  if (data.clientsInRoom !== undefined) {
                    console.log('[WS DEBUG] Total clients in room:', data.clientsInRoom);
                  }
                } else {
                  console.error('[WS DEBUG] ❌ Room join failed:', {
                    roomId: data.roomId,
                    error: data.error,
                    activeRoomId: activeRoomRef.current?.id
                  });
                  
                  // Retry joining if it failed for the current active room
                  if (data.roomId === activeRoomRef.current?.id) {
                    console.log('[WS DEBUG] Retrying room join in 1 second...');
                    setTimeout(() => {
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && 
                          activeRoomRef.current && activeRoomRef.current.id === data.roomId) {
                        joinCurrentRoom();
                      }
                    }, 1000);
                  }
                }
                break;

              case 'new_message':
                // Use ref to get the current active room since closure might be stale
                const currentActiveRoom = activeRoomRef.current;
                console.log('[WS MESSAGE DEBUG] ===== NEW MESSAGE RECEIVED =====');
                console.log('[WS MESSAGE DEBUG] Raw message data:', {
                  type: data.type,
                  fullData: data,
                  dataKeys: Object.keys(data),
                  messageExists: !!data.message,
                  timestamp: new Date().toISOString()
                });
                
                console.log('[WS MESSAGE DEBUG] Processing new message:', {
                  messageId: data.message?.id,
                  messageType: typeof data.message?.id,
                  roomId: data.message?.room_id,
                  roomIdType: typeof data.message?.room_id,
                  activeRoomId: currentActiveRoom?.id,
                  activeRoomIdType: typeof currentActiveRoom?.id,
                  isForActiveRoom: currentActiveRoom && data.message?.room_id === currentActiveRoom.id,
                  messageContent: data.message?.content?.substring(0, 50),
                  messageLength: data.message?.content?.length,
                  sender: data.message?.user?.username,
                  senderId: data.message?.user_id,
                  currentUserId: user?.id,
                  isFromCurrentUser: data.message?.user_id === user?.id,
                  messageCreatedAt: data.message?.created_at,
                  messageUpdatedAt: data.message?.updated_at,
                  messageData: data.message,
                  contextState: {
                    messagesLength: messages.length,
                    activeRoomFromRef: activeRoomRef.current?.id,
                    activeRoomFromState: activeRoom?.id,
                    wsReadyState: wsRef.current?.readyState,
                    isConnected: wsRef.current?.readyState === WebSocket.OPEN
                  }
                });

                // Ensure we have a valid message object
                if (!data.message || !data.message.id) {
                  console.error('[WS MESSAGE DEBUG] INVALID MESSAGE DATA - STOPPING PROCESSING:', {
                    hasMessage: !!data.message,
                    messageId: data.message?.id,
                    messageIdType: typeof data.message?.id,
                    fullMessageData: data.message
                  });
                  break;
                }

                console.log('[WS MESSAGE DEBUG] Message validation passed, proceeding...');

                // Always refresh rooms to update last message first
                console.log('[WS MESSAGE DEBUG] Refreshing rooms for last message update...');
                refreshRooms();

                // Add message if it's for the active room
                if (currentActiveRoom && data.message.room_id === currentActiveRoom.id) {
                  console.log('[WS MESSAGE DEBUG] ===== MESSAGE IS FOR ACTIVE ROOM - UPDATING UI =====');
                  console.log('[WS MESSAGE DEBUG] Current messages state before update:', {
                    currentMessageCount: messages.length,
                    currentMessagesState: messages.map(m => ({ 
                      id: m.id, 
                      tempId: m.tempId, 
                      content: m.content?.substring(0, 30), 
                      user_id: m.user_id,
                      created_at: m.created_at,
                      status: m.status
                    }))
                  });

                  setMessages(prev => {
                    console.log('[WS MESSAGE DEBUG] ===== INSIDE setMessages CALLBACK =====');
                    console.log('[WS MESSAGE DEBUG] Previous messages:', {
                      count: prev.length,
                      messages: prev.map(m => ({ 
                        id: m.id, 
                        tempId: m.tempId, 
                        content: m.content?.substring(0, 30), 
                        user_id: m.user_id,
                        created_at: m.created_at,
                        status: m.status
                      }))
                    });

                    // First check for optimistic message replacement (for messages we sent)
                    console.log('[WS MESSAGE DEBUG] Checking for optimistic message replacement...');
                    const optimisticIndex = prev.findIndex(msg => 
                      msg.tempId && 
                      msg.content === data.message.content && 
                      msg.user_id === data.message.user_id &&
                      Math.abs(new Date(msg.created_at).getTime() - new Date(data.message.created_at).getTime()) < 5000
                    );

                    console.log('[WS MESSAGE DEBUG] Optimistic check result:', {
                      optimisticIndex,
                      foundOptimistic: optimisticIndex !== -1,
                      searchCriteria: {
                        content: data.message.content,
                        user_id: data.message.user_id,
                        created_at: data.message.created_at
                      }
                    });

                    if (optimisticIndex !== -1) {
                      // Replace optimistic message with real message
                      console.log('[WS MESSAGE DEBUG] ===== REPLACING OPTIMISTIC MESSAGE =====');
                      console.log('[WS MESSAGE DEBUG] Replacing optimistic message with real message:', {
                        messageId: data.message.id,
                        optimisticIndex,
                        tempId: prev[optimisticIndex].tempId,
                        oldMessage: prev[optimisticIndex],
                        newMessage: data.message
                      });
                      const newMessages = [...prev];
                      newMessages[optimisticIndex] = {
                        ...data.message,
                        status: 'delivered'
                      };
                      console.log('[WS MESSAGE DEBUG] New messages after optimistic replacement:', {
                        count: newMessages.length,
                        replacedMessage: newMessages[optimisticIndex],
                        allMessages: newMessages.map(m => ({ 
                          id: m.id, 
                          tempId: m.tempId, 
                          content: m.content?.substring(0, 30), 
                          status: m.status
                        }))
                      });
                      return newMessages;
                    }

                    // Check if message already exists by ID (only after optimistic check)
                    console.log('[WS MESSAGE DEBUG] Checking for duplicate by ID...');
                    const existsById = prev.some(msg => msg.id === data.message.id);
                    console.log('[WS MESSAGE DEBUG] Duplicate check result:', {
                      existsById,
                      searchId: data.message.id,
                      existingIds: prev.map(m => m.id)
                    });

                    if (existsById) {
                      console.warn('[WS MESSAGE DEBUG] ===== MESSAGE ALREADY EXISTS - SKIPPING =====');
                      console.log('[WS MESSAGE DEBUG] Message already exists by ID, skipping duplicate:', {
                        messageId: data.message.id,
                        existingMessageIds: prev.map(m => m.id),
                        duplicateMessage: data.message
                      });
                      return prev;
                    }

                    // Add new message if it doesn't exist
                    console.log('[WS MESSAGE DEBUG] ===== ADDING NEW MESSAGE TO UI =====');
                    const newMessages = [...prev, { ...data.message, status: 'delivered' }];
                    console.log('[WS MESSAGE DEBUG] Adding new message to active room:', {
                      messageId: data.message.id,
                      previousCount: prev.length,
                      newCount: newMessages.length,
                      content: data.message.content,
                      sender: data.message.user?.username,
                      senderId: data.message.user_id,
                      isFromCurrentUser: data.message.user_id === user?.id,
                      newMessage: {
                        id: data.message.id,
                        content: data.message.content,
                        user_id: data.message.user_id,
                        created_at: data.message.created_at,
                        status: 'delivered'
                      }
                    });
                    
                    console.log('[WS MESSAGE DEBUG] Final messages array after addition:', {
                      count: newMessages.length,
                      allMessages: newMessages.map(m => ({ 
                        id: m.id, 
                        tempId: m.tempId, 
                        content: m.content?.substring(0, 30), 
                        user_id: m.user_id,
                        created_at: m.created_at,
                        status: m.status
                      }))
                    });

                    return [...prev, { ...data.message, status: 'delivered' }].sort(
                      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                  });
                  
                  console.log('[WS MESSAGE DEBUG] ===== setMessages CALLBACK COMPLETED =====');
                } else {
                  console.log('[WS MESSAGE DEBUG] ===== MESSAGE NOT FOR ACTIVE ROOM =====');
                  console.log('[WS MESSAGE DEBUG] Message not for active room, only refreshing rooms list', {
                    messageRoomId: data.message.room_id,
                    activeRoomId: currentActiveRoom?.id,
                    hasActiveRoom: !!currentActiveRoom,
                    roomComparison: {
                      messageRoom: data.message.room_id,
                      activeRoom: currentActiveRoom?.id,
                      equal: data.message.room_id === currentActiveRoom?.id,
                      bothExist: !!(data.message.room_id && currentActiveRoom?.id)
                    }
                  });
                }
                console.log('[WS MESSAGE DEBUG] ===== NEW MESSAGE PROCESSING COMPLETE =====');
                break;
              case 'user_typing':
                console.log('[WS DEBUG] User typing event:', {
                  userId: data.userId,
                  roomId: data.roomId,
                  isTyping: data.isTyping
                });
                setTypingUsers(prev => {
                  const newMap = new Map(prev);
                  const roomTypers = newMap.get(data.roomId) || [];

                  if (data.isTyping && !roomTypers.includes(data.userId)) {
                    newMap.set(data.roomId, [...roomTypers, data.userId]);
                  } else if (!data.isTyping) {
                    newMap.set(data.roomId, roomTypers.filter(id => id !== data.userId));
                  }

                  return newMap;
                });
                break;
              case 'user_online':
                console.log('[WS DEBUG] User online:', data.userId);
                setOnlineUsers(prev => new Set(prev).add(data.userId));
                break;
              case 'user_offline':
                console.log('[WS DEBUG] User offline:', data.userId);
                setOnlineUsers(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(data.userId);
                  return newSet;
                });
                break;
              case 'room_update':
                console.log('[WS DEBUG] Room update received, refreshing rooms');
                refreshRooms();
                break;
              default:
                console.log('[WS DEBUG] Unknown message type:', data.type);
            }
          } catch (error) {
            console.error('[WS DEBUG] Error parsing WebSocket message:', error, event.data);
          }
        };

        ws.onerror = (error) => {
          console.error('[WS DEBUG] WebSocket error:', error);
        };

        ws.onclose = (event) => {
          console.log('[WS DEBUG] WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            timestamp: new Date().toISOString()
          });
          wsRef.current = null;
          isAuthenticated = false;

          if (user && shouldReconnectRef.current) {
            console.log('[WS DEBUG] Scheduling reconnection in 3 seconds...');
            reconnectTimeout = setTimeout(() => {
              if (user && shouldReconnectRef.current && !wsRef.current) {
                console.log('[WS DEBUG] Attempting reconnection...');
                connectWebSocket();
              }
            }, 3000);
          }
        };
      } catch (error) {
        console.error('[WS DEBUG] Failed to create WebSocket connection:', error);
        // Retry connection after delay
        reconnectTimeout = setTimeout(() => {
          if (user && !wsRef.current) {
            console.log('[WS DEBUG] Retrying connection after error...');
            connectWebSocket();
          }
        }, 5000);
      }
    };

    connectWebSocket();

    return () => {

      shouldReconnectRef.current = false;
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (authenticationTimeout) {
        clearTimeout(authenticationTimeout);
      }
      if (wsRef.current) {
        console.log('[WS DEBUG] Cleaning up WebSocket connection');
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [user]);

  // Join room when active room changes
  useEffect(() => {
    activeRoomRef.current = activeRoom;

    if (!activeRoom) {
      setMessages([]);
      return;
    }

    console.log('[ROOM JOIN DEBUG] ===== JOINING NEW ROOM =====');
    console.log('[ROOM JOIN DEBUG] Joining room:', {
      roomId: activeRoom.id,
      roomName: activeRoom.name,
      timestamp: new Date().toISOString()
    });

    // Load messages for the room immediately
    loadMessages(activeRoom.id);

    // Join room via WebSocket with robust retry logic
    let joinAttempts = 0;
    const maxAttempts = 20;
    let joinTimeout: NodeJS.Timeout | null = null;

    const attemptJoinRoom = () => {
      if (joinAttempts >= maxAttempts) {
        console.error('[ROOM JOIN DEBUG] Max join attempts reached, giving up');
        return;
      }

      joinAttempts++;
      console.log('[ROOM JOIN DEBUG] Join attempt', joinAttempts, '/', maxAttempts);
      console.log('[ROOM JOIN DEBUG] WebSocket state:', {
        exists: !!wsRef.current,
        readyState: wsRef.current?.readyState,
        isOpen: wsRef.current?.readyState === WebSocket.OPEN,
        activeRoomId: activeRoomRef.current?.id
      });

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeRoomRef.current) {
        console.log('[ROOM JOIN DEBUG] Attempting to join room via WebSocket');
        joinCurrentRoom();
        // Don't retry immediately after sending join request
      } else {
        console.log('[ROOM JOIN DEBUG] WebSocket not ready, retrying in 200ms...');
        joinTimeout = setTimeout(attemptJoinRoom, 200);
      }
    };

    // Start attempting to join immediately
    attemptJoinRoom();

    // Cleanup timeout on unmount or room change
    return () => {
      if (joinTimeout) {
        clearTimeout(joinTimeout);
      }
    };
  }, [activeRoom]);

  // Join room after WebSocket authentication
  const joinCurrentRoom = () => {
    console.log('[ROOM JOIN DEBUG] ===== ATTEMPTING TO JOIN CURRENT ROOM =====');
    console.log('[ROOM JOIN DEBUG] Join conditions check:', {
      hasWebSocket: !!wsRef.current,
      wsReadyState: wsRef.current?.readyState,
      isOpen: wsRef.current?.readyState === WebSocket.OPEN,
      hasActiveRoom: !!activeRoomRef.current,
      activeRoomId: activeRoomRef.current?.id,
      activeRoomName: activeRoomRef.current?.name,
      timestamp: new Date().toISOString()
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeRoomRef.current) {
      const joinMessage = {
        type: 'join_room',
        roomId: activeRoomRef.current.id,
      };
      
      console.log('[ROOM JOIN DEBUG] ✅ Sending join_room message:', {
        roomId: activeRoomRef.current.id,
        roomName: activeRoomRef.current.name,
        message: joinMessage,
        timestamp: new Date().toISOString()
      });
      
      try {
        wsRef.current.send(JSON.stringify(joinMessage));
        console.log('[ROOM JOIN DEBUG] 📤 Join message sent successfully');
      } catch (error) {
        console.error('[ROOM JOIN DEBUG] ❌ Failed to send join message:', error);
      }
    } else {
      console.error('[ROOM JOIN DEBUG] ❌ Cannot join room - preconditions not met:', {
        hasWebSocket: !!wsRef.current,
        wsReadyState: wsRef.current?.readyState,
        readyStateNames: {
          0: 'CONNECTING',
          1: 'OPEN', 
          2: 'CLOSING',
          3: 'CLOSED'
        },
        currentState: wsRef.current?.readyState !== undefined ? 
          ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsRef.current.readyState] : 'UNDEFINED',
        isOpen: wsRef.current?.readyState === WebSocket.OPEN,
        hasActiveRoom: !!activeRoomRef.current,
        activeRoomId: activeRoomRef.current?.id
      });
    }
  };

  const loadMessages = async (roomId: string) => {
    console.log('[LOAD MESSAGES DEBUG] ===== LOADING MESSAGES FOR ROOM =====');
    console.log('[LOAD MESSAGES DEBUG] Loading messages for room:', {
      roomId,
      timestamp: new Date().toISOString(),
      currentMessagesCount: messages.length
    });

    try {
      const session = await supabase.auth.getSession();
      console.log('[LOAD MESSAGES DEBUG] Session obtained for message loading');

      const response = await fetch(`/api/rooms/${roomId}/messages`, {
        headers: {
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
      });

      console.log('[LOAD MESSAGES DEBUG] API response:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (response.ok) {
        const loadedMessages = await response.json();
        console.log('[LOAD MESSAGES DEBUG] Messages loaded from API:', {
          count: loadedMessages?.length || 0,
          messages: loadedMessages?.map((m: any) => ({ 
            id: m.id, 
            content: m.content?.substring(0, 50), 
            user_id: m.user_id,
            username: m.user?.username,
            created_at: m.created_at
          }))
        });

        console.log('[LOAD MESSAGES DEBUG] Setting messages state...');
        setMessages(
          (loadedMessages || []).slice().sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        );
        console.log('[LOAD MESSAGES DEBUG] Messages state updated via loadMessages');
      } else {
        console.error('[LOAD MESSAGES DEBUG] Failed to load messages:', {
          status: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      console.error('[LOAD MESSAGES DEBUG] Error loading messages:', {
        error: error.message,
        stack: error.stack,
        roomId
      });
    }
  };

  const sendMessage = async (roomId: string, content: string, replyTo?: string) => {
    console.log('[SEND MESSAGE DEBUG] ===== STARTING SEND MESSAGE =====');
    console.log('[SEND MESSAGE DEBUG] Send parameters:', {
      roomId,
      content: content?.substring(0, 100),
      replyTo,
      userId: user?.id,
      activeRoomId: activeRoom?.id,
      timestamp: new Date().toISOString()
    });

    if (!user) {
      console.error('[SEND MESSAGE DEBUG] No user found - aborting send');
      return;
    }

    // Generate temporary ID for optimistic message
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    console.log('[SEND MESSAGE DEBUG] Generated optimistic message data:', {
      tempId,
      timestamp: now,
      roomId,
      userId: user.id
    });

    // Create optimistic message
    const optimisticMessage: MessageWithUser = {
      id: tempId,
      tempId,
      room_id: roomId,
      user_id: user.id,
      content,
      message_type: 'text',
      reply_to: replyTo || null,
      edited_at: null,
      created_at: now,
      updated_at: now,
      status: 'pending',
      user: {
        id: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'Unknown',
        full_name: user.user_metadata?.full_name || user.email || 'Unknown User',
        avatar_url: user.user_metadata?.avatar_url || null
      }
    };

    console.log('[SEND MESSAGE DEBUG] Created optimistic message:', {
      tempId: optimisticMessage.tempId,
      id: optimisticMessage.id,
      content: optimisticMessage.content,
      user: optimisticMessage.user,
      status: optimisticMessage.status
    });

    // Add optimistic message immediately to UI
    if (activeRoom && roomId === activeRoom.id) {
      console.log('[SEND MESSAGE DEBUG] Adding optimistic message to UI...');
      console.log('[SEND MESSAGE DEBUG] Current messages before optimistic add:', messages.length);
      setMessages(prev => {
        const newMessages = [...prev, optimisticMessage];
        console.log('[SEND MESSAGE DEBUG] Messages after optimistic add:', {
          previousCount: prev.length,
          newCount: newMessages.length,
          addedMessage: optimisticMessage,
          lastFewMessages: newMessages.slice(-3).map(m => ({ id: m.id, tempId: m.tempId, content: m.content?.substring(0, 30) }))
        });
        return [...prev, optimisticMessage].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    } else {
      console.log('[SEND MESSAGE DEBUG] Not adding optimistic message - room mismatch:', {
        hasActiveRoom: !!activeRoom,
        activeRoomId: activeRoom?.id,
        targetRoomId: roomId,
        match: activeRoom?.id === roomId
      });
    }

    try {
      const session = await supabase.auth.getSession();

      const requestBody = {
        content,
        reply_to: replyTo || undefined,
      };

      // Update message status to 'sent' 
      setMessages(prev => 
        prev.map(msg => 
          msg.tempId === tempId 
            ? { ...msg, status: 'sent' as MessageStatus }
            : msg
        )
      );

      const response = await fetch(`/api/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // Update message status to error on failure
        setMessages(prev => 
          prev.map(msg => 
            msg.tempId === tempId 
              ? { ...msg, status: 'error' as MessageStatus }
              : msg
          )
        );
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${errorText}`);
      }

      const responseData = await response.json();

      // Replace optimistic message with real message from server
      setMessages(prev => 
        prev.map(msg => 
          msg.tempId === tempId 
            ? { 
                ...responseData, 
                status: 'delivered' as MessageStatus,
                tempId: undefined
              }
            : msg
        )
      );

      console.log('[SEND MESSAGE DEBUG] Message sent successfully:', {
        tempId,
        realId: responseData.id,
        content: responseData.content
      });

    } catch (error) {
      console.error('[SEND MESSAGE DEBUG] Error sending message:', error);
      // Mark message as error
      setMessages(prev => 
        prev.map(msg => 
          msg.tempId === tempId 
            ? { ...msg, status: 'error' as MessageStatus }
            : msg
        )
      );
      throw error;
    }
  };

  const sendTyping = (isTyping: boolean) => {
    if (!wsRef.current || !activeRoom) return;

    wsRef.current.send(JSON.stringify({
      type: 'typing',
      roomId: activeRoom.id,
      isTyping,
    }));

    if (isTyping) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 3000);
    }
  };

  const refreshRooms = async () => {
    if (!user) return;

    try {
      const session = await supabase.auth.getSession();
      const response = await fetch('/api/rooms', {
        headers: {
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
      });

      if (response.ok) {
        const roomsData = await response.json();
        console.log('[ROOMS DEBUG] Loaded rooms:', roomsData);

        // Transform rooms to include proper structure
        const transformedRooms = roomsData.map((room: any) => ({
          ...room,
          type: room.is_private && room.member_count === 2 ? 'direct' : 'group',
          members: room.members || [],
          unread_count: room.unread_count || 0,
        }));

        setRooms(transformedRooms);
      }
    } catch (error) {
      console.error('Error refreshing rooms:', error);
    }
  };

  const refreshFriends = async () => {
    if (!user) return;

    // Only show loading state on initial load
    if (friendsInitialLoad) {
      setFriendsLoading(true);
    }

    try {
      const session = await supabase.auth.getSession();
      const response = await fetch('/api/friends', {
        headers: {
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
      });

      if (response.ok) {
        const friends = await response.json();
        setFriends(friends);
      }
    } catch (error) {
      console.error('Error refreshing friends:', error);
    } finally {
      if (friendsInitialLoad) {
        // Add minimum loading time of 2 seconds only on initial load
        setTimeout(() => {
          setFriendsLoading(false);
          setFriendsInitialLoad(false);
        }, 2000);
      }
    }
  };

  const markAsRead = (roomId: string) => {
    // Mark messages as read - this would typically update a read status in the database
    // For now, we'll implement a simple client-side version
    console.log(`Marking room ${roomId} as read`);
  };

  const createDirectMessage = async (friendId: string): Promise<RoomWithDetails | null> => {
    if (!user) {
      console.error('[CREATE DM DEBUG] No user found');
      return null;
    }

    console.log('[CREATE DM DEBUG] Starting direct message creation:', {
      userId: user.id,
      friendId,
      currentRooms: rooms.length,
      roomIds: rooms.map(r => ({ id: r.id, type: r.type, memberCount: r.members?.length }))
    });

    try {
      // First check if a direct message room already exists in loaded rooms
      console.log('[CREATE DM DEBUG] Checking for existing rooms...');

      for (const room of rooms) {
        console.log('[CREATE DM DEBUG] Checking room:', {
          roomId: room.id,
          roomType: room.type,
          isPrivate: room.is_private,
          memberCount: room.members?.length,
          members: room.members?.map(m => ({ id: m.id, username: m.username })),
          hasCurrentUser: room.members?.some(member => member.id === user.id),
          hasFriend: room.members?.some(member => member.id === friendId)
        });

        // Check if this is a direct room with exactly 2 members including both users
        const isDirectRoom = room.type === 'direct' || (room.is_private && room.members?.length === 2);
        const hasCurrentUser = room.members?.some(member => member.id === user.id);
        const hasFriend = room.members?.some(member => member.id === friendId);

        if (isDirectRoom && hasCurrentUser && hasFriend) {
          console.log('[CREATE DM DEBUG] Existing DM room found:', {
            roomId: room.id,
            roomName: room.name,
            members: room.members?.map(m => m.username)
          });
          return room;
        }
      }

      console.log('[CREATE DM DEBUG] No existing room found, creating new one');

      // Create new room or get existing one from server
      const session = await supabase.auth.getSession();
      console.log('[CREATE DM DEBUG] Making API request to create room');

      const response = await fetch('/api/rooms/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({
          friend_id: friendId,
        }),
      });

      console.log('[CREATE DM DEBUG] API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const room = await response.json();
        console.log('[CREATE DM DEBUG] Room created/retrieved:', {
          roomId: room.id,
          roomName: room.name,
          memberCount: room.members?.length,
          members: room.members?.map(m => ({ id: m.id, username: m.username }))
        });

        // Add type and ensure proper structure
        const roomWithDetails: RoomWithDetails = {
          ...room,
          type: 'direct',
          unread_count: 0,
        };

        // Update rooms list
        console.log('[CREATE DM DEBUG] Refreshing rooms list');
        await refreshRooms();

        return roomWithDetails;
      } else {
        const error = await response.json();
        console.error('[CREATE DM DEBUG] API error:', error);
        throw new Error(error.message || 'Failed to create room');
      }
    } catch (error) {
      console.error('[CREATE DM DEBUG] Error creating direct message:', {
        error: error.message,
        stack: error.stack,
        friendId,
        userId: user.id
      });
      throw error;
    }
  };

  // Load initial data
  useEffect(() => {
    if (user) {
      refreshRooms();
      refreshFriends();
    }
  }, [user]);

  const value = {
    activeRoom,
    setActiveRoom,
    messages,
    rooms,
    friends,
    friendsLoading,
    onlineUsers,
    typingUsers,
    sendMessage,
    sendTyping,
    refreshRooms,
    refreshFriends,
    markAsRead,
    createDirectMessage,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}