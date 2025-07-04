import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Image, Download, RefreshCw, ChevronLeft, ChevronRight, Edit3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { UpgradePrompt } from "@/components/upgrade/upgrade-prompt";
import { useAuth } from "@/components/auth/UltimateAuthProvider";
import { StoryboardUpgradeModal } from "@/components/ui/storyboard-upgrade-modal";
import { LuxuryStoryboardAnimation } from "@/components/ui/classy-shot-animation";

interface StoryboardsProps {
  jobId: string;
  sceneIndex: string;
}

export default function Storyboards({ jobId, sceneIndex }: StoryboardsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasStartedGeneration, setHasStartedGeneration] = useState(false);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [showCarousel, setShowCarousel] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editingPrompt, setEditingPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [imageRefreshTimestamps, setImageRefreshTimestamps] = useState<{[key: number]: number}>({});
  const [carouselImageVersions, setCarouselImageVersions] = useState<{[key: number]: string | number}>({});
  const [completedImages, setCompletedImages] = useState<Set<number>>(new Set());
  const [initialTimestamp] = useState<number>(Date.now());
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [carouselImages, setCarouselImages] = useState<{[key: number]: string}>({});
  const [updatedMainImages, setUpdatedMainImages] = useState<{[key: number]: string}>({});
  const [imageLoadingStates, setImageLoadingStates] = useState<{[key: number]: boolean}>({});
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [progressiveImages, setProgressiveImages] = useState<{[key: number]: string}>({});
  const [generationProgress, setGenerationProgress] = useState<{total: number, completed: number}>({total: 0, completed: 0});

  
  // Helper functions for image selection and carousel
  const handleImageSelect = (index: number) => {
    setSelectedImages(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const openCarousel = () => {
    if (selectedImages.length > 0) {
      setCurrentImageIndex(0);
      setShowCarousel(true);
    }
  };

  const nextImage = () => {
    setCurrentImageIndex(prev => 
      prev < selectedImages.length - 1 ? prev + 1 : prev
    );
  };

  const prevImage = () => {
    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : prev);
  };

  const regenerateImage = useMutation({
    mutationFn: async (storyboardIndex: number) => {
      setIsRegenerating(true);
      
      console.log(`Attempting to regenerate image at storyboard index: ${storyboardIndex}`);
      console.log(`Current selected images:`, selectedImages);
      console.log(`Editing prompt:`, editingPrompt);
      
      // Use the storyboard index directly - backend will handle mapping
      const response = await fetch(`/api/storyboards/regenerate/${jobId}/${sceneIndex}/${storyboardIndex}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          modifications: editingPrompt
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Regeneration failed:', error);
        throw new Error(error.error || error.message || 'Failed to regenerate image');
      }
      
      const result = await response.json();
      console.log('Regeneration successful:', result);
      return result;
    },
    onSuccess: async (data, storyboardIndex) => {
      // Don't clear the prompt yet - wait until we confirm the image updated
      
      // Fetch fresh image data but only update carousel view
      try {
        const response = await fetch(`/api/storyboards/${jobId}/${sceneIndex}?_t=${Date.now()}`, {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (response.ok) {
          const freshData = await response.json();
          const freshStoryboards = freshData.storyboards || [];
          
          console.log('Fresh data received:', {
            storyboardsLength: freshStoryboards.length,
            storyboardIndex,
            hasImageData: !!freshStoryboards[storyboardIndex]?.imageData,
            imageDataLength: freshStoryboards[storyboardIndex]?.imageData?.length || 0
          });
          
          if (freshStoryboards[storyboardIndex]?.imageData) {
            const newImageData = freshStoryboards[storyboardIndex].imageData;
            
            // Store the regenerated image ONLY in carousel view
            setCarouselImages(prev => {
              const updated = {
                ...prev,
                [storyboardIndex]: newImageData
              };
              console.log('Updated carousel images state:', Object.keys(updated));
              return updated;
            });
            
            // Force image reload by temporarily showing loading state
            setImageLoadingStates(prev => ({
              ...prev,
              [storyboardIndex]: true
            }));
            
            // Show new image with unique key and success message after DOM update
            setTimeout(() => {
              const uniqueKey = `regenerated-${Date.now()}-${Math.random()}`;
              setCarouselImageVersions(prev => ({
                ...prev,
                [storyboardIndex]: uniqueKey
              }));
              setImageLoadingStates(prev => ({
                ...prev,
                [storyboardIndex]: false
              }));
              
              // Clear the editing prompt only after successful image update
              setEditingPrompt("");
              
              // Show success message only after image update is complete
              setTimeout(() => {
                toast({ title: "Image regenerated successfully" });
              }, 200);
            }, 100);
            
            console.log(`Regenerated image updated in carousel view for index ${storyboardIndex}, data length: ${newImageData.length}`);
          } else {
            console.error('No image data found for storyboard index:', storyboardIndex);
            // Still clear prompt on success response, even if no image data
            setEditingPrompt("");
            toast({ title: "Image regenerated successfully" });
          }
        } else {
          // Still clear prompt if we get a response but can't fetch fresh data
          setEditingPrompt("");
          toast({ title: "Image regenerated successfully" });
        }
      } catch (error) {
        console.error('Error fetching regenerated image:', error);
        // Still clear prompt on success, even with fetch error
        setEditingPrompt("");
        toast({ title: "Image regenerated successfully" });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Regeneration failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
    onSettled: () => {
      setIsRegenerating(false);
    }
  });
  
  // Fetch shots for this scene
  const { data: shotsData, isLoading: isLoadingShots } = useQuery({
    queryKey: [`/api/shots/${jobId}/${sceneIndex}`],
  });
  
  // Progressive loading: fetch storyboards regularly during generation
  const { data: storyboards, isLoading: isLoadingStoryboards, refetch: refetchStoryboards } = useQuery({
    queryKey: [`/api/storyboards/${jobId}/${sceneIndex}`],
    enabled: hasStartedGeneration, // Fetch when generation starts
    refetchInterval: isGenerating ? 2000 : false, // Poll every 2 seconds during generation
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data
  });

  // Progressive image tracking - update UI as images become available
  useEffect(() => {
    const storyboardData = storyboards as any;
    if (storyboardData?.storyboards && Array.isArray(storyboardData.storyboards)) {
      const currentImages: {[key: number]: string} = {};
      let completedCount = 0;
      
      storyboardData.storyboards.forEach((storyboard: any, index: number) => {
        if (storyboard.imageData) {
          currentImages[index] = storyboard.imageData;
          completedCount++;
        }
      });
      
      // Update progressive images state
      setProgressiveImages(currentImages);
      setGenerationProgress({
        total: storyboardData.storyboards.length,
        completed: completedCount
      });
      
      // If generation is complete, stop loading state
      if (completedCount === storyboardData.storyboards.length && isGenerating) {
        setIsGenerating(false);
        setIsLoadingImages(false);
        toast({
          title: "Storyboard generation complete",
          description: `All ${completedCount} storyboard images generated successfully`,
        });
      }
    }
  }, [storyboards, isGenerating, toast]);
  
  // Generate storyboards mutation
  const generateStoryboardsMutation = useMutation({
    mutationFn: async () => {
      // Check if user is free tier - show upgrade modal instead
      const userTier = (user as any)?.tier || 'free';
      if (userTier === 'free') {
        setShowUpgradeModal(true);
        throw new Error('upgrade_required');
      }
      
      setIsGenerating(true);
      setHasStartedGeneration(true);
      
      // Initialize progress tracking
      const totalShots = (shotsData as any)?.shots?.length || 0;
      setGenerationProgress({total: totalShots, completed: 0});
      setProgressiveImages({});
      
      const response = await fetch(`/api/storyboards/generate/${jobId}/${sceneIndex}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shots: (shotsData as any)?.shots || [],
          forceRegenerate: true // Always force fresh generation
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate storyboards');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Complete generation and show loading state for images
      setIsGenerating(false);
      setIsLoadingImages(true);
      
      queryClient.invalidateQueries({ queryKey: [`/api/storyboards/${jobId}/${sceneIndex}`] });
      
      // Mark that success toast should be shown
      (window as any).pendingSuccessToast = true;
    },
    onError: (error: Error) => {
      // Don't show error toast for upgrade requirements
      if (error.message !== 'upgrade_required') {
        toast({
          title: "Storyboard generation failed",
          description: error.message,
          variant: "destructive",
        });
      }
      setIsGenerating(false);
    },
  });
  
  const goBack = () => {
    setLocation(`/shots/${jobId}/${sceneIndex}`);
  };
  
  const downloadStoryboards = () => {
    window.open(`/api/storyboards/${jobId}/${sceneIndex}/download?format=zip`, '_blank');
  };

  const downloadSingleImage = (imageIndex: number) => {
    window.open(`/api/storyboards/${jobId}/${sceneIndex}/image/${imageIndex}`, '_blank');
  };

  const handleUpgrade = () => {
    setShowUpgradeModal(false);
    setLocation('/upgrade');
  };

  const handleCloseUpgradeModal = () => {
    setShowUpgradeModal(false);
  };
  
  if (isLoadingShots) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">Loading shots data...</div>
      </div>
    );
  }
  
  const shots = (shotsData as any)?.shots || [];
  const storyboardFrames = (storyboards as any)?.storyboards || [];
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-1">Storyboard Generation</h2>
        <p className="text-muted-foreground">
          Generate visual storyboards for Scene {parseInt(sceneIndex) + 1}
        </p>
      </div>
      
      {/* Show upgrade prompt for free tier users */}
      {(!(user as any)?.tier || (user as any)?.tier === 'free') && (
        <div className="mb-6">
          <UpgradePrompt 
            feature="storyboards"
            message="Storyboard generation with AI-powered images is a Pro feature. Upgrade to create visual storyboards for your scenes."
          />
        </div>
      )}

      {/* Generate or Display Storyboards */}
      {isGenerating ? (
        <div className="mb-6">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold mb-1">Generating Storyboards</h2>
            <p className="text-muted-foreground">
              Progress: {generationProgress.completed} of {generationProgress.total} images generated
            </p>
          </div>
          
          {/* Progressive Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: generationProgress.total }, (_, idx) => (
              <Card key={idx} className="relative">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Shot {idx + 1}</CardTitle>
                  <CardDescription className="text-xs">
                    {progressiveImages[idx] ? 'Generated' : 'Generating...'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-3">
                    {progressiveImages[idx] ? (
                      <img
                        src={`data:image/png;base64,${progressiveImages[idx]}`}
                        alt={`Storyboard ${idx + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                        <span className="text-xs text-muted-foreground">Generating...</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : storyboardFrames.length === 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Generate Storyboards</CardTitle>
            <CardDescription>
              Create visual storyboard frames for each shot in this scene
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button 
                onClick={() => generateStoryboardsMutation.mutate()}
                disabled={isGenerating || isLoadingImages || shots.length === 0 || hasStartedGeneration}
                className="w-full md:w-auto"
              >
                <Image className="mr-2 h-4 w-4" />
                {hasStartedGeneration ? 'Generated' : 'Generate Storyboards'}
              </Button>
              {hasStartedGeneration && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    setHasStartedGeneration(false);
                    generateStoryboardsMutation.mutate();
                  }}
                  disabled={isGenerating || isLoadingImages}
                  className="w-full md:w-auto"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate All
                </Button>
              )}
            </div>
            {shots.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No shots available. Please generate shots first.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Storyboard Grid */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Generated Storyboards</h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={openCarousel}
                  disabled={selectedImages.length === 0}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Selected ({selectedImages.length})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadStoryboards}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download ZIP
                </Button>
              </div>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {storyboardFrames.map((frame: any, idx: number) => (
                <Card key={idx} className="relative">
                  <div className="absolute top-3 left-3 z-10">
                    <Checkbox
                      checked={selectedImages.includes(idx)}
                      onCheckedChange={() => handleImageSelect(idx)}
                      className="bg-white border-2 shadow-sm"
                    />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Shot {idx + 1}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {frame.shotType} - {frame.cameraAngle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Storyboard image */}
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-3 cursor-pointer"
                         onClick={() => {
                           if (frame.hasImage) {
                             setSelectedImages([idx]);
                             setCurrentImageIndex(0);
                             setShowCarousel(true);
                           }
                         }}>
                      {frame.hasImage && frame.imageData ? (
                        <img 
                          src={`data:image/png;base64,${updatedMainImages[idx] || frame.imageData}`}
                          alt={`Storyboard frame ${idx + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                          key={`img-${idx}-${imageRefreshTimestamps[idx] || initialTimestamp}`}
                          onLoad={() => {
                            // Mark this image as completed
                            setCompletedImages(prev => {
                              const newSet = new Set(prev);
                              newSet.add(idx);
                              return newSet;
                            });
                            console.log(`Image ${idx} loaded successfully with data length:`, frame.imageData?.length, 'Generated at:', frame.imageGeneratedAt);
                          }}
                          onError={() => {
                            console.error(`Failed to load image ${idx}`, {
                              hasImageData: !!frame.imageData,
                              dataLength: frame.imageData?.length || 0,
                              dataPreview: frame.imageData?.substring(0, 50) || 'no data',
                              generatedAt: frame.imageGeneratedAt
                            });
                          }}
                        />
                      ) : frame.imagePath === 'GENERATION_ERROR' ? (
                        <div className="text-center text-red-500 space-y-2">
                          <div className="h-8 w-8 mx-auto bg-red-100 rounded flex items-center justify-center">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                          <p className="text-xs">Generation failed</p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs px-2 py-1 h-6"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/storyboards/regenerate/${jobId}/${sceneIndex}/${idx}`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ modifications: 'retry generation' })
                                });
                                if (response.ok) {
                                  queryClient.invalidateQueries({ queryKey: [`/api/storyboards/${jobId}/${sceneIndex}`] });
                                  toast({ 
                                    title: "Retrying image generation...", 
                                    description: "This may take a moment to process"
                                  });
                                } else {
                                  const error = await response.json().catch(() => ({}));
                                  toast({ 
                                    title: "Retry failed", 
                                    description: error.details || "Please try again or contact support",
                                    variant: "destructive" 
                                  });
                                }
                              } catch (error) {
                                toast({ title: "Retry failed", variant: "destructive" });
                              }
                            }}
                          >
                            Retry
                          </Button>
                        </div>
                      ) : frame.imagePath === 'CONTENT_POLICY_ERROR' ? (
                        <div className="text-center text-orange-500 space-y-2">
                          <div className="h-8 w-8 mx-auto bg-orange-100 rounded flex items-center justify-center">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </div>
                          <p className="text-xs">Content policy</p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs px-2 py-1 h-6"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/storyboards/regenerate/${jobId}/${sceneIndex}/${idx}`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ modifications: 'alternative safe prompt' })
                                });
                                if (response.ok) {
                                  queryClient.invalidateQueries({ queryKey: [`/api/storyboards/${jobId}/${sceneIndex}`] });
                                  toast({ title: "Retrying with safer prompt..." });
                                } else {
                                  toast({ title: "Retry failed", variant: "destructive" });
                                }
                              } catch (error) {
                                toast({ title: "Retry failed", variant: "destructive" });
                              }
                            }}
                          >
                            Retry
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <div className="h-8 w-8 mx-auto mb-2 bg-gray-300 rounded animate-pulse"></div>
                          <p className="text-xs">Generating...</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground flex-1">
                        {frame.description || frame.notes}
                      </p>
                      {frame.imagePath && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => downloadSingleImage(idx)}
                          className="ml-2 p-1"
                          title="Download this image"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Image Carousel Dialog */}
          <Dialog open={showCarousel} onOpenChange={setShowCarousel}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>
                  Edit Storyboard Images ({currentImageIndex + 1} of {selectedImages.length})
                </DialogTitle>
                <DialogDescription>
                  Review and modify your selected storyboard images
                </DialogDescription>
              </DialogHeader>
              
              {selectedImages.length > 0 && (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  {/* Image Display */}
                  <div className="relative">
                    <div className="flex justify-center items-center bg-muted rounded-lg h-64 md:h-80">
                      {imageLoadingStates[selectedImages[currentImageIndex]] ? (
                        <div className="flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
                          <span>Updating image...</span>
                        </div>
                      ) : (storyboardFrames[selectedImages[currentImageIndex]]?.imageData || carouselImages[selectedImages[currentImageIndex]]) ? (
                        <img 
                          src={`data:image/png;base64,${carouselImages[selectedImages[currentImageIndex]] || storyboardFrames[selectedImages[currentImageIndex]].imageData}`}
                          alt="Storyboard"
                          className="max-w-full max-h-full object-contain rounded-lg"
                          key={`carousel-${selectedImages[currentImageIndex]}-${carouselImageVersions[selectedImages[currentImageIndex]] || initialTimestamp}`}
                          style={{ 
                            imageRendering: 'auto',
                            opacity: carouselImages[selectedImages[currentImageIndex]] ? 1 : 0.9
                          }}
                          onLoad={() => {
                            const currentIdx = selectedImages[currentImageIndex];
                            const hasCarouselImage = !!carouselImages[currentIdx];
                            console.log('Carousel image loaded:', {
                              currentIdx,
                              hasCarouselImage,
                              carouselImageLength: carouselImages[currentIdx]?.length || 0,
                              originalImageLength: storyboardFrames[currentIdx]?.imageData?.length || 0,
                              carouselImagesKeys: Object.keys(carouselImages),
                              usingCarouselImage: hasCarouselImage,
                              key: carouselImageVersions[currentIdx]
                            });
                          }}
                        />
                      ) : (
                        <Image className="h-16 w-16 text-muted-foreground" />
                      )}
                    </div>
                    
                    {/* Navigation arrows */}
                    {selectedImages.length > 1 && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute left-2 top-1/2 transform -translate-y-1/2"
                          onClick={prevImage}
                          disabled={currentImageIndex === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                          onClick={nextImage}
                          disabled={currentImageIndex === selectedImages.length - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  
                  {/* Current shot info */}
                  <div className="bg-muted p-3 rounded-lg">
                    <h3 className="font-medium">
                      Shot {storyboardFrames[selectedImages[currentImageIndex]]?.shotNumber}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {storyboardFrames[selectedImages[currentImageIndex]]?.description}
                    </p>
                  </div>
                  
                  {/* Edit prompt */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-prompt">Describe changes you want to make:</Label>
                    <Textarea
                      id="edit-prompt"
                      placeholder="e.g., Make the lighting warmer, add more shadows, change the camera angle..."
                      value={editingPrompt}
                      onChange={(e) => setEditingPrompt(e.target.value)}
                      rows={3}
                      disabled={isRegenerating}
                      className={isRegenerating ? "opacity-75" : ""}
                    />
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setShowCarousel(false)}>
                      Close
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const currentImageIdx = selectedImages[currentImageIndex];
                          
                          // Transfer regenerated image from carousel to main view if it exists
                          if (carouselImages[currentImageIdx]) {
                            setUpdatedMainImages(prev => ({
                              ...prev,
                              [currentImageIdx]: carouselImages[currentImageIdx]
                            }));
                          }
                          
                          // Mark this image as completed and update main grid
                          setCompletedImages(prev => {
                            const newSet = new Set(prev);
                            newSet.add(currentImageIdx);
                            return newSet;
                          });
                          setImageRefreshTimestamps(prev => ({
                            ...prev,
                            [currentImageIdx]: Date.now() + Math.random()
                          }));
                          
                          // Remove this image from carousel selection
                          const remainingImages = selectedImages.filter((_, idx) => idx !== currentImageIndex);
                          setSelectedImages(remainingImages);
                          
                          if (remainingImages.length === 0) {
                            // Close carousel if no more images
                            setShowCarousel(false);
                            queryClient.invalidateQueries({ queryKey: [`/api/storyboards/${jobId}/${sceneIndex}`] });
                            toast({ title: "All images completed!" });
                          } else {
                            // Move to next image or adjust index
                            const newIndex = currentImageIndex >= remainingImages.length 
                              ? remainingImages.length - 1 
                              : currentImageIndex;
                            setCurrentImageIndex(newIndex);
                            toast({ title: "Image completed and updated in main view" });
                          }
                        }}
                      >
                        Done with this image
                      </Button>
                      <Button 
                        onClick={() => {
                          const storyboardIndex = selectedImages[currentImageIndex];
                          console.log(`Regenerate button clicked - currentImageIndex: ${currentImageIndex}, storyboardIndex: ${storyboardIndex}`);
                          
                          if (storyboardIndex === undefined || storyboardIndex < 0) {
                            toast({
                              title: "Invalid selection",
                              description: "Unable to identify the selected image. Please try again.",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          if (!editingPrompt.trim()) {
                            toast({
                              title: "Missing prompt",
                              description: "Please enter modifications for the image.",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          regenerateImage.mutate(storyboardIndex);
                        }}
                        disabled={!editingPrompt.trim() || isRegenerating}
                      >
                        {isRegenerating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2"></div>
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Regenerate Image
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
      
      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to Shots
        </Button>
      </div>

      {/* Upgrade Modal */}
      <StoryboardUpgradeModal
        isOpen={showUpgradeModal}
        onClose={handleCloseUpgradeModal}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}