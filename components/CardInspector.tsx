import React from 'react';

type Card = {
  id: string;
  name: string;
  power?: number;
  toughness?: number;
  color?: string;
  image?: string;
};

type Props = {
  zoneName: string;
  cards: Card[];
  onClose: () => void;
};

export default function CardInspector({ zoneName, cards, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center text-white">
      <div className="w-full text-center py-3 px-4 bg-zinc-800 text-lg font-semibold relative">
        Zone: {zoneName}
        <button
          onClick={onClose}
          className="absolute right-4 top-2 text-2xl"
        >
          ×
        </button>
      </div>

      <div className="flex-1 w-full overflow-x-auto flex items-center gap-4 px-4 py-6 snap-x snap-mandatory scroll-smooth">
        {cards.length === 0 ? (
          <div className="text-center w-full italic text-zinc-400">
            <div className="text-4xl mb-2">🗄️</div>
            No cards in this zone.
          </div>
        ) : (
          cards.map((card) => (
            <div
              key={card.id}
              className={`flex-shrink-0 w-[80%] max-w-xs bg-zinc-900 p-4 rounded-xl border-2 snap-center transition-transform duration-200 ${
                card.color ? `shadow-[0_0_12px_theme('colors.${card.color}.500')]` : ''
              }`}
            >
              <img
                src={card.image || '/placeholder.jpg'}
                alt={card.name}
                className="w-full rounded-md mb-3"
              />
              <h3 className="text-xl font-bold mb-1">{card.name}</h3>
              {card.power !== undefined && (
                <p className="text-sm text-zinc-300">
                  Power/Toughness: {card.power}/{card.toughness}
                </p>
              )}
              {card.color && (
                <p className="text-sm text-zinc-300">Color: {card.color}</p>
              )}
              <p className="text-xs text-zinc-500 mt-2">ID: {card.id}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
