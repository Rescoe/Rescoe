import { Default } from '../src/components/layouts/Default';
import { Home } from '../src/components/containers/home';
import type { NextPage } from 'next';

const HomePage: NextPage = () => {
  return (
    <Default pageName="Accueil">
      <Home />
    </Default>
  );
};

export default HomePage;
