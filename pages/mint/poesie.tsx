import { Default } from 'components/layouts/Default';
import { Poesie } from 'components/containers/mint/poesie';
import type { NextPage } from 'next';


const PoesiePage : NextPage = () => {
  return (
    <Default pageName="Poesie">
      <Poesie />
    </Default>
  );
};

export default PoesiePage;
