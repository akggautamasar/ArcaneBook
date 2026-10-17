import React, { useEffect, useState } from 'react';
import { listQuizzes, getQuizHtml, type QuizMeta } from '@/lib/telegram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Clock, Search, Play, Award, Loader2, ArrowLeft, Sparkles, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const MockTests = () => {
  const [tests, setTests] = useState<QuizMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'questions' | 'title'>('newest');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('arcane-favorites') || '[]'); } catch { return []; } });
  const toggleFavorite = (id: string) => setFavorites(prev => { const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; localStorage.setItem('arcane-favorites', JSON.stringify(next)); return next; });
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
      // Enhance legacy test documents without changing Telegram-stored originals.
      const companion = `<script>
(function(){
  var quizId = ${JSON.stringify(quiz.id)};
  var key = 'arcane-attempt-' + quizId;
  var historyKey = 'arcane-history';
  function read(k,fallback){try{return JSON.parse(localStorage.getItem(k)||'null')||fallback;}catch(e){return fallback;}}
  function save(){if(typeof test==='undefined'||test.submitted)return;
    try{localStorage.setItem(key,JSON.stringify({answers:test.answers,current:test.current,at:Date.now()}));}catch(e){}
    refresh();
  }
  function refresh(){if(typeof test==='undefined')return;
    var count=Object.keys(test.answers||{}).length;
    var status=document.getElementById('arcane-status');
    if(status)status.textContent=count+' / '+test.questions+' answered';
  }
  function boot(){
    if(typeof test==='undefined'||typeof showQuestion!=='function')return;
    var state=read(key,null);
    if(state&&state.answers&&!test.submitted){
      test.answers=state.answers;
      Object.keys(test.answers).forEach(function(id){
        var card=document.getElementById('q'+id);
        if(!card)return;
        var selected=card.querySelector('.option[data-option="'+test.answers[id]+'"]');
        if(selected)selected.classList.add('selected');
      });
      if(typeof updateNavigation==='function')updateNavigation();
      showQuestion(state.current||1);
    }
    var bar=document.createElement('div');
    bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Exam companion');
    bar.style.cssText='position:fixed;bottom:12px;left:12px;z-index:99999;background:#172554;color:white;padding:10px 12px;border-radius:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font:13px system-ui;box-shadow:0 4px 24px #0004;max-width:calc(100vw - 24px)';
    bar.innerHTML='<strong id="arcane-status"></strong><button type="button" id="arcane-fs">Full screen</button><button type="button" id="arcane-reset">Restart</button>';
    document.body.appendChild(bar);
    Array.from(bar.querySelectorAll('button')).forEach(function(b){b.style.cssText='padding:6px 9px;border-radius:6px;background:white;color:#172554;border:0;font-weight:600'});
    document.getElementById('arcane-fs').onclick=function(){if(document.fullscreenElement)document.exitFullscreen();else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(function(){});};
    document.getElementById('arcane-reset').onclick=function(){if(confirm('Restart this attempt and clear saved answers?')){localStorage.removeItem(key);location.reload();}};
    document.addEventListener('click',function(e){if(e.target.closest('.option,.q-nav-btn,#next-btn,#prev-btn'))setTimeout(save,80);});
    window.addEventListener('beforeunload',save);
    var oldSubmit=window.submitTest;
    if(typeof oldSubmit==='function')window.submitTest=function(){
      oldSubmit.apply(this,arguments);
      if(test.submitted){
        localStorage.removeItem(key);
        var correct=0,incorrect=0,score=0;
        Object.keys(test.correct||{}).forEach(function(id){
          if(test.answers[id]===undefined)return;
          if(test.answers[id]===test.correct[id]){correct++;score+=(test.marks[id]||{}).positive||0;}
          else{incorrect++;score-=(test.marks[id]||{}).negative||0;}
        });
        var history=read(historyKey,[]);
        history.unshift({id:quizId,title:document.title,date:new Date().toISOString(),correct:correct,incorrect:incorrect,unattempted:test.questions-correct-incorrect,score:Math.max(0,score),seconds:test.timeSpent||0});
        try{localStorage.setItem(historyKey,JSON.stringify(history.slice(0,100)));}catch(e){}
      }
    };
    document.addEventListener('keydown',function(e){if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();showQuestion(test.current+(e.key==='ArrowRight'?1:-1));}});
    refresh();setInterval(save,10000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,0);});else setTimeout(boot,0);
})();
<\/script>`;
      const enhancedHtml = html.includes('</body>') ? html.replace('</body>', companion + '</body>') : html;
      const blob = new Blob([enhancedHtml], { type: 'text/html' });
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

  const filtered = tests.filter(t => (!favoritesOnly || favorites.includes(t.id)) && (
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  )).sort((a,b) => sortBy === 'questions' ? b.question_count - a.question_count : sortBy === 'title' ? a.title.localeCompare(b.title) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 py-12 sm:py-16 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="h-10 w-10 text-white" />
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">Mock Test Library</h1>
          </div>
          <p className="text-indigo-100 text-lg max-w-xl mx-auto">Choose a test, challenge yourself and review your performance. Your preparation starts here.</p>
          <div className="relative max-w-xl mx-auto mt-7">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10 bg-white text-slate-900 h-12 rounded-xl border-0 shadow-lg"
              placeholder="Search mock tests by title or description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-7 flex flex-wrap items-center gap-3">
        <SlidersHorizontal className="h-4 w-4 text-slate-500" /><label htmlFor="sort-tests" className="text-sm font-medium">Sort by</label>
        <select id="sort-tests" className="rounded-md border bg-background p-2 text-sm" value={sortBy} onChange={e => setSortBy(e.target.value as 'newest' | 'questions' | 'title')}>
          <option value="newest">Newest first</option><option value="questions">Most questions</option><option value="title">Title A–Z</option>
        </select>
        <Button size="sm" variant={favoritesOnly ? 'default' : 'outline'} onClick={() => setFavoritesOnly(x => !x)} aria-pressed={favoritesOnly}>★ Favorites ({favorites.length})</Button>
        <span className="ml-auto rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-700">{filtered.length} tests available</span>
      </div>
      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(test => (
              <Card key={test.id} className="rounded-2xl border-slate-200 bg-white hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100 transition-all duration-200 group">
                <CardHeader className="pb-3 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5">Mock Test</span><Sparkles className="h-4 w-4 text-indigo-400" /></div>
                  <CardTitle className="text-lg font-bold group-hover:text-indigo-600 transition-colors">
                    {test.title}
                  </CardTitle>
                  {test.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{test.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {test.question_count} Qs
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(test.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" aria-label={favorites.includes(test.id) ? 'Remove favorite' : 'Add favorite'} aria-pressed={favorites.includes(test.id)} onClick={() => toggleFavorite(test.id)}>{favorites.includes(test.id) ? '★' : '☆'}</Button>
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
          <Button variant="outline" className="rounded-xl" onClick={() => navigate('/')}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Home</Button>
        </div>
      </div>
    </div>
  );
};

export default MockTests;
