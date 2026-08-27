import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Key, Copy, RefreshCw, LogOut, Check, Loader2,
    History, ChevronRight, Building2, Tag, Lock, Bell, BellOff, Wand2, FileCheck, FolderKanban,
    Sun, Moon,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useRegenerateApiKey, useUpdateReviewMode } from '@/hooks/useProfile';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTheme } from '@/hooks/useTheme';
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
    const updateReviewMode = useUpdateReviewMode();
    const { data: bankAccounts = [] } = useBankAccounts();
    const { data: categories = [] } = useCategories();
    const { data: transactionGroups = [] } = useTransactionGroups();
    const { toast } = useToast();
    const { theme, preference, setPreference } = useTheme();
    const { isSupported: pushSupported, permissionState, isSubscribed: pushSubscribed, isLoading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();

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
            <div className="px-5 pt-safe pb-4 page-shell">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-6 md:mb-8 border-b border-border/50 pb-4"
                >
                    <h1 className="text-3xl font-heading font-bold text-foreground leading-none">Settings</h1>
                    <p className="text-xs font-mono text-muted-foreground mt-2 uppercase tracking-widest">
                        System Configuration
                    </p>
                </motion.div>

                {/* Profile Card - Neo Style */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="neo-card p-6 mb-6 flex items-center gap-6"
                >
                    <div className="w-16 h-16 bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <User className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        {isLoading ? (
                            <Skeleton className="h-6 w-32 mb-2 bg-muted/20" />
                        ) : (
                            <>
                                <h2 className="font-heading font-bold text-xl text-foreground truncate">
                                    {profile?.full_name || 'User'}
                                </h2>
                                <p className="text-sm font-mono text-muted-foreground truncate mt-1">
                                    {user?.email}
                                </p>
                            </>
                        )}
                    </div>
                </motion.div>

                <div className="space-y-3">
                    {/* Day / Night ledger */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.18 }}
                    >
                        <div className="w-full neo-card p-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 border border-border flex items-center justify-center">
                                    {theme === 'day'
                                        ? <Sun className="w-5 h-5 text-gold" />
                                        : <Moon className="w-5 h-5 text-muted-foreground" />}
                                </div>
                                <div className="flex-1 text-left">
                                    <h3 className="font-bold text-sm text-foreground">Theme</h3>
                                    <p className="text-xs font-mono text-muted-foreground mt-0.5 uppercase">
                                        {preference === 'system'
                                            ? `System · ${theme === 'day' ? 'paper & ink' : 'midnight soot'}`
                                            : preference === 'day' ? 'Paper & ink' : 'Midnight soot'}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-muted/30 p-1">
                                {([
                                    { key: 'day', label: 'Light' },
                                    { key: 'night', label: 'Dark' },
                                    { key: 'system', label: 'System' },
                                ] as const).map((opt) => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setPreference(opt.key)}
                                        aria-pressed={preference === opt.key}
                                        className={cn(
                                            'py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors',
                                            preference === opt.key
                                                ? 'bg-background text-foreground'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Bank Accounts */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <button
                            onClick={() => navigate('/bank-accounts')}
                            className="w-full neo-card p-4 flex items-center gap-4 group hover:bg-muted/5 transition-colors"
                        >
                            <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                <Building2 className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="font-bold text-sm text-foreground">Bank Accounts</h3>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                    {bankAccounts.length} LINKED
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                    </motion.div>

                    {/* Categories */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 }}
                    >
                        <button
                            onClick={() => navigate('/categories')}
                            className="w-full neo-card p-4 flex items-center gap-4 group hover:bg-muted/5 transition-colors"
                        >
                            <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                <Tag className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="font-bold text-sm text-foreground">Categories</h3>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                    {categories.length} DEFINED
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                    </motion.div>

                    {/* Groups */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.27 }}
                    >
                        <button
                            onClick={() => navigate('/settings/groups')}
                            className="w-full neo-card p-4 flex items-center gap-4 group hover:bg-muted/5 transition-colors"
                        >
                            <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                <FolderKanban className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="font-bold text-sm text-foreground">Groups</h3>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                    {transactionGroups.length} DEFINED
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                    </motion.div>

                    {/* Automation Rules */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.28 }}
                    >
                        <button
                            onClick={() => navigate('/settings/rules')}
                            className="w-full neo-card p-4 flex items-center gap-4 group hover:bg-muted/5 transition-colors"
                        >
                            <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                <Wand2 className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="font-bold text-sm text-foreground">Automation Rules</h3>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                    MERCHANT MAPPINGS & PREFERENCES
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                    </motion.div>

                    {/* API Key */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="neo-card p-5"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 border border-border flex items-center justify-center">
                                    <Key className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-foreground">API Access</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Sync Transactions</p>
                                </div>
                            </div>
                        </div>

                        {isLoading ? (
                            <Skeleton className="h-10 w-full bg-muted/20" />
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 p-3 border border-border bg-muted/40">
                                    <code className="flex-1 text-xs text-primary font-mono truncate">
                                        {showApiKey ? profile?.api_key : '•'.repeat(32)}
                                    </code>
                                    <button
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                                    >
                                        {showApiKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCopyApiKey}
                                        className="flex-1 h-9 rounded-none border-border hover:bg-primary hover:text-primary-foreground font-mono text-xs uppercase"
                                    >
                                        {copied ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
                                        {copied ? 'Copied' : 'Copy Key'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRegenerateApiKey}
                                        disabled={regenerateApiKey.isPending}
                                        className="flex-1 h-9 rounded-none border-border hover:bg-destructive hover:text-destructive-foreground font-mono text-xs uppercase"
                                    >
                                        {regenerateApiKey.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                                        Regenerate
                                    </Button>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Change Password */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 }}
                        className="neo-card p-0 overflow-hidden"
                    >
                        <button
                            onClick={() => setShowChangePassword(!showChangePassword)}
                            className="w-full p-4 flex items-center gap-4 group hover:bg-muted/5 transition-colors"
                        >
                            <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                <Lock className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="font-bold text-sm text-foreground">Security</h3>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                    CHANGE PASSWORD
                                </p>
                            </div>
                            <ChevronRight className={cn(
                                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                                showChangePassword && "rotate-90"
                            )} />
                        </button>

                        <AnimatePresence>
                            {showChangePassword && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden border-t border-border"
                                >
                                    <div className="p-4 space-y-4 bg-muted/5">
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs font-mono uppercase text-muted-foreground">New Password</Label>
                                                <Input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="rounded-none border-border bg-background focus:ring-0 focus:border-primary"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-mono uppercase text-muted-foreground">Confirm</Label>
                                                <Input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="rounded-none border-border bg-background focus:ring-0 focus:border-primary"
                                                />
                                            </div>
                                        </div>

                                        {/* Requirements */}
                                        <div className="grid grid-cols-2 gap-2 text-2xs font-mono text-muted-foreground">
                                            <span className={cn(newPassword.length >= 8 && "text-primary")}>MIN 8 CHARS</span>
                                            <span className={cn(/[A-Z]/.test(newPassword) && "text-primary")}>UPPERCASE</span>
                                            <span className={cn(/[a-z]/.test(newPassword) && "text-primary")}>LOWERCASE</span>
                                            <span className={cn(/[0-9]/.test(newPassword) && "text-primary")}>NUMBER</span>
                                        </div>

                                        {passwordErrors.length > 0 && (
                                            <div className="text-xs text-destructive font-mono border border-destructive/30 p-2 bg-destructive/10">
                                                {passwordErrors.map((err, i) => <div key={i}>! {err}</div>)}
                                            </div>
                                        )}

                                        <Button
                                            onClick={handleChangePassword}
                                            disabled={changingPassword || !newPassword || !confirmPassword}
                                            className="w-full rounded-none bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs h-10 hover:bg-primary/90"
                                        >
                                            {changingPassword && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                                            Update Credentials
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Sync History */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <button
                            onClick={() => navigate('/sync')}
                            className="w-full neo-card p-4 flex items-center gap-4 group hover:bg-muted/5 transition-colors"
                        >
                            <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                <History className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="font-bold text-sm text-foreground">Sync Logs</h3>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                    SMS INGESTION HISTORY
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                    </motion.div>

                    {/* Push Notifications */}
                    {pushSupported && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.45 }}
                        >
                            <button
                                onClick={async () => {
                                    if (pushSubscribed) {
                                        const ok = await pushUnsubscribe();
                                        if (ok) toast({ title: 'Notifications disabled' });
                                    } else {
                                        const ok = await pushSubscribe();
                                        if (ok) {
                                            toast({ title: 'Notifications enabled', description: 'You\'ll be notified when new transactions sync.' });
                                        } else if (permissionState === 'denied') {
                                            toast({ title: 'Permission denied', description: 'Enable notifications in your browser/device settings.', variant: 'destructive' });
                                        }
                                    }
                                }}
                                disabled={pushLoading}
                                className="w-full neo-card p-4 flex items-center gap-4 group hover:bg-muted/5 transition-colors"
                            >
                                <div className={cn(
                                    "w-10 h-10 border flex items-center justify-center transition-colors",
                                    pushSubscribed
                                        ? "border-primary/50 bg-primary/10"
                                        : "border-border group-hover:border-primary/50"
                                )}>
                                    {pushSubscribed
                                        ? <Bell className="w-5 h-5 text-primary" />
                                        : <BellOff className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    }
                                </div>
                                <div className="flex-1 text-left">
                                    <h3 className="font-bold text-sm text-foreground">Push Notifications</h3>
                                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                        {pushLoading ? 'LOADING...' : pushSubscribed ? 'ENABLED' : 'DISABLED'}
                                    </p>
                                </div>
                                <div className={cn(
                                    "w-10 h-5 rounded-full relative transition-colors duration-200",
                                    pushSubscribed ? "bg-primary" : "bg-muted-foreground/30"
                                )}>
                                    <div className={cn(
                                        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200",
                                        pushSubscribed ? "translate-x-5" : "translate-x-0.5"
                                    )} />
                                </div>
                            </button>
                        </motion.div>
                    )}

                    {/* Soft Reviews Toggle */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                    >
                        <div className="w-full neo-card p-4 flex items-center gap-4 hover:bg-muted/5 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                                <FileCheck className="w-4 h-4 text-warning" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm text-foreground">Transaction Inbox</h3>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                    {profile?.enable_review_mode ? 'ENABLED' : 'DISABLED'}
                                </p>
                            </div>
                            <div
                                onClick={() => {
                                    if (profile) {
                                        updateReviewMode.mutate(!profile.enable_review_mode);
                                    }
                                }}
                                className={cn(
                                    "w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer flex-shrink-0",
                                    profile?.enable_review_mode ? "bg-primary" : "bg-muted-foreground/30"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200",
                                    profile?.enable_review_mode ? "translate-x-5" : "translate-x-0.5"
                                )} />
                            </div>
                        </div>
                    </motion.div>

                    {/* Logout */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="pt-4"
                    >
                        <Button
                            variant="ghost"
                            onClick={handleLogout}
                            className="w-full h-12 border border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-none uppercase font-mono text-xs tracking-widest"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Terminate Session
                        </Button>
                    </motion.div>
                </div>
            </div>
        </AppLayout>
    );
}
