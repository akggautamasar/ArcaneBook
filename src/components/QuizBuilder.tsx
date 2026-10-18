import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { QuestionForm } from './QuestionForm';
import { QuestionList } from './QuestionList';
import { BulkImport } from './BulkImport';
import { PdfQuestionImport } from './PdfQuestionImport';
import { ImageCropImport } from './ImageCropImport';
import { QuizSettings } from './QuizSettings';
import { QuizPreview } from './QuizPreview';
import { MyTests } from './MyTests';
import { generateHtmlQuiz } from '@/lib/quiz-generator';
import { saveQuiz } from '@/lib/telegram';
import { FileText, Plus, Settings, Download, Upload, Eye, Trash2, Sparkles, Send } from 'lucide-react';

export interface Question {
  id: string;
  questionText: string;
  options: string[];
  optionImages?: string[];
  questionImage?: string;
  correctOptionIndex: number;
  explanation: string;
  section: string;
  positiveMarks: number;
  negativeMarks: number;
  compText: string;
}

export interface QuizMetadata {
  title: string;
  description: string;
  timerDuration: number;
  shuffleQuestions: boolean;
  defaultPositiveMarks: number;
  defaultNegativeMarks: number;
  template: 'classic' | 'modern' | 'exam-blue' | 'exam-green' | 'exam-minimal' | 'rrb-cbt';
}

export const QuizBuilder: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: '', questionText: '', options: ['', '', '', ''],
    correctOptionIndex: 0, explanation: '', section: 'Test',
    positiveMarks: 5, negativeMarks: 1, compText: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [quizMetadata, setQuizMetadata] = useState<QuizMetadata>({
    title: 'ArcaneBook Quiz',
    description: "Create amazing quizzes with ArcaneBook's professional quiz builder.",
    timerDuration: 60, shuffleQuestions: false,
    defaultPositiveMarks: 5, defaultNegativeMarks: 1, template: 'classic'
  });
  const [activeTab, setActiveTab] = useState('builder');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const addOrUpdateQuestion = () => {
    if ((!currentQuestion.questionText && !currentQuestion.questionImage) || currentQuestion.options.some(o => !o.trim())) {
      toast({ title: 'Validation Error', description: 'Fill in all question text and options.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(currentQuestion.positiveMarks) || !Number.isFinite(currentQuestion.negativeMarks) || currentQuestion.positiveMarks < 0 || currentQuestion.negativeMarks < 0) {
      toast({ title: 'Invalid marks', description: 'Marks must be valid non-negative numbers.', variant: 'destructive' });
      return;
    }
    if (isEditing && editIndex !== null) {
      setQuestions(prev => prev.map((q, i) => i === editIndex ? { ...currentQuestion, id: q.id } : q));
      toast({ title: 'Updated', description: 'Question updated successfully!' });
    } else {
      setQuestions(prev => [...prev, { ...currentQuestion, id: crypto.randomUUID() }]);
      toast({ title: 'Added', description: 'Question added successfully!' });
    }
    resetForm();
  };

  const resetForm = () => {
    setCurrentQuestion({
      id: '', questionText: '', options: ['', '', '', ''], optionImages: ['', '', '', ''],
      correctOptionIndex: 0, explanation: '', section: 'Test',
      positiveMarks: quizMetadata.defaultPositiveMarks,
      negativeMarks: quizMetadata.defaultNegativeMarks, compText: ''
    });
    setIsEditing(false);
    setEditIndex(null);
  };

  const editQuestion = (index: number) => {
    setCurrentQuestion({ ...questions[index] });
    setIsEditing(true);
    setEditIndex(index);
    setActiveTab('builder');
  };

  const deleteQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
    if (isEditing && editIndex === index) resetForm();
    toast({ title: 'Deleted', description: 'Question removed.' });
  };

  const exportToJson = () => {
    if (!questions.length) {
      toast({ title: 'Error', description: 'No questions to export.', variant: 'destructive' });
      return;
    }
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'quiz_questions.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Questions exported to JSON.' });
  };

  const generateHtmlFile = async () => {
    if (!questions.length) {
      toast({ title: 'Error', description: 'Add at least one question first.', variant: 'destructive' });
      return;
    }
    if (!isAuthenticated) {
      toast({ title: 'Auth Required', description: 'Please sign in to save quizzes.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const htmlContent = generateHtmlQuiz(questions, quizMetadata);

      // Save to Telegram
      await saveQuiz(quizMetadata.title, quizMetadata.description, htmlContent, questions.length);

      // Download locally too
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quizMetadata.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);

      toast({ title: '✅ Quiz Saved!', description: 'Saved to Telegram & downloaded locally.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save quiz. Check your Telegram config.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full min-w-0 bg-background">
      {/* Header */}
      <div className="border-b bg-gradient-card backdrop-blur-sm relative sm:sticky sm:top-0 z-30">
        <div className="w-full mx-auto px-3 sm:px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">ArcaneBook</h1>
                <p className="text-sm text-muted-foreground">Professional Quiz Builder</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {questions.length} Question{questions.length !== 1 ? 's' : ''}
              </Badge>
              <Button variant="outline" size="sm" onClick={exportToJson}>
                <Upload className="h-4 w-4 mr-1" />Export JSON
              </Button>
              <Button size="sm" onClick={generateHtmlFile} disabled={isSaving}>
                {isSaving ? (
                  <><Send className="h-4 w-4 mr-1 animate-pulse" />Saving...</>
                ) : (
                  <><Download className="h-4 w-4 mr-1" />Generate & Save</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full min-w-0 mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 min-w-0">
          <TabsList className="flex flex-wrap w-full h-auto justify-start gap-1 p-1">
            <TabsTrigger className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none min-w-[90px]" value="builder"><Plus className="h-4 w-4 mr-1" />Builder</TabsTrigger>
            <TabsTrigger className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none min-w-[90px]" value="questions"><FileText className="h-4 w-4 mr-1" />Questions</TabsTrigger>
            <TabsTrigger className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none min-w-[90px]" value="import"><Upload className="h-4 w-4 mr-1" />Import</TabsTrigger>
            <TabsTrigger className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none min-w-[90px]" value="pdf-import"><FileText className="h-4 w-4 mr-1" />PDF Import</TabsTrigger>
            <TabsTrigger className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none min-w-[90px]" value="settings"><Settings className="h-4 w-4 mr-1" />Settings</TabsTrigger>
            <TabsTrigger className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none min-w-[90px]" value="preview"><Eye className="h-4 w-4 mr-1" />Preview</TabsTrigger>
            <TabsTrigger className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none min-w-[90px]" value="tests"><Download className="h-4 w-4 mr-1" />My Tests</TabsTrigger>
          </TabsList>

          <TabsContent value="builder">
            <QuestionForm
              currentQuestion={currentQuestion}
              setCurrentQuestion={setCurrentQuestion}
              onSave={addOrUpdateQuestion}
              onReset={resetForm}
              isEditing={isEditing}
            />
          </TabsContent>

          <TabsContent value="questions">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Question Bank</h2>
                <p className="text-sm text-muted-foreground">Manage your quiz questions</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => { setQuestions([]); resetForm(); }}>
                <Trash2 className="h-4 w-4 mr-1" />Clear All
              </Button>
            </div>
            <QuestionList questions={questions} onEdit={editQuestion} onDelete={deleteQuestion} />
          </TabsContent>

          <TabsContent value="import">
            <BulkImport onImport={(imported) => {
              setQuestions(prev => [...prev, ...imported]);
              toast({ title: 'Imported', description: `${imported.length} questions added.` });
            }} />
          </TabsContent>

          <TabsContent value="pdf-import">
            <ImageCropImport positive={quizMetadata.defaultPositiveMarks} negative={quizMetadata.defaultNegativeMarks} onImport={imported=>{setQuestions(prev=>[...prev,...imported]);toast({title:'Image questions imported',description:imported.length+' questions added'});setActiveTab('questions')}} />
            <PdfQuestionImport positive={quizMetadata.defaultPositiveMarks} negative={quizMetadata.defaultNegativeMarks} onImport={imported => {
              setQuestions(prev => [...prev, ...imported]);
              toast({ title: 'PDF questions imported', description: `${imported.length} questions added to your question bank.` });
              setActiveTab('questions');
            }} />
          </TabsContent>

          <TabsContent value="settings">
            <QuizSettings metadata={quizMetadata} onUpdate={setQuizMetadata} />
          </TabsContent>

          <TabsContent value="preview">
            <QuizPreview questions={questions} metadata={quizMetadata} />
          </TabsContent>

          <TabsContent value="tests">
            <MyTests />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
