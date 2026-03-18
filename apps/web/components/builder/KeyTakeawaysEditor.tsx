"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AiAssistButton } from "@/components/ui/AiAssistButton";

interface TakeawayItem {
  key: number;
  value: string;
}

interface KeyTakeawaysEditorProps {
  takeaways: string[];
  onChange: (takeaways: string[]) => void;
  maxItems?: number;
}

export function KeyTakeawaysEditor({
  takeaways,
  onChange,
  maxItems = 5,
}: KeyTakeawaysEditorProps) {
  const nextKeyRef = useRef(takeaways.length);
  const [localTakeaways, setLocalTakeaways] = useState<TakeawayItem[]>(() =>
    takeaways.map((v, i) => ({ key: i, value: v }))
  );

  // Sync with external changes
  useEffect(() => {
    setLocalTakeaways(takeaways.map((v, i) => ({ key: i, value: v })));
    nextKeyRef.current = takeaways.length;
  }, [takeaways]);

  const saveTakeaways = useCallback((items: TakeawayItem[]) => {
    const filtered = items.map((t) => t.value).filter((v) => v.trim().length > 0);
    onChange(filtered);
  }, [onChange]);

  function handleChange(index: number, value: string) {
    const updated = [...localTakeaways];
    updated[index] = { ...updated[index], value };
    setLocalTakeaways(updated);
  }

  function handleBlur() {
    saveTakeaways(localTakeaways);
  }

  function handleAdd() {
    if (localTakeaways.length >= maxItems) return;
    const newKey = nextKeyRef.current++;
    setLocalTakeaways([...localTakeaways, { key: newKey, value: "" }]);
  }

  function handleRemove(index: number) {
    const updated = localTakeaways.filter((_, i) => i !== index);
    setLocalTakeaways(updated);
    saveTakeaways(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (localTakeaways.length < maxItems) {
        handleAdd();
        setTimeout(() => {
          const inputs = document.querySelectorAll('[data-takeaway-input]');
          const nextInput = inputs[index + 1] as HTMLInputElement;
          nextInput?.focus();
        }, 0);
      }
    } else if (e.key === "Backspace" && localTakeaways[index].value === "" && index > 0) {
      e.preventDefault();
      handleRemove(index);
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-takeaway-input]');
        const prevInput = inputs[index - 1] as HTMLInputElement;
        prevInput?.focus();
      }, 0);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <label className="text-sm font-medium text-gray-900">Key Takeaways</label>
        <span className="text-xs text-gray-400">
          {localTakeaways.filter((t) => t.value.trim()).length}/{maxItems}
        </span>
      </div>

      <div className="space-y-2">
        {localTakeaways.map((takeaway, index) => (
          <div key={takeaway.key} className="flex items-start gap-2 group">
            <span className="text-teal-500 mt-2.5 text-sm">•</span>
            <input
              type="text"
              data-takeaway-input
              value={takeaway.value}
              onChange={(e) => handleChange(index, e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => handleKeyDown(e, index)}
              placeholder="What will learners take away from this session?"
              maxLength={200}
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
            <span className="mt-1.5">
              <AiAssistButton
                value={takeaway.value}
                type="key_takeaway"
                onEnhance={(enhanced) => {
                  handleChange(index, enhanced);
                  saveTakeaways(localTakeaways.map((t, i) => i === index ? { ...t, value: enhanced } : t));
                }}
              />
            </span>
            <button
              onClick={() => handleRemove(index)}
              className="mt-2 p-1 text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
              title="Remove takeaway"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {localTakeaways.length < maxItems && (
        <button
          onClick={handleAdd}
          className="w-full py-2 text-xs text-gray-400 hover:text-teal-600 border border-dashed border-gray-200 hover:border-teal-400 rounded-lg transition flex items-center justify-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Takeaway
        </button>
      )}

      <p className="text-xs text-gray-400">
        2-3 concise points summarizing what learners will gain from this session.
      </p>
    </div>
  );
}
