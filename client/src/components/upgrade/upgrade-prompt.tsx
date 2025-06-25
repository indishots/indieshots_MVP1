import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Image, Infinity, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

interface UpgradePromptProps {
  feature: 'storyboards' | 'shots' | 'pages';
  currentUsage?: number;
  limit?: number;
  message?: string;
  compact?: boolean;
}

export function UpgradePrompt({ feature, currentUsage, limit, message, compact = false }: UpgradePromptProps) {
  const [, setLocation] = useLocation();

  const featureConfig = {
    storyboards: {
      icon: Image,
      title: 'Storyboard Generation',
      description: 'Generate visual storyboards with AI-powered image creation',
      benefitText: 'Create stunning visual storyboards'
    },
    shots: {
      icon: Infinity,
      title: 'Unlimited Shots',
      description: 'Generate unlimited shots per scene for complex productions',
      benefitText: 'Generate unlimited shots per scene'
    },
    pages: {
      icon: Infinity,
      title: 'Unlimited Pages',
      description: 'Process unlimited script pages per month',
      benefitText: 'Process unlimited script pages'
    }
  };

  const config = featureConfig[feature];
  const IconComponent = config.icon;

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-full">
              <Crown className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {message || `${config.title} is a Pro feature`}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Upgrade to unlock {config.benefitText}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setLocation('/upgrade')} className="bg-amber-600 hover:bg-amber-700">
            Upgrade
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 dark:bg-amber-800 rounded-full">
              <IconComponent className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-amber-900 dark:text-amber-100">
                Unlock {config.title}
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-300">
                {config.description}
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-amber-600 text-white">Pro Feature</Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {message && (
            <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-100/50 dark:bg-amber-900/30 p-3 rounded-md">
              {message}
            </p>
          )}
          
          {currentUsage !== undefined && limit !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-amber-700 dark:text-amber-300">Current Usage</span>
                <span className="font-medium text-amber-900 dark:text-amber-100">
                  {currentUsage}/{limit === -1 ? '∞' : limit}
                </span>
              </div>
              <div className="w-full bg-amber-200 dark:bg-amber-800 rounded-full h-2">
                <div 
                  className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: limit === -1 ? '0%' : `${Math.min(100, (currentUsage / limit) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => setLocation('/upgrade')} 
              className="bg-amber-600 hover:bg-amber-700 flex-1"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setLocation('/upgrade')}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
            >
              Compare Plans
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default UpgradePrompt;