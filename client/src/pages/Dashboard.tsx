// Dashboard.tsx
import { Route, Switch, Redirect } from 'wouter';
import { Layout } from '@/components/layout/Layout';
import { ShoppingList } from '@/components/shopping/ShoppingList'; // ✅ Ora funziona!
import { NotesList } from '@/components/notes/NotesList';
import { Calendar } from '@/components/calendar/Calendar';

export default function Dashboard() {
  return (
    <Layout>
      <Switch>
        <Route path="/shopping" component={ShoppingList} />
        <Route path="/notes" component={NotesList} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/">
          <Redirect to="/shopping" />
        </Route>
      </Switch>
    </Layout>
  );
}