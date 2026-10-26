import { useEffect, useRef } from "react";
export function PromotionPicker({
  color,
  onPick,
  onCancel,
}: {
  color: "white" | "black";
  onPick: (piece: string) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="promotion-dialog"
      aria-labelledby="promotion-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="promotion-title">Promote your pawn</h2>
      <p>Choose a piece to complete your move.</p>
      <div className="promotion-options">
        {[
          ["q", "Queen"],
          ["r", "Rook"],
          ["b", "Bishop"],
          ["n", "Knight"],
        ].map(([piece, name]) => (
          <button
            key={piece}
            aria-label={`Promote to ${name.toLowerCase()}`}
            onClick={() => onPick(piece)}
          >
            <img
              src={`/pieces/${color === "white" ? "w" : "b"}${piece.toUpperCase()}.svg`}
              alt=""
            />
            <span>{name}</span>
          </button>
        ))}
      </div>
      <button className="cancel" onClick={onCancel}>
        Cancel promotion
      </button>
    </dialog>
  );
}
