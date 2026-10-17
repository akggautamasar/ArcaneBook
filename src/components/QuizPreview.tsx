import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Eye, Clock, Shuffle, FileText, CheckCircle, X } from 'lucide-react';
import type { Question, QuizMetadata } from './QuizBuilder';

interface QuizPreviewProps {
  questions: Question[];
  metadata: QuizMetadata;
}

export const QuizPreview: React.FC<QuizPreviewProps> = ({ questions, metadata }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: number }>({});
  const [showAnswers, setShowAnswers] = useState(false);

  const handleOptionSelect = (questionId: string, optionIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const toggleAnswers = () => {
    setShowAnswers(!showAnswers);
  };

  if (questions.length === 0) {
    return (
      <Card className="bg-gradient-card border-card-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Eye className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Questions to Preview</h3>
          <p className="text-muted-foreground text-center">
            Add some questions to see a preview of your quiz.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalMarks = questions.reduce((sum, q) => sum + q.positiveMarks, 0);
  const sectionsCount = new Set(questions.map(q => q.section)).size;

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <Card className="bg-gradient-card border-card-border shadow-glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{metadata.title}</CardTitle>
              <CardDescription className="mt-2">{metadata.description}</CardDescription>
            </div>
            <Button variant="outline" onClick={toggleAnswers}>
              {showAnswers ? <X className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showAnswers ? 'Hide Answers' : 'Show Answers'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>{questions.length} Questions</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{totalMarks} Total Marks</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{sectionsCount} Section{sectionsCount !== 1 ? 's' : ''}</Badge>
            </div>
            {metadata.timerDuration > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{metadata.timerDuration} minutes</span>
              </div>
            )}
            {metadata.shuffleQuestions && (
              <div className="flex items-center gap-2">
                <Shuffle className="h-4 w-4" />
                <span>Shuffled</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => (
          <Card key={question.id} className="bg-gradient-card border-card-border shadow-glass">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {question.section}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        +{question.positiveMarks} / -{question.negativeMarks}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {question.compText && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Comprehension:</p>
                  <div 
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: question.compText }}
                  />
                </div>
              )}
              
              <div>
                <div 
                  className="text-base font-medium leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: question.questionText }}
                />
              </div>

              <div className="space-y-3">
                {question.options.map((option, optionIndex) => {
                  const isSelected = selectedAnswers[question.id] === optionIndex;
                  const isCorrect = optionIndex === question.correctOptionIndex;
                  const showCorrectAnswer = showAnswers && isCorrect;
                  const showIncorrectAnswer = showAnswers && isSelected && !isCorrect;
                  
                  return (
                    <div 
                      key={optionIndex}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        showCorrectAnswer 
                          ? 'bg-success/10 border-success/30'
                          : showIncorrectAnswer
                          ? 'bg-destructive/10 border-destructive/30'
                          : isSelected
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-background/50 border-border hover:bg-muted/50'
                      }`}
                      onClick={() => handleOptionSelect(question.id, optionIndex)}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        showCorrectAnswer 
                          ? 'border-success bg-success'
                          : showIncorrectAnswer
                          ? 'border-destructive bg-destructive'
                          : isSelected
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}>
                        {(isSelected || showCorrectAnswer) && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-medium min-w-[20px]">
                        {String.fromCharCode(65 + optionIndex)}.
                      </span>
                      <div className="flex-1">
                        {question.optionImages?.[optionIndex] && (
                          <img 
                            src={question.optionImages[optionIndex]} 
                            alt={`Option ${optionIndex + 1}`}
                            className="max-w-32 max-h-32 object-contain border border-border rounded mb-2"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div dangerouslySetInnerHTML={{ __html: option }} />
                      </div>
                      {showAnswers && isCorrect && (
                        <CheckCircle className="h-5 w-5 text-success" />
                      )}
                    </div>
                  );
                })}
              </div>

              {showAnswers && question.explanation && (
                <>
                  <Separator />
                  <div className="bg-primary/5 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary">Explanation</span>
                    </div>
                    <div 
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: question.explanation }}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};