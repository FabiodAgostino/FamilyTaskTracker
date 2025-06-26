// Aggiornamenti per client/src/components/auth/LoginForm.tsx

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Home, Loader2, AlertTriangle, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/auth';

// Schema di validazione migliorato
const loginSchema = z.object({
  username: z.string()
    .min(1, 'Seleziona un nome utente')
    .max(50, 'Username troppo lungo'),
  password: z.string()
    .min(1, 'Inserisci una password')
    .max(100, 'Password troppo lunga'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface AvailableUser {
  username: string;
  displayName: string;
  role: string;
}

export function LoginForm() {
  const { login } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  // Carica la lista degli utenti disponibili al mount
useEffect(() => {
  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const users = await AuthService.getAvailableUsers();
      setAvailableUsers(users);
    } catch (error) {
      console.error('Errore nel caricamento utenti:', error);
      
      const generateDisplayName = (username: string, role: string) => {
        if (role === 'admin') {
          return `${username} (Amministratore)`;
        }
        
        const capitalized = username.charAt(0).toUpperCase() + username.slice(1);
        return `${capitalized} (Membro della famiglia)`;
      };
      
      const fallbackUsers = ['admin', 'Fabio', 'Ludovica'];
      
      const fallbackData = fallbackUsers.map(username => {
        const role = username === 'admin' ? 'admin' : 'user';
        return {
          username,
          displayName: generateDisplayName(username, role),
          role
        };
      });
      
      setAvailableUsers(fallbackData);
      
    } finally {
      setIsLoadingUsers(false);
    }
  };

  loadUsers();
}, []);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      await login(data);
      toast({
        title: 'Bentornato!',
        description: 'Accesso effettuato con successo.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Credenziali non valide';
      setErrorMessage(message);
      
      toast({
        title: 'Accesso fallito',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-eggshell flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-burnt-sienna rounded-full flex items-center justify-center mx-auto mb-4">
              <Home className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-delft-blue mb-2">HomeTask</h1>
            <p className="text-gray-600">Accedi per gestire le attività</p>
          </div>

          {/* Messaggio di errore persistente */}
          {errorMessage && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Form di login */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Selezione utente */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Nome utente
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={isLoadingUsers || isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue 
                            placeholder={
                              isLoadingUsers 
                                ? "Caricamento utenti..." 
                                : "Seleziona un utente"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.username} value={user.username}>
                            <div className="flex items-center space-x-2">
                              <span>{user.displayName}</span>
                              {user.role === 'admin' && (
                                <Shield className="h-3 w-3 text-yellow-600" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-delft-blue">
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Inserisci la password"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Pulsante di submit */}
              <Button
                type="submit"
                className="w-full bg-burnt-sienna hover:bg-burnt-sienna/90 text-white font-semibold py-3"
                disabled={isLoading || isLoadingUsers}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Accesso in corso...' : 'Accedi'}
              </Button>
            </form>
          </Form>

         
        </CardContent>
      </Card>
    </div>
  );
}