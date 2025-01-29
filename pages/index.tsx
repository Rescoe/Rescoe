import { Default } from 'components/layouts/Default';
import { Home } from 'components/containers/home';
import type { NextPage } from 'next';

const HomePage: NextPage = () => {
  return (
    <Default pageName="Accueil">
      <Home />
    </Default>
  );
};

export default HomePage;
