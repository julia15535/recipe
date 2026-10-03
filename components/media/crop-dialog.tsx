"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, Heading, Label, Modal, Slider, SliderThumb, SliderTrack } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { ModalOverlay } from "@/components/application/modals/modal";
import { ASPECT, type CropFractions, maxZoom, type Size } from "@/lib/domain/photo";

// Окно кадрирования (владелец 03.10: «кадрирование, которое я могу двигать и масштабировать на фото, это при
// загрузке»): рамка 4:3 стоит, фото двигается пальцем/мышью/стрелками и увеличивается щипком, колесом, ползунком или
// «−/+». Затенённые полосы сверху и снизу — то, что не попадёт в превью ссылки (1,91:1). Модалка — без анимации
// увеличения: react-easy-crop неверно меряет рамку в окне, которое при появлении масштабируется.
export type CropImage = Size & { url: string };
type Props = { image: CropImage | null; initial?: CropFractions; busy: boolean; error: string | null; onCancel: () => void; onDone: (crop: CropFractions) => void };

const OG_BAND = "linear-gradient(to bottom, rgb(0 0 0 / 0.28) 15%, transparent 15%, transparent 85%, rgb(0 0 0 / 0.28) 85%)";

export function CropDialog({ image, ...props }: Props) {
  return (
    <ModalOverlay
      isOpen={image !== null}
      onOpenChange={(open) => !open && !props.busy && props.onCancel()}
      isDismissable={!props.busy}
      isKeyboardDismissDisabled={props.busy}
    >
      <Modal className="max-h-[calc(var(--visual-viewport-height)-var(--modal-pt)-var(--modal-pb))] w-full max-w-2xl overflow-y-auto rounded-2xl bg-primary shadow-xl outline-hidden">
        <Dialog className="outline-hidden">{image && <CropEditor key={image.url} image={image} {...props} />}</Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function CropEditor({ image, initial, busy, error, onCancel, onDone }: Omit<Props, "image"> & { image: CropImage }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const area = useRef<CropFractions | null>(null);
  const [ready, setReady] = useState(false);
  const hintId = useId();
  const max = maxZoom(image);
  const step = (delta: number) => setZoom((value) => Math.min(max, Math.max(1, Math.round((value + delta) * 10) / 10)));
  const done = () => area.current && onDone(area.current);
  const toArea = (value: CropFractions) => ({ x: value.x * 100, y: value.y * 100, width: value.width * 100, height: value.height * 100 });

  return (
    <div className="flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      <Heading slot="title" className="font-display text-display-xs text-primary">
        Кадр для фото
      </Heading>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-[calc(55dvh*4/3)] overflow-hidden rounded-xl bg-secondary">
        <Cropper
          image={image.url}
          crop={crop}
          zoom={zoom}
          aspect={ASPECT}
          minZoom={1}
          maxZoom={max}
          zoomSpeed={0.25}
          keyboardStep={8}
          showGrid
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(pct: Area) => {
            area.current = { x: pct.x / 100, y: pct.y / 100, width: pct.width / 100, height: pct.height / 100 };
            setReady(true);
          }}
          initialCroppedAreaPercentages={initial ? toArea(initial) : undefined}
          style={{ cropAreaStyle: { backgroundImage: OG_BAND } }}
          classes={{ cropAreaClassName: "outline-brand focus-visible:outline-4 focus-visible:outline-offset-2" }}
          cropperProps={{ role: "group", "aria-roledescription": "рамка кадра", "aria-label": "Кадр фото", "aria-describedby": hintId }}
        />
      </div>
      <p id={hintId} className="text-sm text-tertiary">
        Двигайте фото пальцем или стрелками, увеличивайте двумя пальцами или ползунком. Затенённые полосы не попадут в превью
        ссылки.
      </p>
      <div className="flex items-center gap-2">
        <AppButton color="secondary" size="lg" iconLeading={Minus} aria-label="Уменьшить" isDisabled={zoom <= 1} onPress={() => step(-0.2)} />
        <Slider aria-label="Масштаб" minValue={1} maxValue={max} step={0.05} value={zoom} onChange={setZoom} className="flex-1">
          <Label className="sr-only">Масштаб</Label>
          <SliderTrack className="relative h-11 w-full before:absolute before:inset-x-0 before:top-1/2 before:h-1.5 before:-translate-y-1/2 before:rounded-full before:bg-quaternary">
            <SliderThumb className="top-1/2 size-7 rounded-full bg-brand-solid shadow-md ring-4 ring-primary outline-brand before:absolute before:-inset-2 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2" />
          </SliderTrack>
        </Slider>
        <AppButton color="secondary" size="lg" iconLeading={Plus} aria-label="Увеличить" isDisabled={zoom >= max} onPress={() => step(0.2)} />
      </div>
      {error && (
        <p role="alert" className="text-md text-error-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <AppButton color="secondary" onPress={onCancel} isDisabled={busy}>
          Отмена
        </AppButton>
        <AppButton onPress={done} isLoading={busy} isDisabled={!ready} showTextWhileLoading>
          {busy ? "Сохраняем…" : "Готово"}
        </AppButton>
      </div>
    </div>
  );
}
