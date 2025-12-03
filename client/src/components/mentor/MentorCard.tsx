import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { GraduationCap, MapPin, Sparkles } from "lucide-react";

export interface Mentor {
  id: string;
  name: string;
  university: string;
  course: string;
  field: string;
  bio: string;
  topics: string[];
}

interface MentorCardProps {
  mentor: Mentor;
  onRequest?: (mentor: Mentor) => void;
  className?: string;
}

export function MentorCard({ mentor, onRequest, className }: MentorCardProps) {
  return (
    <Card className={cn("h-full border-border/70 shadow-sm bg-card/90", className)}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{mentor.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{mentor.field}</p>
          </div>
          <Badge variant="outline" className="rounded-full text-xs px-3 py-1">
            {mentor.course}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            {mentor.university}
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {mentor.course}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{mentor.bio}</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            Mentoring topics
          </div>
          <div className="flex flex-wrap gap-2">
            {mentor.topics.map((topic) => (
              <Badge key={topic} variant="secondary" className="rounded-full">
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
      <Separator className="bg-border/70" />
      <CardFooter className="pt-4 flex justify-between items-center">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="rounded-full">{mentor.field}</Badge>
          <Badge variant="outline" className="rounded-full">{mentor.university}</Badge>
        </div>
        <Button onClick={() => onRequest?.(mentor)} className="rounded-full">
          Request mentorship
        </Button>
      </CardFooter>
    </Card>
  );
}
