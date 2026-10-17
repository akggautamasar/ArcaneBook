// HtmlUploader removed — file hosting now handled via Telegram channel.
// Quizzes saved via "Generate & Save" are automatically stored in Telegram.
import { Card, CardContent } from '@/components/ui/card';
import { Send } from 'lucide-react';

const HtmlUploader = () => (
  <Card className="border-dashed">
    <CardContent className="py-12 text-center space-y-3">
      <Send className="h-10 w-10 text-primary mx-auto" />
      <h3 className="font-semibold text-lg">Files stored on Telegram</h3>
      <p className="text-muted-foreground max-w-sm mx-auto">
        Use the <strong>Generate &amp; Save</strong> button to save your quiz directly to your Telegram channel.
        All quizzes appear in the <strong>My Tests</strong> tab.
      </p>
    </CardContent>
  </Card>
);

export default HtmlUploader;
