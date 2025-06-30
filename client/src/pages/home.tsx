import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UltimateAuthProvider";
import { ArrowRight, FileText, Film, Code, CheckCircle2, Zap, Clock, Globe } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  // No automatic redirect - let users stay on home page

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Header */}
      <nav className="fixed top-0 w-full bg-background/95 backdrop-blur-sm border-b border-border z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-bold tracking-tight text-foreground">IndieShots</h1>
              <span className="ml-2 px-2 py-0.5 text-xs bg-primary rounded-full text-white font-medium">Beta</span>
            </div>
            <div className="flex items-center space-x-4">
              {!loading && (
                isAuthenticated ? (
                  <Button 
                    variant="default"
                    onClick={() => setLocation("/dashboard")}
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <Button 
                    variant="default" 
                    onClick={async () => {
                      // Clear any existing auth state
                      try {
                        await fetch('/api/auth/logout', {
                          method: 'POST',
                          credentials: 'include'
                        });
                      } catch (error) {
                        console.log('Logout call failed:', error);
                      }
                      
                      // Clear local auth state
                      localStorage.setItem('auth_disabled', 'true');
                      localStorage.setItem('logout_timestamp', Date.now().toString());
                      
                      // Navigate to clean auth page
                      setLocation("/auth");
                    }}
                  >
                    Sign In
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-b from-background to-card/50">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium text-primary">Built for Independent Filmmakers</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            From Script to Screen, <br />Faster than Ever
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            IndieShots converts your screenplay into a professional shot list, saving you hours of pre-production work. Perfect for indie productions working on tight budgets and timelines.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={async () => {
                // Always force logout first to clear any existing tokens
                try {
                  await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include'
                  });
                } catch (error) {
                  console.log('Logout call failed:', error);
                }
                
                // Clear any local auth state
                localStorage.setItem('auth_disabled', 'true');
                localStorage.setItem('logout_timestamp', Date.now().toString());
                
                // Navigate to clean auth page
                setLocation("/auth");
              }} 
              className="bg-primary hover:bg-primary/90 text-white"
            >
              Get Started for Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline">
              View Features
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Overview */}
      <section className="py-20 px-6 bg-card">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, Powerful Workflow</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From screenplay to production-ready shot list in three simple steps.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-background p-8 rounded-xl shadow-sm border border-border">
              <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-6">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">1. Upload Your Script</h3>
              <p className="text-muted-foreground leading-relaxed">
                Upload your screenplay as PDF, DOCX, or TXT. Or simply paste your script text directly into our editor.
              </p>
            </div>
            
            <div className="bg-background p-8 rounded-xl shadow-sm border border-border">
              <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-6">
                <Code className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">2. Customize Details</h3>
              <p className="text-muted-foreground leading-relaxed">
                Select which elements to extract: scene numbers, locations, characters, props, camera angles, and more.
              </p>
            </div>
            
            <div className="bg-background p-8 rounded-xl shadow-sm border border-border">
              <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-6">
                <Film className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">3. Export Shot List</h3>
              <p className="text-muted-foreground leading-relaxed">
                Download your production-ready shot list in CSV format. Share with your crew and start shooting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Designed for Independent Filmmaking</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tools that understand the unique needs of indie productions
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-card p-8 rounded-xl">
              <CheckCircle2 className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Intelligent Scene Detection</h3>
              <p className="text-muted-foreground">
                Our parser automatically identifies scenes, locations, and characters from standard screenplay format.
              </p>
            </div>
            
            <div className="bg-card p-8 rounded-xl">
              <Globe className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Location Grouping</h3>
              <p className="text-muted-foreground">
                Organize your shot list by location to optimize your shooting schedule and minimize company moves.
              </p>
            </div>
            
            <div className="bg-card p-8 rounded-xl">
              <Clock className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Time-Saving Templates</h3>
              <p className="text-muted-foreground">
                Choose from pre-configured column templates designed for different shooting scenarios and production sizes.
              </p>
            </div>
            
            <div className="bg-card p-8 rounded-xl">
              <Zap className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Production-Ready Output</h3>
              <p className="text-muted-foreground">
                Clean, formatted shot lists ready to share with your director, DP, and crew without additional formatting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-card">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Clear, Upfront Pricing</h2>
          <p className="text-xl text-muted-foreground mb-16">
            Flexible options for productions of all sizes
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-background p-8 rounded-xl border border-border relative">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <p className="text-4xl font-bold mb-6">
                $0 <span className="text-muted-foreground text-base font-normal">/month</span>
              </p>
              
              <Separator className="my-6" />
              
              <ul className="space-y-4 text-left mb-8">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-primary mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>5 pages per month</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-primary mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Basic scene extraction</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-primary mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>CSV export format</span>
                </li>
              </ul>
              
              <Button className="w-full" onClick={() => setLocation("/auth")}>
                Sign Up Free
              </Button>
              <p className="text-xs text-muted-foreground mt-4">No credit card required</p>
            </div>
            
            <div className="bg-background p-8 rounded-xl border-2 border-primary relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-bold rounded-full">
                RECOMMENDED
              </div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <p className="text-4xl font-bold mb-6">
                $29 <span className="text-muted-foreground text-base font-normal">/month</span>
              </p>
              
              <Separator className="my-6" />
              
              <ul className="space-y-4 text-left mb-8">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-primary mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Unlimited pages</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-primary mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Enhanced parsing accuracy</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-primary mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>CSV & Excel export formats</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-primary mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Location grouping & scheduling</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-primary mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>No watermarks on exports</span>
                </li>
              </ul>
              
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => setLocation("/auth")}>
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-primary/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Streamline Your Pre-Production?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join other indie filmmakers who are saving hours of pre-production time with IndieShots.
          </p>
          <Button 
            size="lg" 
            onClick={async () => {
              // Clear any existing auth state
              try {
                await fetch('/api/auth/logout', {
                  method: 'POST',
                  credentials: 'include'
                });
              } catch (error) {
                console.log('Logout call failed:', error);
              }
              
              // Clear local auth state
              localStorage.setItem('auth_disabled', 'true');
              localStorage.setItem('logout_timestamp', Date.now().toString());
              
              // Navigate to clean auth page
              setLocation("/auth");
            }}
            className="bg-primary hover:bg-primary/90 text-white px-8"
          >
            Get Started for Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="mb-6 md:mb-0">
            <p className="text-muted-foreground">
              © {currentYear} IndieShots. All rights reserved.
            </p>
          </div>
          
          <div className="flex space-x-6">
            <a href="#" className="text-muted-foreground hover:text-foreground transition">
              Terms
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition">
              Privacy
            </a>
            <a href="mailto:indieshots@theindierise.com" className="text-muted-foreground hover:text-foreground transition">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
