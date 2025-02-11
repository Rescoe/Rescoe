import { Default } from 'components/layouts/Default';
import { Adherent } from 'components/containers/association/Adherents';

const AdherentsPage = () => {
  return (
    <Default pageName="Liste d'adhérents">
      <Adherent />
    </Default>
  );
};

export default AdherentsPage;
