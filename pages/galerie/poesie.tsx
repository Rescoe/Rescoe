/**
 * /galerie/poesie — Galerie des collections de poésie (ISR)
 *
 * ISR : liste des collections pré-construite, régénérée toutes les heures.
 * Les poèmes d'une collection sont toujours chargés à la demande côté client.
 */

import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { Default } from 'components/layouts/Default';
import { Recueil } from 'components/containers/galerie/poemes';
import { fetchGalerieCollections, type GalerieCollection } from '@/lib/collectionsData';

export const getStaticProps: GetStaticProps<{
  initialCollections: GalerieCollection[];
}> = async () => {
  try {
    const all = await fetchGalerieCollections();
    const poesieCollections = all
      .filter((c) => c.collectionType === 'Poesie')
      .sort((a, b) => Number(b.id) - Number(a.id)); // plus récentes d'abord

    return {
      props: { initialCollections: poesieCollections },
      revalidate: 3600,
    };
  } catch (e) {
    console.error('[getStaticProps /galerie/poesie]', e);
    return {
      props: { initialCollections: [] },
      revalidate: 60,
    };
  }
};

const Poemes = ({
  initialCollections,
}: InferGetStaticPropsType<typeof getStaticProps>) => {
  return (
    <Default pageName="Recueil de poèmes">
      <Recueil initialCollections={initialCollections} />
    </Default>
  );
};

export default Poemes;
