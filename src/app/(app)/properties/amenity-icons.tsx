import {
  Accessibility, AirVent, ArrowUpDown, Baby, Bath, BedDouble, Building2, Cctv, CircleParking, Coffee, CookingPot,
  Droplets, Dumbbell, Fence, GlassWater, Laptop, type LucideIcon, Microwave, MonitorPlay, PartyPopper, PawPrint,
  Refrigerator, Shirt, ShieldCheck, ShowerHead, Soup, Sparkles, Store, Trees, Tv, Umbrella, Utensils, WashingMachine,
  Waves, Wifi, Wind, Zap,
} from "lucide-react";

/** Icon keys stored on default amenities (see src/lib/amenities.ts). */
const AMENITY_ICONS: Record<string, LucideIcon> = {
  pool: Waves, parking: CircleParking, gym: Dumbbell, elevator: ArrowUpDown, security: ShieldCheck, cctv: Cctv,
  garden: Trees, playground: Baby, laundry: WashingMachine, "function-room": PartyPopper, rooftop: Building2,
  pets: PawPrint, beach: Umbrella, store: Store, accessible: Accessibility, generator: Zap,
  wifi: Wifi, aircon: AirVent, kitchen: CookingPot, fridge: Refrigerator, microwave: Microwave, "rice-cooker": Soup,
  coffee: Coffee, dining: Utensils, towels: Bath, toiletries: Droplets, shower: ShowerHead, "hair-dryer": Wind,
  linens: BedDouble, tv: Tv, streaming: MonitorPlay, iron: Shirt, workspace: Laptop, balcony: Fence, water: GlassWater,
};

/** Custom amenities have no icon and fall back to a generic one. */
export function amenityIcon(key: string | null): LucideIcon {
  return (key && AMENITY_ICONS[key]) || Sparkles;
}

/** Read-only chips for detail pages. */
export function AmenityList({ amenities, emptyLabel }: { amenities: { id: string; name: string; icon: string | null }[]; emptyLabel: string }) {
  if (!amenities.length) return <p className="text-sm text-ink/55">{emptyLabel}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {amenities.map((amenity) => {
        const Icon = amenityIcon(amenity.icon);
        return (
          <li key={amenity.id} className="inline-flex items-center gap-1.5 rounded-full border border-pine/15 bg-white px-3 py-1 text-sm text-pine">
            <Icon aria-hidden className="h-3.5 w-3.5 text-pine/60" />{amenity.name}
          </li>
        );
      })}
    </ul>
  );
}
