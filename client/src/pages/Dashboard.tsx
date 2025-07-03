// client/src/pages/Dashboard.tsx - Con User Management
import { Route, Switch, Redirect } from 'wouter';
import { Layout } from '@/components/layout/Layout';
import { ShoppingList } from '@/components/shopping/ShoppingList';
import { NotesList } from '@/components/notes/NotesList';
import { Calendar } from '@/components/calendar/Calendar';
import { UserManagement } from '@/components/admin/UserManagement';
import { useAuthContext } from '@/contexts/AuthContext';
import AdminPanel from '@/components/admin/AdministratorPanel';
import { ShoppingFoodComponent } from '@/components/shoppingfood/ShoppingFood';
import { AutoFCMManager } from '@/components/admin/AutoFCMManager';

export default function Dashboard() {
  const { user } = useAuthContext();
  
  return (
    <Layout>
      <Switch>
        <Route path="/shopping" component={ShoppingList} />
        <Route path="/notes" component={NotesList} />
        <Route path="/calendar" component={Calendar} />
         <Route path="/shoppingfood">
          {() => <ShoppingFoodComponent />}
        </Route>

         <Route path="/notification">
          {() => <AutoFCMManager />}
        </Route>

        
        {/* Route per gestione utenti - solo per admin */}
        {user?.role === 'admin' && (
          <Route path="/admin/users" component={UserManagement} />

        )}
        {user?.role === 'admin' && (
                <Route path="/admin/panel" component={AdminPanel} />
        )}
        
        <Route path="/">
          <Redirect to="/shopping" />
        </Route>
      </Switch>
    </Layout>
  );
}