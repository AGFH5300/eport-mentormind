import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'wouter';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KeyRound } from 'lucide-react';

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ResetData = z.infer<typeof resetSchema>;

export default function PasswordReset() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ResetData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ResetData) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setEmailSent(true);
        toast({
          title: 'Reset Email Sent',
          description: result.message,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reset email',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-4">
        <Card className="w-full max-w-md border shadow-sm">
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center mb-6">
              <KeyRound className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>
            <h1 className="text-2xl font-semibold mb-4">Check Your Email</h1>
            <p className="text-muted-foreground mb-6">
              We've sent password reset instructions to your email address. 
              Please check your inbox and follow the instructions to reset your password.
            </p>
            <Link href="/login">
              <Button className="w-full" data-testid="button-back-to-login">
                Back to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-4">
      <Card className="w-full max-w-md border shadow-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-gray-600 dark:text-gray-400" />
          </div>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <p className="text-muted-foreground">Enter your email to receive reset instructions</p>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-send-reset"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Email'
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-primary hover:underline font-medium">
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
