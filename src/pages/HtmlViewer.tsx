import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff } from 'lucide-react';

const HtmlViewer = () => {
  const { filename } = useParams<{ filename: string }>();
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const checkPasswordProtection = async () => {
      if (!filename) {
        setError('No filename provided');
        setLoading(false);
        return;
      }

      try {
        // Check if this file is password protected
        const { data: protectedFile, error: protectedError } = await supabase
          .from('protected_html_files')
          .select('filename')
          .eq('filename', filename)
          .single();

        if (protectedFile && !protectedError) {
          setIsPasswordProtected(true);
          setLoading(false);
          return;
        }

        // If not password protected, load normally
        await loadHtmlFile();
      } catch (err) {
        console.error('Error checking password protection:', err);
        await loadHtmlFile(); // Try to load normally if check fails
      }
    };

    checkPasswordProtection();
  }, [filename]);

  const loadHtmlFile = async () => {
    if (!filename) {
      setError('No filename provided');
      setLoading(false);
      return;
    }

    try {
      // Add .html extension if not present
      const fullFilename = filename.endsWith('.html') ? filename : `${filename}.html`;
      
      // Download the file from storage
      const { data, error: downloadError } = await supabase.storage
        .from('html-files')
        .download(fullFilename);

      if (downloadError) {
        throw downloadError;
      }

      // Convert blob to text
      const text = await data.text();
      setHtmlContent(text);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error loading HTML file:', err);
      setError('File not found or unable to load');
    } finally {
      setLoading(false);
    }
  };

  const verifyPassword = async () => {
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('verify-html-password', {
        body: {
          filename: filename,
          password: password
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        await loadHtmlFile();
        setPassword(''); // Clear password from memory
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      console.error('Password verification error:', err);
      setError('Invalid password');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      verifyPassword();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg text-foreground">Loading...</div>
      </div>
    );
  }

  if (isPasswordProtected && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Password Protected</CardTitle>
            <CardDescription>
              This HTML file is password protected. Please enter the password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button
              onClick={verifyPassword}
              disabled={isVerifying || !password.trim()}
              className="w-full"
            >
              {isVerifying ? 'Verifying...' : 'Access File'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-foreground">File Not Found</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full min-h-screen"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default HtmlViewer;