import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, ShieldCheck, ArrowRight, Trophy, Timer, BarChart3, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const benefits = [
  { icon: Timer, title: 'Exam-like practice', text: 'Timed tests and focused question navigation.' },
  { icon: Trophy, title: 'Instant results', text: 'Understand your score and learn from mistakes.' },
  { icon: BarChart3, title: 'Track your progress', text: 'Keep improving with every practice session.' },
];

export default function UserTypeSelection() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
            <span className="rounded-xl bg-indigo-600 p-2 text-white"><BookOpen className="h-5 w-5" /></span>
            Arcane<span className="text-indigo-600">Book</span>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => navigate('/password-protected')}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Admin login
          </Button>
        </div>
      </header>
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.13),_transparent_55%)]" />
          <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-14 sm:pt-24 sm:pb-20 grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
                <Sparkles className="h-4 w-4" /> Your exam preparation workspace
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight leading-[1.13] sm:text-5xl lg:text-6xl">
                Practice smarter.<br /><span className="text-indigo-600">Perform better.</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-slate-600">
                Prepare with exam-style mock tests, timed practice and detailed answer review — all in one place.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-7" onClick={() => navigate('/mock-tests')}>
                  Explore mock tests <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="rounded-xl" onClick={() => navigate('/password-protected')}>
                  Create a test
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Free practice</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Mobile friendly</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Instant feedback</span>
              </div>
            </div>
            <div className="rounded-[2rem] border border-indigo-100 bg-white p-5 sm:p-7 shadow-2xl shadow-indigo-100/70">
              <div className="flex items-center justify-between border-b pb-5">
                <div><p className="text-xs uppercase font-bold tracking-widest text-indigo-600">Student dashboard</p><h2 className="mt-1 text-xl font-bold">Ready for your next test?</h2></div>
                <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><GraduationCap className="h-7 w-7" /></div>
              </div>
              <div className="mt-6 space-y-4">
                {benefits.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <div className="rounded-xl bg-white p-3 text-indigo-600 shadow-sm"><Icon className="h-5 w-5" /></div>
                    <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-slate-600">{text}</p></div>
                  </div>
                ))}
              </div>
              <Button className="mt-6 w-full rounded-xl bg-slate-900 hover:bg-slate-800" size="lg" onClick={() => navigate('/mock-tests')}>
                Start practicing <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-10 text-center text-sm text-slate-500">ArcaneBook · Learn, practice, improve.</div>
        </section>
      </main>
    </div>
  );
}
