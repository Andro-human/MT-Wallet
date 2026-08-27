import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

// Strong password schema for sign-up
const strongPasswordSchema = z.string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Needs uppercase')
  .regex(/[0-9]/, 'Needs number');

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
});

const signUpSchema = z.object({
  email: z.string().email('Invalid email'),
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

  // Handle update_password from URL param
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
        toast({ title: 'Link Sent', description: 'Check your email inbox.' });
        setMode('login');
        return;
      }

      if (mode === 'update_password') {
        const pwResult = strongPasswordSchema.safeParse(password);
        if (!pwResult.success) {
          setErrors({ password: pwResult.error.errors[0].message });
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
        toast({ title: 'Password Updated' });
        navigate('/', { replace: true });
        return;
      }

      if (mode === 'login') {
        const result = loginSchema.safeParse({ email, password });
        if (!result.success) {
          setErrors(Object.fromEntries(result.error.errors.map(e => [e.path[0], e.message])));
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          toast({ title: 'Login Failed', description: error.message, variant: 'destructive' });
          return;
        }
      } else if (mode === 'signup') {
        const result = signUpSchema.safeParse({ email, password });
        if (!result.success) {
          setErrors(Object.fromEntries(result.error.errors.map(e => [e.path[0], e.message])));
          return;
        }

        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast({ title: 'Sign Up Failed', description: error.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Verify Email', description: 'Check your inbox to confirm account.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'bg-transparent border-0 border-b border-border rounded-none px-0 h-10 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/40';

  return (
    <div className="min-h-screen bg-background bg-grain flex text-foreground font-sans">
      {/* Left: what this is. No invented version numbers, and no claims about
          encryption or uptime that nothing here actually verifies. */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 border-r border-border/50">
        <div>
          <h1 className="font-heading text-3xl font-normal">MT Wallet</h1>
          <p className="mt-1.5 text-2xs font-mono uppercase tracking-widest text-muted-foreground">
            a ledger that keeps itself
          </p>
        </div>

        <p className="font-heading text-4xl font-normal leading-tight max-w-sm text-foreground/90">
          Every rupee, where it went, and what you said about it.
        </p>

        <p className="text-2xs font-mono text-muted-foreground">
          Built for one person. Yours.
        </p>
      </div>

      {/* Right: the form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-20 relative">
        <div className="absolute top-8 left-8 lg:hidden">
          <h1 className="font-heading text-xl font-normal">MT Wallet</h1>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <h2 className="font-heading text-3xl font-normal">
              {mode === 'login' && 'Sign in'}
              {mode === 'signup' && 'Create your ledger'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'update_password' && 'Choose a new password'}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode === 'login' && 'Welcome back.'}
              {mode === 'signup' && 'One account, one ledger.'}
              {mode === 'forgot' && "We'll email you a link."}
              {mode === 'update_password' && 'At least 8 characters, with a capital and a number.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="popLayout">
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <Label htmlFor="fullName" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                    Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={fieldClass}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {mode !== 'update_password' && (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass}
                />
                {errors.email && <p className="text-xs text-primary font-mono mt-1">{errors.email}</p>}
              </div>
            )}

            {mode !== 'forgot' && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                  {mode === 'update_password' ? 'New password' : 'Password'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldClass}
                />
                {errors.password && <p className="text-xs text-primary font-mono mt-1">{errors.password}</p>}
              </div>
            )}

            {mode === 'update_password' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                  Confirm
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={fieldClass}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-primary font-mono mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            <div className="pt-2 space-y-5">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                {loading
                  ? 'One moment...'
                  : mode === 'login'
                    ? 'Sign in'
                    : mode === 'signup'
                      ? 'Create account'
                      : mode === 'forgot'
                        ? 'Send link'
                        : 'Save password'}
              </Button>

              <div className="flex justify-between items-center text-xs">
                {mode === 'login' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMode('signup'); setErrors({}); }}
                      className="text-primary hover:opacity-80 transition-opacity"
                    >
                      Create an account
                    </button>
                  </>
                )}
                {mode !== 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErrors({}); }}
                    className="w-full text-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
