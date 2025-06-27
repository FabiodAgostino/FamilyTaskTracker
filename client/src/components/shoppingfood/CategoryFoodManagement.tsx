// ==============================================================================
// GESTIONE CATEGORIE E SUPERMERCATI - FamilyTaskTracker
// ==============================================================================

import React, { useState } from 'react';
import { 
  Store, 
  Tag, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Palette,
  MapPin,
  Phone,
  Globe,
  FileText,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { CategoryFood, ShoppingFoodFactory, Supermarket } from '@/lib/models/food';

interface CategoryManagementProps {
  className?: string;
}

interface SupermarketManagementProps {
  className?: string;
}

// ===== GESTIONE CATEGORIE ALIMENTARI =====
export function CategoryFoodManagement({ className }: CategoryManagementProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const { data: categories, loading, add: addCategory, update: updateCategory, remove: removeCategory } = useFirestore<CategoryFood>('food_categories');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryFood | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#81B29A',
    icon: '📦',
    order: 0
  });

  // Colori predefiniti per le categorie
  const predefinedColors = [
    '#10B981', '#D97706', '#DC2626', '#0EA5E9', '#B91C1C',
    '#F3F4F6', '#92400E', '#3B82F6', '#8B5CF6', '#06B6D4',
    '#EC4899', '#6B7280', '#81B29A', '#E07A5F', '#F2CC8F'
  ];

  // Icone predefinite
  const predefinedIcons = [
    '🥬', '🍞', '🧀', '🐟', '🥩', '🥛', '📦', '🧊', '🥤', '🧽', '🧴', '📋'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingCategory) {
        // Aggiorna categoria esistente
        const updatedCategory = new CategoryFood(
          editingCategory.id,
          formData.name,
          editingCategory.createdBy,
          editingCategory.createdAt,
          formData.description,
          formData.color,
          formData.icon,
          formData.order,
          new Date()
        );
        
        await updateCategory(editingCategory.id, updatedCategory);
        toast({ title: "Categoria aggiornata", description: `"${formData.name}" è stata aggiornata con successo` });
        setEditingCategory(null);
      } else {
        // Crea nuova categoria
        const newCategory = ShoppingFoodFactory.createCategoryFood(formData, user.username);
        await addCategory(newCategory);
        toast({ title: "Categoria creata", description: `"${formData.name}" è stata creata con successo` });
        setShowCreateDialog(false);
      }

      // Reset form
      setFormData({ name: '', description: '', color: '#81B29A', icon: '📦', order: 0 });
    } catch (error) {
      toast({
        title: "Errore",
        description: editingCategory ? "Impossibile aggiornare la categoria" : "Impossibile creare la categoria",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (category: CategoryFood) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
      icon: category.icon || '📦',
      order: category.order
    });
  };

  const handleDelete = async (category: CategoryFood) => {
    if (!window.confirm(`Sei sicuro di voler eliminare la categoria "${category.name}"?`)) {
      return;
    }

    try {
      await removeCategory(category.id);
      toast({ title: "Categoria eliminata", description: `"${category.name}" è stata eliminata` });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la categoria",
        variant: "destructive"
      });
    }
  };

  const sortedCategories = categories?.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)) || [];

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-delft-blue flex items-center gap-2">
            <Tag className="h-6 w-6 text-burnt-newStyle" />
            Categorie Alimentari
          </h2>
          <p className="text-muted-foreground">Gestisci le categorie per organizzare i prodotti</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-burnt-newStyle hover:bg-burnt-newStyle/90">
              <Plus className="h-4 w-4 mr-2" />
              Nuova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crea Nuova Categoria</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  required
                  placeholder="Nome categoria"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  placeholder="Descrizione opzionale"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <Label>Icona</Label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {predefinedIcons.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      className={`p-2 border rounded-md hover:bg-gray-50 ${
                        formData.icon === icon ? 'border-burnt-newStyle bg-burnt-newStyle/10' : 'border-gray-200'
                      }`}
                      onClick={() => setFormData({ ...formData, icon })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Colore</Label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {predefinedColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-delft-blue' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-burnt-newStyle hover:bg-burnt-newStyle/90">
                  Crea Categoria
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCategories.map(category => (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              {editingCategory?.id === category.id ? (
                <CardContent className="p-4">
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome categoria"
                    />
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descrizione"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90">
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingCategory(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </form>
                </CardContent>
              ) : (
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-2xl">{category.icon}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <h3 className="font-medium text-delft-blue mb-1">{category.name}</h3>
                  
                  {category.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {category.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Ordine: {category.order}</span>
                    <span>di {category.createdBy}</span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== GESTIONE SUPERMERCATI =====
export function SupermarketManagement({ className }: SupermarketManagementProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const { data: supermarkets, loading, add: addSupermarket, update: updateSupermarket, remove: removeSupermarket } = useFirestore<Supermarket>('supermarkets');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSupermarket, setEditingSupermarket] = useState<Supermarket | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    website: '',
    notes: '',
    color: '#E07A5F',
    isActive: true
  });

  const predefinedColors = [
    '#E07A5F', '#81B29A', '#F2CC8F', '#3D405B', '#F4F1DE',
    '#DC2626', '#059669', '#7C3AED', '#DB2777', '#EA580C'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingSupermarket) {
        const updatedSupermarket = new Supermarket(
          editingSupermarket.id,
          formData.name,
          editingSupermarket.createdBy,
          editingSupermarket.createdAt,
          formData.address,
          formData.city,
          formData.phone,
          formData.website,
          formData.notes,
          formData.color,
          formData.isActive,
          new Date()
        );
        
        await updateSupermarket(editingSupermarket.id, updatedSupermarket);
        toast({ title: "Supermercato aggiornato", description: `"${formData.name}" è stato aggiornato con successo` });
        setEditingSupermarket(null);
      } else {
        const newSupermarket = ShoppingFoodFactory.createSupermarket(formData, user.username);
        await addSupermarket(newSupermarket);
        toast({ title: "Supermercato creato", description: `"${formData.name}" è stato creato con successo` });
        setShowCreateDialog(false);
      }

      setFormData({
        name: '', address: '', city: '', phone: '', website: '', notes: '', 
        color: '#E07A5F', isActive: true
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: editingSupermarket ? "Impossibile aggiornare il supermercato" : "Impossibile creare il supermercato",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (supermarket: Supermarket) => {
    setEditingSupermarket(supermarket);
    setFormData({
      name: supermarket.name,
      address: supermarket.address || '',
      city: supermarket.city || '',
      phone: supermarket.phone || '',
      website: supermarket.website || '',
      notes: supermarket.notes || '',
      color: supermarket.color,
      isActive: supermarket.isActive
    });
  };

  const handleDelete = async (supermarket: Supermarket) => {
    if (!window.confirm(`Sei sicuro di voler eliminare "${supermarket.name}"?`)) {
      return;
    }

    try {
      await removeSupermarket(supermarket.id);
      toast({ title: "Supermercato eliminato", description: `"${supermarket.name}" è stato eliminato` });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il supermercato",
        variant: "destructive"
      });
    }
  };

  const activeSupermarkets = supermarkets?.filter(s => s.isActive) || [];
  const inactiveSupermarkets = supermarkets?.filter(s => !s.isActive) || [];

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-delft-blue flex items-center gap-2">
            <Store className="h-6 w-6 text-burnt-newStyle" />
            Supermercati
          </h2>
          <p className="text-muted-foreground">Gestisci i tuoi supermercati preferiti</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-burnt-newStyle hover:bg-burnt-newStyle/90">
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Supermercato
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aggiungi Nuovo Supermercato</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  required
                  placeholder="Nome supermercato"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address">Indirizzo</Label>
                  <Input
                    id="address"
                    placeholder="Via, numero civico"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Città</Label>
                  <Input
                    id="city"
                    placeholder="Città"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    placeholder="+39 123 456 7890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Sito web</Label>
                  <Input
                    id="website"
                    placeholder="https://www.esempio.it"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  placeholder="Note aggiuntive, orari, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div>
                <Label>Colore</Label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {predefinedColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-delft-blue' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="active">Supermercato attivo</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-burnt-newStyle hover:bg-burnt-newStyle/90">
                  Crea Supermercato
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-24 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Supermercati Attivi */}
          <div>
            <h3 className="text-lg font-medium text-delft-blue mb-4 flex items-center gap-2">
              <Check className="h-5 w-5 text-cambridge-newStyle" />
              Attivi ({activeSupermarkets.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSupermarkets.map(supermarket => (
                <SupermarketCard
                  key={supermarket.id}
                  supermarket={supermarket}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isEditing={editingSupermarket?.id === supermarket.id}
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleSubmit}
                  onCancelEdit={() => setEditingSupermarket(null)}
                />
              ))}
            </div>
          </div>

          {/* Supermercati Inattivi */}
          {inactiveSupermarkets.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Inattivi ({inactiveSupermarkets.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inactiveSupermarkets.map(supermarket => (
                  <SupermarketCard
                    key={supermarket.id}
                    supermarket={supermarket}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isEditing={editingSupermarket?.id === supermarket.id}
                    formData={formData}
                    setFormData={setFormData}
                    onSubmit={handleSubmit}
                    onCancelEdit={() => setEditingSupermarket(null)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente per singola card supermercato
interface SupermarketCardProps {
  supermarket: Supermarket;
  onEdit: (supermarket: Supermarket) => void;
  onDelete: (supermarket: Supermarket) => void;
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelEdit: () => void;
}

function SupermarketCard({
  supermarket,
  onEdit,
  onDelete,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  onCancelEdit
}: SupermarketCardProps) {
  if (isEditing) {
    return (
      <Card>
        <CardContent className="p-4">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome supermercato"
            />
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Indirizzo"
            />
            <Input
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Città"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90">
                <Save className="h-3 w-3 mr-1" />
                Salva
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onCancelEdit}>
                <X className="h-3 w-3 mr-1" />
                Annulla
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${!supermarket.isActive ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: supermarket.color }}
            />
            <h3 className="font-medium text-delft-blue">{supermarket.name}</h3>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(supermarket)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(supermarket)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {supermarket.address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <MapPin className="h-3 w-3" />
            <span>{supermarket.address}</span>
          </div>
        )}

        {supermarket.city && (
          <div className="text-sm text-muted-foreground mb-2">
            {supermarket.city}
          </div>
        )}

        {supermarket.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Phone className="h-3 w-3" />
            <span>{supermarket.phone}</span>
          </div>
        )}

        {supermarket.website && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Globe className="h-3 w-3" />
            <a 
              href={supermarket.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-burnt-newStyle hover:underline"
            >
              Sito web
            </a>
          </div>
        )}

        {supermarket.notes && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2 pt-2 border-t">
            <FileText className="h-3 w-3 mt-0.5" />
            <span className="text-xs">{supermarket.notes}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-2 border-t text-xs text-muted-foreground">
          <Badge variant={supermarket.isActive ? "default" : "secondary"}>
            {supermarket.isActive ? "Attivo" : "Inattivo"}
          </Badge>
          <span>di {supermarket.createdBy}</span>
        </div>
      </CardContent>
    </Card>
  );
}