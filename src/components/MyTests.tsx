import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { listQuizzes, deleteQuiz, getQuizHtml, type QuizMeta } from '@/lib/telegram';
import { FileText, Download, HelpCircle, Calendar, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';

export const MyTests: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [quizFiles, setQuizFiles] = useState<QuizMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchQuizFiles(); }, [isAuthenticated]);

  const fetchQuizFiles = async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const data = await listQuizzes();
      setQuizFiles(data);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load quizzes from Telegram.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const downloadQuizFile = async (quiz: QuizMeta) => {
    setDownloading(quiz.id);
    try {
      const html = await getQuizHtml(quiz.file_id);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quiz.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'Failed to download quiz.', variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteQuiz(id);
      setQuizFiles(prev => prev.filter(q => q.id !== id));
      toast({ title: 'Deleted', description: 'Quiz removed from Telegram.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete quiz.', variant: 'destructive' });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Sign in to view your saved quizzes.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading from Telegram...</span>
      </div>
    );
  }

  if (quizFiles.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No quizzes yet</h3>
          <p className="text-muted-foreground">Build your first quiz and it will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Saved Quizzes ({quizFiles.length})</h3>
        <Button variant="outline" size="sm" onClick={fetchQuizFiles}>Refresh</Button>
      </div>

      {quizFiles.map(quiz => (
        <Card key={quiz.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate">{quiz.title}</CardTitle>
                {quiz.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{quiz.description}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadQuizFile(quiz)}
                  disabled={downloading === quiz.id}
                >
                  {downloading === quiz.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Download className="h-4 w-4" />}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{quiz.title}" from Telegram. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(quiz.id)} className="bg-destructive text-destructive-foreground">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                {quiz.question_count} questions
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {formatFileSize(quiz.file_size)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(quiz.created_at), { addSuffix: true })}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
