import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/components/ui/theme-provider';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { 
  Settings, 
  User as UserIcon, 
  Shield, 
  Bell, 
  Key, 
  Download, 
  Trash,
  Moon,
  Sun 
} from 'lucide-react';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  username: z.string().min(1, 'Username is required'),
});

const settingsSchema = z.object({
  show_online_status: z.boolean(),
  read_receipts: z.boolean(),
  desktop_notifications: z.boolean(),
  sound_notifications: z.boolean(),
});

type ProfileData = z.infer<typeof profileSchema>;
type SettingsData = z.infer<typeof settingsSchema>;

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { user, updateProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState({
    show_online_status: true,
    read_receipts: true,
    desktop_notifications: true,
    sound_notifications: false,
  });
  
  const form = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      username: user?.username || '',
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      await updateProfile(data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Profile updated successfully!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await fetch('/api/users/avatar', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload avatar');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      updateProfile({ avatar_url: data.avatar_url });
      toast({
        title: 'Success',
        description: 'Avatar updated successfully!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmitProfile = (data: ProfileData) => {
    updateProfileMutation.mutate(data);
  };

  const handleAvatarChange = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'Error',
          description: 'File size must be less than 5MB',
          variant: 'destructive',
        });
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Error',
          description: 'Please select an image file',
          variant: 'destructive',
        });
        return;
      }
      
      setIsUploading(true);
      uploadAvatarMutation.mutate(file);
    }
  };
  
  const handleSettingsChange = (key: keyof SettingsData, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast({
      title: 'Setting updated',
      description: `${key.replace('_', ' ')} ${value ? 'enabled' : 'disabled'}`,
    });
  };
  
  const handleChangePassword = () => {
    toast({
      title: 'Coming Soon',
      description: 'Password change functionality will be available soon.',
    });
  };
  
  const handleExportData = () => {
    toast({
      title: 'Export Started',
      description: 'Your data export has been initiated. You will receive an email when ready.',
    });
  };
  
  const handleDeleteAccount = () => {
    toast({
      title: 'Account Deletion',
      description: 'Please contact support to delete your account.',
      variant: 'destructive',
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      onOpenChange(false);
      toast({
        title: 'Success',
        description: 'Logged out successfully!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to logout',
        variant: 'destructive',
      });
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden" data-testid="settings-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Account
            </TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto max-h-[calc(80vh-180px)] mt-4">
            <TabsContent value="profile" className="space-y-6">
              <div className="flex items-center gap-4">
                <UserAvatar user={user} size="lg" />
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleAvatarChange}
                    disabled={isUploading || uploadAvatarMutation.isPending}
                    data-testid="button-change-avatar"
                  >
                    {uploadAvatarMutation.isPending ? 'Uploading...' : 'Change Avatar'}
                  </Button>
                  <p className="text-xs text-muted-foreground">Max 5MB, JPG/PNG only</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitProfile)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-full-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input value={user.email} disabled />
                    </FormControl>
                  </FormItem>

                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="privacy" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Show Online Status</h4>
                    <p className="text-sm text-muted-foreground">
                      Let others see when you're online
                    </p>
                  </div>
                  <Switch 
                    checked={settings.show_online_status}
                    onCheckedChange={(checked) => handleSettingsChange('show_online_status', checked)}
                    data-testid="switch-online-status"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Read Receipts</h4>
                    <p className="text-sm text-muted-foreground">
                      Show when you've read messages
                    </p>
                  </div>
                  <Switch 
                    checked={settings.read_receipts}
                    onCheckedChange={(checked) => handleSettingsChange('read_receipts', checked)}
                    data-testid="switch-read-receipts"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Desktop Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified about new messages
                    </p>
                  </div>
                  <Switch 
                    checked={settings.desktop_notifications}
                    onCheckedChange={(checked) => handleSettingsChange('desktop_notifications', checked)}
                    data-testid="switch-desktop-notifications"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Sound Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Play sound for new messages
                    </p>
                  </div>
                  <Switch 
                    checked={settings.sound_notifications}
                    onCheckedChange={(checked) => handleSettingsChange('sound_notifications', checked)}
                    data-testid="switch-sound-notifications" 
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Dark Mode</h4>
                    <p className="text-sm text-muted-foreground">
                      Toggle between light and dark themes
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleTheme}
                    className="flex items-center gap-2"
                    data-testid="button-toggle-theme"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4" />
                        Light
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4" />
                        Dark
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="account" className="space-y-6">
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleChangePassword}
                  data-testid="button-change-password"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Change Password
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleExportData}
                  data-testid="button-export-data"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>

                <Separator />

                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full justify-start"
                  data-testid="button-logout"
                >
                  <UserIcon className="w-4 h-4 mr-2" />
                  Logout
                </Button>

                <Button 
                  variant="destructive" 
                  className="w-full justify-start"
                  onClick={handleDeleteAccount}
                  data-testid="button-delete-account"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
