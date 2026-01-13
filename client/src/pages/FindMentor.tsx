import { useMemo, useState } from "react";
import { Mentor, MentorCard } from "@/components/mentor/MentorCard";
import { MentorNavbar } from "@/components/layout/MentorNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const mentors: Mentor[] = [
  {
    id: "1",
    name: "Amelia Johnson",
    university: "Stanford University",
    course: "Computer Science",
    field: "Engineering & CS",
    bio: "Product engineer helping students translate coursework into portfolio-ready projects.",
    topics: ["Application guidance", "Internships", "Technical interviews", "Career advice"],
  },
  {
    id: "2",
    name: "Dr. Rahul Mehta",
    university: "University of Toronto",
    course: "Biomedical Engineering",
    field: "Medicine & Health",
    bio: "Clinical researcher mentoring students interested in translational medicine and evidence-based practice.",
    topics: ["Research methods", "Medical school prep", "Scholarships", "Grad school"],
  },
  {
    id: "3",
    name: "Sofia Alvarez",
    university: "London School of Economics",
    course: "Economics",
    field: "Business & Economics",
    bio: "Strategy consultant guiding students on case prep, networking, and building analytical confidence.",
    topics: ["Case interviews", "Networking", "Career pivots", "Graduate studies"],
  },
  {
    id: "4",
    name: "Marcus Lee",
    university: "National University of Singapore",
    course: "Law",
    field: "Law & Policy",
    bio: "Corporate lawyer focused on helping students navigate applications and early career steps in legal practice.",
    topics: ["Personal statements", "Subject choices", "Internships", "Career advice"],
  },
];

const fields = ["Engineering & CS", "Medicine & Health", "Business & Economics", "Law & Policy"];
const universities = [
  "Stanford University",
  "University of Toronto",
  "London School of Economics",
  "National University of Singapore",
];
const topics = [
  "Application guidance",
  "Subject choices",
  "Career advice",
  "Internships",
  "Research methods",
  "Graduate studies",
];

export default function FindMentor() {
  const [searchTerm, setSearchTerm] = useState("");
  const [fieldFilter, setFieldFilter] = useState<string | null>(null);
  const [universityFilter, setUniversityFilter] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  const filteredMentors = useMemo(() => {
    return mentors.filter((mentor) => {
      const matchesSearch = mentor.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesField = !fieldFilter || mentor.field === fieldFilter;
      const matchesUniversity = !universityFilter || mentor.university === universityFilter;
      const matchesTopic = !topicFilter || mentor.topics.includes(topicFilter);
      return matchesSearch && matchesField && matchesUniversity && matchesTopic;
    });
  }, [searchTerm, fieldFilter, universityFilter, topicFilter]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MentorNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="relative overflow-hidden rounded-[32px] border border-border/70 bg-card/80 p-6 shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_60%)]" />
          <div className="absolute -bottom-12 right-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <Badge variant="outline" className="uppercase tracking-[0.2em] text-xs">
                Mentor network
              </Badge>
              <h1 className="text-3xl font-semibold">Build your mentor match list</h1>
              <p className="text-muted-foreground max-w-2xl">
                Curate a shortlist of alumni mentors based on field, university, and the topics you want to explore next.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  placeholder="Search by mentor name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-80"
                />
                <div className="flex flex-wrap gap-2 text-sm">
                  {fields.map((field) => (
                    <Badge
                      key={field}
                      variant={fieldFilter === field ? "default" : "outline"}
                      className="cursor-pointer rounded-full"
                      onClick={() => setFieldFilter(fieldFilter === field ? null : field)}
                    >
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-border/70 bg-background/80 shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Active filters
                  </p>
                  <p className="text-2xl font-semibold">
                    {[fieldFilter, universityFilter, topicFilter].filter(Boolean).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Applied to your list</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-background/80 shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Mentor matches
                  </p>
                  <p className="text-2xl font-semibold">{filteredMentors.length}</p>
                  <p className="text-xs text-muted-foreground">Profiles ready to request</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-background/80 shadow-sm sm:col-span-2">
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Quick actions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFieldFilter(null);
                        setUniversityFilter(null);
                        setTopicFilter(null);
                        setSearchTerm("");
                      }}
                    >
                      Reset filters
                    </Button>
                    <Button variant="default" size="sm" className="rounded-full">
                      Start mentorship request
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Filter by university</p>
                <div className="flex flex-wrap gap-2">
                  {universities.map((uni) => (
                    <Button
                      key={uni}
                      variant={universityFilter === uni ? "default" : "secondary"}
                      size="sm"
                      className="rounded-full"
                      onClick={() => setUniversityFilter(universityFilter === uni ? null : uni)}
                    >
                      {uni}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Filter by topics</p>
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => (
                    <Badge
                      key={topic}
                      variant={topicFilter === topic ? "default" : "outline"}
                      className="cursor-pointer rounded-full"
                      onClick={() => setTopicFilter(topicFilter === topic ? null : topic)}
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Focus picks</p>
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Top request</p>
                    <p className="font-semibold">Resume + application review</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Trending field</p>
                    <p className="font-semibold">Engineering & CS mentors</p>
                  </div>
                </div>
              </div>
            </div>
            <Separator />
            {filteredMentors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No mentors match these filters yet. Adjust your filters to see more options.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredMentors.map((mentor) => (
                  <MentorCard
                    key={mentor.id}
                    mentor={mentor}
                    onRequest={() => alert(`Request sent to ${mentor.name}`)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
