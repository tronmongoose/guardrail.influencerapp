"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";

interface Program {
  id: string;
  title: string;
}

interface PromoCode {
  id: string;
  code: string;
  programId: string | null;
  program: { title: string } | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [newCode, setNewCode] = useState("");
  const [newProgramId, setNewProgramId] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/programs").then((r) => r.json()),
      fetch("/api/promo-codes").then((r) => r.json()),
    ])
      .then(([programsData, codesData]) => {
        setPrograms(Array.isArray(programsData) ? programsData : []);
        setCodes(Array.isArray(codesData) ? codesData : []);
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim(),
          programId: newProgramId || undefined,
          maxUses: newMaxUses || undefined,
          expiresAt: newExpiresAt || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create promo code");
      }

      setCodes((prev) => [data, ...prev]);
      setNewCode("");
      setNewProgramId("");
      setNewMaxUses("");
      setNewExpiresAt("");
      setSuccess(`Promo code "${data.code}" created!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    setDeleteId(id);
    setError(null);
    try {
      const res = await fetch(`/api/promo-codes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCodes((prev) => prev.filter((c) => c.id !== id));
      setSuccess(`Promo code "${code}" deactivated.`);
    } catch {
      setError("Failed to delete promo code");
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a0f" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <style>{`body { background-color: #0a0a0f !important; }`}</style>
      <div className="min-h-screen" style={{ backgroundColor: "#0a0a0f" }}>
        {/* Nav */}
        <nav className="flex items-center justify-between px-5 py-4 border-b border-white/10" style={{ backgroundColor: "#0a0a0f" }}>
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            Journeyline
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition">
              Dashboard
            </Link>
            <UserButton />
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-5 py-10 space-y-10">
          <h1 className="text-2xl font-bold text-white">Settings</h1>

          {/* Promo Codes Section */}
          <section className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Learner Promo Codes</h2>
              <p className="text-sm text-gray-400 mt-1">
                Give your audience a code to access your paid programs for free.
              </p>
            </div>

            {/* Create form */}
            <form
              onSubmit={handleCreate}
              className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4"
            >
              <h3 className="text-sm font-medium text-white">Create a promo code</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-gray-400 block mb-1">Code *</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="FREEMONTH"
                    maxLength={20}
                    required
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan placeholder-gray-600"
                  />
                  <p className="text-xs text-gray-600 mt-1">Letters, numbers, dashes. 3-20 chars.</p>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-gray-400 block mb-1">Program</label>
                  <select
                    value={newProgramId}
                    onChange={(e) => setNewProgramId(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan"
                  >
                    <option value="">All my programs</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Max uses</label>
                  <input
                    type="number"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(e.target.value)}
                    placeholder="Unlimited"
                    min={1}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan placeholder-gray-600"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Expires</label>
                  <input
                    type="date"
                    value={newExpiresAt}
                    onChange={(e) => setNewExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-neon-cyan"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating || !newCode.trim()}
                className="btn-neon px-4 py-2 rounded-lg text-surface-dark text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? <><Spinner size="sm" color="pink" /> Creating...</> : "Create code"}
              </button>

              {error && <p className="text-sm text-red-400">{error}</p>}
              {success && <p className="text-sm text-green-400">{success}</p>}
            </form>

            {/* Codes list */}
            {codes.length === 0 ? (
              <p className="text-sm text-gray-500">No promo codes yet.</p>
            ) : (
              <div className="space-y-2">
                {codes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-semibold text-neon-cyan">{c.code}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.program ? c.program.title : "All programs"} ·{" "}
                        {c.uses}{c.maxUses !== null ? `/${c.maxUses}` : ""} uses
                        {c.expiresAt
                          ? ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(c.id, c.code)}
                      disabled={deleteId === c.id}
                      className="ml-4 text-xs text-gray-500 hover:text-red-400 transition flex-shrink-0"
                    >
                      {deleteId === c.id ? "..." : "Deactivate"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
