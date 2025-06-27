// client/src/components/admin/UserManagement.tsx

import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Shield, Mail, Calendar, Key, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthContext } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { User } from '@/lib/models/types';
import { PasswordCrypto } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

// Schema per creazione utente con password personalizzata
const createUserSchema = z.object({
  username: z.string()
    .min(3, 'Username deve essere almeno 3 caratteri')
    .max(20, 'Username troppo lungo')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username può contenere solo lettere, numeri, _ e -'),
  email: z.string()
    .email('Email non valida')
    .max(100, 'Email troppo lunga'),
  displayName: z.string()
    .min(2, 'Nome display troppo corto')
    .max(50, 'Nome display troppo lungo'),
  password: z.string()
    .min(6, 'Password deve essere almeno 6 caratteri')
    .max(50, 'Password troppo lunga'),
  role: z.enum(['admin', 'user'], {
    required_error: 'Seleziona un ruolo'
  })
});

type CreateUserData = z.infer<typeof createUserSchema>;

interface GeneratedCredentials {
  username: string;
  password: string;
  email: string;
  displayName: string;
  role: string;
}

export function UserManagement() {
  const { user: currentUser } = useAuthContext();
  const { data: users, loading, error, add, update, remove } = useFirestore<User>('users');
  const { toast } = useToast();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<GeneratedCredentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      email: '',
      displayName: '',
      password: '',
      role: 'user'
    }
  });

  // Solo gli admin possono accedere
  if (currentUser?.role !== "admin") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Accesso riservato agli amministratori</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateUser = async (data: CreateUserData) => {
    setIsCreating(true);
    
    try {
      // Verifica che l'username non esista già
      const existingUser = users.find(u => u.username === data.username);
      if (existingUser) {
        throw new Error('Username già esistente');
      }

      // Cifra la password inserita dall'utente
      const { encrypted, iv } = await PasswordCrypto.encryptPassword(data.password);

      // Prepara dati per Firestore
      const userData = new User(
        '', // ID verrà generato da Firestore
        data.username,
        data.role,
        data.email,
        data.displayName,
        undefined, // photoURL
        new Date(), // createdAt
        undefined, // lastLoginAt
        new Date(), // updatedAt
        true, // isActive
        encrypted, // passwordEncrypted
        iv // passwordIV
      );

      // Salva in Firestore
      await add(userData);

      // Mostra credenziali create
      setGeneratedCredentials({
        username: data.username,
        password: data.password,
        email: data.email,
        displayName: data.displayName,
        role: data.role
      });

      // Reset form
      form.reset();
      
      toast({
        title: 'Utente creato con successo!',
        description: `L'utente ${data.username} è stato creato.`
      });

    } catch (error) {
      console.error('Errore nella creazione utente:', error);
      toast({
        title: 'Errore nella creazione',
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Errore nella copia:', error);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Mai';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getRoleBadgeVariant = (role: string) => {
    return role === 'admin' ? 'destructive' : 'secondary';
  };

  const getRoleIcon = (role: string) => {
    return role === 'admin' ? <Shield className="h-3 w-3" /> : <Users className="h-3 w-3" />;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-newStyle mx-auto"></div>
            <p className="mt-3 text-gray-600">Caricamento utenti...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p>Errore nel caricamento: {error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-delft-blue flex items-center">
            <Users className="h-8 w-8 mr-3 text-cambridge-newStyle" />
            Gestione Utenti
          </h1>
          <p className="text-gray-600 mt-1">Amministra gli utenti del sistema</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90">
              <Plus className="h-4 w-4 mr-2" />
              Crea Nuovo Utente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crea Nuovo Utente</DialogTitle>
            </DialogHeader>
            
            {generatedCredentials ? (
              // Mostra credenziali create
              <div className="space-y-4">
                <Alert>
                  <Key className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Utente creato con successo!</strong><br />
                    Ecco le credenziali dell'utente:
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Username</label>
                      <p className="font-mono">{generatedCredentials.username}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedCredentials.username, 'username')}
                    >
                      {copiedField === 'username' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Password</label>
                      <p className="font-mono text-blue-600 font-semibold">{generatedCredentials.password}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedCredentials.password, 'password')}
                    >
                      {copiedField === 'password' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <p className="font-mono">{generatedCredentials.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedCredentials.email, 'email')}
                    >
                      {copiedField === 'email' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    onClick={() => {
                      setGeneratedCredentials(null);
                      setIsCreateDialogOpen(false);
                    }}
                    className="flex-1"
                  >
                    Chiudi
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setGeneratedCredentials(null)}
                    className="flex-1"
                  >
                    Crea Altro Utente
                  </Button>
                </div>
              </div>
            ) : (
              // Form di creazione
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateUser)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="es. marco.rossi" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="marco.rossi@family.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Marco Rossi" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"}
                              placeholder="Inserisci una password sicura" 
                              {...field} 
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ruolo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona un ruolo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="user">
                              <div className="flex items-center">
                                <Users className="h-3 w-3 mr-2" />
                                Utente Standard
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center">
                                <Shield className="h-3 w-3 mr-2" />
                                Amministratore
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="flex-1"
                    >
                      Annulla
                    </Button>
                    <Button
                      type="submit"
                      disabled={isCreating}
                      className="flex-1 bg-cambridge-newStyle hover:bg-cambridge-newStyle/90"
                    >
                      {isCreating ? 'Creazione...' : 'Crea Utente'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-cambridge-newStyle" />
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-gray-600">Utenti Totali</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role === 'admin').length}
                </p>
                <p className="text-sm text-gray-600">Amministratori</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.lastLoginAt).length}
                </p>
                <p className="text-sm text-gray-600">Utenti Attivi</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


{/* Lista utenti */}
{/* Lista utenti - FIX COMPLETO */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Lista Utenti ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nessun utente trovato
              </h3>
              <p className="text-gray-500 mb-6">
                Inizia creando il primo utente del sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg hover:bg-gray-50 gap-3 overflow-hidden"
                >
                  {/* Contenuto utente */}
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-cambridge-newStyle/10 rounded-full flex items-center justify-center flex-shrink-0">
                      {getRoleIcon(user.role)}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium truncate">{user.displayName || user.username}</h3>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="flex-shrink-0">
                          {user.role}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-600 space-y-1 sm:space-y-0">
                        <span className="flex items-center min-w-0">
                          <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </span>
                        <span className="flex-shrink-0">@{user.username}</span>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-1">
                        Ultimo accesso: {formatDate(user.lastLoginAt)}
                      </div>
                    </div>
                  </div>

                  {/* Azioni - Responsive */}
                  <div className="flex items-center justify-end space-x-2 flex-shrink-0">
                    <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-8">
                      <Edit className="h-3 w-3 sm:mr-1" />
                      <span className="hidden sm:inline">Modifica</span>
                    </Button>
                    
                    {user.username !== currentUser.username && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs px-2 py-1 h-8"
                      >
                        <Trash2 className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Elimina</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}