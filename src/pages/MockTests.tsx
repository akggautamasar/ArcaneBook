import React, { useEffect, useState } from 'react';
import { listQuizzes, getQuizHtml, type QuizMeta } from '@/lib/telegram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Clock, Search, Play, Award, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const MockTests = () => {
  const [tests, setTests] = useState<QuizMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [launching, setLaunching] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { fetchTests(); }, []);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const data = await listQuizzes();
      setTests(data);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not load tests from Telegram.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Launch quiz by fetching HTML and opening in new tab
  const launchQuiz = async (quiz: QuizMeta) => {
    setLaunching(quiz.id);
    try {
      const html = await getQuizHtml(quiz.file_id);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load quiz.', variant: 'destructive' });
    } finally {
      setLaunching(null);
    }
  };

  const filtered = tests.filter(t =>
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-primary/80 to-primary py-12 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="h-10 w-10 text-white" />
            <h1 className="text-4xl font-bold text-white">Mock Tests</h1>
          </div>
          <p className="text-white/80 text-lg">Practice and sharpen your skills</p>
          <div className="relative max-w-md mx-auto mt-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10 bg-white/90"
              placeholder="Search tests..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading from Telegram...</span>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">
                {searchTerm ? 'No matching tests' : 'No tests available yet'}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try a different search term.' : 'Ask your admin to upload quizzes.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(test => (
              <Card key={test.id} className="hover:shadow-lg transition-all duration-200 group">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base group-hover:text-primary transition-colors">
                    {test.title}
                  </CardTitle>
                  {test.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{test.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {test.question_count} Qs
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(test.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => launchQuiz(test)}
                      disabled={launching === test.id}
                      className="gap-1"
                    >
                      {launching === test.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Play className="h-3.5 w-3.5" />}
                      Start
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center mt-8">
          <Button variant="outline" onClick={() => navigate('/')}>← Back to Home</Button>
        </div>
      </div>
    </div>
  );
};

export default MockTests;
