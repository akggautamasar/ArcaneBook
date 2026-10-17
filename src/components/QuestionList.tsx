import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Edit, Trash2, CheckCircle, FileText } from 'lucide-react';
import type { Question } from './QuizBuilder';

interface QuestionListProps {
  questions: Question[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

export const QuestionList: React.FC<QuestionListProps> = ({
  questions,
  onEdit,
  onDelete
}) => {
  if (questions.length === 0) {
    return (
      <Card className="bg-gradient-card border-card-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Questions Yet</h3>
          <p className="text-muted-foreground text-center">
            Start building your quiz by adding your first question using the Builder tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((question, index) => (
        <Card key={question.id} className="bg-gradient-card border-card-border shadow-glass hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </div>
                <div>
                  <CardTitle className="text-base">Question {index + 1}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {question.section}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      +{question.positiveMarks} / -{question.negativeMarks}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(index)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {question.compText && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Comprehension:</p>
                <div 
                  className="text-sm"
                  dangerouslySetInnerHTML={{ __html: question.compText.substring(0, 150) + (question.compText.length > 150 ? '...' : '') }}
                />
              </div>
            )}
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Question:</p>
              <div 
                className="font-medium"
                dangerouslySetInnerHTML={{ __html: question.questionText.substring(0, 200) + (question.questionText.length > 200 ? '...' : '') }}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Options:</p>
              <div className="grid gap-2">
                {question.options.map((option, optionIndex) => (
                  <div 
                    key={optionIndex}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                      optionIndex === question.correctOptionIndex 
                        ? 'bg-success/10 border border-success/20' 
                        : 'bg-muted/30'
                    }`}
                  >
                    {optionIndex === question.correctOptionIndex && (
                      <CheckCircle className="h-4 w-4 text-success" />
                    )}
                    <span className="font-medium min-w-[20px]">
                      {String.fromCharCode(65 + optionIndex)}.
                    </span>
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: option.substring(0, 100) + (option.length > 100 ? '...' : '') 
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {question.explanation && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Explanation:</p>
                <div 
                  className="text-sm bg-primary/5 p-3 rounded-lg"
                  dangerouslySetInnerHTML={{ 
                    __html: question.explanation.substring(0, 150) + (question.explanation.length > 150 ? '...' : '') 
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};