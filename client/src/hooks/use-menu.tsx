import { CalendarDays, CreditCardIcon, ExternalLink, NotebookText, Pizza, ShoppingBasket } from "lucide-react";
import React from "react"
import { FaSpotify } from "react-icons/fa";

export function useMenu(): NavItem[] {

  const navItems: NavItem[] = [
    { name: 'Shopping', path: '/shopping', icon: ShoppingBasket, onlyHeader:true, color:'bg-burnt-newStyle' },
    { name: 'Note', path: '/notes', icon: NotebookText, onlyHeader:true,color:'bg-burnt-newStyle'  },
    { name: 'Calendario', path: '/calendar', icon: CalendarDays, onlyHeader:true,color:'bg-burnt-newStyle'  },
    { name: 'Spesa', path: '/shoppingfood', icon: Pizza, onlyHeader:true,color:'bg-burnt-newStyle'  },
    { name: 'Wallet', path: '/digitalwallet', icon: CreditCardIcon,color:'bg-burnt-newStyle' },
    { name: 'TripTaste', path:'https://fabiodagostino.github.io/TripTaste/#/', icon:ExternalLink,color:'bg-burnt-newStyle'},
    { name:'SpotifyStat', path:'/spotystat', icon:FaSpotify,color:'bg-burnt-newStyle' }
  ];
  return navItems;
}


type LucideIconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface NavItem {
  name: string;
  path: string;
  icon: LucideIconType | React.ComponentType<{ className?: string }>;
  color?:string;
  count?:number;
  onlyHeader?: boolean;
};

