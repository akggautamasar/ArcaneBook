import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings2, Clock, Shuffle, FileText, Palette } from 'lucide-react';
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
    <div className="space-y-6 min-w-0">
      <Card className="w-full min-w-0 bg-gradient-card border-card-border shadow-glass">
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
                    onChange={(e) => handleChange('defaultPositiveMarks', Number(e.target.value) || 0)}
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
                    step="any"
                    value={metadata.defaultNegativeMarks}
                    onChange={(e) => handleChange('defaultNegativeMarks', Number(e.target.value) || 0)}
                    placeholder="1"
                    className="bg-background/50"
                    min="0"
                  />
                  <p className="text-sm text-muted-foreground">
                    Deduction per wrong answer; decimals are supported (e.g. 0.25 or 0.333333).
                  </p>
                </div>
              </div>
              
              <div className="rounded-xl border bg-indigo-50/50 p-4 space-y-3">
                <Label>Quick negative-marking presets</Label>
                <p className="text-xs text-muted-foreground">Fractions are calculated from the marks awarded for a correct answer. Apply to existing questions separately if needed.</p>
                <div className="flex flex-wrap gap-2">
                  {([{label:'No deduction',fraction:0},{label:'1/4 (25%)',fraction:1/4},{label:'1/3 (33.33%)',fraction:1/3},{label:'1/2 (50%)',fraction:1/2}] as const).map(p => (
                    <button type="button" key={p.label} onClick={() => handleChange('defaultNegativeMarks', Number((metadata.defaultPositiveMarks*p.fraction).toFixed(8)))} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:border-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">{p.label}</button>
                  ))}
                </div>
                <p className="text-sm">Example: +{metadata.defaultPositiveMarks} / −{Number(metadata.defaultNegativeMarks.toFixed(4))} per question</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg bg-background/30">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Quiz template">
                {([
                  {value:'classic',label:'Classic',description:'Traditional question layout',accent:'bg-indigo-600'},
                  {value:'modern',label:'Modern',description:'Gradient interface with animations',accent:'bg-violet-600'},
                  {value:'exam-blue',label:'Exam Blue',description:'Blue government CBT-inspired screen',accent:'bg-blue-700'},
                  {value:'exam-green',label:'Exam Green',description:'Green recruitment CBT-inspired screen',accent:'bg-emerald-700'},
                  {value:'exam-minimal',label:'Exam Minimal',description:'Distraction-free examination screen',accent:'bg-slate-600'},
                ] as const).map(t => (
                  <button key={t.value} type="button" role="radio" aria-checked={metadata.template === t.value}
                    onClick={() => handleChange('template', t.value)}
                    className={`w-full min-w-0 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${metadata.template === t.value ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                    <span className="flex items-center gap-3">
                      <span className={`h-9 w-11 shrink-0 rounded-md ${t.accent} flex items-center justify-center text-white text-xs font-bold`}>Q 01</span>
                      <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{t.label}</span><span className="block text-xs text-slate-600">{t.description}</span></span>
                      <span className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center ${metadata.template === t.value ? 'border-indigo-600' : 'border-slate-300'}`}>{metadata.template === t.value && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Choose from five layouts. Exam-inspired layouts are independent recreations, not official exam portals.
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
                   {({classic:'Classic',modern:'Modern','exam-blue':'Exam Blue','exam-green':'Exam Green','exam-minimal':'Exam Minimal'} as const)[metadata.template]} template
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