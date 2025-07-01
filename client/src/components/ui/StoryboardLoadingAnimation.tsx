import { useState, useEffect } from 'react';
import { Camera, Film, Clapperboard, Video, Wand2, Sparkles } from 'lucide-react';

interface LoadingFrame {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  animation: string;
}

const loadingFrames: LoadingFrame[] = [
  {
    icon: <Camera className="w-5 h-5" />,
    title: "Rolling camera on your story...",
    subtitle: "Generating high-quality images with cinematic precision.",
    color: "text-blue-500",
    animation: "animate-bounce"
  },
  {
    icon: <Film className="w-5 h-5" />,
    title: "Building your visual storyboard...",
    subtitle: "Generating high-quality images with cinematic precision.",
    color: "text-purple-500",
    animation: "animate-pulse"
  },
  {
    icon: <Clapperboard className="w-5 h-5" />,
    title: "Bringing scenes to life, one frame at a time...",
    subtitle: "Generating high-quality images with cinematic precision.",
    color: "text-green-500",
    animation: "animate-wiggle"
  },
  {
    icon: <Video className="w-5 h-5" />,
    title: "Crafting cinematic moments...",
    subtitle: "Generating high-quality images with cinematic precision.",
    color: "text-orange-500",
    animation: "animate-spin-slow"
  },
  {
    icon: <Wand2 className="w-5 h-5" />,
    title: "Transforming words into visuals...",
    subtitle: "Generating high-quality images with cinematic precision.",
    color: "text-amber-500",
    animation: "animate-ping"
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "Creating movie magic from your script...",
    subtitle: "Generating high-quality images with cinematic precision.",
    color: "text-pink-500",
    animation: "animate-float"
  }
];

export default function StoryboardLoadingAnimation() {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % loadingFrames.length);
    }, 3000); // Change frame every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const frame = loadingFrames[currentFrame];

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-900 rounded-lg p-8">
      {/* Animated Icon with Spinning Ring */}
      <div className="relative mb-6 flex items-center justify-center">
        {/* Outer spinning ring - smaller and thinner */}
        <div className="w-16 h-16 rounded-full border-2 border-slate-700 border-t-primary animate-spin"></div>
        
        {/* Inner icon circle - smaller */}
        <div className="absolute inset-2 bg-slate-800 rounded-full flex items-center justify-center overflow-visible">
          <div className={`${frame.color} ${frame.animation} transition-colors duration-500`}>
            <div className="w-5 h-5">
              {frame.icon}
            </div>
          </div>
        </div>
      </div>

      {/* Title - smaller font */}
      <h2 className="text-lg font-medium text-white mb-2 text-center transition-all duration-500 max-w-md">
        {frame.title}
      </h2>

      {/* Subtitle - smaller font */}
      <p className="text-sm text-slate-400 text-center mb-4 transition-all duration-500">
        {frame.subtitle}
      </p>

      {/* Progress Dots - smaller */}
      <div className="flex space-x-1.5">
        {loadingFrames.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              index === currentFrame 
                ? `${frame.color.replace('text-', 'bg-')}` 
                : 'bg-slate-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
}