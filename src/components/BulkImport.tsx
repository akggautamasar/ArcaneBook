import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileJson, FileText, AlertCircle } from 'lucide-react';
import type { Question } from './QuizBuilder';

interface BulkImportProps {
  onImport: (questions: Question[]) => void;
}

export const BulkImport: React.FC<BulkImportProps> = ({ onImport }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [plainTextInput, setPlainTextInput] = useState('');
  const { toast } = useToast();

  const handleJsonImport = () => {
    try {
      const parsedQuestions = JSON.parse(jsonInput);
      if (!Array.isArray(parsedQuestions)) {
        throw new Error('Invalid JSON format. Expected an array of questions.');
      }

      const importedQuestions: Question[] = parsedQuestions.map(q => ({
        id: crypto.randomUUID(),
        questionText: q.questionText || '',
        options: q.options || ['', '', '', ''],
        correctOptionIndex: q.correctOptionIndex !== undefined ? parseInt(q.correctOptionIndex) : 0,
        explanation: q.explanation || '',
        section: q.section || 'Test',
        positiveMarks: q.positiveMarks !== undefined ? parseInt(q.positiveMarks) : 5,
        negativeMarks: q.negativeMarks !== undefined ? parseInt(q.negativeMarks) : 1,
        compText: q.compText || ''
      }));

      onImport(importedQuestions);
      setJsonInput('');
      
      toast({
        title: "Success",
        description: `${importedQuestions.length} questions imported from JSON!`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Import Error",
        description: "Failed to parse JSON. Please check your input format.",
        variant: "destructive"
      });
    }
  };

  const handlePlainTextImport = () => {
    const text = plainTextInput.trim();
    if (!text) {
      toast({
        title: "Error",
        description: "Plain text input is empty.",
        variant: "destructive"
      });
      return;
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const importedQuestions: Question[] = [];
    let currentQ: Partial<Question> | null = null;

    const optionMap: { [key: string]: number } = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5 };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match question number (e.g., "1. Which sentence...")
      const qMatch = line.match(/^(\d+)\.\s*(.*)/);
      if (qMatch) {
        if (currentQ) {
          importedQuestions.push(currentQ as Question);
        }
        currentQ = {
          id: crypto.randomUUID(),
          questionText: qMatch[2],
          options: [],
          correctOptionIndex: 0,
          explanation: '',
          section: 'Test',
          positiveMarks: 5,
          negativeMarks: 1,
          compText: ''
        };
        continue;
      }

      if (!currentQ) continue;

      // Match options (e.g., "a) She is cooking dinner.")
      const optionMatch = line.match(/^([a-z])\)\s*(.*)/);
      if (optionMatch && currentQ.options) {
        currentQ.options.push(optionMatch[2]);
        continue;
      }

      // Match Answer (e.g., "Answer: b")
      const answerMatch = line.match(/^Answer:\s*([a-z])/i);
      if (answerMatch) {
        const answerLetter = answerMatch[1].toLowerCase();
        currentQ.correctOptionIndex = optionMap[answerLetter] !== undefined ? optionMap[answerLetter] : 0;
        continue;
      }

      // Match Explanation (e.g., "Explanation: The simple present...")
      const explanationMatch = line.match(/^Explanation:\s*(.*)/);
      if (explanationMatch) {
        currentQ.explanation = explanationMatch[1];
        continue;
      }

      // Handle multi-line content
      if (currentQ.explanation === '') {
        if (!currentQ.options || currentQ.options.length === 0) {
          currentQ.questionText += ' ' + line;
        } else if (currentQ.options.length > 0) {
          currentQ.options[currentQ.options.length - 1] += ' ' + line;
        }
      } else {
        currentQ.explanation += ' ' + line;
      }
    }

    if (currentQ) {
      importedQuestions.push(currentQ as Question);
    }

    if (importedQuestions.length > 0) {
      onImport(importedQuestions);
      setPlainTextInput('');
      
      toast({
        title: "Success",
        description: `${importedQuestions.length} questions imported from plain text!`,
        variant: "default"
      });
    } else {
      toast({
        title: "Import Error",
        description: "No questions could be parsed from the plain text. Please check the format.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Questions
          </CardTitle>
          <CardDescription>
            Import multiple questions at once using JSON or plain text format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="json" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="json" className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                JSON Format
              </TabsTrigger>
              <TabsTrigger value="plaintext" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Plain Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="json-input">JSON Data</Label>
                <Textarea
                  id="json-input"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`[
  {
    "questionText": "What is the capital of France?",
    "options": ["London", "Berlin", "Paris", "Madrid"],
    "correctOptionIndex": 2,
    "explanation": "Paris is the capital city of France.",
    "section": "Geography",
    "positiveMarks": 5,
    "negativeMarks": 1
  }
]`}
                  className="min-h-[200px] font-mono text-sm bg-background/50"
                />
              </div>
              <Button onClick={handleJsonImport} disabled={!jsonInput.trim()}>
                <FileJson className="h-4 w-4" />
                Import from JSON
              </Button>
            </TabsContent>

            <TabsContent value="plaintext" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plaintext-input">Plain Text Data</Label>
                <Textarea
                  id="plaintext-input"
                  value={plainTextInput}
                  onChange={(e) => setPlainTextInput(e.target.value)}
                  placeholder={`1. What is the capital of France?
a) London
b) Berlin
c) Paris
d) Madrid
Answer: c
Explanation: Paris is the capital city of France.

2. Which planet is closest to the Sun?
a) Venus
b) Mercury
c) Mars
d) Earth
Answer: b
Explanation: Mercury is the closest planet to the Sun.`}
                  className="min-h-[200px] font-mono text-sm bg-background/50"
                />
              </div>
              
              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning mb-1">Format Requirements:</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Start each question with a number followed by a period</li>
                    <li>• Use a), b), c), d) for options</li>
                    <li>• Use "Answer: [letter]" to specify correct answer</li>
                    <li>• Use "Explanation: [text]" for explanations (optional)</li>
                  </ul>
                </div>
              </div>
              
              <Button onClick={handlePlainTextImport} disabled={!plainTextInput.trim()}>
                <FileText className="h-4 w-4" />
                Import from Plain Text
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};