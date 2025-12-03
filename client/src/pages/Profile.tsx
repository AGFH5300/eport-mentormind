import { MentorNavbar } from "@/components/layout/MentorNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";

const mentorTopics = ["Application guidance", "Subject choices", "Career advice", "Interview prep"];
const studentInterests = ["AI & Robotics", "Healthcare", "Social impact"];

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MentorNavbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="rounded-3xl bg-card shadow-sm border border-border/70 p-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Profile</p>
          <h1 className="text-3xl font-semibold">{user?.full_name || "Your profile"}</h1>
          <p className="text-muted-foreground max-w-2xl">
            Keep your mentorship details up to date so students can understand your expertise and availability.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Student overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-semibold">{user?.full_name || "Student"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Grade</p>
                <p className="font-semibold">Upper secondary</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interests</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {studentInterests.map((interest) => (
                    <Badge key={interest} variant="secondary" className="rounded-full">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mentorship goals</p>
                <p className="text-sm text-foreground">
                  Clarify university pathways, build a focused project portfolio, and prepare for scholarship applications.
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Past sessions</p>
                <p className="text-sm text-foreground">4 completed sessions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Mentor profile</CardTitle>
                <p className="text-sm text-muted-foreground">Visible to students</p>
              </div>
              <Button variant="outline" className="rounded-full">Edit mentor profile</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">University</p>
                <p className="font-semibold">University of Example</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Course</p>
                <p className="font-semibold">Engineering</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Industry / Field</p>
                <p className="font-semibold">Technology & Product</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Topics you can help with</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {mentorTopics.map((topic) => (
                    <Badge key={topic} variant="secondary" className="rounded-full">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Availability</p>
                <p className="text-sm text-foreground">Weekly slots: Tue & Thu evenings (GMT)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
