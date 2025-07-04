import React from 'react';
import { Film, Camera, Video, Clapperboard, Sparkles, Star, Circle } from 'lucide-react';

interface CinematicShotAnimationProps {
  message?: string;
}

export const CinematicShotAnimation: React.FC<CinematicShotAnimationProps> = ({ 
  message = "Creating cinematic shots..." 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 relative overflow-hidden rounded-lg border border-indigo-200 dark:border-indigo-800">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Minimal Floating Film Elements */}
        <div className="absolute top-8 left-8 animate-float-slow">
          <Film className="w-5 h-5 text-indigo-400 dark:text-indigo-300 opacity-10" />
        </div>
        <div className="absolute top-12 right-12 animate-float-delay-1">
          <Camera className="w-4 h-4 text-indigo-500 dark:text-indigo-400 opacity-10" />
        </div>
        <div className="absolute bottom-12 left-12 animate-float-delay-2">
          <Video className="w-6 h-6 text-indigo-400 dark:text-indigo-300 opacity-10" />
        </div>
        
        {/* Subtle Sparkle Effects */}
        <div className="absolute top-1/4 right-1/4 animate-twinkle">
          <Sparkles className="w-3 h-3 text-indigo-300 dark:text-indigo-400 opacity-15" />
        </div>
        <div className="absolute bottom-1/4 left-1/4 animate-twinkle-delay-1">
          <Star className="w-2 h-2 text-indigo-400 dark:text-indigo-300 opacity-15" />
        </div>
      </div>
      
      {/* Main Animation Container */}
      <div className="relative z-10 flex flex-col items-center space-y-6">
        {/* Subtle Central Element */}
        <div className="relative">
          {/* Outer Ring */}
          <div className="w-20 h-20 rounded-full border border-indigo-300 dark:border-indigo-600 animate-spin-slow opacity-50"></div>
          
          {/* Inner Ring */}
          <div className="absolute inset-2 rounded-full border border-indigo-400 dark:border-indigo-500 animate-spin-reverse opacity-60"></div>
          
          {/* Core Element */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-500 dark:from-indigo-500 dark:to-indigo-600 opacity-80 flex items-center justify-center shadow-lg">
            <div className="relative">
              <Film className="w-6 h-6 text-white animate-bounce-subtle" />
              {/* Subtle Glow */}
              <div className="absolute inset-0 rounded-full bg-white opacity-10 animate-ping"></div>
            </div>
          </div>
          
          {/* Minimal Orbiting Elements */}
          <div className="absolute inset-0 animate-orbit">
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
              <Camera className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
            </div>
          </div>
          
          <div className="absolute inset-0 animate-orbit-reverse">
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
              <Video className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
            </div>
          </div>
          
          <div className="absolute inset-0 animate-orbit-slow">
            <div className="absolute top-1/2 -right-1 transform -translate-y-1/2">
              <Clapperboard className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
            </div>
          </div>
        </div>
        
        {/* Message */}
        <div className="text-center space-y-3">
          <h3 className="text-xl font-semibold text-indigo-900 dark:text-indigo-100">
            {message}
          </h3>
          
          {/* Progress Dots */}
          <div className="flex space-x-2 justify-center">
            <div className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-pulse-sequence"></div>
            <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse-sequence-delay-1"></div>
            <div className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-pulse-sequence-delay-2"></div>
          </div>
          
          {/* Subtitle */}
          <p className="text-sm text-indigo-600 dark:text-indigo-300 animate-fade-in-out">
            Crafting your cinematic vision...
          </p>
        </div>
        
        {/* Minimal Film Strip */}
        <div className="flex space-x-1 opacity-20">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-4 h-5 bg-gradient-to-b from-indigo-400 to-indigo-500 dark:from-indigo-500 dark:to-indigo-600 rounded-sm animate-film-strip"
              style={{ animationDelay: `${i * 0.15}s` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};