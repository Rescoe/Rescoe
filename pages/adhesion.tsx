import { Default } from 'components/layouts/Default';
import { Adhesion } from 'components/containers/home';
import type { NextPage } from 'next';

const AdhesionPage: NextPage = () => {
  return (
    <Default pageName="Adhésion">
      <Adhesion />
    </Default>
  );
};

export default AdhesionPage;
