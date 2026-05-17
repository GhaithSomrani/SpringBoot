import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { getExpenseSummary, type GroupDto } from '@/api/groups';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface GroupCardProps {
  group: GroupDto;
}

export function GroupCard({ group }: GroupCardProps) {
  const navigate = useNavigate();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['expenses', 'summary', group.id],
    queryFn: () => getExpenseSummary(group.id),
    staleTime: 5 * 60_000,
  });

  const memberCount = group.members.length + 1; // members + owner

  return (
    <Card
      className="cursor-pointer transition-all hover:ring-ring/30 hover:ring-2"
      onClick={() => navigate(`/groups/${group.id}`)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{group.name}</CardTitle>
        {group.description && (
          <CardDescription className="line-clamp-2">
            {group.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
          <span className="font-medium tabular-nums">
            {summaryLoading ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              `$${(summary?.totalAmount ?? 0).toFixed(2)}`
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
