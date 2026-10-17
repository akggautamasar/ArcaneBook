import React from 'react';
import { QuizBuilder } from '@/components/QuizBuilder';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { BookOpen, Sparkles, Users, Zap, LogOut, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { signOut, isMaster } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-primary via-primary/80 to-primary">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
        <div className="relative max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Air<span className="text-yellow-300">Book</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/mock-tests')}
                className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <GraduationCap className="h-4 w-4" />
                Mock Tests
              </Button>
              {isMaster && (
                <span className="text-xs bg-yellow-400/20 text-yellow-200 px-2 py-1 rounded-full border border-yellow-400/30">
                  Master
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="relative bg-gradient-to-r from-primary via-primary/80 to-primary pb-8">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
        <div className="relative max-w-7xl mx-auto px-4 pt-8 sm:px-6 lg:px-8 text-center space-y-6">
          <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
            Create professional HTML quiz files with our advanced quiz builder.
            Perfect for educators, trainers, and content creators.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-white/80">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5" />
              <span>Smart Question Builder</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Bulk Import Support</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>Telegram Storage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <QuizBuilder />
      </div>
    </div>
  );
};

export default Index;
