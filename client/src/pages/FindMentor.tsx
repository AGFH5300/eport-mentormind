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
        <div className="rounded-3xl bg-card shadow-sm border border-border/70 p-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Find your mentor</p>
          <h1 className="text-3xl font-semibold">Connect with alumni mentors</h1>
          <p className="text-muted-foreground max-w-3xl">
            Browse the mentor network, filter by field or university, and request mentorship with one click.
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-2">
            <Input
              placeholder="Search by mentor name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80"
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
                <p className="text-sm font-semibold text-foreground">Quick actions</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => {
                    setFieldFilter(null);
                    setUniversityFilter(null);
                    setTopicFilter(null);
                    setSearchTerm("");
                  }}>
                    Reset filters
                  </Button>
                  <Button variant="default" size="sm" className="rounded-full">
                    Start mentorship request
                  </Button>
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
