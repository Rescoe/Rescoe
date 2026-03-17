import { Default } from 'components/layouts/Default';
import { CGUPage } from 'components/containers/home';
import type { NextPage } from 'next';

const CGU: NextPage = () => {
  return (
    <Default pageName="cgu">
      <CGUPage />
    </Default>
  );
};

export default CGU;
