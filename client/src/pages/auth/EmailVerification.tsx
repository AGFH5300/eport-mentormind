import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CheckCircle, XCircle, Mail } from 'lucide-react';

export default function EmailVerification() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/verify-email');
  const { toast } = useToast();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'waiting'>('waiting');
  const [message, setMessage] = useState('');

  const token = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      setStatus('loading');
      // Redirect to set password page for token verification
      setLocation(`/set-password?token=${verificationToken}&type=verify`);
    } catch (error) {
      setStatus('error');
      setMessage('Failed to process verification token');
    }
  };

  const handleGoToLogin = () => {
    setLocation('/login');
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <LoadingSpinner size="lg" />
            </div>
            <h1 className="text-2xl font-semibold mb-4">Verifying Your Email</h1>
            <p className="text-muted-foreground">
              Please wait while we verify your email address...
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-green-100 dark:bg-green-900 rounded-full p-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold mb-4">Email Verified!</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button onClick={handleGoToLogin} data-testid="button-go-to-login">
              Go to Sign In
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-red-100 dark:bg-red-900 rounded-full p-4">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold mb-4">Verification Failed</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <div className="space-y-2">
              <Button onClick={handleGoToLogin} data-testid="button-go-to-login">
                Go to Sign In
              </Button>
              <Button variant="outline" onClick={() => setLocation('/signup')}>
                Create New Account
              </Button>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <Mail className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>
            <h1 className="text-2xl font-semibold mb-4">Check Your Email</h1>
            <p className="text-muted-foreground mb-6">
              We've sent a verification link to your email address. 
              Please check your inbox and click the link to verify your account.
            </p>
            <Button onClick={handleGoToLogin} data-testid="button-go-to-login">
              Go to Sign In
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-4">
      <Card className="w-full max-w-md border shadow-sm">
        <CardContent className="pt-6">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
