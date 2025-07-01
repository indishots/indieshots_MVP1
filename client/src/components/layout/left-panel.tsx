import { useAuth } from "@/components/auth/UltimateAuthProvider";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Upload, 
  Folder, 
  Settings, 
  HelpCircle,
  Clock,
  LogOut,
  Crown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeftPanelProps {
  collapsed: boolean;
}

export default function LeftPanel({ collapsed }: LeftPanelProps) {
  const [location] = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  
  // Query for scripts to display in recent projects
  const { data: scripts } = useQuery({
    queryKey: ["/api/scripts"],
    enabled: isAuthenticated,
  });

  // Query for parse jobs to find completed ones for recent projects
  const { data: parseJobs } = useQuery({
    queryKey: ["/api/jobs"],
    enabled: isAuthenticated,
  });

  // Query for upgrade status to get accurate tier and usage info
  const { data: upgradeStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/upgrade/status'], // Fixed query key
    enabled: isAuthenticated,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  // Generate the recent scripts list
  const recentScripts = Array.isArray(scripts) ? scripts.slice(0, 3) : [];
  
  // Helper function to get the correct navigation link for a script
  const getScriptNavigationLink = (scriptId: number) => {
    if (!Array.isArray(parseJobs)) return `/columns/${scriptId}`;
    
    // Find a completed parse job for this script
    const completedJob = parseJobs.find((job: any) => 
      job.scriptId === scriptId && job.status === 'completed'
    );
    
    // If there's a completed job, navigate to review page; otherwise go to columns
    return completedJob ? `/review/${completedJob.id}` : `/columns/${scriptId}`;
  };
  
  // Get tier info from upgrade status or fallback to user object
  const userTier = (upgradeStatus as any)?.tier || (user as any)?.tier || 'free';
  const isProUser = userTier === 'pro';
  const usageData = (upgradeStatus as any)?.limits || user;
  
  // Debug logging
  console.log('Left panel tier data:', {
    upgradeStatusTier: (upgradeStatus as any)?.tier,
    userTier: (user as any)?.tier,
    finalTier: userTier,
    isProUser,
    upgradeStatusData: upgradeStatus,
    usageData
  });
  
  if (!isAuthenticated && location === "/") {
    // Don't show left panel on home page for unauthenticated users
    return null;
  }

  // Calculate the CSS width based on collapsed state
  const panelWidth = collapsed ? "w-0 overflow-hidden" : "w-[280px]";
  
  return (
    <div className={cn("bg-card border-r border-border flex-shrink-0 transition-all duration-300 ease-in-out", panelWidth)}>
      <div className="h-full flex flex-col py-4">
        {/* User Stats */}
        <div className="px-6 mb-6">
          <div className="bg-background rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  {isProUser ? (
                    <>
                      <Crown className="h-3 w-3 text-amber-500" />
                      Pro Plan
                    </>
                  ) : (
                    'Free Plan'
                  )}
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {isProUser ? 'Unlimited pages' : `${usageData?.totalPages || 5} pages/month`}
                </p>
              </div>
              {!isProUser && (
                <Link href="/upgrade" className="px-3 py-1.5 text-xs bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground rounded-lg transition font-medium">
                  Upgrade
                </Link>
              )}
            </div>
            
            {user && !isProUser && (
              <>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-primary to-accent h-full rounded-full" 
                    style={{ width: `${Math.min(100, ((usageData?.usedPages ?? 0) / (usageData?.totalPages ?? 1)) * 100)}%` }}
                  ></div>
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span className="font-medium">{usageData?.usedPages ?? 0}/{usageData?.totalPages ?? 5} pages used</span>
                  <span>{Math.round(((usageData?.usedPages ?? 0) / (usageData?.totalPages ?? 1)) * 100)}%</span>
                </div>
              </>
            )}
            
            {isProUser && (
              <div className="text-center py-2">
                <p className="text-sm font-medium text-green-600 flex items-center justify-center gap-1">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Unlimited Access
                </p>
                <p className="text-xs text-muted-foreground mt-1">Enjoy all premium features</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Navigation */}
        <div className="px-4 mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 mb-2">
            Main
          </p>
          <nav className="space-y-1.5">
            <Link href="/dashboard" className={cn(
              "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
              location === "/dashboard" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-background/80"
            )}>
              <Home className="h-4 w-4 mr-3" />
              Dashboard
            </Link>
            
            <Link href="/upload" className={cn(
              "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
              location === "/upload" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-background/80"
            )}>
              <Upload className="h-4 w-4 mr-3" />
              Upload
            </Link>
            
            <Link href="/projects" className={cn(
              "flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
              location === "/projects" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-background/80"
            )}>
              <div className="flex items-center flex-1">
                <Folder className="h-4 w-4 mr-3" />
                Projects
              </div>
              {Array.isArray(scripts) && scripts.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {scripts.length}
                </Badge>
              )}
            </Link>
          </nav>
        </div>
        

          
        {/* Recent Projects */}
        {recentScripts.length > 0 && (
          <div className="px-4 mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 mb-2">
              Recent Projects
            </p>
            <div className="space-y-1.5">
              {recentScripts.map((script) => (
                <Link key={script.id} href={getScriptNavigationLink(script.id)} className="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-background/80 transition-colors group">
                  <Clock className="h-4 w-4 mr-3 text-muted-foreground" />
                  <span className="truncate text-sm">{script.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-auto px-4">
          <Link href="/settings" className={cn(
            "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
            location === "/settings" 
              ? "bg-primary text-primary-foreground" 
              : "text-foreground hover:bg-background/80"
          )}>
            <Settings className="h-4 w-4 mr-3" />
            Settings
          </Link>
          
          <Link 
            href="/help" 
            className={cn(
              "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors mt-1.5",
              location === "/help" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-background/80"
            )}
          >
            <HelpCircle className="h-4 w-4 mr-3 text-muted-foreground" />
            Help Center
          </Link>
          
          <Link
            href="/logout"
            className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors mt-1.5"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Logout
          </Link>
        </div>
      </div>
    </div>
  );
}
