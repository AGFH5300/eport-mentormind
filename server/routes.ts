import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { supabase, getUserFromSession } from "./lib/supabase";
import { sendVerificationEmail, sendPasswordResetEmail, generateVerificationToken } from "./lib/email";
import { loginSchema, insertChatRoomSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

const signupSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
});
import crypto from "crypto";
import bcrypt from "bcrypt";
import multer from 'multer';
import fs from 'fs';
import path from 'path';

import { WebSocket as WS } from 'ws';

interface WebSocketWithUserId extends WS {
  userId?: string;
  roomId?: string;
}

// Define AuthenticatedRequest to include user property
interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

// Keep track of online users
const onlineUsers = new Set<string>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/chat-ws' // Use specific path to avoid conflicts with Vite HMR
  });

  // Helper function to broadcast to all clients
  function broadcastToAllClients(message: any): void {
    wss.clients.forEach((client: WebSocketWithUserId) => {
      if (client.readyState === WS.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Configure multer for avatar uploads
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocketWithUserId, request) => {
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('[WS DEBUG] Received WebSocket message:', {
          type: data.type,
          userId: ws.userId,
          roomId: ws.roomId,
          timestamp: new Date().toISOString(),
          fullData: data
        });

        switch (data.type) {
          case 'auth':
            try {
              // Verify the JWT token with Supabase
              const { data: { user }, error } = await supabase.auth.getUser(data.token);
              if (error || !user) {
                console.error('[WS DEBUG] Authentication failed:', error?.message);
                ws.close(1008, 'Authentication failed');
                return;
              }

              ws.userId = user.id;
              console.log('[WS DEBUG] User authenticated:', {
                userId: user.id,
                email: user.email,
                timestamp: new Date().toISOString()
              });

              // Send authentication confirmation
              ws.send(JSON.stringify({ 
                type: 'authenticated', 
                userId: user.id,
                success: true 
              }));

              // Add to online users
              onlineUsers.add(user.id);
              broadcastToAllClients({
                type: 'user_online',
                userId: user.id,
              });
            } catch (authError) {
              console.error('[WS DEBUG] Authentication error:', authError);
              ws.close(1008, 'Authentication failed');
            }
            break;
          case 'join_room':
            if (!ws.userId) {
              console.error('[WS DEBUG] User not authenticated for room join');
              ws.send(JSON.stringify({ 
                type: 'room_joined', 
                roomId: data.roomId,
                success: false,
                error: 'Authentication required' 
              }));
              return;
            }

            // Verify user has access to the room
            const { data: membership } = await supabase
              .from('room_members')
              .select('role')
              .eq('room_id', data.roomId)
              .eq('user_id', ws.userId)
              .single();

            if (!membership) {
              console.error('[WS DEBUG] User not authorized for room:', {
                userId: ws.userId,
                roomId: data.roomId
              });
              ws.send(JSON.stringify({ 
                type: 'room_joined', 
                roomId: data.roomId,
                success: false,
                error: 'Not authorized for this room' 
              }));
              return;
            }

            // Leave previous room if any
            if (ws.roomId) {
              console.log('[WS DEBUG] Leaving previous room:', ws.roomId);
            }

            // CRITICAL FIX: Set roomId for ALL connections from this user, not just this one connection
            console.log('[WS DEBUG] ===== FIXING MULTI-CONNECTION ISSUE =====');
            const userConnections = Array.from(wss.clients).filter((client: WebSocketWithUserId) => 
              client.userId === ws.userId && client.readyState === WS.OPEN
            );
            
            console.log('[WS DEBUG] Found user connections:', {
              userId: ws.userId,
              totalConnections: userConnections.length,
              connectionDetails: userConnections.map((c: WebSocketWithUserId) => ({
                userId: c.userId,
                currentRoomId: c.roomId,
                readyState: c.readyState
              }))
            });

            // Set roomId for ALL connections from this user
            userConnections.forEach((client: WebSocketWithUserId) => {
              client.roomId = data.roomId;
              console.log('[WS DEBUG] Set roomId for user connection:', {
                userId: client.userId,
                newRoomId: client.roomId
              });
            });

            const roomClientsCount = Array.from(wss.clients).filter((client: WebSocketWithUserId) => 
              client.roomId === data.roomId && client.readyState === WS.OPEN
            ).length;

            console.log('[WS DEBUG] Client joined room:', {
              userId: ws.userId,
              roomId: data.roomId,
              totalClientsInRoom: roomClientsCount
            });

            ws.send(JSON.stringify({ 
              type: 'room_joined', 
              roomId: data.roomId,
              success: true,
              clientsInRoom: roomClientsCount
            }));
            break;
          case 'typing':
            // Broadcast typing indicator to room members
            wss.clients.forEach((client: WebSocketWithUserId) => {
              if (client !== ws && client.roomId === ws.roomId && client.readyState === WS.OPEN) {
                client.send(JSON.stringify({
                  type: 'user_typing',
                  userId: ws.userId,
                  roomId: ws.roomId,
                  isTyping: data.isTyping
                }));
              }
            });
            break;
          default:
            console.warn('[WS DEBUG] Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error for user:', ws.userId, error);
    });

    ws.on('close', async () => {
      if (ws.userId) {
        // Update user offline status
        await supabase
          .from('users')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', ws.userId);
        
        // Remove from online users set and broadcast
        onlineUsers.delete(ws.userId);
        broadcastToAllClients({
          type: 'user_offline',
          userId: ws.userId,
        });
      }
    });
  });

  // Helper function to broadcast to room
  function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    console.log('[BROADCAST DEBUG] ===== STARTING ROOM BROADCAST =====');
    console.log('[BROADCAST DEBUG] Broadcast parameters:', {
      roomId,
      messageType: message.type,
      messageId: message.message?.id,
      excludeUserId,
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;
    let totalClients = 0;
    let roomClients = 0;
    let openRoomClients = 0;
    let closedRoomClients = 0;
    let sentDetails = [];
    let failedDetails = [];

    console.log('[BROADCAST DEBUG] Analyzing all WebSocket clients...');
    
    wss.clients.forEach((client: WebSocketWithUserId) => {
      totalClients++;
      
      const clientInfo = {
        userId: client.userId,
        roomId: client.roomId,
        readyState: client.readyState,
        isOpen: client.readyState === WS.OPEN,
        isTargetRoom: client.roomId === roomId
      };

      if (client.roomId === roomId) {
        roomClients++;
        
        if (client.readyState === WS.OPEN) {
          openRoomClients++;
          // Include all clients in the room, including sender for message confirmation
          try {
            const messageToSend = JSON.stringify(message);
            console.log(`[BROADCAST DEBUG] Attempting to send to client ${client.userId}:`, {
              userId: client.userId,
              messageLength: messageToSend.length,
              messageType: message.type,
              messageId: message.message?.id
            });
            
            client.send(messageToSend);
            sentCount++;
            
            const sentDetail = {
              userId: client.userId,
              success: true,
              readyState: client.readyState,
              timestamp: new Date().toISOString()
            };
            sentDetails.push(sentDetail);
            
            console.log(`[BROADCAST DEBUG] ✅ Successfully sent message to client ${client.userId} in room ${roomId}`);
          } catch (error) {
            closedRoomClients++;
            const failedDetail = {
              userId: client.userId,
              success: false,
              error: error.message,
              readyState: client.readyState,
              timestamp: new Date().toISOString()
            };
            failedDetails.push(failedDetail);
            
            console.error(`[BROADCAST DEBUG] ❌ Error sending message to client ${client.userId}:`, {
              error: error.message,
              clientState: client.readyState,
              userId: client.userId
            });
          }
        } else {
          closedRoomClients++;
          console.log(`[BROADCAST DEBUG] 🔴 Client ${client.userId} in room ${roomId} has closed connection (state: ${client.readyState})`);
        }
      }
    });

    console.log('[BROADCAST DEBUG] ===== BROADCAST SUMMARY =====');
    console.log(`[BROADCAST DEBUG] Broadcast summary:`, {
      roomId,
      messageType: message.type,
      messageId: message.message?.id,
      results: {
        sentCount,
        roomClients,
        openRoomClients,
        closedRoomClients,
        totalClients,
        successRate: roomClients > 0 ? (sentCount / roomClients * 100).toFixed(1) + '%' : '0%'
      },
      sentDetails,
      failedDetails,
      timestamp: new Date().toISOString()
    });

    // Also broadcast to all users who are members of this room but might not be connected to the room yet
    if (sentCount === 0) {
      console.log(`[BROADCAST DEBUG] ⚠️ No connected clients in room ${roomId}, broadcasting room_update to all connected users`);
      let fallbackSentCount = 0;
      
      wss.clients.forEach((client: WebSocketWithUserId) => {
        if (client.readyState === WS.OPEN && client.userId) {
          try {
            client.send(JSON.stringify({
              ...message,
              type: 'room_update' // Different type to trigger room refresh
            }));
            fallbackSentCount++;
            console.log(`[BROADCAST DEBUG] 📢 Sent room_update to user ${client.userId}`);
          } catch (error) {
            console.error(`[BROADCAST DEBUG] ❌ Failed to send room_update to user ${client.userId}:`, error.message);
          }
        }
      });
      
      console.log(`[BROADCAST DEBUG] Fallback broadcast sent to ${fallbackSentCount} users`);
    }

    console.log('[BROADCAST DEBUG] ===== BROADCAST COMPLETE =====');
  }

  // Helper function to broadcast to specific user
  function broadcastToUser(userId: string, message: any) {
    wss.clients.forEach((client: WebSocketWithUserId) => {
      if (client.userId === userId && client.readyState === WS.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Auth Routes
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const data = signupSchema.parse(req.body);

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .or(`email.eq.${data.email},username.eq.${data.username}`)
        .single();

      if (existingUser) {
        return res.status(400).json({ message: 'User with this email or username already exists' });
      }

      // Generate verification token
      const verificationToken = generateVerificationToken();
      const tokenExpires = new Date();
      tokenExpires.setHours(tokenExpires.getHours() + 24);

      // Create user in Supabase Auth without password
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        email_confirm: false,
      });

      if (authError) {
        return res.status(400).json({ message: authError.message });
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: data.email,
          username: data.username,
          full_name: data.full_name,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires.toISOString(),
        });

      if (profileError) {
        // Clean up auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return res.status(500).json({ message: 'Failed to create user profile' });
      }

      // Send verification email
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000';
      const emailSent = await sendVerificationEmail(data.email, verificationToken, `https://${baseUrl}`);

      if (!emailSent) {
        console.warn('Failed to send verification email');
      }

      res.json({ 
        message: 'Account created successfully. Please check your email for verification instructions.',
        user: {
          id: authUser.user.id,
          email: data.email,
          username: data.username,
          full_name: data.full_name,
          email_verified: false,
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const data = loginSchema.parse(req.body);

      let email = data.email;

      // If the input doesn't contain '@', treat it as username and find the email
      if (!data.email.includes('@')) {
        const { data: userByUsername } = await supabase
          .from('users')
          .select('email')
          .eq('username', data.email)
          .single();

        if (!userByUsername) {
          return res.status(401).json({ message: 'Invalid username or password' });
        }

        email = userByUsername.email;
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: data.password,
      });

      if (error) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Get user profile
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      // Update online status
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', authData.user.id);

      res.json({
        user: userProfile,
        session: authData.session,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (user) {
        await supabase
          .from('users')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', user.id);
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/auth/verify-email', async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ message: 'Verification token is required' });
      }

      // Find user with this token
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('verification_token', token)
        .gt('verification_token_expires', new Date().toISOString())
        .single();

      if (error || !user) {
        return res.status(400).json({ message: 'Invalid or expired verification token' });
      }

      // Redirect to set password page with token
      res.redirect(`/reset-password?token=${token}&type=verify`);
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/request-password-reset', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Check if user exists
      const { data: user } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .single();

      if (!user) {
        // Don't reveal if email exists or not
        return res.json({ message: 'If an account with this email exists, you will receive password reset instructions.' });
      }

      // Generate reset token
      const resetToken = generateVerificationToken();
      const tokenExpires = new Date();
      tokenExpires.setHours(tokenExpires.getHours() + 1); // 1 hour expiry

      // Store reset token
      await supabase
        .from('users')
        .update({
          verification_token: resetToken,
          verification_token_expires: tokenExpires.toISOString(),
        })
        .eq('id', user.id);

      // Send reset email
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000';
      await sendPasswordResetEmail(email, resetToken, `https://${baseUrl}`);

      res.json({ message: 'If an account with this email exists, you will receive password reset instructions.' });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { token, password, is_verification } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
      }

      // Find user with this token
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('verification_token', token)
        .gt('verification_token_expires', new Date().toISOString())
        .single();

      if (error || !user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      // Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: password,
      });

      if (updateError) {
        return res.status(500).json({ message: 'Failed to update password' });
      }

      // Update user verification status if this is initial verification
      const updateData: any = {
        verification_token: null,
        verification_token_expires: null,
      };

      if (is_verification) {
        updateData.email_verified = true;
        // Update Supabase Auth user
        await supabase.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        });
      }

      await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      const message = is_verification 
        ? 'Account verified and password set successfully' 
        : 'Password updated successfully';

      res.json({ message });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // User Routes
  app.get('/api/users/me', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      res.json(userProfile);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Search users endpoint
  app.get('/api/users/search', async (req: Request, res: Response) => {
    console.log('[SEARCH DEBUG] ===== NEW SEARCH REQUEST =====');
    console.log('[SEARCH DEBUG] Search request received:', {
      url: req.url,
      fullQuery: req.query,
      queryKeys: Object.keys(req.query),
      queryValues: Object.values(req.query),
      headers: {
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        authPrefix: req.headers.authorization?.substring(0, 20) + '...',
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      method: req.method,
      timestamp: new Date().toISOString()
    });

    try {
      const user = await getUserFromSession(req.headers.authorization);
      console.log('[SEARCH DEBUG] User from session:', user ? { id: user.id, email: user.email } : 'None');

      if (!user) {
        console.log('[SEARCH DEBUG] No user found, returning unauthorized');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { q } = req.query;
      console.log('[SEARCH DEBUG] Search query:', { q, type: typeof q, length: q?.toString().length });

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        console.log('[SEARCH DEBUG] Query too short or invalid, returning empty array');
        return res.json([]);
      }

      const searchTerm = q.trim();
      console.log('[SEARCH DEBUG] Sanitized search term:', searchTerm);

      // Search users by username, full_name, or email
      console.log('[SEARCH DEBUG] Starting user search query...');
      const { data: users, error: searchError } = await supabase
        .from('users')
        .select('id, username, full_name, email, avatar_url')
        .neq('id', user.id) // Exclude current user
        .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(10);

      console.log('[SEARCH DEBUG] User search result:', {
        foundUsers: users?.length || 0,
        users: users?.map(u => ({ id: u.id, username: u.username, full_name: u.full_name })),
        searchError: searchError?.message
      });

      if (searchError) {
        console.error('[SEARCH DEBUG] Search query error:', searchError);
        return res.status(500).json({ message: 'Search query failed' });
      }

      // Get existing friendships to show status
      const userIds = users?.map(u => u.id) || [];
      console.log('[SEARCH DEBUG] User IDs for relationship check:', userIds);

      let friendships: any[] = [];
      let requests: any[] = [];

      if (userIds.length > 0) {
        console.log('[SEARCH DEBUG] Checking friendships...');
        // Get friendships - check if current user is friends with any of the search results
        const { data: friendshipData, error: friendshipError } = await supabase
          .from('friendships')
          .select('user1_id, user2_id')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

        console.log('[SEARCH DEBUG] Friendship query result:', {
          friendships: friendshipData?.length || 0,
          friendshipError: friendshipError?.message,
          data: friendshipData
        });

        friendships = friendshipData || [];

        console.log('[SEARCH DEBUG] Checking friend requests...');
        // Get friend requests - check for pending requests involving current user
        const { data: requestData, error: requestError } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id, status')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .eq('status', 'pending');

        console.log('[SEARCH DEBUG] Friend request query result:', {
          requests: requestData?.length || 0,
          requestError: requestError?.message,
          data: requestData
        });

        requests = requestData || [];
      }

      // Add relationship status to each user
      console.log('[SEARCH DEBUG] Processing relationship statuses...');
      const usersWithStatus = users?.map(searchUser => {
        const isFriend = friendships.some(f => 
          (f.user1_id === user.id && f.user2_id === searchUser.id) ||
          (f.user1_id === searchUser.id && f.user2_id === user.id)
        );

        const pendingRequest = requests.find(r => 
          (r.sender_id === user.id && r.receiver_id === searchUser.id) ||
          (r.sender_id === searchUser.id && r.receiver_id === user.id)
        );

        let status = 'none';
        if (isFriend) {
          status = 'friends';
        } else if (pendingRequest) {
          status = pendingRequest.sender_id === user.id ? 'request_sent' : 'request_received';
        }

        console.log('[SEARCH DEBUG] User relationship status:', {
          userId: searchUser.id,
          username: searchUser.username,
          isFriend,
          pendingRequest: pendingRequest ? { 
            sender: pendingRequest.sender_id, 
            receiver: pendingRequest.receiver_id 
          } : null,
          finalStatus: status
        });

        return {
          ...searchUser,
          relationship_status: status
        };
      }) || [];

      console.log('[SEARCH DEBUG] Final result:', {
        totalUsers: usersWithStatus.length,
        users: usersWithStatus.map(u => ({ 
          id: u.id, 
          username: u.username, 
          status: u.relationship_status 
        }))
      });

      res.json(usersWithStatus);
    } catch (error) {
      console.error('[SEARCH DEBUG] Search users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/users/me', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { full_name, username, avatar_url } = req.body;

      // Check if username is already taken by another user
      if (username) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .neq('id', user.id)
          .single();

        if (existingUser) {
          return res.status(400).json({ message: 'Username already taken' });
        }
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({
          full_name: full_name || undefined,
          username: username || undefined,
          avatar_url: avatar_url || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ message: 'Failed to update profile' });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Avatar upload endpoint
  app.post('/api/users/avatar', upload.single('avatar'), async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Create avatars directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${user.id}-${Date.now()}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      // Save file
      fs.writeFileSync(filePath, req.file.buffer);

      // Create URL for the avatar
      const avatar_url = `/uploads/avatars/${fileName}`;

      // Update user's avatar URL in database
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({
          avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        // Clean up uploaded file if database update fails
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to clean up file:', e);
        }
        return res.status(500).json({ message: 'Failed to update avatar' });
      }

      res.json({ avatar_url, user: updatedUser });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Friends Routes
  app.get('/api/friends', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      console.log('[FRIENDS DEBUG] Fetching friends for user:', {
        userId: user.id,
        userEmail: user.email,
        timestamp: new Date().toISOString()
      });

      // Get friendships with manual joins to avoid issues
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      console.log('[FRIENDS DEBUG] Raw friendships query result:', {
        friendshipsFound: friendships?.length || 0,
        error: error?.message,
        friendships: friendships
      });

      if (error) {
        console.error('[FRIENDS DEBUG] Database error:', error);
        return res.status(500).json({ message: 'Database query failed' });
      }

      // Manually fetch user data for each friendship
      const friends = [];

      for (const friendship of friendships || []) {
        const friendUserId = friendship.user1_id === user.id ? friendship.user2_id : friendship.user1_id;

        // Get the friend's details
        const { data: friendUser, error: userError } = await supabase
          .from('users')
          .select('id, username, full_name, email, avatar_url, is_online, last_seen')
          .eq('id', friendUserId)
          .single();

        if (!userError && friendUser) {
          friends.push({
            ...friendUser,
            friendship_id: friendship.id,
          });
        }
      }

      console.log('[FRIENDS DEBUG] Final friends result:', {
        totalFriends: friends.length,
        friends: friends.map(f => ({ id: f.id, username: f.username, full_name: f.full_name }))
      });

      res.json(friends);
    } catch (error) {
      console.error('Get friends error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get friend requests (sent and received)
  app.get('/api/friend-requests', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      req.user = user; // Attach user to request

      console.log('[FRIEND REQUESTS DEBUG] Fetching requests for user:', {
        userId: user.id,
        userEmail: user.email,
        timestamp: new Date().toISOString()
      });

      // Get friend requests with manual joins
      const { data: requests, error } = await supabase
        .from('friend_requests')
        .select('id, status, created_at, sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      console.log('[FRIEND REQUESTS DEBUG] Raw requests query result:', {
        requestsFound: requests?.length || 0,
        error: error?.message,
        requests: requests
      });

      if (error) {
        console.error('[FRIEND REQUESTS DEBUG] Database error:', error);
        return res.status(500).json({ message: 'Database query failed' });
      }

      // Manually fetch user data for each request
      const formattedRequests = [];

      for (const request of requests || []) {
        const isSender = request.sender_id === user.id;
        const otherUserId = isSender ? request.receiver_id : request.sender_id;

        // Get the other user's details
        const { data: otherUser, error: userError } = await supabase
          .from('users')
          .select('id, username, full_name, email, avatar_url')
          .eq('id', otherUserId)
          .single();

        if (!userError && otherUser) {
          formattedRequests.push({
            id: request.id,
            status: request.status,
            created_at: request.created_at,
            is_sender: isSender,
            user: otherUser,
          });
        }
      }

      console.log('[FRIEND REQUESTS DEBUG] Formatted response:', {
        totalFormatted: formattedRequests.length,
        received: formattedRequests.filter(req => !req.is_sender).length,
        sent: formattedRequests.filter(req => req.is_sender).length,
        formatted: formattedRequests.map(req => ({
          id: req.id,
          is_sender: req.is_sender,
          user: req.user?.username
        }))
      });

      res.json(formattedRequests);
    } catch (error) {
      console.error('Get friend requests error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/friend-requests', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { recipient_id, username_or_email } = req.body;

      let targetUser;

      if (recipient_id) {
        // Direct recipient ID provided
        const { data: userData, error: findError } = await supabase
          .from('users')
          .select('id, username, full_name, email')
          .eq('id', recipient_id)
          .single();

        if (findError || !userData) {
          return res.status(404).json({ message: 'User not found' });
        }
        targetUser = userData;
      } else if (username_or_email) {
        // Find by username or email
        const { data: userData, error: findError } = await supabase
          .from('users')
          .select('id, username, full_name, email')
          .or(`username.eq.${username_or_email},email.eq.${username_or_email}`)
          .single();

        if (findError || !userData) {
          return res.status(404).json({ message: 'User not found' });
        }
        targetUser = userData;
      } else {
        return res.status(400).json({ message: 'Either recipient_id or username_or_email is required' });
      }

      if (targetUser.id === user.id) {
        return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
      }

      // Check if already friends
      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUser.id}),and(user1_id.eq.${targetUser.id},user2_id.eq.${user.id})`)
        .single();

      if (existingFriendship) {
        return res.status(400).json({ message: 'You are already friends with this user' });
      }

      // Check if friend request already exists
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${user.id})`)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        return res.status(400).json({ message: 'Friend request already pending' });
      }

      // Create friend request
      const { data: newRequest, error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: targetUser.id,
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ message: 'Failed to send friend request' });
      }

      res.json({ message: 'Friend request sent successfully', request: newRequest });
    } catch (error) {
      console.error('Send friend request error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/friend-requests/:requestId', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { requestId } = req.params;
      const { action } = req.body; // 'accept' or 'reject'

      if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Invalid action' });
      }

      // Get the friend request
      const { data: request, error: getError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('id', requestId)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .single();

      if (getError || !request) {
        return res.status(404).json({ message: 'Friend request not found' });
      }

      if (action === 'accept') {
        // Create friendship
        const { error: friendshipError } = await supabase
          .from('friendships')
          .insert({
            user1_id: request.sender_id,
            user2_id: request.receiver_id,
          });

        if (friendshipError) {
          console.error('[FRIENDSHIP DEBUG] Failed to create friendship:', friendshipError);
          return res.status(500).json({ message: 'Failed to create friendship' });
        }

        console.log('[FRIENDSHIP DEBUG] Successfully created friendship:', {
          user1_id: request.sender_id,
          user2_id: request.receiver_id,
          timestamp: new Date().toISOString()
        });

        // Update request status
        await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        // Send notification to the original sender
        broadcastToUser(request.sender_id, {
          type: 'friend_request_response',
          action: 'accepted',
          message: `${user.full_name || user.username} accepted your friend request!`,
          from_user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name
          }
        });

        res.json({ message: 'Friend request accepted' });
      } else {
        // Update request status
        await supabase
          .from('friend_requests')
          .update({ status: 'rejected' })
          .eq('id', requestId);

        // Send notification to the original sender
        broadcastToUser(request.sender_id, {
          type: 'friend_request_response',
          action: 'rejected',
          message: `${user.full_name || user.username} declined your friend request.`,
          from_user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name
          }
        });

        res.json({ message: 'Friend request rejected' });
      }
    } catch (error) {
      console.error('Update friend request error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/friends/:friendshipId', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { friendshipId } = req.params;

      // Verify user is part of this friendship
      const { data: friendship, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('id', friendshipId)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .single();

      if (error || !friendship) {
        return res.status(404).json({ message: 'Friendship not found' });
      }

      // Delete friendship
      await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      res.json({ message: 'Friend removed successfully' });
    } catch (error) {
      console.error('Remove friend error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Chat Rooms Routes
  app.get('/api/rooms', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Get user's rooms
      const { data: rooms } = await supabase
        .from('room_members')
        .select(`
          room:chat_rooms(*),
          role
        `)
        .eq('user_id', user.id);

      // Get details for each room
      const roomsWithDetails = await Promise.all(
        (rooms || []).map(async (roomMember) => {
          const room = roomMember.room;

          // Get all members of the room
          const { data: members } = await supabase
            .from('room_members')
            .select(`
              user:users(id, username, full_name, avatar_url, is_online, last_seen)
            `)
            .eq('room_id', (room as any).id);

          // Get last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select(`
              *,
              user:users(id, username, full_name, avatar_url)
            `)
            .eq('room_id', (room as any).id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get member count
          const { count: memberCount } = await supabase
            .from('room_members')
            .select('*', { count: 'exact' })
            .eq('room_id', (room as any).id);

          return {
            ...room,
            members: members?.map((m: any) => m.user) || [],
            member_count: memberCount || 0,
            last_message: lastMessage,
            user_role: roomMember.role,
            is_private: (room as any).is_private || false,
          };
        })
      );

      console.log('[ROOMS DEBUG] Returning rooms with details:', {
        roomCount: roomsWithDetails.length,
        rooms: roomsWithDetails.map(r => ({
          id: r.id,
          name: r.name,
          memberCount: r.member_count,
          isPrivate: r.is_private
        }))
      });

      res.json(roomsWithDetails);
    } catch (error) {
      console.error('Get rooms error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/rooms', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const data = insertChatRoomSchema.parse(req.body);

      // Create room
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          ...data,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ message: 'Failed to create room' });
      }

      // Add creator as admin
      await supabase
        .from('room_members')
        .insert({
          room_id: newRoom.id,
          user_id: user.id,
          role: 'admin',
        });

      res.json(newRoom);
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create direct message room between friends
  app.post('/api/rooms/direct', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        console.log('[DM SERVER DEBUG] Unauthorized request');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { friend_id } = req.body;

      console.log('[DM SERVER DEBUG] Direct message request:', {
        userId: user.id,
        friendId: friend_id,
        timestamp: new Date().toISOString()
      });

      if (!friend_id) {
        return res.status(400).json({ message: 'Friend ID is required' });
      }

      // Check if friendship exists
      console.log('[DM SERVER DEBUG] Checking friendship...');
      const { data: friendship, error: friendshipError } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${friend_id}),and(user1_id.eq.${friend_id},user2_id.eq.${user.id})`)
        .single();

      console.log('[DM SERVER DEBUG] Friendship check result:', {
        found: !!friendship,
        error: friendshipError?.message,
        friendship
      });

      if (!friendship) {
        return res.status(403).json({ message: 'You are not friends with this user' });
      }

      // Check if direct message room already exists more efficiently
      console.log('[DM SERVER DEBUG] Checking for existing room between users:', user.id, 'and', friend_id);

      const { data: existingRooms, error: roomCheckError } = await supabase
        .from('room_members')
        .select(`
          room_id,
          room:chat_rooms(*)
        `)
        .eq('user_id', user.id);

      console.log('[DM SERVER DEBUG] User rooms found:', {
        count: existingRooms?.length || 0,
        error: roomCheckError?.message,
        rooms: existingRooms?.map(r => ({ roomId: r.room_id, roomName: (r.room as any)?.name }))
      });

      if (roomCheckError) {
        console.error('[DM SERVER DEBUG] Error checking existing rooms:', roomCheckError);
      }

      for (const roomMember of existingRooms || []) {
        // Check if this room has exactly 2 members and includes both users
        const { data: members, error: membersError } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', roomMember.room_id);

        if (membersError) {
          console.error('[DM SERVER DEBUG] Error checking room members:', membersError);
          continue;
        }

        console.log('[DM SERVER DEBUG] Room', roomMember.room_id, 'has members:', {
          memberCount: members?.length,
          memberIds: members?.map(m => m.user_id),
          isPrivate: (roomMember.room as any)?.is_private
        });

        if (members?.length === 2) {
          const memberIds = members.map(m => m.user_id);
          if (memberIds.includes(user.id) && memberIds.includes(friend_id)) {
            console.log('[DM SERVER DEBUG] Found existing room:', roomMember.room_id);

            // Room already exists, return it with full details
            const { data: roomWithDetails, error: detailsError } = await supabase
              .from('chat_rooms')
              .select(`
                *,
                members:room_members(
                  user:users(id, username, full_name, avatar_url)
                )
              `)
              .eq('id', roomMember.room_id)
              .single();

            if (detailsError) {
              console.error('[DM SERVER DEBUG] Error getting room details:', detailsError);
              continue;
            }

            console.log('[DM SERVER DEBUG] Returning existing room with details:', {
              roomId: roomWithDetails.id,
              memberCount: roomWithDetails.members?.length,
              members: roomWithDetails.members?.map((m: any) => ({ id: m.user.id, username: m.user.username }))
            });

            return res.json({
              ...roomWithDetails,
              type: 'direct',
              members: roomWithDetails?.members?.map((m: any) => m.user) || []
            });
          }
        }
      }

      console.log('[DM SERVER DEBUG] No existing room found, creating new one');

      // Get friend's details for room name
      const { data: friend, error: friendError } = await supabase
        .from('users')
        .select('username, full_name')
        .eq('id', friend_id)
        .single();

      console.log('[DM SERVER DEBUG] Friend details:', {
        found: !!friend,
        error: friendError?.message,
        friend: friend ? { username: friend.username, fullName: friend.full_name } : null
      });

      if (!friend) {
        return res.status(404).json({ message: 'Friend not found' });
      }

      const roomName = `${user.full_name || user.username}, ${friend.full_name || friend.username}`;

      console.log('[DM SERVER DEBUG] Creating new room:', { roomName });

      // Create new direct message room
      const { data: newRoom, error: createError } = await supabase
        .from('chat_rooms')
        .insert({
          name: roomName,
          is_private: true,
          created_by: user.id,
        })
        .select()
        .single();

      console.log('[DM SERVER DEBUG] Room creation result:', {
        success: !!newRoom,
        error: createError?.message,
        roomId: newRoom?.id
      });

      if (createError) {
        console.error('[DM SERVER DEBUG] Failed to create room:', createError);
        return res.status(500).json({ message: 'Failed to create room' });
      }

      // Add both users as members (use upsert to handle duplicates)
      console.log('[DM SERVER DEBUG] Adding members to room');
      const { error: membersError } = await supabase
        .from('room_members')
        .upsert([
          {
            room_id: newRoom.id,
            user_id: user.id,
            role: 'admin',
          },
          {
            room_id: newRoom.id,
            user_id: friend_id,
            role: 'member',
          },
        ], {
          onConflict: 'room_id,user_id'
        });

      console.log('[DM SERVER DEBUG] Members addition result:', {
        error: membersError?.message
      });

      if (membersError) {
        console.error('[DM SERVER DEBUG] Failed to add members:', membersError);
        return res.status(500).json({ message: 'Failed to add members to room' });
      }

      // Get full room details with members
      const { data: roomWithDetails, error: detailsError } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          members:room_members(
            user:users(id, username, full_name, avatar_url)
          )
        `)
        .eq('id', newRoom.id)
        .single();

      console.log('[DM SERVER DEBUG] Final room details:', {
        success: !!roomWithDetails,
        error: detailsError?.message,
        roomId: roomWithDetails?.id,
        memberCount: roomWithDetails?.members?.length,
        members: roomWithDetails?.members?.map((m: any) => ({ id: m.user.id, username: m.user.username }))
      });

      if (detailsError) {
        console.error('[DM SERVER DEBUG] Failed to get room details:', detailsError);
        return res.status(500).json({ message: 'Failed to get room details' });
      }

      const response = {
        ...roomWithDetails,
        type: 'direct',
        members: roomWithDetails?.members?.map((m: any) => m.user) || []
      };

      console.log('[DM SERVER DEBUG] Sending response:', {
        roomId: response.id,
        memberCount: response.members.length,
        members: response.members.map(m => ({ id: m.id, username: m.username }))
      });

      res.json(response);

    } catch (error) {
      console.error('[DM SERVER DEBUG] Create direct message error:', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/rooms/:roomId/messages', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { roomId } = req.params;
      const { limit = 50, before } = req.query;

      // Verify user is a member of the room
      const { data: membership } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ message: 'You are not a member of this room' });
      }

      let query = supabase
        .from('messages')
        .select(`
          *,
          user:users(id, username, full_name, avatar_url)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(Number(limit));

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data: messages, error: queryError } = await query;

      console.log('[MESSAGE FETCH DEBUG] Query result:', {
        roomId,
        userId: user.id,
        messageCount: messages?.length || 0,
        error: queryError?.message,
        messages: messages?.map(m => ({ id: m.id, content: m.content, user_id: m.user_id }))
      });

      res.json(messages?.reverse() || []);
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/rooms/:roomId/messages', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        console.log('[MESSAGE SERVER DEBUG] Unauthorized message request');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { roomId } = req.params;

      console.log('[MESSAGE SERVER DEBUG] Message creation request:', {
        roomId,
        userId: user.id,
        username: user.username,
        body: req.body,
        timestamp: new Date().toISOString()
      });

      const data = insertMessageSchema.parse({
        ...req.body,
        room_id: roomId,
      });

      console.log('[MESSAGE SERVER DEBUG] Parsed message data:', data);

      // Verify user is a member of the room
      const { data: membership, error: membershipError } = await supabase
        .from('room_members')
        .select('id, role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single();

      console.log('[MESSAGE SERVER DEBUG] Membership check:', {
        found: !!membership,
        error: membershipError?.message,
        membership
      });

      if (!membership) {
        return res.status(403).json({ message: 'You are not a member of this room' });
      }

      // Create message
      const messageData = {
        room_id: data.room_id,
        content: data.content,
        user_id: user.id,
        message_type: data.message_type || 'text',
      };

      // Only add reply_to if it exists and is valid
      if (data.reply_to) {
        messageData.reply_to = data.reply_to;
      }

      console.log('[MESSAGE SERVER DEBUG] Creating message with data:', messageData);

      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert(messageData)
        .select(`
          *,
          user:users(id, username, full_name, avatar_url)
        `)
        .single();

      console.log('[MESSAGE SERVER DEBUG] Message creation result:', {
        success: !!newMessage,
        error: messageError?.message,
        messageId: newMessage?.id
      });

      if (messageError) {
        console.error('[MESSAGE SERVER DEBUG] Failed to create message:', messageError);
        return res.status(500).json({ message: 'Failed to send message' });
      }

      // Get all connected clients for debugging
      const allClients = Array.from(wss.clients);
      const roomClients = allClients.filter((client: WebSocketWithUserId) => client.roomId === roomId);
      const activeClients = roomClients.filter((client: WebSocketWithUserId) => client.readyState === WS.OPEN);

      console.log('[MESSAGE SERVER DEBUG] WebSocket clients status:', {
        totalClients: allClients.length,
        roomClients: roomClients.length,
        activeClients: activeClients.length,
        activeClientIds: activeClients.map((client: WebSocketWithUserId) => client.userId),
        allRoomIds: allClients.map((client: WebSocketWithUserId) => client.roomId).filter(Boolean)
      });

      // Broadcast message to all room members
      console.log('[MESSAGE SERVER DEBUG] ===== BROADCASTING MESSAGE TO ROOM =====');
      console.log('[MESSAGE SERVER DEBUG] Broadcasting message to room:', {
        roomId,
        messageId: newMessage.id,
        messageContent: newMessage.content?.substring(0, 50),
        senderUsername: newMessage.user?.username,
        senderId: newMessage.user_id,
        createdAt: newMessage.created_at,
        broadcastData: {
          type: 'new_message',
          message: newMessage,
        }
      });

      // Get detailed WebSocket client information (reusing existing variables)
      const activeRoomClients = activeClients;
      
      console.log('[MESSAGE SERVER DEBUG] WebSocket clients detailed analysis:', {
        totalClients: allClients.length,
        roomClientsTotal: roomClients.length,
        activeRoomClients: activeRoomClients.length,
        targetRoomId: roomId,
        allClientRooms: allClients.map((client: WebSocketWithUserId) => ({ 
          userId: client.userId, 
          roomId: client.roomId, 
          readyState: client.readyState,
          isOpen: client.readyState === WS.OPEN
        })),
        roomClientDetails: roomClients.map((client: WebSocketWithUserId) => ({
          userId: client.userId,
          readyState: client.readyState,
          isOpen: client.readyState === WS.OPEN,
          webSocketStates: {
            CONNECTING: client.readyState === WS.CONNECTING,
            OPEN: client.readyState === WS.OPEN,
            CLOSING: client.readyState === WS.CLOSING,
            CLOSED: client.readyState === WS.CLOSED
          }
        }))
      });

      broadcastToRoom(roomId, {
        type: 'new_message',
        message: newMessage,
      });

      console.log('[MESSAGE SERVER DEBUG] Message sent and broadcasted:', {
        messageId: newMessage.id,
        roomId: roomId,
        senderId: user.id,
        senderUsername: user.username,
        content: newMessage.content?.substring(0, 50) + (newMessage.content?.length > 50 ? '...' : ''),
        timestamp: new Date().toISOString(),
        connectedClientsInRoom: activeClients.length
      });

      res.json(newMessage);
    } catch (error) {
      console.error('[MESSAGE SERVER DEBUG] Send message error:', {
        error: error.message,
        stack: error.stack,
        roomId: req.params.roomId,
        userId: req.body
      });
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/rooms/:roomId/members', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { roomId } = req.params;

      // Verify user is a member of the room
      const { data: membership } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ message: 'You are not a member of this room' });
      }

      // Get room members
      const { data: members } = await supabase
        .from('room_members')
        .select(`
          *,
          user:users(*)
        `)
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      res.json(members || []);
    } catch (error) {
      console.error('Get room members error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/rooms/:roomId', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { roomId } = req.params;

      // Verify user is admin of the room
      const { data: membership } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single();

      if (!membership || membership.role !== 'admin') {
        return res.status(403).json({ message: 'Only room admins can delete the room' });
      }

      // Delete room (cascade will handle members and messages)
      await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', roomId);

      res.json({ message: 'Room deleted successfully' });
    } catch (error) {
      console.error('Delete room error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/rooms/:roomId/leave', async (req: Request, res: Response) => {
    try {
      const user = await getUserFromSession(req.headers.authorization);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { roomId } = req.params;

      // Remove user from room
      await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      res.json({ message: 'Left room successfully' });
    } catch (error) {
      console.error('Leave room error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  return httpServer;
}