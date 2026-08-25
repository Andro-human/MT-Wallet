import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-background flex text-foreground font-sans">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex w-1/2 bg-secondary/20 relative flex-col justify-between p-12 overflow-hidden border-r border-border">

        <div className="relative z-10">
          <h1 className="text-4xl font-heading font-bold tracking-tighter">MT.WALLET</h1>
          <p className="text-muted-foreground mt-2 font-mono text-xs uppercase tracking-widest">
            Finance OS V2.0
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-6xl font-heading font-bold leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground/20">
            TOTAL<br />CONTROL
          </p>
        </div>

        <div className="relative z-10 flex justify-between items-end border-t border-border pt-6">
          <div className="text-xs font-mono text-muted-foreground">
            SYSTEM_STATUS: ONLINE<br />
            ENCRYPTION: AES-256
          </div>
          <div className="h-12 w-12 bg-primary rounded-none flex items-center justify-center">
            <ArrowUpRight className="text-primary-foreground w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-24 relative">
        <div className="absolute top-8 right-8 lg:hidden">
          <h1 className="text-xl font-heading font-bold">MT.W</h1>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="mb-10">
            <h2 className="text-3xl font-heading font-semibold tracking-tight">
              {mode === 'login' && 'Authenticate'}
              {mode === 'signup' && 'Initialize'}
              {mode === 'forgot' && 'Recovery'}
              {mode === 'update_password' && 'New Vector'}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode === 'login' && 'Enter credentials to access dashboard.'}
              {mode === 'signup' && 'Create new identity within the system.'}
              {mode === 'forgot' && 'Reset access protocols.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <AnimatePresence mode="popLayout">
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <Label htmlFor="fullName" className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Identity</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="FULL NAME"
                    className="bg-transparent border-b border-border border-l-0 border-r-0 border-t-0 rounded-none px-0 h-10 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/30 font-medium"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            {mode !== 'update_password' && (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Identifier</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="EMAIL ADDRESS"
                  className="bg-transparent border-b border-border border-l-0 border-r-0 border-t-0 rounded-none px-0 h-10 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/30 font-medium"
                />
                {errors.email && <p className="text-xs text-destructive font-mono mt-1">{errors.email}</p>}
              </div>
            )}

            {/* Password */}
            {mode !== 'forgot' && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
                  {mode === 'update_password' ? 'New Key' : 'Key'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="PASSWORD"
                  className="bg-transparent border-b border-border border-l-0 border-r-0 border-t-0 rounded-none px-0 h-10 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/30 font-medium"
                />
                {errors.password && <p className="text-xs text-destructive font-mono mt-1">{errors.password}</p>}
              </div>
            )}

            {/* Confirm Password */}
            {mode === 'update_password' && (
              <div className="space-y-2">
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="CONFIRM PASSWORD"
                  className="bg-transparent border-b border-border border-l-0 border-r-0 border-t-0 rounded-none px-0 h-10 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/30 font-medium"
                />
                {errors.confirmPassword && <p className="text-xs text-destructive font-mono mt-1">{errors.confirmPassword}</p>}
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 space-y-4">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-none bg-primary text-primary-foreground font-bold tracking-widest hover:bg-primary/90 transition-all border border-transparent hover:border-sidebar-primary/20 text-xs uppercase"
              >
                {loading ? 'PROCESSING...' : (
                  mode === 'login' ? 'Execute' :
                    mode === 'signup' ? 'Initiate' :
                      mode === 'forgot' ? 'Send Link' : 'Update'
                )}
              </Button>

              <div className="flex justify-between items-center text-xs font-mono">
                {mode === 'login' && (
                  <>
                    <button type="button" onClick={() => setMode('forgot')} className="text-muted-foreground hover:text-primary transition-colors">
                      FORGOT PASSWORD?
                    </button>
                    <button type="button" onClick={() => { setMode('signup'); setErrors({}); }} className="text-foreground border-b border-primary pb-0.5 hover:opacity-80 transition-opacity">
                      CREATE ACCOUNT
                    </button>
                  </>
                )}
                {mode === 'signup' && (
                  <button type="button" onClick={() => { setMode('login'); setErrors({}); }} className="w-full text-center text-muted-foreground hover:text-foreground transition-colors">
                    ALREADY HAVE ACCOUNT? LOGIN
                  </button>
                )}
                {mode === 'forgot' && (
                  <button type="button" onClick={() => { setMode('login'); setErrors({}); }} className="w-full text-center text-muted-foreground hover:text-foreground transition-colors">
                    BACK TO LOGIN
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 w-full text-center lg:text-left lg:px-24">
          <p className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-widest">
            Secure Connection • v2.0.4
          </p>
        </div>
      </div>
    </div>
  );
}
