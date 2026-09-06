// Dialog (escritorio) o Sheet full-screen (móvil) que envuelve el TrabajadorForm.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle } from "@/components/ui/sheet";

import { useMediaQuery } from "@/components/shared/useMediaQuery";
import { TrabajadorForm } from "./TrabajadorForm";

export function TrabajadorFormDialog({ open, onOpenChange, modo, trabajador }) {
  const esMovil = useMediaQuery("(max-width: 1023px)");

  const onGuardado = () => {
    onOpenChange(false);
  };

  const formKey = `${modo}-${trabajador?.id ?? "nuevo"}-${open ? "open" : "closed"}`;

  // En móvil: Sheet full-width bottom
  if (esMovil) {
    return (<Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] overflow-y-auto rounded-t-xl p-0">
          <div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4 backdrop-blur">
            <SheetHeader>
              <SheetTitle className="display text-lg">
                {modo === "crear" ? "Nuevo trabajador" : `Editar · ${trabajador?.nombre ?? ""}`}
              </SheetTitle>
              <SheetDescription>
                {modo === "crear"
                  ? "Crea el trabajador y su acceso a JornalPro."
                  : "Modifica los datos del trabajador."}
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="px-4 py-4">
            <TrabajadorForm
              key={formKey}
              modo={modo}
              trabajador={trabajador ?? null}
              onGuardado={onGuardado}
            />
          </div>
        </SheetContent>
      </Sheet>);
  }

  return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-background/95 px-6 py-4">
          <DialogTitle className="display text-lg">
            {modo === "crear" ? "Nuevo trabajador" : `Editar · ${trabajador?.nombre ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            {modo === "crear"
              ? "Crea el trabajador y su acceso a JornalPro."
              : "Modifica los datos del trabajador."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-100px)] overflow-y-auto px-6 py-4">
          <TrabajadorForm
            key={formKey}
            modo={modo}
            trabajador={trabajador ?? null}
            onGuardado={onGuardado}
          />
        </div>
      </DialogContent>
    </Dialog>);
}
