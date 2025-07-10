import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  CreditCard,
  Globe,
  Lock,
  ChevronDown,
  ChevronUp,
  Filter,
  Star,
  RotateCcw,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/hooks/useFirestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { LoadingScreen, useLoadingTransition } from '../ui/loading-screen';
import { FidelityCard, FidelityCardFactory } from '@/lib/models/FidelityCard';

// Import dei nuovi componenti
import { supermarketData, type SupermarketKey } from './walletConstants';
import { WalletComponents } from './WalletComponent';
import { AddCardModal } from './AddCardModal';

const DigitalWallet = () => {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Hook Firestore
  const { 
    data: firebaseCards, 
    loading: cardsLoading, 
    add: addCard, 
    update: updateCard, 
    remove: deleteCard 
  } = useFirestore<FidelityCard>('fidelity_cards');

  // Stati principali
  const [localCards, setLocalCards] = useState<FidelityCard[]>([]);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(!isMobile);
  
  // Modal stati
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<FidelityCard | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showCardBack, setShowCardBack] = useState(false);
  
  // Filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [showNewCards, setShowNewCards] = useState(true);

  // Hook per loading screen
  const { showLoading } = useLoadingTransition(cardsLoading, firebaseCards);

  // Sincronizza dati Firebase
  useEffect(() => {
    if (firebaseCards) {
      const cards = firebaseCards.map(cardData => {
        if (cardData instanceof FidelityCard) {
          return cardData;
        }
        return FidelityCard.fromFirestore(cardData);
      });
      setLocalCards(cards);
    }
  }, [firebaseCards]);

  // Aggiorna filtri su cambio mobile/desktop
  useEffect(() => {
    setIsFiltersExpanded(!isMobile);
  }, [isMobile]);

  // Carte visibili con filtri
  const { filteredCards, visibleCards } = useMemo(() => {
    if (!localCards || !user) return { filteredCards: [], visibleCards: [] };
    
    const visible = localCards.filter(card => 
      card.isPublic || 
      card.createdBy === user.username || 
      user.role === 'admin'
    );
    
    const filtered = visible.filter(card => {
      const matchesSearch = !searchTerm || 
        card.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.number?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBrand = brandFilter === 'all' || card.brand === brandFilter;
      const matchesNew = showNewCards ? true : !card.isNew();
      
      return matchesSearch && matchesBrand && matchesNew;
    });

    return { filteredCards: filtered, visibleCards: visible };
  }, [localCards, searchTerm, brandFilter, showNewCards, user]);

  // Carte ordinate
  const sortedCards = useMemo(() => {
    const cards = [...filteredCards];
    
    switch (sortBy) {
      case 'name':
        return cards.sort((a, b) => a.name.localeCompare(b.name));
      case 'lastUsed':
        return cards.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
      case 'priority':
      default:
        return FidelityCard.sortByPriority(cards);
    }
  }, [filteredCards, sortBy]);

  // Statistiche
  const stats = useMemo(() => {
    if (!visibleCards) return {
      totalCards: 0,
      publicCards: 0,
      privateCards: 0,
      myCards: 0,
      newCards: 0,
      popularCards: 0,
      brands: []
    };
    
    const brands = [...new Set(visibleCards.map(card => card.brand))].filter(Boolean);
    
    return {
      totalCards: visibleCards.length,
      publicCards: visibleCards.filter(card => card.isPublic).length,
      privateCards: visibleCards.filter(card => !card.isPublic).length,
      myCards: visibleCards.filter(card => card.createdBy === user?.username).length,
      newCards: visibleCards.filter(card => card.isNew()).length,
      popularCards: visibleCards.filter(card => card.isPopular()).length,
      brands
    };
  }, [visibleCards, user]);

  // Handlers
  const handleCardUsed = async (cardId: string) => {
    const card = localCards.find(c => c.id === cardId);
    if (!card) return;

    try {
      const updatedCard = Object.assign(
        Object.create(Object.getPrototypeOf(card)), 
        card
      );
      updatedCard.incrementPriority();

      await updateCard(cardId, updatedCard);
      setLocalCards(prev => prev.map(c => c.id === cardId ? updatedCard : c));

    } catch (error) {
      console.error('Errore nell\'aggiornamento carta:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare la carta',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      await deleteCard(cardId);
      toast({
        title: 'Carta eliminata',
        description: 'Carta eliminata con successo!',
      });
    } catch (error) {
      console.error('Errore nell\'eliminazione carta:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare la carta',
        variant: 'destructive',
      });
    }
  };

  const handleCardClick = async (card: FidelityCard) => {
    try {
      const updatedCard = Object.assign(
        Object.create(Object.getPrototypeOf(card)), 
        card
      );
      updatedCard.incrementPriority();

      await updateCard(card.id, updatedCard);
      setLocalCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));

      setSelectedCard(updatedCard);
      setIsDetailModalOpen(true);
    
    } catch (error) {
      console.error('Errore nell\'aggiornamento carta:', error);
      setSelectedCard(card);
      setIsDetailModalOpen(true);
    }
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedCard(null);
    setShowCardBack(false);
  };

  const toggleCardView = () => {
    setShowCardBack(!showCardBack);
  };

  const openAddCardModal = () => {
    setIsModalOpen(true);
  };

  const closeAddCardModal = () => {
    setIsModalOpen(false);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setBrandFilter('all');
    setSortBy('priority');
    setShowNewCards(true);
  };

  const activeFiltersCount = [
    searchTerm.length > 0,
    brandFilter !== 'all',
    sortBy !== 'priority',
    !showNewCards
  ].filter(Boolean).length;

  const toggleFilters = () => setIsFiltersExpanded(!isFiltersExpanded);

  const saveCard = async (cardData: any) => {
    if (!user) {
      toast({
        title: 'Errore',
        description: 'Devi essere autenticato',
        variant: 'destructive',
      });
      return;
    }

    try {
      const newCardData = FidelityCardFactory.createFidelityCard(cardData, user.username);
      await addCard(newCardData);
      closeAddCardModal();
      
      toast({
        title: 'Carta aggiunta',
        description: 'Carta aggiunta con successo!',
      });
    } catch (error) {
      console.error('Errore nel salvataggio carta:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile aggiungere la carta',
        variant: 'destructive',
      });
    }
  };

  return (
    <LoadingScreen
      isVisible={showLoading}
      title="Caricamento Portafoglio"
      subtitle="Recupero delle tue carte..."
    >
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className={cn(
          "flex justify-between items-start gap-6 mb-8",
          isMobile ? "flex-col" : "lg:flex-row lg:items-center"
        )}>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="h-8 w-8 text-cambridge-newStyle" />
              <h1 className="text-3xl font-bold text-delft-blue">Portafoglio Digitale</h1>
              
              {isMobile && (
                <Button
                  onClick={openAddCardModal}
                  size="sm"
                  className="ml-auto bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white p-2"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <WalletComponents.WalletStats stats={stats} isMobile={isMobile} />
          </div>
          
          {!isMobile && (
            <Button
              onClick={openAddCardModal}
              className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi Carta
            </Button>
          )}
        </div>

        {/* Filtri */}
        <WalletComponents.FilterPanel
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          brandFilter={brandFilter}
          setBrandFilter={setBrandFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          showNewCards={showNewCards}
          setShowNewCards={setShowNewCards}
          isFiltersExpanded={isFiltersExpanded}
          toggleFilters={toggleFilters}
          activeFiltersCount={activeFiltersCount}
          handleClearFilters={handleClearFilters}
          isMobile={isMobile}
          brands={stats.brands}
        />

        {/* Griglia carte */}
        {!cardsLoading && (
          <div className="space-y-8">
            {sortedCards.length > 0 ? (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {sortedCards.map((card) => (
                  <WalletComponents.CompactFidelityCard 
                    key={card.id} 
                    card={card} 
                    onCardClick={handleCardClick}
                  />
                ))}
              </div>
            ) : (
              <Card className="text-center py-16">
                <CardContent>
                  <CreditCard className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-xl font-medium text-gray-600 mb-2">
                    {!user ? 'Accedi per gestire le tue carte' : 'Nessuna carta trovata'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {activeFiltersCount > 0 
                      ? "Prova a modificare i filtri di ricerca."
                      : "Inizia aggiungendo la tua prima carta fedeltà."
                    }
                  </p>
                  {user && (
                    activeFiltersCount > 0 ? (
                      <Button onClick={handleClearFilters} variant="outline">
                        Pulisci Filtri
                      </Button>
                    ) : (
                      <Button onClick={openAddCardModal} className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90">
                        <Plus className="mr-2 h-4 w-4" />
                        Aggiungi Prima Carta
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Modal dettaglio */}
        <WalletComponents.CardDetailModal
          selectedCard={selectedCard}
          isDetailModalOpen={isDetailModalOpen}
          showCardBack={showCardBack}
          handleCloseDetail={handleCloseDetail}
          toggleCardView={toggleCardView}
          handleDeleteCard={handleDeleteCard}
        />

        {/* Modal aggiunta carta */}
        <AddCardModal
          isOpen={isModalOpen}
          onClose={closeAddCardModal}
          onSave={saveCard}
        />
      </div>
    </LoadingScreen>
  );
};

export default DigitalWallet;