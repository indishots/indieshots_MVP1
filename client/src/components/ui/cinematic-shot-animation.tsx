import React from 'react';
import { Film, Camera, Video, Clapperboard, Sparkles, Star, Circle } from 'lucide-react';

interface CinematicShotAnimationProps {
  message?: string;
}

export const CinematicShotAnimation: React.FC<CinematicShotAnimationProps> = ({ 
  message = "Creating cinematic shots..." 
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Film Elements */}
        <div className="absolute top-20 left-20 animate-float-slow">
          <Film className="w-8 h-8 text-amber-400 opacity-20" />
        </div>
        <div className="absolute top-40 right-32 animate-float-delay-1">
          <Camera className="w-6 h-6 text-purple-400 opacity-20" />
        </div>
        <div className="absolute bottom-40 left-32 animate-float-delay-2">
          <Video className="w-10 h-10 text-blue-400 opacity-20" />
        </div>
        <div className="absolute bottom-20 right-20 animate-float-delay-3">
          <Clapperboard className="w-7 h-7 text-green-400 opacity-20" />
        </div>
        
        {/* Sparkle Effects */}
        <div className="absolute top-1/4 left-1/4 animate-twinkle">
          <Sparkles className="w-4 h-4 text-amber-300 opacity-40" />
        </div>
        <div className="absolute top-3/4 right-1/4 animate-twinkle-delay-1">
          <Star className="w-3 h-3 text-purple-300 opacity-40" />
        </div>
        <div className="absolute top-1/2 left-1/3 animate-twinkle-delay-2">
          <Circle className="w-2 h-2 text-blue-300 opacity-40" />
        </div>
        
        {/* Film Grain Overlay */}
        <div className="absolute inset-0 bg-grain opacity-5 animate-grain"></div>
      </div>
      
      {/* Main Animation Container */}
      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Central Cinematic Element */}
        <div className="relative">
          {/* Outer Ring */}
          <div className="w-32 h-32 rounded-full border-2 border-amber-400 animate-spin-slow opacity-70"></div>
          
          {/* Inner Ring */}
          <div className="absolute inset-4 rounded-full border-2 border-purple-400 animate-spin-reverse opacity-80"></div>
          
          {/* Core Element */}
          <div className="absolute inset-8 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500 animate-pulse-glow flex items-center justify-center">
            <div className="relative">
              <Film className="w-8 h-8 text-white animate-bounce-subtle" />
              {/* Glowing Effect */}
              <div className="absolute inset-0 rounded-full bg-white opacity-20 animate-ping"></div>
            </div>
          </div>
          
          {/* Orbiting Elements */}
          <div className="absolute inset-0 animate-orbit">
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <Camera className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          
          <div className="absolute inset-0 animate-orbit-reverse">
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
              <Video className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          
          <div className="absolute inset-0 animate-orbit-slow">
            <div className="absolute top-1/2 -right-2 transform -translate-y-1/2">
              <Clapperboard className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          
          <div className="absolute inset-0 animate-orbit-reverse-slow">
            <div className="absolute top-1/2 -left-2 transform -translate-y-1/2">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
          </div>
        </div>
        
        {/* Message */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent animate-gradient-shift">
            {message}
          </h2>
          
          {/* Progress Dots */}
          <div className="flex space-x-2 justify-center">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse-sequence"></div>
            <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse-sequence-delay-1"></div>
            <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse-sequence-delay-2"></div>
          </div>
          
          {/* Subtitle */}
          <p className="text-lg text-gray-300 animate-fade-in-out">
            Crafting your cinematic vision...
          </p>
        </div>
        
        {/* Bottom Film Strip */}
        <div className="flex space-x-1 opacity-30">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="w-6 h-8 bg-gradient-to-b from-amber-400 to-amber-600 rounded-sm animate-film-strip"
              style={{ animationDelay: `${i * 0.1}s` }}
            ></div>
          ))}
        </div>
      </div>
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20 pointer-events-none"></div>
    </div>
  );
};