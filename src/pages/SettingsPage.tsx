import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Key, Copy, RefreshCw, LogOut, Check, Loader2 } from 'lucide-react';
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
      <div className="px-4 pt-6 pb-4 safe-area-top">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account
          </p>
        </motion.div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card p-6 mb-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center">
              <User className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <>
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-4 w-48" />
                </>
              ) : (
                <>
                  <h2 className="font-semibold text-foreground truncate">
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-card p-4 mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">API Key</h3>
              <p className="text-xs text-muted-foreground">
                Use this key to sync SMS transactions
              </p>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-12 rounded-xl" />
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted mb-3">
                <code className="flex-1 text-xs text-foreground font-mono truncate">
                  {showApiKey ? profile?.api_key : '••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-xs text-primary hover:underline"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyApiKey}
                  className="flex-1 gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateApiKey}
                  disabled={regenerateApiKey.isPending}
                  className="flex-1 gap-2"
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-card p-4 mb-4"
        >
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Demo Data</span>
              <SeedDataButton />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">App Version</span>
              <span className="text-foreground">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Build</span>
              <span className="text-foreground">MTWallet PWA</span>
            </div>
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            variant="destructive"
            className="w-full gap-2"
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
