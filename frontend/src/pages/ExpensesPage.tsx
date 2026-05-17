import { useParams } from 'react-router-dom';

export function ExpensesPage() {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-foreground">Expenses</h1>
      <p className="text-muted-foreground">{groupId}</p>
    </div>
  );
}
