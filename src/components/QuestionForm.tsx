import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Save, RotateCcw, Image } from 'lucide-react';
import type { Question } from './QuizBuilder';

interface QuestionFormProps {
  currentQuestion: Question;
  setCurrentQuestion: React.Dispatch<React.SetStateAction<Question>>;
  onSave: () => void;
  onReset: () => void;
  isEditing: boolean;
}

export const QuestionForm: React.FC<QuestionFormProps> = ({
  currentQuestion,
  setCurrentQuestion,
  onSave,
  onReset,
  isEditing
}) => {
  const handleChange = (field: keyof Question, value: any) => {
    setCurrentQuestion(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const handleOptionImageChange = (index: number, value: string) => {
    const newOptionImages = [...(currentQuestion.optionImages || [])];
    // Ensure the array is the same length as options
    while (newOptionImages.length < currentQuestion.options.length) {
      newOptionImages.push('');
    }
    newOptionImages[index] = value;
    setCurrentQuestion(prev => ({ ...prev, optionImages: newOptionImages }));
  };

  const addOption = () => {
    setCurrentQuestion(prev => ({ 
      ...prev, 
      options: [...prev.options, ''],
      optionImages: [...(prev.optionImages || []), '']
    }));
  };

  const removeOption = (index: number) => {
    if (currentQuestion.options.length <= 2) return;
    const newOptions = currentQuestion.options.filter((_, i) => i !== index);
    const newOptionImages = (currentQuestion.optionImages || []).filter((_, i) => i !== index);
    setCurrentQuestion(prev => ({ 
      ...prev, 
      options: newOptions,
      optionImages: newOptionImages,
      correctOptionIndex: prev.correctOptionIndex >= index && prev.correctOptionIndex > 0 
        ? prev.correctOptionIndex - 1 
        : prev.correctOptionIndex
    }));
  };

  const insertImage = (field: 'questionText' | 'explanation') => {
    const url = prompt('Enter image URL:');
    if (url) {
      const imgTag = `<img src="${url}" alt="Image" style="max-width:100%; height:auto; border-radius:8px; margin: 8px 0; display: block;" />`;
      const currentValue = currentQuestion[field];
      setCurrentQuestion(prev => ({ ...prev, [field]: currentValue + imgTag }));
    }
  };

  return (
    <Card className="bg-gradient-card border-card-border shadow-glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEditing ? 'Edit Question' : 'Add New Question'}
        </CardTitle>
        <CardDescription>
          {isEditing ? 'Update the question details below' : 'Create a new question for your quiz'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comprehension Text */}
        <div className="space-y-2">
          <Label htmlFor="compText">Comprehension Text (Optional)</Label>
          <Textarea
            id="compText"
            value={currentQuestion.compText}
            onChange={(e) => handleChange('compText', e.target.value)}
            placeholder="Add any passage or context that applies to this question..."
            className="min-h-[80px] bg-background/50"
          />
        </div>

        {/* Question Text */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="questionText">Question Text *</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertImage('questionText')}
            >
              <Image className="h-4 w-4" />
              Add Image
            </Button>
          </div>
          <Textarea
            id="questionText"
            value={currentQuestion.questionText}
            onChange={(e) => handleChange('questionText', e.target.value)}
            placeholder="Enter your question here..."
            className="min-h-[100px] bg-background/50"
            required
          />
        </div>

        {/* Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Answer Options *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOption}
            >
              <Plus className="h-4 w-4" />
              Add Option
            </Button>
          </div>
          
          <div className="space-y-4">
            {currentQuestion.options.map((option, index) => (
              <div key={index} className="space-y-2 p-3 border border-border rounded-lg bg-background/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={currentQuestion.correctOptionIndex === index}
                      onChange={() => handleChange('correctOptionIndex', index)}
                      className="text-primary"
                    />
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1} text`}
                      className="bg-background/50"
                      required
                    />
                  </div>
                  {currentQuestion.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(index)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {/* Option Image */}
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={currentQuestion.optionImages?.[index] || ''}
                    onChange={(e) => handleOptionImageChange(index, e.target.value)}
                    placeholder={`Option ${index + 1} image URL (optional)`}
                    className="bg-background/50 text-sm"
                  />
                </div>
                
                {/* Preview image if URL is provided */}
                {currentQuestion.optionImages?.[index] && (
                  <div className="mt-2">
                    <img 
                      src={currentQuestion.optionImages[index]} 
                      alt={`Option ${index + 1}`}
                      className="max-w-32 max-h-32 object-contain border border-border rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Settings Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="section">Section</Label>
            <Input
              id="section"
              value={currentQuestion.section}
              onChange={(e) => handleChange('section', e.target.value)}
              placeholder="Test"
              className="bg-background/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="positiveMarks">Positive Marks</Label>
            <Input
              id="positiveMarks"
              type="number"
              value={currentQuestion.positiveMarks}
              onChange={(e) => handleChange('positiveMarks', parseInt(e.target.value) || 0)}
              className="bg-background/50"
              min="0"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="negativeMarks">Negative Marks</Label>
            <Input
              id="negativeMarks"
              type="number"
              value={currentQuestion.negativeMarks}
              onChange={(e) => handleChange('negativeMarks', parseInt(e.target.value) || 0)}
              className="bg-background/50"
              min="0"
            />
          </div>
        </div>

        {/* Explanation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="explanation">Explanation (Optional)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertImage('explanation')}
            >
              <Image className="h-4 w-4" />
              Add Image
            </Button>
          </div>
          <Textarea
            id="explanation"
            value={currentQuestion.explanation}
            onChange={(e) => handleChange('explanation', e.target.value)}
            placeholder="Provide an explanation for the correct answer..."
            className="min-h-[80px] bg-background/50"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button onClick={onSave} className="flex-1" variant="default">
            <Save className="h-4 w-4" />
            {isEditing ? 'Update Question' : 'Add Question'}
          </Button>
          <Button onClick={onReset} variant="outline">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};