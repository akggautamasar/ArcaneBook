import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, Settings } from 'lucide-react';

const UserTypeSelection = () => {
  const navigate = useNavigate();

  const handleStudentAccess = () => {
    navigate('/mock-tests');
  };

  const handleAdminAccess = () => {
    navigate('/password-protected');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary mb-2">Welcome</h1>
          <p className="text-muted-foreground">Please select your access type</p>
        </div>
        
        <div className="space-y-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleStudentAccess}>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 p-3 bg-primary/10 rounded-full w-fit">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Student</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Access mock tests and practice quizzes
              </p>
              <Button className="w-full">
                Continue as Student
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleAdminAccess}>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 p-3 bg-secondary/10 rounded-full w-fit">
                <Settings className="h-8 w-8 text-secondary" />
              </div>
              <CardTitle className="text-xl">Admin</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Create and manage quiz content
              </p>
              <Button variant="secondary" className="w-full">
                Continue as Admin
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserTypeSelection;