/**
 * /galerie/art — Galerie des œuvres d'art (ISR)
 *
 * ISR (Incremental Static Regeneration) :
 *   - La liste des collections est pré-construite au build et régénérée toutes les heures
 *   - Les utilisateurs voient la page instantanément (HTML statique depuis CDN)
 *   - 0 appel Moralis à l'affichage (contre 20-30 avant)
 *   - Le contenu d'une collection (NFTs) est chargé à la demande côté client
 *
 * Invalidation on-demand :
 *   - POST /api/revalidate → appelle res.revalidate('/galerie/art')
 *   - Déclenché par webhook Moralis Streams sur événement mint/transfer
 */

import React from 'react';
import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { Default } from 'components/layouts/Default';
import { UniqueArtGalerie } from 'components/containers/galerie/art';
import { fetchGalerieCollections, type GalerieCollection } from '@/lib/collectionsData';

export const getStaticProps: GetStaticProps<{
  initialCollections: GalerieCollection[];
}> = async () => {
  try {
    const all = await fetchGalerieCollections();
    const artCollections = all
      .filter((c) => c.collectionType === 'Art')
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));

    return {
      props: { initialCollections: artCollections },
      // Régénération automatique toutes les heures
      // Complétée par invalidation on-demand depuis /api/revalidate
      revalidate: 3600,
    };
  } catch (e) {
    console.error('[getStaticProps /galerie/art]', e);
    return {
      props: { initialCollections: [] },
      revalidate: 60, // retry plus tôt en cas d'erreur
    };
  }
};

const ERC721ART = ({
  initialCollections,
}: InferGetStaticPropsType<typeof getStaticProps>) => {
  return (
    <Default pageName="1/1 Collection">
      <UniqueArtGalerie initialCollections={initialCollections} />
    </Default>
  );
};

export default ERC721ART;
