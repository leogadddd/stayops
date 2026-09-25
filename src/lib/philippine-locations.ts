import locations from "./philippine-locations.json";

export const PHILIPPINE_REGIONS = locations.regions;

function regionId(region: string) {
  return PHILIPPINE_REGIONS.find((item) => item.name === region)?.id;
}

export function provincesForPhilippineRegion(region: string) {
  const id = regionId(region);
  return id ? locations.provinces.filter((province) => province.regionId === id) : [];
}

function provinceId(region: string, province: string) {
  const id = regionId(region);
  return locations.provinces.find((item) => item.regionId === id && item.name === province)?.id;
}

function localitiesFor(entries: typeof locations.cities, region: string, province: string) {
  const selectedRegionId = regionId(region);
  const selectedProvinceId = provinceId(region, province);
  if (!selectedRegionId) return [];
  return entries.filter((entry) => entry.regionId === selectedRegionId && entry.provinceId === (selectedProvinceId ?? null));
}

export function citiesForPhilippineLocation(region: string, province: string) {
  return localitiesFor(locations.cities, region, province);
}

export function municipalitiesForPhilippineLocation(region: string, province: string) {
  return localitiesFor(locations.municipalities, region, province);
}

export function isValidPhilippineAddress(input: { region: string; province: string; city: string; municipality: string }): boolean {
  const { region, province, city, municipality } = input;
  if (!region && !province && !city && !municipality) return true;
  if (!region || (city && municipality) || (!city && !municipality)) return false;
  const provinces = provincesForPhilippineRegion(region);
  if (province && !provinces.some((item) => item.name === province)) return false;
  if (!province && provinces.length > 0) return false;
  return city
    ? citiesForPhilippineLocation(region, province).some((item) => item.name === city)
    : municipalitiesForPhilippineLocation(region, province).some((item) => item.name === municipality);
}
