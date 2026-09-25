"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { saveProfile, type ProfileFormState } from "./actions";
import { SettingsSaveBar } from "../settings-save-bar";

export function ProfileForm({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(saveProfile, {});
  const [dirty, setDirty] = useState(false);
  const router = useRouter();
  useActionFeedback(state, { success: "Profile updated." });
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);
  const saveBarVisible = dirty || pending || Boolean(state.error);
  return (
    <form
      action={formAction}
      onChange={(event) =>
        setDirty(new FormData(event.currentTarget).get("name") !== name)
      }
      onSubmit={() => setDirty(false)}
      className={saveBarVisible ? "space-y-5" : "space-y-5"}
    >
      <Card className="min-w-0 bg-[#FFFDFA]">
        <CardBody>
          <section>
            <h2 className="font-display text-xl text-pine">Profile picture</h2>
            <p className="mt-1 text-sm text-ink/60">
              Upload a photo to personalize your StayOps account.
            </p>
            <ProfileImageField currentImage={image} onApplied={() => setDirty(true)} />
          </section>
        </CardBody>
      </Card>
      <Card className="min-w-0 bg-[#FFFDFA]">
        <CardBody>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={name}
              minLength={2}
              maxLength={80}
              required
            />
          </div>
          <div className="mt-4">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
            <p className="mt-1.5 text-xs text-ink/50">
              Email changes are not available yet.
            </p>
          </div>
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

function ProfileImageField({
  currentImage,
  onApplied,
}: {
  currentImage: string | null;
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
  const [preview, setPreview] = useState(currentImage);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
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
      x: Math.max(-Math.max(0, (width - frame) / 2), Math.min(Math.max(0, (width - frame) / 2), next.x)),
      y: Math.max(-Math.max(0, (height - frame) / 2), Math.min(Math.max(0, (height - frame) / 2), next.y)),
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
      const nextImage = canvas.toDataURL("image/png");
      setPreview(nextImage);
      setImageDataUrl(nextImage);
      setRemoveImage(false);
      onApplied();
      closeEditor();
    };
    image.src = source;
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-5">
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-dashed border-pine/25 bg-linen/50">
        {preview ? (
          <img src={preview} alt="Profile picture preview" className="h-full w-full object-cover" />
        ) : (
          <span className="text-center text-xs text-ink/45">Photo preview</span>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          id="profile-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 4 * 1024 * 1024) {
              setError("Choose a JPG, PNG, or WebP image up to 4 MB.");
              event.target.value = "";
              return;
            }
            const reader = new FileReader();
            reader.onload = () => setSource(String(reader.result));
            reader.readAsDataURL(file);
          }}
        />
        <input type="hidden" name="profileImageDataUrl" value={imageDataUrl} />
        <input type="hidden" name="removeProfileImage" value={removeImage ? "true" : ""} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden />
            Upload photo
          </Button>
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              className="text-terracotta hover:bg-terracotta/10 hover:text-terracotta"
              onClick={() => {
                setPreview(null);
                setImageDataUrl("");
                setRemoveImage(true);
                setError("");
                onApplied();
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove photo
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-ink/50">JPG, PNG, or WebP · up to 4 MB.</p>
        {error ? <p className="mt-1 text-xs text-terracotta">{error}</p> : null}
      </div>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-pine/15 bg-[#FFFDFA] p-0 text-ink shadow-2xl backdrop:bg-ink/55"
        onCancel={closeEditor}
      >
        <div className="p-6">
          <h3 className="font-display text-2xl text-pine">Position profile picture</h3>
          <p className="mt-1 text-sm text-ink/60">
            Drag the image to reposition it, then use the slider to scale it.
          </p>
          <div className="mt-5 flex justify-center">
            <div
              className="relative h-72 w-72 touch-none overflow-hidden rounded-full bg-ink/10"
              onPointerDown={(event) => {
                if (!dimensions) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { x: offset.x, y: offset.y, pointerX: event.clientX, pointerY: event.clientY };
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag) return;
                setOffset(clampOffset({
                  x: drag.x + event.clientX - drag.pointerX,
                  y: drag.y + event.clientY - drag.pointerY,
                }));
              }}
              onPointerUp={() => { dragRef.current = null; }}
            >
              {source ? (
                <img
                  src={source}
                  alt="Adjust profile picture position"
                  draggable={false}
                  onLoad={(event) => setDimensions({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: dimensions ? dimensions.width * cover * zoom : "auto",
                    height: dimensions ? dimensions.height * cover * zoom : "auto",
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <Label htmlFor="profile-image-scale">Scale</Label>
            <input
              id="profile-image-scale"
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
            <Button type="button" variant="outline" onClick={closeEditor}>Cancel</Button>
            <Button type="button" variant="clay" disabled={!dimensions} onClick={applyCrop}>Apply image</Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
