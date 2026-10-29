import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Server Component: rendered at build time into static HTML.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">Japan Trip 2026–27</h1>
          </CardTitle>
          <CardDescription>Dec 15, 2026 – Jan 12, 2027</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            The day-by-day planner is on its way. This page is a placeholder
            while the app is being built.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Tokyo</Badge>
            <Badge variant="secondary">Nagoya</Badge>
            <Badge variant="secondary">Hiroshima</Badge>
            <Badge variant="secondary">Osaka</Badge>
            <Badge variant="secondary">Kawaguchiko</Badge>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
