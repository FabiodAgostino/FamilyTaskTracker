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
  Users, // Aggiunto per le statistiche "mie carte"
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, // Aggiunto per il popup delle statistiche
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'; // Assicurati di avere questi import
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/hooks/useFirestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { LoadingScreen, useLoadingTransition } from '../ui/loading-screen';
import { FidelityCard, FidelityCardFactory } from '@/lib/models/FidelityCard';
import { LuChartColumnBig } from "react-icons/lu"; // ✅ NUOVO: Import dell'icona LuChartColumnBig
import { min, max } from 'date-fns'; // Importato min, max
import { it } from 'date-fns/locale'; // Importata la locale italiana

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

  // ✅ NUOVO: Stato per il popup dei badge
  const [isBadgesPopupOpen, setIsBadgesPopupOpen] = useState(false);

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

  // Statistiche estese per i badge (calcolate su TUTTE le carte visibili)
  const stats = useMemo(() => {
    if (!visibleCards || !user) return {
      totalCards: 0,
      publicCards: 0,
      privateCards: 0,
      myCards: 0,
      newCards: 0,
      popularCards: 0,
      brands: [],
      cardsWithPoints: 0,
      oldestCardDate: null,
      newestCardDate: null,
    };

    const brands = [...new Set(visibleCards.map(card => card.brand))].filter(Boolean);

    let oldestCardDate: Date | null = null;
    let newestCardDate: Date | null = null;

    if (visibleCards.length > 0) {
      const createdDates = visibleCards.map(card => card.createdAt instanceof Date ? card.createdAt : new Date(card.createdAt));
      oldestCardDate = min(createdDates);
      newestCardDate = max(createdDates);
    }


    return {
      totalCards: visibleCards.length,
      publicCards: visibleCards.filter(card => card.isPublic).length,
      privateCards: visibleCards.filter(card => !card.isPublic).length,
      myCards: visibleCards.filter(card => card.createdBy === user.username).length,
      newCards: visibleCards.filter(card => card.isNew()).length,
      popularCards: visibleCards.filter(card => card.isPopular()).length,
      brands,
      oldestCardDate,
      newestCardDate,
    };
  }, [visibleCards, user]);

  // Handlers
  const _handleCardUsed = async (cardId: string) => {
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
          <div className="flex-1 flex items-center gap-3 w-full">
            <CreditCard className="h-8 w-8 text-cambridge-newStyle" />
            <h1 className="text-3xl font-bold text-delft-blue">Wallet</h1>

            {/* ✅ Bottoni per popup badge e "Aggiungi Carta" su mobile, spostati a destra */}
            {isMobile && (
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  onClick={() => setIsBadgesPopupOpen(true)} // ✅ Apre il popup dei badge
                  size="sm"
                  variant="outline"
                  className="border-cambridge-newStyle"
                >
                  <LuChartColumnBig className="h-4 w-4 text-cambridge-newStyle" />
                </Button>
                <Button
                  onClick={openAddCardModal}
                  size="sm"
                  className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white p-2"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* WalletStats (visibili solo su desktop) */}
          {!isMobile && <WalletComponents.WalletStats stats={stats} isMobile={isMobile} />}

          {/* Bottone grande "Aggiungi Carta" solo su schermi grandi */}
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

        {/* ✅ NUOVO: Modale per le statistiche avanzate (con più badge) */}
        <Dialog open={isBadgesPopupOpen} onOpenChange={setIsBadgesPopupOpen}>
          <DialogContent className="sm:max-w-md p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-semibold text-delft-blue">Statistiche Portafoglio</DialogTitle>
              <DialogDescription className="text-gray-600">
                Riepilogo approfondito delle tue carte fedeltà.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-3 py-4 border-t border-b border-gray-200 dark:border-gray-700">
              {/* Badge esistenti dalla stats */}
              <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-cambridge-newStyle/10 text-cambridge-newStyle border-cambridge-newStyle/20">
                <CreditCard className="w-4 h-4 mr-2" /> {stats.totalCards} {stats.totalCards === 1 ? 'carta' : 'carte'} totali
              </Badge>
              <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-blue-100 text-blue-700 border-blue-200">
                <Globe className="w-4 h-4 mr-2" /> {stats.publicCards} {stats.publicCards === 1 ? 'pubblica' : 'pubbliche'}
              </Badge>
              <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-orange-100 text-orange-700 border-orange-200">
                <Lock className="w-4 h-4 mr-2" /> {stats.privateCards} {stats.privateCards === 1 ? 'privata' : 'private'}
              </Badge>
              {stats.myCards > 0 && (
                <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-purple-100 text-purple-700 border-purple-200">
                  <Users className="w-4 h-4 mr-2" /> {stats.myCards} {stats.myCards === 1 ? 'mia' : 'mie'}
                </Badge>
              )}
              {stats.newCards > 0 && (
                <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-green-100 text-green-700 border-green-200">
                  <RotateCcw className="w-4 h-4 mr-2" /> {stats.newCards} {stats.newCards === 1 ? 'nuova' : 'nuove'} carte
                </Badge>
              )}
              {stats.popularCards > 0 && (
                <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-yellow-100 text-yellow-700 border-yellow-200">
                  <Star className="w-4 h-4 mr-2" /> {stats.popularCards} {stats.popularCards === 1 ? 'carta' : 'carte'} popolari
                </Badge>
              )}
            </div>
            <div className="pt-4 flex justify-end">
              <Button onClick={() => setIsBadgesPopupOpen(false)} variant="secondary">
                Chiudi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </LoadingScreen>
  );
};

export default DigitalWallet;