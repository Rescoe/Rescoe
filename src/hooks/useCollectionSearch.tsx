import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export interface Collection {
  id: string;
  name: string;
  imageUrl: string;
  mintContractAddress: string;
  isFeatured: boolean;
  creator?: string;       // facultatif
  collectionType?: string; // facultatif
}

export const useCollectionSearch = (allCollections: Collection[]) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Collection[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Fonction pour filtrer les collections
  const handleSearch = (term: string) => {
    const results = allCollections.filter((collection) =>
      (collection.name || '').toLowerCase().includes(term.toLowerCase()) ||
      (collection.creator || '').toLowerCase().includes(term.toLowerCase()) ||
      (collection.collectionType || '').toLowerCase().includes(term.toLowerCase()) ||
      (collection.id || '').toLowerCase().includes(term.toLowerCase())
    );

    setSearchResults(results);
    setShowSearchResults(true);
  };

  // Soumettre le formulaire
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchTerm) return;

    router.push(`?search=${searchTerm}`, undefined, { shallow: true });
    handleSearch(searchTerm);
  };

  // Effet pour récupérer le terme de recherche depuis l'URL
  useEffect(() => {
    if (!router.isReady) return;

    const { search } = router.query;
    if (typeof search === 'string' && search.trim() !== '') {
      setSearchTerm(search);
      handleSearch(search);
    }
  }, [router.isReady, router.query, allCollections]);

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    showSearchResults,
    handleSearch,
    handleSearchSubmit,
  };
};
