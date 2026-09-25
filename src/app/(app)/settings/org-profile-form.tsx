"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/timezone-picker";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { saveOrganizationProfile, type OrgFormState } from "./actions";
import {
  citiesForPhilippineLocation,
  municipalitiesForPhilippineLocation,
  PHILIPPINE_REGIONS,
  provincesForPhilippineRegion,
} from "@/lib/philippine-locations";
import { SettingsSaveBar } from "./settings-save-bar";

export type OrganizationProfileValues = {
  name: string;
  displayName: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  municipality: string | null;
  province: string | null;
  region: string | null;
  country: string;
  legalName: string | null;
  taxId: string | null;
};

export function OrganizationProfileForm({
  values,
}: {
  values: OrganizationProfileValues;
}) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    saveOrganizationProfile,
    {},
  );
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const checkDirty = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const initial = {
      name: values.name,
      displayName: values.displayName ?? "",
      legalName: values.legalName ?? "",
      taxId: values.taxId ?? "",
      contactEmail: values.contactEmail ?? "",
      contactPhone: values.contactPhone ?? "",
      addressLine1: values.addressLine1 ?? "",
      addressLine2: values.addressLine2 ?? "",
      city: values.city ?? "",
      municipality: values.municipality ?? "",
      province: values.province ?? "",
      region: values.region ?? "",
      country: values.country,
    };
    setDirty(
      Object.entries(initial).some(
        ([key, value]) => String(data.get(key) ?? "") !== value,
      ),
    );
  }, [values]);
  useActionFeedback(state, { success: "Organization profile updated." });
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);
  const saveBarVisible = dirty || pending || Boolean(state.error);

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={checkDirty}
      onSubmit={() => setDirty(false)}
      className={saveBarVisible ? "space-y-6" : "space-y-6"}
    >
      <Card className="bg-[#FFFDFA]">
        <CardBody>
          <section>
            <h2 className="font-display text-xl text-pine">
              Logo &amp; brand image
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              Upload the image used to represent your organization.
            </p>
            <LogoImageField
              currentLogoUrl={values.logoUrl}
              onApplied={() => setDirty(true)}
            />
          </section>
        </CardBody>
      </Card>

      <Card className="bg-[#FFFDFA]">
        <CardBody>
          <section>
            <h2 className="font-display text-xl text-pine">
              Organization details
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              Names used by your team and, when set, your guests.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Organization name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={values.name}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="displayName">Guest-facing display name</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  defaultValue={values.displayName ?? ""}
                  maxLength={80}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="legalName">Legal business name</Label>
                <Input
                  id="legalName"
                  name="legalName"
                  defaultValue={values.legalName ?? ""}
                  maxLength={120}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="taxId">Tax ID / registration number</Label>
                <Input
                  id="taxId"
                  name="taxId"
                  defaultValue={values.taxId ?? ""}
                  maxLength={80}
                  placeholder="Optional"
                />
              </div>
            </div>
          </section>
        </CardBody>
      </Card>

      <Card className="bg-[#FFFDFA]">
        <CardBody>
          <section>
            <h2 className="font-display text-xl text-pine">Contact</h2>
            <p className="mt-1 text-sm text-ink/60">
              Business contact details for your records and future guest-facing
              communications.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={values.contactEmail ?? ""}
                  maxLength={254}
                />
              </div>
              <div>
                <Label htmlFor="contactPhone">Phone / WhatsApp</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  type="tel"
                  defaultValue={values.contactPhone ?? ""}
                  maxLength={40}
                />
              </div>
            </div>
          </section>
        </CardBody>
      </Card>

      <Card className="bg-[#FFFDFA]">
        <CardBody>
          <AddressFields values={values} onChange={checkDirty} />
        </CardBody>
      </Card>

      <SettingsSaveBar
        visible={saveBarVisible}
        pending={pending}
        error={state.error}
      />
    </form>
  );
}

function LogoImageField({
  currentLogoUrl,
  onApplied,
}: {
  currentLogoUrl: string | null;
  onApplied: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    pointerX: number;
    pointerY: number;
  } | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [preview, setPreview] = useState(currentLogoUrl);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const frame = 288;
  const cover = dimensions
    ? Math.max(frame / dimensions.width, frame / dimensions.height)
    : 1;
  const clampOffset = (next: { x: number; y: number }, nextZoom = zoom) => {
    if (!dimensions) return { x: 0, y: 0 };
    const width = dimensions.width * cover * nextZoom;
    const height = dimensions.height * cover * nextZoom;
    return {
      x: Math.max(
        -Math.max(0, (width - frame) / 2),
        Math.min(Math.max(0, (width - frame) / 2), next.x),
      ),
      y: Math.max(
        -Math.max(0, (height - frame) / 2),
        Math.min(Math.max(0, (height - frame) / 2), next.y),
      ),
    };
  };

  useEffect(() => {
    if (source) dialogRef.current?.showModal();
  }, [source]);

  const closeEditor = () => {
    dialogRef.current?.close();
    setSource(null);
    setDimensions(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (inputRef.current) inputRef.current.value = "";
  };

  const applyCrop = () => {
    if (!source || !dimensions) return;
    const image = new Image();
    image.onload = () => {
      const displayWidth = dimensions.width * cover * zoom;
      const displayHeight = dimensions.height * cover * zoom;
      const left = frame / 2 + offset.x - displayWidth / 2;
      const top = frame / 2 + offset.y - displayHeight / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(
        image,
        (-left * dimensions.width) / displayWidth,
        (-top * dimensions.height) / displayHeight,
        (frame * dimensions.width) / displayWidth,
        (frame * dimensions.height) / displayHeight,
        0,
        0,
        512,
        512,
      );
      const nextLogo = canvas.toDataURL("image/png");
      setLogoDataUrl(nextLogo);
      setPreview(nextLogo);
      setRemoveLogo(false);
      onApplied();
      closeEditor();
    };
    image.src = source;
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-5">
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-pine/25 bg-linen/50">
        {preview ? (
          <img
            src={preview}
            alt="Organization logo preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-center text-xs text-ink/45">Logo preview</span>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          id="logo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (
              !new Set(["image/jpeg", "image/png", "image/webp"]).has(
                file.type,
              ) ||
              file.size > 4 * 1024 * 1024
            ) {
              setError("Choose a JPG, PNG, or WebP image up to 4 MB.");
              event.target.value = "";
              return;
            }
            setError("");
            const reader = new FileReader();
            reader.onload = () => setSource(String(reader.result));
            reader.readAsDataURL(file);
          }}
        />
        <input type="hidden" name="logoDataUrl" value={logoDataUrl} />
        <input
          type="hidden"
          name="removeLogo"
          value={removeLogo ? "true" : ""}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload logo
          </Button>
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              className="text-terracotta hover:bg-terracotta/10 hover:text-terracotta"
              onClick={() => {
                setPreview(null);
                setLogoDataUrl("");
                setRemoveLogo(true);
                setError("");
                onApplied();
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove logo
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-ink/50">
          JPG, PNG, or WebP · up to 4 MB. You can reposition and scale it before
          saving.
        </p>
        {error ? <p className="mt-1 text-xs text-terracotta">{error}</p> : null}
      </div>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-pine/15 bg-[#FFFDFA] p-0 text-ink shadow-2xl backdrop:bg-ink/55"
        onCancel={closeEditor}
      >
        <div className="p-6">
          <h3 className="font-display text-2xl text-pine">Position logo</h3>
          <p className="mt-1 text-sm text-ink/60">
            Drag the image to reposition it, then use the slider to scale it.
          </p>
          <div className="mt-5 flex justify-center">
            <div
              className="relative h-72 w-72 touch-none overflow-hidden rounded-xl bg-ink/10"
              onPointerDown={(event) => {
                if (!dimensions) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = {
                  x: offset.x,
                  y: offset.y,
                  pointerX: event.clientX,
                  pointerY: event.clientY,
                };
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag) return;
                setOffset(
                  clampOffset({
                    x: drag.x + event.clientX - drag.pointerX,
                    y: drag.y + event.clientY - drag.pointerY,
                  }),
                );
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
            >
              {source ? (
                <img
                  src={source}
                  alt="Adjust logo position"
                  draggable={false}
                  onLoad={(event) =>
                    setDimensions({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })
                  }
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: dimensions
                      ? dimensions.width * cover * zoom
                      : "auto",
                    height: dimensions
                      ? dimensions.height * cover * zoom
                      : "auto",
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <Label htmlFor="logo-scale">Scale</Label>
            <input
              id="logo-scale"
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => {
                const nextZoom = Number(event.target.value);
                setZoom(nextZoom);
                setOffset((current) => clampOffset(current, nextZoom));
              }}
              className="mt-2 w-full accent-pine"
            />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="clay"
              disabled={!dimensions}
              onClick={applyCrop}
            >
              Apply image
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function AddressFields({
  values,
  onChange,
}: {
  values: OrganizationProfileValues;
  onChange: () => void;
}) {
  const [region, setRegion] = useState(values.region ?? "");
  const provinces = useMemo(
    () => provincesForPhilippineRegion(region),
    [region],
  );
  const [province, setProvince] = useState(values.province ?? "");
  const cities = useMemo(
    () => citiesForPhilippineLocation(region, province),
    [region, province],
  );
  const municipalities = useMemo(
    () => municipalitiesForPhilippineLocation(region, province),
    [region, province],
  );
  const [city, setCity] = useState(values.city ?? "");
  const [municipality, setMunicipality] = useState(values.municipality ?? "");
  const localityEnabled =
    Boolean(region) && (provinces.length === 0 || Boolean(province));
  useEffect(() => {
    onChange();
  }, [region, province, city, municipality, onChange]);
  return (
    <section>
      <h2 className="font-display text-xl text-pine">Business address</h2>
      <p className="mt-1 text-sm text-ink/60">
        Country is currently fixed to the Philippines.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="addressLine1">Address line 1</Label>
          <Input
            id="addressLine1"
            name="addressLine1"
            defaultValue={values.addressLine1 ?? ""}
            maxLength={160}
            placeholder="Building, street, barangay"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="addressLine2">Address line 2</Label>
          <Input
            id="addressLine2"
            name="addressLine2"
            defaultValue={values.addressLine2 ?? ""}
            maxLength={160}
            placeholder="Optional"
          />
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Input id="country" value="Philippines" disabled />
        </div>
        <input type="hidden" name="country" value="Philippines" />
        <div>
          <Label htmlFor="region">Region</Label>
          <SearchableSelect
            id="region"
            name="region"
            value={region}
            options={PHILIPPINE_REGIONS.map((item) => ({ value: item.name }))}
            placeholder="Select region"
            searchPlaceholder="Search regions"
            emptyMessage="No region matches that search."
            onValueChange={(nextRegion) => {
              setRegion(nextRegion);
              setProvince("");
              setCity("");
              setMunicipality("");
            }}
          />
        </div>
        <div>
          <Label htmlFor="province">Province</Label>
          <SearchableSelect
            id="province"
            name="province"
            value={province}
            options={provinces.map((item) => ({ value: item.name }))}
            placeholder={
              region
                ? provinces.length
                  ? "Select province"
                  : "No province required"
                : "Choose a region first"
            }
            searchPlaceholder="Search provinces"
            emptyMessage="No province matches that search."
            disabled={!region || provinces.length === 0}
            onValueChange={(nextProvince) => {
              setProvince(nextProvince);
              setCity("");
              setMunicipality("");
            }}
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <SearchableSelect
            id="city"
            name="city"
            value={city}
            options={cities.map((item) => ({ value: item.name }))}
            placeholder={
              localityEnabled ? "Select city" : "Choose a province first"
            }
            searchPlaceholder="Search cities"
            emptyMessage="No city matches that search."
            disabled={!localityEnabled}
            onValueChange={(nextCity) => {
              setCity(nextCity);
              setMunicipality("");
            }}
          />
        </div>
        <div>
          <Label htmlFor="municipality">Municipality</Label>
          <SearchableSelect
            id="municipality"
            name="municipality"
            value={municipality}
            options={municipalities.map((item) => ({ value: item.name }))}
            placeholder={
              localityEnabled
                ? "Select municipality"
                : "Choose a province first"
            }
            searchPlaceholder="Search municipalities"
            emptyMessage="No municipality matches that search."
            disabled={!localityEnabled}
            onValueChange={(nextMunicipality) => {
              setMunicipality(nextMunicipality);
              setCity("");
            }}
          />
        </div>
      </div>
    </section>
  );
}
