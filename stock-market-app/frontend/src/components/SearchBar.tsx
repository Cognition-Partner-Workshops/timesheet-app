import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchStocks } from '../services/api';
import type { SearchResult } from '../types';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchStocks(query);
        setResults(data);
        setIsOpen(true);
      } catch {
        setResults([]);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symbol: string) => {
    setQuery('');
    setIsOpen(false);
    navigate(`/stocks/${symbol}`);
  };

  return (
    <div className="search-bar" ref={wrapperRef}>
      <input
        type="text"
        placeholder="Search ticker or company..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search-input"
      />
      {isOpen && results.length > 0 && (
        <div className="search-dropdown">
          {results.map((result) => (
            <button
              key={result.symbol}
              className="search-result"
              onClick={() => handleSelect(result.symbol)}
            >
              <span className="search-symbol">{result.symbol}</span>
              <span className="search-company">{result.company_name}</span>
              <span className={`search-change ${result.day_change_pct >= 0 ? 'positive' : 'negative'}`}>
                {result.day_change_pct >= 0 ? '+' : ''}{Number(result.day_change_pct).toFixed(2)}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
