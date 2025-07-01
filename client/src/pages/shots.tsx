import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, ArrowLeft, Film, Camera, Clock, Users, Video, Move, Palette, MapPin, Sun, Box, Lightbulb, MessageSquare, Heart, Volume2, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ShotsProps {
  jobId: string;
  sceneIndex: string;
}

export default function Shots({ jobId, sceneIndex }: ShotsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Fetch parse job to get the selected scene
  const { data: parseJob, isLoading: isLoadingJob } = useQuery({
    queryKey: [`/api/jobs/${jobId}`],
  });
  
  // Get the specific scene data
  const scenes = (parseJob as any)?.fullParseData?.scenes || [];
  const selectedScene = scenes[parseInt(sceneIndex)];
  
  // Fetch any existing shots for this scene
  const { data: existingShots, isLoading: isLoadingShots } = useQuery({
    queryKey: [`/api/shots/${jobId}/${sceneIndex}`],
    enabled: !!parseJob,
  });
  
  // Generate shots mutation
  const generateShotsMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const response = await fetch(`/api/shots/generate/${jobId}/${sceneIndex}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate shots');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Shots generated successfully",
        description: `Generated ${data.shotCount || 0} shots for the scene`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/shots/${jobId}/${sceneIndex}`] });
      setIsGenerating(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Shot generation failed",
        description: error.message,
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });
  
  const goToStoryboards = () => {
    setLocation(`/storyboards/${jobId}/${sceneIndex}`);
  };
  
  const goBack = () => {
    setLocation(`/scene-selection/${jobId}`);
  };
  
  if (isLoadingJob) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">Loading scene data...</div>
      </div>
    );
  }
  
  if (!selectedScene) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Scene Not Found</CardTitle>
            <CardDescription>
              The selected scene could not be found. Please go back and select a valid scene.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  const shots = (existingShots as any)?.shots || [];
  
  // Debug logging to see the shots data structure
  console.log('Shots data:', shots);
  
  // CSV download function - exports ALL 19 fields automatically
  const downloadCSV = () => {
    if (!shots.length) {
      toast({
        title: "No shots to download",
        description: "Generate shots first before downloading",
        variant: "destructive"
      });
      return;
    }

    console.log('First shot data keys:', shots[0] ? Object.keys(shots[0]) : 'No shots');
    console.log('First shot sample:', shots[0]);

    // Export ALL 19 comprehensive fields automatically
    const allFields = [
      { header: 'Scene Number', field: 'sceneIndex', transform: (value: any) => (value || 0) + 1 },
      { header: 'Scene Heading', field: 'sceneHeading' },
      { header: 'Shot Number', field: 'shotNumberInScene' },
      { header: 'Shot Description', field: 'shotDescription' },
      { header: 'Shot Type', field: 'shotType' },
      { header: 'Lens', field: 'lens' },
      { header: 'Camera Movement', field: 'movement' },
      { header: 'Location', field: 'location' },
      { header: 'Time of Day', field: 'timeOfDay' },
      { header: 'Characters', field: 'characters' },
      { header: 'Action', field: 'action' },
      { header: 'Dialogue', field: 'dialogue' },
      { header: 'Props', field: 'props' },
      { header: 'Tone', field: 'tone' },
      { header: 'Mood & Ambience', field: 'moodAndAmbience' },
      { header: 'Lighting', field: 'lighting' },
      { header: 'Notes', field: 'notes' },
      { header: 'Sound Design', field: 'soundDesign' },
      { header: 'Color Temperature', field: 'colourTemp' }
    ];
    
    const headers = allFields.map(field => field.header);
    console.log(`Exporting ${headers.length} comprehensive fields:`, headers);
    
    const csvRows = [headers.join(',')];
    
    shots.forEach((shot: any, shotIndex: number) => {
      const row = allFields.map(fieldDef => {
        let value = shot[fieldDef.field];
        
        // Apply transformation if specified
        if (fieldDef.transform) {
          value = fieldDef.transform(value);
        }
        
        // Ensure we return a string value
        const finalValue = value !== null && value !== undefined ? String(value).trim() : '';
        
        // Debug logging for first shot
        if (shotIndex === 0) {
          console.log(`${fieldDef.header} (${fieldDef.field}): "${finalValue}"`);
        }
        
        return finalValue;
      });
      
      // Clean and escape CSV data properly
      const cleanRow = row.map((field: any) => {
        let str = String(field || '').trim();
        // Remove any line breaks or extra spaces
        str = str.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
        // Escape quotes and wrap in quotes if contains comma or quote
        if (str.includes(',') || str.includes('"')) {
          str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      
      csvRows.push(cleanRow.join(','));
    });
    
    const csvContent = csvRows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `scene_${parseInt(sceneIndex) + 1}_shots.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('Final CSV content preview:');
    console.log(csvContent.split('\n').slice(0, 3).join('\n'));
    
    toast({
      title: "CSV downloaded",
      description: `Downloaded ${shots.length} shots with ${headers.length} comprehensive fields`,
    });
  };
  
  // Production Details Component
  const ProductionDetailsPanel = () => (
    <div className="w-64 bg-card border-l border-border overflow-y-auto">
      <div className="sticky top-0 bg-card border-b border-border p-6 pb-4">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Production Details</h3>
        </div>
      </div>
      <div className="p-6 pt-4 space-y-6">
        {/* Comprehensive Shot List Generation */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Comprehensive Shot List Generation</h4>
          <p className="text-xs text-muted-foreground">
            Every shot generated includes comprehensive production details organized into these categories:
          </p>
        </div>

        {/* Basic Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            <h4 className="font-medium text-sm">Basic Information</h4>
          </div>
          <div className="space-y-2">
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Scene Number</div>
              <div className="text-xs text-muted-foreground">Sequential numbering of scenes</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Scene Heading</div>
              <div className="text-xs text-muted-foreground">INT/EXT and location descriptions</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Shot Number</div>
              <div className="text-xs text-muted-foreground">Sequential shot numbering</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Shot Description</div>
              <div className="text-xs text-muted-foreground">Detailed description of the shot</div>
            </div>
          </div>
        </div>

        {/* Camera & Technical */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <h4 className="font-medium text-sm">Camera & Technical</h4>
          </div>
          <div className="space-y-2">
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Shot Type</div>
              <div className="text-xs text-muted-foreground">Wide, Medium, Close-up, etc.</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Lens</div>
              <div className="text-xs text-muted-foreground">Recommended lens focal length</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Camera Movement</div>
              <div className="text-xs text-muted-foreground">Suggested camera directions</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Color Temperature</div>
              <div className="text-xs text-muted-foreground">Lighting color recommendations</div>
            </div>
          </div>
        </div>

        {/* Scene Context */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <h4 className="font-medium text-sm">Scene Context</h4>
          </div>
          <div className="space-y-2">
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Location</div>
              <div className="text-xs text-muted-foreground">Specific shooting location details</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Time of Day</div>
              <div className="text-xs text-muted-foreground">Narrative time and lighting needs</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Props</div>
              <div className="text-xs text-muted-foreground">Required props and set pieces</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Lighting</div>
              <div className="text-xs text-muted-foreground">Lighting setup requirements</div>
            </div>
          </div>
        </div>

        {/* Characters & Action */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <h4 className="font-medium text-sm">Characters & Action</h4>
          </div>
          <div className="space-y-2">
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Characters</div>
              <div className="text-xs text-muted-foreground">Characters in the shot</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Action</div>
              <div className="text-xs text-muted-foreground">Physical actions and movements</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Dialogue</div>
              <div className="text-xs text-muted-foreground">Spoken lines and voiceover</div>
            </div>
          </div>
        </div>

        {/* Production Notes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <h4 className="font-medium text-sm">Production Notes</h4>
          </div>
          <div className="space-y-2">
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Tone</div>
              <div className="text-xs text-muted-foreground">Emotional tone and atmosphere</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Mood & Ambience</div>
              <div className="text-xs text-muted-foreground">Overall mood and environmental feel</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Sound Design</div>
              <div className="text-xs text-muted-foreground">Audio requirements and notes</div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="font-medium text-sm">Notes</div>
              <div className="text-xs text-muted-foreground">Additional production notes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-1">Shot Generation</h2>
            <p className="text-muted-foreground">
              Generate detailed shots for "{selectedScene?.sceneHeading || `Scene ${parseInt(sceneIndex) + 1}`}"
            </p>
          </div>
          
          {/* Scene Overview */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Film className="h-5 w-5 mr-2" />
                  Scene {selectedScene?.sceneNumber || parseInt(sceneIndex) + 1}
                </CardTitle>
                <Badge variant="outline">
                  {selectedScene?.location || "Location not specified"}
                </Badge>
              </div>
              <CardDescription>
                {selectedScene?.sceneHeading}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Characters</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedScene?.characters?.map((character: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {character}
                      </Badge>
                    )) || <span className="text-muted-foreground text-sm">No characters specified</span>}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Props</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedScene?.props?.map((prop: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {prop}
                      </Badge>
                    )) || <span className="text-muted-foreground text-sm">No props specified</span>}
                  </div>
                </div>
              </div>
              {selectedScene?.action && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Action</h4>
                  <p className="text-sm text-muted-foreground">{selectedScene.action}</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Generate Shots Section */}
          {shots.length === 0 ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Generate Shots</CardTitle>
                <CardDescription>
                  Create a detailed shot breakdown for this scene using AI analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => generateShotsMutation.mutate()}
                  disabled={isGenerating}
                  className="w-full md:w-auto"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2"></div>
                      Generating Shots...
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-4 w-4" />
                      Generate Shots
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Shots Table */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Generated Shots ({shots.length})</CardTitle>
                    <Button 
                      onClick={downloadCSV}
                      disabled={shots.length === 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Download Excel/CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shot</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Camera</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shots.map((shot: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {shot.shotNumberInScene || shot.shotNumber || idx + 1}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{shot.shotType || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {shot.lens || 'N/A'}
                            {shot.movement && (
                              <div className="text-muted-foreground">{shot.movement}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-md">
                            {shot.shotDescription || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <Clock className="h-3 w-3 mr-1" />
                              3s
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
          
          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Scene Selection
            </Button>
            
            {shots.length > 0 && (
              <Button onClick={goToStoryboards}>
                Generate Storyboards
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Production Details Right Panel */}
      <ProductionDetailsPanel />
    </div>
  );
}