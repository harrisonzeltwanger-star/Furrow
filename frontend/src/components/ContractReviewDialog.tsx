import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export interface ContractDetails {
  stackId: string;
  productType?: string;
  baleType?: string;
  buyerName: string;
  growerName: string;
  pricePerTon: number;
  tons: number;
  moisturePercent?: number;
  notes?: string;
  isDeliveredPrice?: boolean;
  truckingCoordinatedBy?: string;
  farmLocationName?: string;
}

interface ContractReviewDialogProps {
  open: boolean;
  onClose: () => void;
  details: ContractDetails | null;
  onSign: (typedName: string, signatureImage?: string) => Promise<void>;
}

const SAVED_SIG_KEY = 'furrow_saved_signature';

interface SavedSignature {
  name: string;
  imageData: string; // base64 PNG
}

function getSavedSignature(): SavedSignature | null {
  try {
    const raw = localStorage.getItem(SAVED_SIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.name && parsed.imageData) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveSignature(name: string, imageData: string) {
  localStorage.setItem(SAVED_SIG_KEY, JSON.stringify({ name, imageData }));
}

function SignaturePad({
  onSignatureChange,
  canvasRef,
}: {
  onSignatureChange: (hasSignature: boolean) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const isDrawing = useRef(false);
  const hasStrokes = useRef(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasStrokes.current = true;
    onSignatureChange(true);
  };

  const endDraw = () => {
    isDrawing.current = false;
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onSignatureChange(false);
  }, [canvasRef, onSignatureChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [canvasRef]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Draw your signature</Label>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Clear
        </button>
      </div>
      <div className="rounded-lg border-2 border-dashed border-border bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={440}
          height={140}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Use your mouse or finger to sign above.
      </p>
    </div>
  );
}

export default function ContractReviewDialog({ open, onClose, details, onSign }: ContractReviewDialogProps) {
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [usingSaved, setUsingSaved] = useState(false);
  const [savedSig, setSavedSig] = useState<SavedSignature | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check for saved signature when dialog opens
  useEffect(() => {
    if (open) {
      setSavedSig(getSavedSignature());
    }
  }, [open]);

  const reset = () => {
    setTypedName('');
    setAgreed(false);
    setHasSig(false);
    setSigning(false);
    setError('');
    setUsingSaved(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const applySavedSignature = () => {
    if (!savedSig) return;
    setTypedName(savedSig.name);
    setHasSig(true);
    setUsingSaved(true);
  };

  const switchToNewSignature = () => {
    setUsingSaved(false);
    setHasSig(false);
    setTypedName('');
  };

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigning(true);
    setError('');
    try {
      // Get signature image
      let sigImage: string | undefined;
      if (usingSaved && savedSig) {
        sigImage = savedSig.imageData;
      } else if (canvasRef.current) {
        sigImage = canvasRef.current.toDataURL('image/png');
        // Save for future use
        saveSignature(typedName, sigImage);
        setSavedSig({ name: typedName, imageData: sigImage });
      }
      await onSign(typedName, sigImage);
      reset();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || (err as Error).message || 'Failed to sign contract');
      setSigning(false);
    }
  };

  if (!details) return null;

  const totalValue = details.pricePerTon * details.tons;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contract Terms Review</DialogTitle>
          <DialogDescription>
            Review the purchase order details below before signing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Deal summary */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Stack ID</span>
                <div className="font-semibold">{details.stackId}</div>
              </div>
              {details.productType && (
                <div>
                  <span className="text-muted-foreground">Product Type</span>
                  <div className="font-semibold">{details.productType}</div>
                </div>
              )}
              {details.baleType && (
                <div>
                  <span className="text-muted-foreground">Bale Type</span>
                  <div className="font-semibold">{details.baleType}</div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Buyer</span>
                <div className="font-semibold">{details.buyerName}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Grower</span>
                <div className="font-semibold">{details.growerName}</div>
              </div>
            </div>

            <div className="border-t border-border pt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Price/Ton</span>
                <div className="text-lg font-bold">${details.pricePerTon}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Tons</span>
                <div className="text-lg font-bold">{details.tons || '--'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Value</span>
                <div className="text-lg font-bold">{totalValue ? `$${totalValue.toLocaleString()}` : '--'}</div>
              </div>
            </div>

            {/* Trucking & logistics */}
            <div className="border-t border-border pt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Pricing</span>
                <div className="font-semibold">
                  {details.isDeliveredPrice ? 'Delivered' : 'Pickup'}
                </div>
              </div>
              {!details.isDeliveredPrice && details.truckingCoordinatedBy && (
                <div>
                  <span className="text-muted-foreground">Trucking Coordinated By</span>
                  <div className="font-semibold">{details.truckingCoordinatedBy}</div>
                </div>
              )}
              {details.farmLocationName && (
                <div>
                  <span className="text-muted-foreground">Farm Location</span>
                  <div className="font-semibold">{details.farmLocationName}</div>
                </div>
              )}
            </div>

            {details.moisturePercent != null && (
              <div className="border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Moisture: </span>
                <span className="font-medium">{details.moisturePercent}%</span>
              </div>
            )}

            {details.notes && (
              <div className="border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Notes: </span>
                <span>{details.notes}</span>
              </div>
            )}
          </div>

          {/* Signature section */}
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">{error}</div>
          )}

          <form onSubmit={handleSign} className="space-y-4 border-t border-border pt-4">
            {/* Saved signature option */}
            {savedSig && !usingSaved && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Saved Signature</Label>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={applySavedSignature}>
                    Use Saved Signature
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded border border-border bg-white overflow-hidden">
                    <img src={savedSig.imageData} alt="Saved signature" className="h-14 w-auto" />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{savedSig.name}</div>
                    <div className="text-xs text-muted-foreground">Printed name</div>
                  </div>
                </div>
              </div>
            )}

            {/* Using saved signature view */}
            {usingSaved && savedSig && (
              <div className="space-y-3">
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Signing as</Label>
                    <button
                      type="button"
                      onClick={switchToNewSignature}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Draw new signature
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="rounded border border-border bg-white overflow-hidden">
                      <img src={savedSig.imageData} alt="Signature" className="h-16 w-auto" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{savedSig.name}</div>
                      <div className="text-xs text-muted-foreground">Printed name</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* New signature flow */}
            {!usingSaved && (
              <>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Type your full legal name</Label>
                  <Input
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Full legal name"
                    className="text-base"
                  />
                </div>

                {/* Signature canvas */}
                <SignaturePad onSignatureChange={setHasSig} canvasRef={canvasRef} />
              </>
            )}

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground">
                I have reviewed the contract terms above and agree to be bound by them.
              </span>
            </label>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={signing || !typedName.trim() || !agreed || !hasSig}
                className="flex-1"
              >
                {signing ? 'Signing...' : 'Sign Contract'}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose} disabled={signing}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
