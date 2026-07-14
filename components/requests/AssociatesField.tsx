import { useEffect, useRef, useState } from 'react';

export interface Associate {
  /** app_users id when picked from the directory; absent for non-RTG guests. */
  id?: string;
  name: string;
  email?: string;
}

interface DirUser {
  id: string;
  display_name: string | null;
  email: string;
  job_title?: string | null;
  source?: 'app_users' | 'azure_ad';
}

interface AssociatesFieldProps {
  value: Associate[];
  onChange: (next: Associate[]) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Accompanying-associates selector.
 *
 * Primarily a directory (Azure AD) picker — search-as-you-type against
 * `/api/users/search`. Directory picks carry an `id` (so the caller can add them
 * as request watchers). Names that aren't in the directory (external / non-RTG
 * guests) can be added as free text, with no `id`.
 */
export function AssociatesField({ value, onChange, disabled, label = 'Accompanying Associate(s)' }: AssociatesFieldProps) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<DirUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = new Set(value.map((a) => a.id).filter(Boolean));

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      setSource(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const resp = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data = resp.ok ? await resp.json() : { users: [], source: null };
        setResults((data.users || []).filter((u: DirUser) => !selectedIds.has(u.id)));
        setSource(data.source || null);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const addDirectory = (u: DirUser) => {
    onChange([...value, { id: u.id, name: u.display_name || u.email, email: u.email }]);
    setTerm('');
    setResults([]);
  };

  const addFreeText = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange([...value, { name: trimmed }]);
    setTerm('');
    setResults([]);
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  // Whether the typed term already exactly matches a selected free-text name.
  const termMatchesSelected = value.some((a) => a.name.toLowerCase() === term.trim().toLowerCase());

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">{label}</label>
      <p className="text-xs text-gray-500 mb-2">
        Search the staff directory to add colleagues — they&apos;ll automatically be added as watchers of this
        request. You can also type a name and add it as a non-RTG guest.
      </p>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((a, idx) => (
            <span
              key={`${a.id || 'ext'}-${idx}`}
              className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-sm ${
                a.id ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              {a.id && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
              {a.name}
              {!a.id && <span className="text-[10px] uppercase text-gray-400">guest</span>}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="ml-0.5 w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-black/10"
                  aria-label={`Remove ${a.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="relative">
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds the typed text as a non-RTG guest (when it isn't
              // clearly a directory match the user is about to click).
              if (e.key === 'Enter') {
                e.preventDefault();
                if (results.length === 0) addFreeText(term);
              }
            }}
            placeholder="Search the directory, or type a non-RTG guest name…"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
          />
          {term.trim().length >= 1 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {loading && <div className="px-3 py-2 text-xs text-gray-400">Searching the directory…</div>}
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => addDirectory(u)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                >
                  <span className="font-medium text-gray-900">{u.display_name || 'Unnamed'}</span>
                  {u.job_title ? <span className="text-gray-500"> — {u.job_title}</span> : ''}
                  <span className="block text-xs text-gray-400">{u.email}</span>
                </button>
              ))}
              {/* Always offer the free-text (non-RTG) option. */}
              {term.trim().length >= 2 && !termMatchesSelected && (
                <button
                  type="button"
                  onClick={() => addFreeText(term)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-t border-gray-100"
                >
                  Add &ldquo;<span className="font-medium">{term.trim()}</span>&rdquo; as a non-RTG guest
                </button>
              )}
              {!loading && results.length === 0 && term.trim().length < 2 && (
                <div className="px-3 py-2 text-xs text-gray-400">Keep typing to search…</div>
              )}
            </div>
          )}
        </div>
      )}
      {source === 'app_users' && (
        <p className="text-[11px] text-gray-400 mt-1">
          Directory search is using the local user list. Live Azure AD search activates when configured.
        </p>
      )}
    </div>
  );
}
