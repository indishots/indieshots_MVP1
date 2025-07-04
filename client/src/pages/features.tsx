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
            {/* Feature Card 1 */}
            <div className="group relative bg-gradient-to-br from-indigo-100/40 to-amber-50/30 border border-indigo-200/40 p-8 rounded-2xl hover:shadow-lg hover:shadow-indigo-200/40 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-6 right-6 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-200/50 to-amber-200/30 rounded-full"></div>
              </div>
              <div className="relative z-10">
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-200/70 to-amber-200/60 rounded-xl shadow-sm border border-indigo-300/40">
                    <CheckCircle2 className="h-6 w-6 text-indigo-800" />
                  </div>
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-amber-700 bg-clip-text text-transparent mb-3">
                  Intelligent Scene Breakdown
                </h3>
                <p className="text-indigo-700/80 leading-relaxed">
                  Our advanced analysis meticulously dissects your script, identifying scenes, characters, locations, and dialogue for meticulous shot planning.
                </p>
              </div>
            </div>
            
            {/* Feature Card 2 */}
            <div className="group relative bg-gradient-to-br from-indigo-100/40 to-amber-50/30 border border-indigo-200/40 p-8 rounded-2xl hover:shadow-lg hover:shadow-indigo-200/40 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-6 right-6 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-200/50 to-amber-200/30 rounded-full"></div>
              </div>
              <div className="relative z-10">
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-200/70 to-amber-200/60 rounded-xl shadow-sm border border-indigo-300/40">
                    <Globe className="h-6 w-6 text-indigo-800" />
                  </div>
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-amber-700 bg-clip-text text-transparent mb-3">
                  Comprehensive Shot Planning
                </h3>
                <p className="text-indigo-700/80 leading-relaxed">
                  Craft production-ready shot lists featuring essential fields, including detailed camera movements, lighting requirements, props, and technical specifications.
                </p>
              </div>
            </div>
            
            {/* Feature Card 3 */}
            <div className="group relative bg-gradient-to-br from-indigo-100/40 to-amber-50/30 border border-indigo-200/40 p-8 rounded-2xl hover:shadow-lg hover:shadow-indigo-200/40 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-6 right-6 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-200/50 to-amber-200/30 rounded-full"></div>
              </div>
              <div className="relative z-10">
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-200/70 to-amber-200/60 rounded-xl shadow-sm border border-indigo-300/40">
                    <Clock className="h-6 w-6 text-indigo-800" />
                  </div>
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-amber-700 bg-clip-text text-transparent mb-3">
                  Dynamic Visual Storyboards
                </h3>
                <p className="text-indigo-700/80 leading-relaxed">
                  Design captivating storyboards with customizable image creation. Refine and regenerate visuals with specific prompts to perfectly match your cinematic vision.
                </p>
              </div>
            </div>
            
            {/* Feature Card 4 */}
            <div className="group relative bg-gradient-to-br from-indigo-100/40 to-amber-50/30 border border-indigo-200/40 p-8 rounded-2xl hover:shadow-lg hover:shadow-indigo-200/40 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-6 right-6 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-200/50 to-amber-200/30 rounded-full"></div>
              </div>
              <div className="relative z-10">
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-200/70 to-amber-200/60 rounded-xl shadow-sm border border-indigo-300/40">
                    <Zap className="h-6 w-6 text-indigo-800" />
                  </div>
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-amber-700 bg-clip-text text-transparent mb-3">
                  Seamless Export
                </h3>
                <p className="text-indigo-700/80 leading-relaxed">
                  Effortlessly download production-ready shot lists and complete storyboard packages. Perfect for sharing with your crew and starting production.
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16">
            <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Filmmaking Process?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Use IndieShots to streamline your pre-production workflow.
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