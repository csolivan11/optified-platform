import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InDevelopmentNoticeProps {
  title?: string;
  description?: string;
  expectedRelease?: string;
}

/**
 * Used on PHI-deferred tabs (Bloodwork, Specialty Testing, document upload).
 * Reads as a product roadmap feature rather than an error.
 */
export function InDevelopmentNotice({
  title = "In active development",
  description = "This capability is in our engineering roadmap. Your coach has full access to your results and will continue to discuss them with you directly until the feature launches.",
  expectedRelease,
}: InDevelopmentNoticeProps) {
  return (
    <Card className="border-accent/30 bg-gradient-to-br from-card to-accent/5">
      <CardContent className="p-10">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-md bg-accent/15 flex items-center justify-center">
            <Sparkles size={18} className="text-accent" />
          </div>
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-h3">{title}</h3>
              {expectedRelease && (
                <Badge variant="accent">{expectedRelease}</Badge>
              )}
            </div>
            <p className="text-body text-muted-foreground max-w-xl">
              {description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
