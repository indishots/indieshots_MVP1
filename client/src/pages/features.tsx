import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { CheckCircle2, Globe, Clock, Zap, ArrowLeft } from "lucide-react";

export default function Features() {
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    setLocation('/auth');
  };

  const handleBackHome = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBackHome}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </button>
          </div>
          <Button onClick={handleGetStarted}>Get Started Free</Button>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold mb-4">Designed for Independent Filmmaking</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the next generation of filmmaking tools, designed specifically for your vision.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-card p-8 rounded-xl">
              <CheckCircle2 className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Intelligent Scene Breakdown</h3>
              <p className="text-muted-foreground">
                Our advanced analysis meticulously dissects your script, identifying scenes, characters, locations, and dialogue for meticulous shot planning.
              </p>
            </div>
            
            <div className="bg-card p-8 rounded-xl">
              <Globe className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Comprehensive Shot Planning</h3>
              <p className="text-muted-foreground">
                Craft production-ready shot lists featuring essential fields, including detailed camera movements, lighting requirements, props, and technical specifications.
              </p>
            </div>
            
            <div className="bg-card p-8 rounded-xl">
              <Clock className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Dynamic Visual Storyboards</h3>
              <p className="text-muted-foreground">
                Design captivating storyboards with customizable image creation. Refine and regenerate visuals with specific prompts to perfectly match your cinematic vision.
              </p>
            </div>
            
            <div className="bg-card p-8 rounded-xl">
              <Zap className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Seamless Export</h3>
              <p className="text-muted-foreground">
                Effortlessly download production-ready shot lists and complete storyboard packages.
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16">
            <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Filmmaking Process?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of independent filmmakers who are already using IndieShots to streamline their pre-production workflow.
            </p>
            <Button onClick={handleGetStarted} size="lg">
              Get Started Free
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}