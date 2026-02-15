import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Key, Copy, RefreshCw, LogOut, Check, Loader2, Sparkles,
  History, ChevronRight, Building2, Tag, Lock,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useRegenerateApiKey } from '@/hooks/useProfile';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { z } from 'zod';

// Strong password schema
const strongPasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');

export default function SettingsPage() {
  const { user, signOut, updatePassword } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const regenerateApiKey = useRegenerateApiKey();
  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: categories = [] } = useCategories();
  const { toast } = useToast();
  
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleCopyApiKey = async () => {
    if (!profile?.api_key) return;
    
    await navigator.clipboard.writeText(profile.api_key);
    setCopied(true);
    toast({ title: 'API key copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateApiKey = async () => {
    try {
      await regenerateApiKey.mutateAsync();
      toast({ title: 'New API key generated' });
    } catch {
      toast({ title: 'Failed to regenerate API key', variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleChangePassword = async () => {
    setPasswordErrors([]);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordErrors(['Passwords do not match']);
      return;
    }

    // Validate strong password
    const result = strongPasswordSchema.safeParse(newPassword);
    if (!result.success) {
      setPasswordErrors(result.error.errors.map(e => e.message));
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setPasswordErrors([error.message]);
        return;
      }
      toast({ title: 'Password updated successfully' });
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordErrors(['Failed to update password']);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-5 pt-8 pb-4 safe-area-top">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-base text-muted-foreground mt-0.5">
            Manage your account
          </p>
        </motion.div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-elevated p-6 mb-4"
        >
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, hsl(252 87% 64%), hsl(280 85% 55%))',
                boxShadow: '0 8px 24px -8px hsl(252 87% 64% / 0.4)',
              }}
            >
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </>
              ) : (
                <>
                  <h2 className="font-bold text-lg text-foreground truncate">
                    {profile?.full_name || 'User'}
                  </h2>
                  <p className="text-base text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Bank Accounts — navigation link */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            onClick={() => navigate('/bank-accounts')}
            className="w-full glass-card p-5 mb-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-base text-foreground">Bank Accounts</h3>
              <p className="text-sm text-muted-foreground">
                {bankAccounts.length} linked account{bankAccounts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </motion.div>

        {/* Categories — navigation link */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            onClick={() => navigate('/categories')}
            className="w-full glass-card p-5 mb-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-base text-foreground">Categories</h3>
              <p className="text-sm text-muted-foreground">
                {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </motion.div>

        {/* API Key Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5 mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">API Key</h3>
              <p className="text-sm text-muted-foreground">
                Use this key to sync SMS transactions
              </p>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-14 rounded-xl" />
          ) : (
            <>
              <div className="flex items-center gap-2 p-4 rounded-xl bg-muted/30 border border-border/50 mb-4">
                <code className="flex-1 text-sm text-foreground font-mono truncate">
                  {showApiKey ? profile?.api_key : '••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-sm text-primary font-medium hover:underline shrink-0"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyApiKey}
                  className="flex-1 gap-2 rounded-xl border-border/50 h-10"
                >
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateApiKey}
                  disabled={regenerateApiKey.isPending}
                  className="flex-1 gap-2 rounded-xl border-border/50 h-10"
                >
                  {regenerateApiKey.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Regenerate
                </Button>
              </div>
            </>
          )}
        </motion.div>

        {/* Change Password Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5 mb-4"
        >
          <button
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="w-full flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-base text-foreground">Change Password</h3>
              <p className="text-sm text-muted-foreground">
                Update your account password
              </p>
            </div>
            <ChevronRight className={cn(
              "w-5 h-5 text-muted-foreground transition-transform duration-200",
              showChangePassword && "rotate-90"
            )} />
          </button>

          <AnimatePresence>
            {showChangePassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm text-muted-foreground">
                      New Password
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="bg-muted/30 border-border/50 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">
                      Confirm Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="bg-muted/30 border-border/50 rounded-xl"
                    />
                  </div>

                  {/* Password requirements */}
                  <div className="text-sm text-muted-foreground space-y-1 p-3 rounded-xl bg-muted/20">
                    <p className="font-medium text-foreground mb-1.5">Password requirements:</p>
                    <p className={cn(newPassword.length >= 8 && "text-success")}>• At least 8 characters</p>
                    <p className={cn(/[A-Z]/.test(newPassword) && "text-success")}>• One uppercase letter</p>
                    <p className={cn(/[a-z]/.test(newPassword) && "text-success")}>• One lowercase letter</p>
                    <p className={cn(/[0-9]/.test(newPassword) && "text-success")}>• One number</p>
                    <p className={cn(/[^A-Za-z0-9]/.test(newPassword) && "text-success")}>• One special character</p>
                  </div>

                  {passwordErrors.length > 0 && (
                    <div className="text-sm text-destructive space-y-1">
                      {passwordErrors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword || !confirmPassword}
                    className="w-full rounded-xl"
                  >
                    {changingPassword ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Update Password
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Sync History */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            onClick={() => navigate('/sync')}
            className="w-full glass-card p-5 mb-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <History className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-base text-foreground">Sync History</h3>
              <p className="text-sm text-muted-foreground">
                View SMS ingestion runs and parsed results
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </motion.div>

        {/* App Info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5 mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">App Info</h3>
              <p className="text-sm text-muted-foreground">
                Version and demo data
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
              <span className="text-base text-muted-foreground">App Version</span>
              <span className="text-base text-foreground font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
              <span className="text-base text-muted-foreground">Build</span>
              <span className="text-base text-foreground font-medium">MTWallet PWA</span>
            </div>
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
