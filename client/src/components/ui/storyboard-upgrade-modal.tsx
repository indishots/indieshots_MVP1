import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Crown, Sparkles, ArrowRight, Star } from 'lucide-react';
import './storyboard-upgrade-modal.css';

interface StoryboardUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export const StoryboardUpgradeModal: React.FC<StoryboardUpgradeModalProps> = ({
  isOpen,
  onClose,
  onUpgrade
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 border-2 border-purple-200 dark:border-purple-700 overflow-hidden">
        <div className="storyboard-upgrade-animation">
          {/* Floating camera icons */}
          <div className="floating-cameras">
            <Camera className="floating-camera camera-1" />
            <Camera className="floating-camera camera-2" />
            <Camera className="floating-camera camera-3" />
          </div>
          
          {/* Sparkle effects */}
          <div className="sparkles">
            <Sparkles className="sparkle sparkle-1" />
            <Sparkles className="sparkle sparkle-2" />
            <Sparkles className="sparkle sparkle-3" />
            <Star className="sparkle sparkle-4" />
          </div>
        </div>
        
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4 crown-bounce">
            <Crown className="h-8 w-8 text-white" />
          </div>
          
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Unlock Visual Storyboards
          </DialogTitle>
          
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            Transform your shots into stunning visual storyboards with AI-powered image generation
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
            <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Pro Storyboard Features
            </h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full pulse-dot"></div>
                AI-generated visual storyboards
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full pulse-dot delay-200"></div>
                Custom prompt modifications
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full pulse-dot delay-400"></div>
                High-quality image downloads
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full pulse-dot delay-600"></div>
                Unlimited storyboard generation
              </li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-300 hover:border-gray-400"
          >
            Maybe Later
          </Button>
          <Button
            onClick={onUpgrade}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white upgrade-button"
          >
            Upgrade to Pro
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};