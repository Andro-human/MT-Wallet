import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { cn } from '@/lib/utils';

// Strong password schema for sign-up
const strongPasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: strongPasswordSchema,
});

type AuthMode = 'login' | 'signup' | 'forgot' | 'update_password';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');

  const [mode, setMode] = useState<AuthMode>(
    typeParam === 'update_password' ? 'update_password' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signIn, signUp, user, resetPassword, updatePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && mode !== 'update_password') {
      navigate('/', { replace: true });
    }
  }, [user, navigate, mode]);

  // Handle update_password from URL param (after clicking reset link in email)
  useEffect(() => {
    if (typeParam === 'update_password') {
      setMode('update_password');
    }
  }, [typeParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (mode === 'forgot') {
        if (!email) {
          setErrors({ email: 'Please enter your email' });
          return;
        }
        const { error } = await resetPassword(email);
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          return;
        }
        toast({
          title: 'Reset link sent',
          description: 'Check your email for a password reset link.',
        });
        setMode('login');
        return;
      }

      if (mode === 'update_password') {
        // Validate strong password
        const pwResult = strongPasswordSchema.safeParse(password);
        if (!pwResult.success) {
          const pwErrors: Record<string, string> = {};
          pwErrors.password = pwResult.error.errors.map(e => e.message).join('. ');
          setErrors(pwErrors);
          return;
        }
        if (password !== confirmPassword) {
          setErrors({ confirmPassword: 'Passwords do not match' });
          return;
        }
        const { error } = await updatePassword(password);
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Password updated successfully' });
        navigate('/', { replace: true });
        return;
      }

      if (mode === 'login') {
        const result = loginSchema.safeParse({ email, password });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0].toString()] = err.message;
            }
          });
          setErrors(fieldErrors);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Login failed',
              description: 'Invalid email or password. Please try again.',
              variant: 'destructive',
            });
          } else if (error.message.includes('Email not confirmed')) {
            toast({
              title: 'Email not verified',
              description: 'Please check your email and verify your account before signing in.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Login failed',
              description: error.message,
              variant: 'destructive',
            });
          }
          return;
        }
      } else if (mode === 'signup') {
        const result = signUpSchema.safeParse({ email, password });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0].toString()] = err.message;
            }
          });
          setErrors(fieldErrors);
          return;
        }

        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Account exists',
              description: 'This email is already registered. Try signing in instead.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Sign up failed',
              description: error.message,
              variant: 'destructive',
            });
          }
          return;
        }
        toast({
          title: 'Check your email',
          description: 'We sent you a verification link. Please check your inbox.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradient */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 100% 80% at 50% 0%, hsl(252 87% 64% / 0.12), transparent 60%)',
        }}
      />
      
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm relative"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center justify-center w-18 h-18 rounded-3xl mb-5"
            style={{
              background: 'linear-gradient(135deg, hsl(252 87% 64%), hsl(280 85% 55%))',
              boxShadow: '0 12px 32px -8px hsl(252 87% 64% / 0.5)',
            }}
          >
            <Wallet className="w-9 h-9 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">MTWallet</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {mode === 'forgot' ? 'Reset your password' :
             mode === 'update_password' ? 'Set a new password' :
             'Track where your money goes'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name — sign up only */}
          <AnimatePresence>
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <Label htmlFor="fullName" className="text-sm text-muted-foreground mb-2 block">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="pl-11 h-12 bg-card/60 border-border/50 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:bg-card focus:border-primary/50"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email — login, signup, forgot */}
          {mode !== 'update_password' && (
            <div>
              <Label htmlFor="email" className="text-sm text-muted-foreground mb-2 block">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-11 h-12 bg-card/60 border-border/50 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:bg-card focus:border-primary/50"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive mt-1.5">{errors.email}</p>
              )}
            </div>
          )}

          {/* Password — login, signup, update_password */}
          {mode !== 'forgot' && (
            <div>
              <Label htmlFor="password" className="text-sm text-muted-foreground mb-2 block">
                {mode === 'update_password' ? 'New Password' : 'Password'}
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-11 h-12 bg-card/60 border-border/50 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:bg-card focus:border-primary/50"
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive mt-1.5">{errors.password}</p>
              )}
            </div>
          )}

          {/* Confirm Password — update_password only */}
          {mode === 'update_password' && (
            <div>
              <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground mb-2 block">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-11 h-12 bg-card/60 border-border/50 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:bg-card focus:border-primary/50"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive mt-1.5">{errors.confirmPassword}</p>
              )}
            </div>
          )}

          {/* Password requirements — signup & update_password */}
          {(mode === 'signup' || mode === 'update_password') && password.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              className="text-xs text-muted-foreground space-y-1 p-3 rounded-xl bg-card/40 border border-border/30"
            >
              <p className="font-medium text-foreground mb-1.5">Password requirements:</p>
              <p className={cn(password.length >= 8 && "text-success")}>• At least 8 characters</p>
              <p className={cn(/[A-Z]/.test(password) && "text-success")}>• One uppercase letter</p>
              <p className={cn(/[a-z]/.test(password) && "text-success")}>• One lowercase letter</p>
              <p className={cn(/[0-9]/.test(password) && "text-success")}>• One number</p>
              <p className={cn(/[^A-Za-z0-9]/.test(password) && "text-success")}>• One special character</p>
            </motion.div>
          )}

          {/* Forgot password link — login only */}
          {mode === 'login' && (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl text-base font-semibold transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, hsl(252 87% 64%), hsl(280 85% 55%))',
              boxShadow: loading ? 'none' : '0 8px 24px -8px hsl(252 87% 64% / 0.5)',
            }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                {mode === 'login' ? 'Sign In' :
                 mode === 'signup' ? 'Create Account' :
                 mode === 'forgot' ? 'Send Reset Link' :
                 'Update Password'}
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>
        </form>

        {/* Toggle links */}
        <div className="text-center text-sm text-muted-foreground mt-8 space-y-2">
          {mode === 'login' && (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setErrors({}); }}
                className="text-primary font-semibold hover:underline"
              >
                Sign up
              </button>
            </p>
          )}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setErrors({}); }}
                className="text-primary font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setErrors({}); }}
                className="text-primary font-semibold hover:underline"
              >
                Back to sign in
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
