// src/pages/TestPage.tsx

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar'; // Il nostro componente completo
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent 
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"

export function TestPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column', // Mettiamo i bottoni uno sopra l'altro
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem', // Spazio tra i bottoni
        width: '100vw',
        height: '100vh',
        backgroundColor: '#111',
      }}
    >
      <div>
        <h1 style={{ color: 'white', textAlign: 'center', marginBottom: '1rem' }}>
          Pagina di Test Isolata
        </h1>

        {/* --- Test 1: Dentro un Popover --- */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Apri in un Popover</Button>
          </PopoverTrigger>
          {/* Usiamo le stesse classi del tuo codice originale */}
          <PopoverContent className="w-auto p-0" align="start"> 
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
            />
          </PopoverContent>
        </Popover>

      </div>

      <div>
        {/* --- Test 2: Dentro una Modale (Dialog) --- */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Apri in una Modale (Dialog)</Button>
          </DialogTrigger>
          {/* Nelle modali è comune non avere padding sul Content */}
          <DialogContent className="p-0 w-auto"> 
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
            />
          </DialogContent>
        </Dialog>
      </div>

      <p style={{ color: 'white', textAlign: 'center', marginTop: '1rem' }}>
        Data selezionata: {date ? date.toString() : 'Nessuna'}
      </p>
      
    </div>
  );
}