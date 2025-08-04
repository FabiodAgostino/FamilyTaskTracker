// client/src/pages/Dashboard.tsx - Con User Management
import { Route, Switch, Redirect } from 'wouter';
import { Layout } from '@/components/layout/Layout';
import { LayoutMobile } from '@/components/layout/LayoutMobile'; // Assicurati che il percorso sia corretto
import { ShoppingList } from '@/components/shopping/ShoppingList';
import { NotesList } from '@/components/notes/NotesList';
import { Calendar } from '@/components/calendar/Calendar';
import { UserManagement } from '@/components/admin/UserManagement';
import { useAuthContext } from '@/contexts/AuthContext';
import AdminPanel from '@/components/admin/AdministratorPanel';
import { ShoppingFoodComponent } from '@/components/shoppingfood/ShoppingFood';
import { AutoFCMManager } from '@/components/admin/AutoFCMManager';
import { NotificationCenter } from '@/components/user/NotificationCenter';
import DigitalWallet from '@/components/wallet/DigitalWallet';
import { useIsMobile } from '@/hooks/use-mobile';
import { TestPage } from '@/TestPage';
import { SpotifyStats } from '@/components/spotify/SpotifyStats';
// Removed unused imports

export default function Dashboard() {
  const { user } = useAuthContext();
  const isMobile = useIsMobile();

  // Seleziona il componente di Layout da usare in base a isMobile
  const PageLayout = isMobile ? LayoutMobile : Layout;

  return (
    <PageLayout>
      <Switch>
        <Route path="/shopping" component={ShoppingList} />
        <Route path="/notes" component={NotesList} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/shoppingfood">
          {() => <ShoppingFoodComponent />}
        </Route>
<Route path="/testpage" component={TestPage} />
        <Route path="/notification">
          {() => <AutoFCMManager />}
        </Route>

        <Route path="/notificationcenter">
          {() => <NotificationCenter />}
        </Route>

        <Route path="/digitalwallet">
          {() => <DigitalWallet />}
        </Route>

          <Route path="/spotystat">
          {() => <SpotifyStats />}
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
    </PageLayout>
  );
}