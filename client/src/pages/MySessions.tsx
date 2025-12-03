import { MentorNavbar } from "@/components/layout/MentorNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Star, Timer } from "lucide-react";

const activeSessions = [
  {
    id: "s1",
    mentor: "Amelia Johnson",
    field: "Engineering & CS",
    lastMessage: "Let's review your project outline before Thursday.",
  },
  {
    id: "s2",
    mentor: "Dr. Rahul Mehta",
    field: "Medicine & Health",
    lastMessage: "Sharing the research template you asked for.",
  },
];

const pastSessions = [
  {
    id: "p1",
    mentor: "Sofia Alvarez",
    summary: "Completed case interview prep and networking plan.",
  },
  {
    id: "p2",
    mentor: "Marcus Lee",
    summary: "Reviewed law school applications and personal statement.",
  },
];

export default function MySessions() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MentorNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="rounded-3xl bg-card shadow-sm border border-border/70 p-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">My mentorships</p>
          <h1 className="text-3xl font-semibold">Mentorship Sessions</h1>
          <p className="text-muted-foreground max-w-2xl">
            Continue active mentorships or review completed sessions and share feedback.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-primary" /> Active mentorships
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 rounded-2xl border border-border/70 bg-muted/40 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{session.mentor}</p>
                      <p className="text-sm text-muted-foreground">{session.field}</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      In progress
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Last note: {session.lastMessage}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-full">Continue Session</Button>
                    <Button size="sm" variant="outline" className="rounded-full">
                      View plan
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Timer className="w-5 h-5 text-primary" /> Past mentorships
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pastSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 rounded-2xl border border-border/70 bg-muted/40 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{session.mentor}</p>
                      <p className="text-sm text-muted-foreground">Completed mentorship</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">Completed</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{session.summary}</p>
                  <Separator className="bg-border/60" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="rounded-full">
                      View conversation history
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full">
                      <Star className="w-4 h-4 mr-2" /> Leave feedback
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
