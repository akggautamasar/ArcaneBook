import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Clock, ArrowLeft, ArrowRight, CheckCircle, Menu, Flag, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  html_content: string;
  question_count: number;
}

const QuizTaker = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(2700); // 45 minutes
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [showNavigationSheet, setShowNavigationSheet] = useState(false);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    if (quizId) {
      fetchQuiz();
    }
  }, [quizId]);

  useEffect(() => {
    if (!submitted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !submitted) {
      handleSubmit();
    }
  }, [timeLeft, submitted]);

  const fetchQuiz = async () => {
    try {
      const { data: quizData, error } = await supabase
        .from('quiz_files')
        .select('*')
        .eq('id', quizId)
        .single();

      if (error) throw error;

      setQuiz(quizData);
      parseQuestions(quizData.html_content);
    } catch (error) {
      console.error('Error fetching quiz:', error);
      toast({
        title: "Error",
        description: "Failed to load quiz",
        variant: "destructive",
      });
      navigate('/mock-tests');
    } finally {
      setLoading(false);
    }
  };

  const parseQuestions = (htmlContent: string) => {
    console.log('Starting to parse HTML content');
    console.log('HTML content length:', htmlContent.length);
    
    // Parse HTML content to extract questions with improved parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Try multiple selectors to find questions
    let questionCards = doc.querySelectorAll('.q-card');
    if (questionCards.length === 0) {
      questionCards = doc.querySelectorAll('.question-card, .quiz-question, [class*="question"]');
    }
    
    console.log('Found question cards:', questionCards.length);
    
    const parsedQuestions: Question[] = [];
    
    // First, try to extract answers and explanations from script tags
    const scriptElements = doc.querySelectorAll('script');
    let correctAnswersMap: { [key: string]: number } = {};
    let explanationsMap: { [key: string]: string } = {};
    
    scriptElements.forEach((script, scriptIndex) => {
      const scriptContent = script.textContent || '';
      console.log(`Script ${scriptIndex} content (first 500 chars):`, scriptContent.substring(0, 500));
      
      // Enhanced parsing for different answer formats
      
      // Pattern 1: correctAnswers = {q1: 2, q2: 0, ...}
      const correctAnswersMatch = scriptContent.match(/correctAnswers\s*[=:]\s*\{([^}]+)\}/s);
      if (correctAnswersMatch) {
        console.log('Found correctAnswers object:', correctAnswersMatch[1]);
        const correctAnswersText = correctAnswersMatch[1];
        // Handle both quoted and unquoted keys
        const pairs = correctAnswersText.match(/["']?q\d+["']?\s*[=:]\s*\d+/g);
        if (pairs) {
          pairs.forEach(pair => {
            const match = pair.match(/["']?(q\d+)["']?\s*[=:]\s*(\d+)/);
            if (match) {
              correctAnswersMap[match[1]] = parseInt(match[2]);
            }
          });
        }
      }
      
      // Pattern 2: answers = [2, 0, 1, 3, ...]
      const answerArrayMatch = scriptContent.match(/(?:answers|correctAnswers)\s*=\s*\[([^\]]+)\]/);
      if (answerArrayMatch) {
        console.log('Found answers array:', answerArrayMatch[1]);
        const answers = answerArrayMatch[1].split(',').map(a => {
          const cleaned = a.trim().replace(/['"]/g, '');
          const num = parseInt(cleaned);
          return isNaN(num) ? 0 : num;
        });
        console.log('Parsed answers array:', answers);
        
        // Store answers by index (0-based)
        answers.forEach((answer, index) => {
          correctAnswersMap[`q${index}`] = answer;
        });
      }
      
      // Pattern 3: const correct = {q1: 2, q2: 0, ...}
      const correctVarMatch = scriptContent.match(/(?:const|var|let)\s+correct\s*=\s*\{([^}]+)\}/s);
      if (correctVarMatch) {
        console.log('Found correct variable:', correctVarMatch[1]);
        const correctText = correctVarMatch[1];
        const pairs = correctText.match(/["']?q\d+["']?\s*[=:]\s*\d+/g);
        if (pairs) {
          pairs.forEach(pair => {
            const match = pair.match(/["']?(q\d+)["']?\s*[=:]\s*(\d+)/);
            if (match) {
              correctAnswersMap[match[1]] = parseInt(match[2]);
            }
          });
        }
      }
      
      // Pattern 4: Individual assignments like q1_correct = 2
      const individualMatches = scriptContent.match(/(q\d+)(?:_correct|_answer)\s*=\s*(\d+)/g);
      if (individualMatches) {
        individualMatches.forEach(match => {
          const parsed = match.match(/(q\d+)(?:_correct|_answer)\s*=\s*(\d+)/);
          if (parsed) {
            correctAnswersMap[parsed[1]] = parseInt(parsed[2]);
          }
        });
      }
      
      // Pattern 5: Look for explanations
      const explanationsMatch = scriptContent.match(/explanations\s*[=:]\s*\{([^}]+)\}/s);
      if (explanationsMatch) {
        console.log('Found explanations object');
        const explanationsText = explanationsMatch[1];
        // Parse explanations with proper quote handling
        const explanationPairs = explanationsText.match(/["']?q\d+["']?\s*[=:]\s*["']([^"']+)["']/g);
        if (explanationPairs) {
          explanationPairs.forEach(pair => {
            const match = pair.match(/["']?(q\d+)["']?\s*[=:]\s*["']([^"']+)["']/);
            if (match) {
              explanationsMap[match[1]] = match[2];
            }
          });
        }
      }
      
      // Pattern 6: Look for explanations array
      const explanationArrayMatch = scriptContent.match(/explanations\s*=\s*\[([^\]]+)\]/s);
      if (explanationArrayMatch) {
        console.log('Found explanations array');
        const explanationsStr = explanationArrayMatch[1];
        // Split by quotes and commas, handling nested quotes
        const explanations = explanationsStr.split(/["'],\s*["']/).map(exp => 
          exp.replace(/^["']|["']$/g, '').trim()
        );
        explanations.forEach((explanation, index) => {
          if (explanation && explanation !== '') {
            explanationsMap[`q${index}`] = explanation;
          }
        });
      }
    });
    
    console.log('Extracted correct answers map:', correctAnswersMap);
    
    questionCards.forEach((card, index) => {
      console.log(`Processing question ${index}`);
      
      // Try multiple selectors for question text
      let questionTextElement = card.querySelector('.q-text');
      if (!questionTextElement) {
        questionTextElement = card.querySelector('.question-text, .question, h3, h4, .title');
      }
      
      // Try multiple selectors for options
      let optionElements = card.querySelectorAll('.option .option-text');
      if (optionElements.length === 0) {
        optionElements = card.querySelectorAll('.option-text, .answer-option, .choice, .option label, .option span');
      }
      if (optionElements.length === 0) {
        optionElements = card.querySelectorAll('input[type="radio"] + label, .option');
      }
      
      if (questionTextElement && optionElements.length > 0) {
        const questionText = questionTextElement.textContent?.trim() || '';
        const options = Array.from(optionElements).map(opt => opt.textContent?.trim() || '').filter(opt => opt.length > 0);
        
        console.log(`Question ${index} text:`, questionText.substring(0, 50) + '...');
        console.log(`Question ${index} options:`, options);
        
        // Try to find correct answer
        const cardId = card.getAttribute('id');
        let correctAnswer = 0;
        let explanation = '';
        
        // Method 1: Use extracted answers from scripts
        if (correctAnswersMap[`q${index}`] !== undefined) {
          correctAnswer = correctAnswersMap[`q${index}`];
          console.log(`Found correct answer from script for q${index}:`, correctAnswer);
        } else if (cardId && correctAnswersMap[cardId]) {
          correctAnswer = correctAnswersMap[cardId];
          console.log(`Found correct answer from script for ${cardId}:`, correctAnswer);
        } else {
          // Method 2: Look for data attributes
          const correctAttr = card.getAttribute('data-correct') || 
                            card.getAttribute('data-answer') || 
                            card.getAttribute('correct-answer');
          if (correctAttr) {
            correctAnswer = parseInt(correctAttr);
            console.log(`Found correct answer from data attribute:`, correctAnswer);
          } else {
            // Method 3: Look for correct option marked in HTML
            const correctOption = card.querySelector('.correct, .answer-correct, [data-correct="true"]');
            if (correctOption) {
              const allOptions = card.querySelectorAll('.option');
              const correctIndex = Array.from(allOptions).indexOf(correctOption.closest('.option') || correctOption);
              if (correctIndex >= 0) {
                correctAnswer = correctIndex;
                console.log(`Found correct answer from HTML markup:`, correctAnswer);
              }
            }
          }
        }

        // Try to find explanation
        if (explanationsMap[`q${index}`]) {
          explanation = explanationsMap[`q${index}`];
          console.log(`Found explanation from script for q${index}:`, explanation);
        } else {
          const explanationElement = card.querySelector('.explanation, .answer-explanation, .q-explanation');
          if (explanationElement) {
            explanation = explanationElement.textContent?.trim() || '';
            console.log(`Found explanation from HTML for q${index}:`, explanation);
          }
        }
        
        console.log(`Final correct answer for question ${index}:`, correctAnswer);
        
        if (options.length > 0) {
          parsedQuestions.push({
            id: `q${index}`,
            question: questionText,
            options,
            correct_answer: Math.max(0, correctAnswer), // Ensure non-negative
            explanation: explanation || 'No explanation available'
          });
        }
      }
    });

    console.log('Total parsed questions:', parsedQuestions.length);
    console.log('All questions with correct answers:', parsedQuestions.map(q => ({ id: q.id, correct: q.correct_answer })));

    if (parsedQuestions.length > 0) {
      setQuestions(parsedQuestions);
    } else {
      // Fallback: create dummy questions for testing
      console.log('No questions parsed, using fallback');
      const dummyQuestions: Question[] = [
        {
          id: 'q1',
          question: 'What is the capital of France?',
          options: ['London', 'Berlin', 'Paris', 'Madrid'],
          correct_answer: 2,
          explanation: 'Paris is the capital and largest city of France.'
        },
        {
          id: 'q2',
          question: 'Which planet is closest to the Sun?',
          options: ['Venus', 'Mercury', 'Earth', 'Mars'],
          correct_answer: 1,
          explanation: 'Mercury is the closest planet to the Sun in our solar system.'
        }
      ];
      setQuestions(dummyQuestions);
    }
  };

  const handleAnswer = (questionIndex: number, answerIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  const toggleFlag = (questionIndex: number) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionIndex)) {
        newSet.delete(questionIndex);
      } else {
        newSet.add(questionIndex);
      }
      return newSet;
    });
  };

  const clearAnswer = (questionIndex: number) => {
    setAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[questionIndex];
      return newAnswers;
    });
  };

  const jumpToQuestion = (questionIndex: number) => {
    setCurrentQuestion(questionIndex);
    setShowNavigationSheet(false);
  };

  const handleSubmit = () => {
    let correctAnswers = 0;
    questions.forEach((question, index) => {
      if (answers[index] === question.correct_answer) {
        correctAnswers++;
      }
    });
    
    setScore(correctAnswers);
    setSubmitted(true);
    
    toast({
      title: "Quiz Submitted!",
      description: `You scored ${correctAnswers}/${questions.length}`,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading quiz...</div>
      </div>
    );
  }

  if (submitted && !showReview) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-success/10 rounded-full w-fit">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-2xl">Quiz Completed!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div>
              <p className="text-3xl font-bold text-primary">{score}/{questions.length}</p>
              <p className="text-muted-foreground">Correct Answers</p>
            </div>
            <div>
              <p className="text-lg">{Math.round((score / questions.length) * 100)}%</p>
              <p className="text-muted-foreground">Success Rate</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setShowReview(true)} variant="outline" className="w-full">
                Review Answers
              </Button>
              <Button onClick={() => navigate('/mock-tests')} className="w-full">
                Back to Mock Tests
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted && showReview) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-primary text-primary-foreground p-4">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowReview(false)}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Quiz Review</h1>
                <p className="text-primary-foreground/80">
                  Score: {score}/{questions.length} ({Math.round((score / questions.length) * 100)}%)
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto p-4 space-y-6">
          {questions.map((question, index) => {
            const userAnswer = answers[index];
            const isCorrect = userAnswer === question.correct_answer;
            
            return (
              <Card key={index} className={`border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Question {index + 1}
                    {isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                        <span className="text-white text-xs">✕</span>
                      </div>
                    )}
                  </CardTitle>
                  <p className="text-base">{question.question}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div 
                        key={optionIndex} 
                        className={`p-3 rounded-lg border ${
                          optionIndex === question.correct_answer 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : optionIndex === userAnswer && !isCorrect
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-background border-border'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {optionIndex === question.correct_answer && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                          {optionIndex === userAnswer && !isCorrect && (
                            <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                              <span className="text-white text-xs">✕</span>
                            </div>
                          )}
                          <span className="font-medium">
                            {optionIndex === question.correct_answer ? 'Correct: ' : 
                             optionIndex === userAnswer ? 'Your answer: ' : ''}
                            {option}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {question.explanation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="font-medium text-blue-800 mb-1">Explanation:</p>
                      <p className="text-blue-700">{question.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          
          <div className="text-center pt-4">
            <Button onClick={() => navigate('/mock-tests')} className="w-full max-w-md">
              Back to Mock Tests
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/mock-tests')}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{quiz?.title}</h1>
              <p className="text-primary-foreground/80">
                Question {currentQuestion + 1} of {questions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-mono">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4">
        {/* Progress and Controls */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1">
            <Progress 
              value={((currentQuestion + 1) / questions.length) * 100} 
              className="h-2"
            />
            <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
              <span>Question {currentQuestion + 1} of {questions.length}</span>
              <span>{Object.keys(answers).length} answered</span>
            </div>
          </div>
          
          {/* Navigation Sheet */}
          <Sheet open={showNavigationSheet} onOpenChange={setShowNavigationSheet}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="ml-4">
                <Menu className="h-4 w-4" />
                Questions
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Question Navigation</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-5 gap-2 mt-4">
                {questions.map((_, index) => (
                  <Button
                    key={index}
                    variant={currentQuestion === index ? "default" : answers[index] !== undefined ? "secondary" : "outline"}
                    size="sm"
                    className={`relative ${flaggedQuestions.has(index) ? 'ring-2 ring-yellow-500' : ''}`}
                    onClick={() => jumpToQuestion(index)}
                  >
                    {index + 1}
                    {flaggedQuestions.has(index) && (
                      <Flag className="h-3 w-3 absolute -top-1 -right-1 text-yellow-500" />
                    )}
                  </Button>
                ))}
              </div>
              <div className="mt-6 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-primary rounded"></div>
                  <span>Current Question</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-secondary rounded"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border border-border rounded"></div>
                  <span>Not Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-yellow-500" />
                  <span>Flagged</span>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Question */}
        {questions.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg flex-1">
                  {questions[currentQuestion].question}
                </CardTitle>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleFlag(currentQuestion)}
                    className={flaggedQuestions.has(currentQuestion) ? 'text-yellow-600 border-yellow-600' : ''}
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                  {answers[currentQuestion] !== undefined && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => clearAnswer(currentQuestion)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={answers[currentQuestion]?.toString() || ""}
                onValueChange={(value) => handleAnswer(currentQuestion, parseInt(value))}
              >
                {questions[currentQuestion].options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent/50">
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Navigation and Submit */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
              disabled={currentQuestion === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            <Button
              onClick={() => setCurrentQuestion(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentQuestion === questions.length - 1}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          
          <Button 
            onClick={handleSubmit}
            variant={currentQuestion === questions.length - 1 ? "default" : "secondary"}
            className="sm:w-auto w-full"
          >
            Submit Quiz
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuizTaker;