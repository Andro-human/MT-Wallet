import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Key, Copy, RefreshCw, LogOut, Check, Loader2, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useRegenerateApiKey } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeedDataButton } from '@/components/debug/SeedDataButton';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const regenerateApiKey = useRegenerateApiKey();
  const { toast } = useToast();
  
  const [copied, setCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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
          <p className="text-sm text-muted-foreground mt-0.5">
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
                  <p className="text-sm text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* API Key Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5 mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">API Key</h3>
              <p className="text-xs text-muted-foreground">
                Use this key to sync SMS transactions
              </p>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-14 rounded-xl" />
          ) : (
            <>
              <div className="flex items-center gap-2 p-4 rounded-xl bg-muted/30 border border-border/50 mb-4">
                <code className="flex-1 text-xs text-foreground font-mono truncate">
                  {showApiKey ? profile?.api_key : '••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-xs text-primary font-medium hover:underline shrink-0"
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
              <h3 className="font-semibold text-foreground">App Info</h3>
              <p className="text-xs text-muted-foreground">
                Version and demo data
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
              <span className="text-sm text-muted-foreground">Demo Data</span>
              <SeedDataButton />
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
              <span className="text-sm text-muted-foreground">App Version</span>
              <span className="text-sm text-foreground font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
              <span className="text-sm text-muted-foreground">Build</span>
              <span className="text-sm text-foreground font-medium">MTWallet PWA</span>
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
            className="w-full gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
