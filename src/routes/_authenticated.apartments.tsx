import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listApartments } from "@/lib/data.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const qo = queryOptions({ queryKey: ["apartments"], queryFn: () => listApartments() });

export const Route = createFileRoute("/_authenticated/apartments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: ApartmentsPage,
});

function ApartmentsPage() {
  const { data: apts } = useSuspenseQuery(qo);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Huoneet</h1>
        <p className="text-sm text-muted-foreground">{apts.length} hotellihuonetta</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Huone</TableHead>
                <TableHead>Kerros</TableHead>
                <TableHead>Termostaatit</TableHead>
                <TableHead>Huone / Kylpyhuone</TableHead>
                <TableHead>Keskiasetus</TableHead>
                <TableHead>Tila</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apts.map((a: any) => {
                const ts = a.thermostats ?? [];
                const avg = ts.length
                  ? (ts.reduce((s: number, t: any) => s + Number(t.current_setpoint), 0) / ts.length).toFixed(1)
                  : "—";
                const rooms = ts.filter((t: any) => t.zone === "room").length;
                const baths = ts.filter((t: any) => t.zone === "bathroom").length;
                const off = ts.filter((t: any) => t.status === "offline").length;
                const al = ts.filter((t: any) => t.status === "alarm").length;
                return (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <Link to="/apartments/$id" params={{ id: a.id }} className="block">
                        {a.number}
                      </Link>
                    </TableCell>
                    <TableCell>{a.floor}. krs</TableCell>
                    <TableCell>{ts.length}</TableCell>
                    <TableCell className="text-muted-foreground">{rooms} · {baths}</TableCell>
                    <TableCell>{avg} °C</TableCell>
                    <TableCell>
                      {al === 0 && off === 0 ? (
                        <Badge variant="outline" className="border-success/40 text-success">OK</Badge>
                      ) : (
                        <div className="flex gap-1.5">
                          {al > 0 && <Badge variant="destructive">{al} hälytys</Badge>}
                          {off > 0 && <Badge variant="secondary">{off} offline</Badge>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
