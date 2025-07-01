import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Upload, Eye, Download, ArrowRight, ChevronRight, Crown, Zap, TestTube, MessageSquare } from "lucide-react";
import { formatDate, truncate } from "@/lib/utils";
import { UpgradePrompt } from "@/components/upgrade/upgrade-prompt";

export default function Dashboard() {
  const { user } = useAuth();
  
  // Fetch user's scripts
  const { data: scripts = [], isLoading: isLoadingScripts } = useQuery({
    queryKey: ["/api/scripts"],
  });
  
  // Fetch user's parse jobs
  const { data: parseJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["/api/jobs"],
  });
  
  // Calculate usage statistics based on tier
  const userTier = (user as any)?.tier || 'free';
  const pagesUsed = (user as any)?.usedPages || 0;
  const totalPages = userTier === 'pro' ? -1 : ((user as any)?.totalPages || 5);
  const usagePercentage = totalPages === -1 ? 0 : Math.min(100, Math.round((pagesUsed / totalPages) * 100));
  const pagesRemaining = totalPages === -1 ? 'unlimited' : Math.max(0, totalPages - pagesUsed);
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Track your scripts, jobs and usage
        </p>
      </div>
      
      {/* Upgrade prompt for users approaching limits */}
      {userTier === 'free' && usagePercentage >= 80 && (
        <div className="mb-6">
          <UpgradePrompt 
            feature="pages"
            currentUsage={pagesUsed}
            limit={totalPages}
            message={`You've used ${pagesUsed} out of ${totalPages} pages this month. Upgrade to Pro for unlimited script processing.`}
            compact
          />
        </div>
      )}

      {/* Usage Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {userTier === 'pro' ? (
                    <>
                      <Crown className="h-5 w-5 text-amber-500" />
                      Pro Plan
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      Usage Quota
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {userTier === 'pro' ? 'Unlimited access' : 'Free tier monthly limit'}
                </CardDescription>
              </div>
              {userTier === 'pro' && (
                <Crown className="h-6 w-6 text-amber-500" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {userTier === 'pro' ? (
              <div className="text-center py-4">
                <p className="text-lg font-medium text-green-600">Unlimited Pages</p>
                <p className="text-sm text-muted-foreground">Enjoy unlimited script processing</p>
              </div>
            ) : (
              <>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div 
                    className="bg-primary h-full rounded-full" 
                    style={{ width: `${usagePercentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{pagesUsed}/{totalPages} pages used</span>
                  <span>{usagePercentage}%</span>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            {userTier === 'free' && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/upgrade">
                  Upgrade for unlimited pages
                </Link>
              </Button>
            )}
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Scripts Uploaded</CardTitle>
            <CardDescription>Total scripts in your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold mr-2">
                {isLoadingScripts ? "..." : Array.isArray(scripts) ? scripts.length : 0}
              </span>
              <span className="text-muted-foreground">scripts</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" asChild>
              <Link href="/upload">
                Upload New Script
              </Link>
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Completed Jobs</CardTitle>
            <CardDescription>Successfully parsed scripts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold mr-2">
                {isLoadingJobs ? "..." : Array.isArray(parseJobs) ? parseJobs.filter((job: any) => job.status === 'completed').length : 0}
              </span>
              <span className="text-muted-foreground">jobs</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" disabled={isLoadingJobs || !Array.isArray(parseJobs) || parseJobs.length === 0}>
              View All Jobs
            </Button>
          </CardFooter>
        </Card>
        
{(user?.email === 'premium@demo.com' || userTier === 'premium') && (
          <Card className="border-dashed border-2 border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-600" />
                Premium Demo Features
              </CardTitle>
              <CardDescription>Experience premium functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p className="text-amber-700">✨ <strong>Unlimited Script Processing</strong></p>
                <p className="text-amber-700">🎬 <strong>Advanced Storyboard Generation</strong></p>
                <p className="text-amber-700">📊 <strong>Detailed Analytics & Reports</strong></p>
                <p className="text-amber-700">🔄 <strong>Batch Processing</strong></p>
                <p className="text-amber-700">💾 <strong>Priority Support</strong></p>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" asChild className="border-amber-300 hover:bg-amber-100">
                <Link href="/test-payment">
                  Test Premium Features
                </Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
      
      {/* Recent Activity */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Scripts</h2>
          <Button variant="link" asChild>
            <Link href="/projects">
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        
        {isLoadingScripts ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </CardContent>
                <CardFooter>
                  <div className="h-9 bg-muted rounded w-full"></div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : Array.isArray(scripts) && scripts.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-6">
            {scripts.slice(0, 3).map((script: any) => (
              <Card key={script.id}>
                <CardHeader>
                  <CardTitle>{truncate(script.title, 30)}</CardTitle>
                  <CardDescription>
                    Uploaded {formatDate(script.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {script.pageCount} pages • {script.fileType.toUpperCase()}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between">
                  {Array.isArray(parseJobs) && parseJobs.find((job: any) => job.scriptId === script.id && job.status === 'completed') ? (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/review/${parseJobs.find((job: any) => job.scriptId === script.id)?.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Review
                        </Link>
                      </Button>
                      <Button size="sm" asChild>
                        <a href={`/api/jobs/${parseJobs.find((job: any) => job.scriptId === script.id)?.id}/download`}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/columns/${script.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Link>
                      </Button>
                      <Button size="sm" asChild>
                        <Link href={`/columns/${script.id}`}>
                          Continue <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">No scripts uploaded yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your first script to get started
                </p>
                <Button asChild>
                  <Link href="/upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload a Script
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/upload">
              <div className="flex flex-col items-center text-center w-full">
                <Upload className="h-6 w-6 mb-2" />
                <span>Upload Script</span>
              </div>
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/projects">
              <div className="flex flex-col items-center text-center w-full">
                <Eye className="h-6 w-6 mb-2" />
                <span>View Projects</span>
              </div>
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/contact">
              <div className="flex flex-col items-center text-center w-full">
                <MessageSquare className="h-6 w-6 mb-2" />
                <span>Get help</span>
              </div>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
