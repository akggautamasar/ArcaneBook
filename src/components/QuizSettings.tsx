import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings2, Clock, Shuffle, FileText, Palette } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { QuizMetadata } from './QuizBuilder';

interface QuizSettingsProps {
  metadata: QuizMetadata;
  onUpdate: (metadata: QuizMetadata) => void;
}

export const QuizSettings: React.FC<QuizSettingsProps> = ({ metadata, onUpdate }) => {
  const handleChange = (field: keyof QuizMetadata, value: any) => {
    onUpdate({ ...metadata, [field]: value });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-card-border shadow-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Quiz Settings
          </CardTitle>
          <CardDescription>
            Configure your quiz metadata and behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Basic Information
            </h3>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="quiz-title">Quiz Title</Label>
                <Input
                  id="quiz-title"
                  value={metadata.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Enter quiz title..."
                  className="bg-background/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quiz-description">Quiz Description</Label>
                <Textarea
                  id="quiz-description"
                  value={metadata.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe your quiz..."
                  className="min-h-[80px] bg-background/50"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Quiz Behavior */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Quiz Behavior
            </h3>
            
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="timer-duration">Timer Duration (minutes)</Label>
                <Input
                  id="timer-duration"
                  type="number"
                  value={metadata.timerDuration}
                  onChange={(e) => handleChange('timerDuration', parseInt(e.target.value) || 0)}
                  placeholder="60"
                  className="bg-background/50"
                  min="0"
                />
                <p className="text-sm text-muted-foreground">
                  Set to 0 to disable the timer
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default-positive-marks">Default Positive Marks</Label>
                  <Input
                    id="default-positive-marks"
                    type="number"
                    value={metadata.defaultPositiveMarks}
                    onChange={(e) => handleChange('defaultPositiveMarks', parseInt(e.target.value) || 0)}
                    placeholder="5"
                    className="bg-background/50"
                    min="0"
                  />
                  <p className="text-sm text-muted-foreground">
                    Default marks awarded for correct answers
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="default-negative-marks">Default Negative Marks</Label>
                  <Input
                    id="default-negative-marks"
                    type="number"
                    value={metadata.defaultNegativeMarks}
                    onChange={(e) => handleChange('defaultNegativeMarks', parseInt(e.target.value) || 0)}
                    placeholder="1"
                    className="bg-background/50"
                    min="0"
                  />
                  <p className="text-sm text-muted-foreground">
                    Default marks deducted for wrong answers
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg bg-background/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shuffle className="h-4 w-4" />
                    <Label htmlFor="shuffle-questions" className="font-medium">
                      Shuffle Questions
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Randomize the order of questions for each quiz attempt
                  </p>
                </div>
                <Switch
                  id="shuffle-questions"
                  checked={metadata.shuffleQuestions}
                  onCheckedChange={(checked) => handleChange('shuffleQuestions', checked)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Template Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Template Selection
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="template-select">Quiz Template</Label>
              <Select value={metadata.template} onValueChange={(value: 'classic' | 'modern') => handleChange('template', value)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic - Traditional quiz layout</SelectItem>
                  <SelectItem value="modern">Modern - Gradient design with smooth animations</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose the visual theme for your quiz HTML file
              </p>
            </div>
          </div>

          <Separator />

          {/* Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Preview</h3>
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-semibold text-lg">{metadata.title}</h4>
              <p className="text-muted-foreground">{metadata.description}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                {metadata.timerDuration > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {metadata.timerDuration} minutes
                  </span>
                )}
                 <span className="flex items-center gap-1">
                   +{metadata.defaultPositiveMarks} / -{metadata.defaultNegativeMarks} marks
                 </span>
                 <span className="flex items-center gap-1">
                   <Palette className="h-3 w-3" />
                   {metadata.template === 'classic' ? 'Classic' : 'Modern'} template
                 </span>
                 {metadata.shuffleQuestions && (
                   <span className="flex items-center gap-1">
                     <Shuffle className="h-3 w-3" />
                     Shuffled
                   </span>
                 )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};